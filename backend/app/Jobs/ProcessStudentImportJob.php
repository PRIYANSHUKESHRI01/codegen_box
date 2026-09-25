<?php

namespace App\Jobs;

use App\Models\StudentImport;
use App\Models\User;
use Illuminate\Bus\Batch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Parses one uploaded CSV and creates/updates the students it describes.
 * Runs in the background because bcrypt-hashing a password for ~1,900 new
 * accounts is CPU-bound work (bcrypt is deliberately slow) that would blow
 * past any reasonable HTTP request timeout if done inline in the upload
 * request — the controller only ever stores the file and dispatches this.
 *
 * Deliberately NOT retried automatically ($tries = 1): a partially-applied
 * re-run of someone else's half-finished import is far more confusing than
 * a clearly failed one a human can inspect and re-upload.
 */
class ProcessStudentImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 1800; // 30 minutes - generous headroom for a very large roster

    public function __construct(public int $studentImportId) {}

    public function handle(): void
    {
        $import = StudentImport::findOrFail($this->studentImportId);
        $import->update(['status' => StudentImport::STATUS_PROCESSING]);

        try {
            $this->process($import);
        } catch (Throwable $e) {
            $import->update([
                'status' => StudentImport::STATUS_FAILED,
                'errors' => [['row' => null, 'email' => null, 'error' => 'Import failed: '.$e->getMessage()]],
                'completed_at' => now(),
            ]);
            throw $e;
        }
    }

    private function process(StudentImport $import): void
    {
        $path = Storage::disk('local')->path("student-imports/{$import->id}.csv");
        $handle = fopen($path, 'r');

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), fgetcsv($handle) ?: []);

        if (! in_array('name', $header, true) || ! in_array('email', $header, true)) {
            fclose($handle);
            $import->update([
                'status' => StudentImport::STATUS_FAILED,
                'errors' => [['row' => 1, 'email' => null, 'error' => 'CSV must have "name" and "email" columns.']],
                'completed_at' => now(),
            ]);

            return;
        }

        $errors = [];
        $emailJobs = [];
        $successCount = 0;
        $rowNumber = 1;

        while (($row = fgetcsv($handle)) !== false) {
            $rowNumber++;

            if (count(array_filter($row, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue; // skip blank rows
            }

            $data = array_combine($header, array_pad($row, count($header), null));
            $name = trim((string) ($data['name'] ?? ''));
            $email = trim((string) ($data['email'] ?? ''));

            if ($name === '' || $email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = ['row' => $rowNumber, 'email' => $email ?: null, 'error' => 'Missing or invalid name/email.'];

                continue;
            }

            $cgpaRaw = trim((string) ($data['cgpa'] ?? ''));
            $cgpa = ($cgpaRaw !== '' && is_numeric($cgpaRaw)) ? round((float) $cgpaRaw, 2) : null;

            if ($cgpa !== null && ($cgpa < 0 || $cgpa > 10)) {
                $errors[] = ['row' => $rowNumber, 'email' => $email, 'error' => 'CGPA must be between 0 and 10.'];

                continue;
            }

            $backlogsRaw = trim((string) ($data['backlogs'] ?? ''));
            $backlogs = ($backlogsRaw !== '' && is_numeric($backlogsRaw)) ? (int) $backlogsRaw : null;

            $existing = User::where('email', $email)->first();

            if ($existing && $existing->college_id && $existing->college_id !== $import->college_id) {
                $errors[] = ['row' => $rowNumber, 'email' => $email, 'error' => 'This email is already registered to a different college.'];

                continue;
            }

            $academicFields = [
                'roll_number' => trim((string) ($data['roll_number'] ?? '')) ?: null,
                'branch' => trim((string) ($data['branch'] ?? '')) ?: null,
                'section' => trim((string) ($data['section'] ?? '')) ?: null,
                'cgpa' => $cgpa,
                'backlogs' => $backlogs,
                'phone' => trim((string) ($data['phone'] ?? '')) ?: null,
                'parent_phone' => trim((string) ($data['parent_phone'] ?? '')) ?: null,
            ];

            if ($existing) {
                // Idempotent re-upload: refresh their academic data, but never
                // touch their password or re-send the welcome email.
                $existing->update(array_filter([
                    'name' => $name,
                    'college_id' => $import->college_id,
                    ...array_filter($academicFields, fn ($v) => $v !== null),
                ], fn ($v) => $v !== null));
                $successCount++;
            } else {
                $plainPassword = Str::password(12);

                $user = User::create([
                    'name' => $name,
                    'email' => $email,
                    'handle' => Str::slug($name).'-'.Str::lower(Str::random(4)),
                    'password' => Hash::make($plainPassword),
                    'must_change_password' => true,
                    'role' => User::ROLE_USER,
                    'college_id' => $import->college_id,
                    ...$academicFields,
                ]);

                $emailJobs[] = new SendAccountCredentialsEmail($user->id, $plainPassword);
                $successCount++;
            }

            if ($rowNumber % 50 === 0) {
                $import->update(['processed_rows' => $rowNumber - 1]);
            }
        }

        fclose($handle);

        $import->update([
            'total_rows' => $rowNumber - 1,
            'processed_rows' => $rowNumber - 1,
            'successful_rows' => $successCount,
            'failed_rows' => count($errors),
            'errors' => $errors,
        ]);

        if (empty($emailJobs)) {
            $import->update([
                'status' => count($errors) > 0 ? StudentImport::STATUS_COMPLETED_WITH_ERRORS : StudentImport::STATUS_COMPLETED,
                'completed_at' => now(),
            ]);

            return;
        }

        $hadRowErrors = count($errors) > 0;

        $batch = Bus::batch($emailJobs)
            ->name("student-import-{$import->id}-welcome-emails")
            ->finally(function (Batch $batch) use ($import, $hadRowErrors) {
                $import->update([
                    'status' => ($hadRowErrors || $batch->failedJobs > 0)
                        ? StudentImport::STATUS_COMPLETED_WITH_ERRORS
                        : StudentImport::STATUS_COMPLETED,
                    'completed_at' => now(),
                ]);
            })
            ->dispatch();

        $import->update(['email_batch_id' => $batch->id]);
    }
}
