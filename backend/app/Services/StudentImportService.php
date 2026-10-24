<?php

namespace App\Services;

use App\Jobs\ProcessStudentImportJob;
use App\Models\College;
use App\Models\StudentImport;
use App\Models\User;
use App\Support\StudentImportSheets;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * The one place a bulk student-roster upload is actually handled — shared
 * by both self-serve TPO imports and Mellow-staff-assisted imports (for a
 * college that would rather email their spreadsheet to us than upload it
 * themselves), so the two entry points can never drift into two different
 * implementations of the same operation.
 */
class StudentImportService
{
    public function import(College $college, UploadedFile $file, ?User $uploadedBy, ?string $department = null): StudentImport
    {
        // A college with no active subscription at all (never had one, or
        // it expired/was canceled) must be blocked outright here — without
        // this, $college->studentLimit() below resolves to null exactly
        // the same way it would for a genuinely unlimited active plan, and
        // the `$limit !== null` check further down would wrongly let an
        // expired college import without limit.
        if (! $college->hasActiveSubscription()) {
            throw ValidationException::withMessages([
                'file' => ["{$college->name}'s subscription has expired. Contact Mellow Vault to renew before importing more students."],
            ]);
        }

        // Fast, upfront rejection when the college is already at (or past) its
        // plan's seat cap — no point queuing a job that will just fail every
        // row. A batch that crosses the cap mid-way (college has room for
        // some but not all of this file) is instead handled row-by-row in
        // ProcessStudentImportJob, which is where "the 501st student" fails.
        $limit = $college->studentLimit();

        if ($limit !== null && $college->studentCount() >= $limit) {
            $planName = $college->activePlan()?->name ?? 'current';

            throw ValidationException::withMessages([
                'file' => ["{$college->name} is already at its {$planName} plan's limit of {$limit} students. Upgrade your plan to import more."],
            ]);
        }

        // An Excel roster is converted to the CSV the import job has always read, before anything is
        // created, so an unreadable workbook is refused up front instead of failing in the queue.
        $csv = null;

        if (StudentImportSheets::isSpreadsheet($file)) {
            try {
                $csv = StudentImportSheets::toCsv($file);
            } catch (\Throwable) {
                throw ValidationException::withMessages([
                    'file' => ["We couldn't read that spreadsheet. Use the template (or save the first sheet as .xlsx or .csv) and try again."],
                ]);
            }
        }

        $studentImport = StudentImport::create([
            'college_id' => $college->id,
            // The department the whole file is for (null only for an import queued by code that predates departments).
            'department_code' => $department,
            'uploaded_by' => $uploadedBy?->id,
            'original_filename' => $file->getClientOriginalName(),
            'status' => StudentImport::STATUS_PENDING,
        ]);

        $csv !== null
            ? Storage::disk('local')->put("student-imports/{$studentImport->id}.csv", $csv)
            : $file->storeAs('student-imports', "{$studentImport->id}.csv", 'local');

        ProcessStudentImportJob::dispatch($studentImport->id);

        return $studentImport;
    }
}
