<?php

namespace App\Jobs;

use App\Models\CandidateImport;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Services\CandidateImportService;
use Illuminate\Bus\Batch;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Parses one uploaded CSV of candidates and gets each one into this job
 * opening's pipeline — mirrors ProcessStudentImportJob's shape (background,
 * not retried, batched welcome/invite emails) but with a materially
 * different per-row branch: no academic fields (name/email/phone only), and
 * an existing account is never modified beyond adding it to the pipeline —
 * see CandidateImportService::findOrCreateCandidate().
 */
class ProcessCandidateImportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public int $tries = 1;

    public int $timeout = 1800;

    public function __construct(public int $candidateImportId) {}

    public function handle(CandidateImportService $service): void
    {
        $import = CandidateImport::findOrFail($this->candidateImportId);
        $import->update(['status' => CandidateImport::STATUS_PROCESSING]);

        try {
            $this->process($import, $service);
        } catch (Throwable $e) {
            $import->update([
                'status' => CandidateImport::STATUS_FAILED,
                'errors' => [['row' => null, 'email' => null, 'error' => 'Import failed: '.$e->getMessage()]],
                'completed_at' => now(),
            ]);
            throw $e;
        }
    }

    private function process(CandidateImport $import, CandidateImportService $service): void
    {
        $drive = PlacementDrive::findOrFail($import->placement_drive_id);

        $path = Storage::disk('local')->path("candidate-imports/{$import->id}.csv");
        $handle = fopen($path, 'r');

        $header = array_map(fn ($h) => strtolower(trim((string) $h)), fgetcsv($handle) ?: []);

        if (! in_array('name', $header, true) || ! in_array('email', $header, true)) {
            fclose($handle);
            $import->update([
                'status' => CandidateImport::STATUS_FAILED,
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
                continue;
            }

            $data = array_combine($header, array_pad($row, count($header), null));
            $name = trim((string) ($data['name'] ?? ''));
            $email = trim((string) ($data['email'] ?? ''));
            $phone = trim((string) ($data['phone'] ?? '')) ?: null;

            if ($name === '' || $email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = ['row' => $rowNumber, 'email' => $email ?: null, 'error' => 'Missing or invalid name/email.'];

                continue;
            }

            $result = $service->findOrCreateCandidate($name, $email, $phone, $drive->company_id);
            $candidate = $result['user'];

            DriveApplication::firstOrCreate(
                ['placement_drive_id' => $drive->id, 'user_id' => $candidate->id],
                [
                    'college_id' => $candidate->college_id,
                    'stage' => DriveApplication::STAGE_REGISTERED,
                    'stage_updated_at' => now(),
                ]
            );

            $emailJobs[] = $result['created']
                ? new SendAccountCredentialsEmail($candidate->id, $result['plainPassword'])
                : new SendCandidateInviteEmail($candidate->id, $drive->company_id, $drive->role_title);

            $successCount++;

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
                'status' => count($errors) > 0 ? CandidateImport::STATUS_COMPLETED_WITH_ERRORS : CandidateImport::STATUS_COMPLETED,
                'completed_at' => now(),
            ]);

            return;
        }

        $hadRowErrors = count($errors) > 0;

        $batch = Bus::batch($emailJobs)
            ->name("candidate-import-{$import->id}-emails")
            ->finally(function (Batch $batch) use ($import, $hadRowErrors) {
                $import->update([
                    'status' => ($hadRowErrors || $batch->failedJobs > 0)
                        ? CandidateImport::STATUS_COMPLETED_WITH_ERRORS
                        : CandidateImport::STATUS_COMPLETED,
                    'completed_at' => now(),
                ]);
            })
            ->dispatch();

        $import->update(['email_batch_id' => $batch->id]);
    }
}
