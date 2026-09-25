<?php

namespace App\Services;

use App\Jobs\ProcessStudentImportJob;
use App\Models\College;
use App\Models\StudentImport;
use App\Models\User;
use Illuminate\Http\UploadedFile;

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
