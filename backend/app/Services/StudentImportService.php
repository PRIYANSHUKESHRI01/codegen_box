<?php

namespace App\Services;

use App\Jobs\ProcessStudentImportJob;
use App\Models\College;
use App\Models\StudentImport;
use App\Models\User;
use Illuminate\Http\UploadedFile;
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
    public function import(College $college, UploadedFile $file, ?User $uploadedBy): StudentImport
    {
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

        $studentImport = StudentImport::create([
            'college_id' => $college->id,
            'uploaded_by' => $uploadedBy?->id,
            'original_filename' => $file->getClientOriginalName(),
            'status' => StudentImport::STATUS_PENDING,
        ]);

        $file->storeAs('student-imports', "{$studentImport->id}.csv", 'local');

        ProcessStudentImportJob::dispatch($studentImport->id);

        return $studentImport;
    }
}
