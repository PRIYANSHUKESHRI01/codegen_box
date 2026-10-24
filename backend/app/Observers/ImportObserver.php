<?php

namespace App\Observers;

use App\Enums\NotificationType;
use App\Models\CandidateImport;
use App\Models\StudentImport;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Model;

/**
 * A bulk upload runs in the background (a queue worker, or the cron), so the person who uploaded it isn't
 * watching when it ends. Tell them — how many were added and how many were skipped, and where to look. Shared by the
 * college student import and the hiring partner's candidate import: same statuses, same columns.
 */
class ImportObserver
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function updated(Model $import): void
    {
        if (! $import->wasChanged('status') || ! in_array($import->status, ['completed', 'completed_with_errors', 'failed'], true)) {
            return;
        }

        $who = $import instanceof CandidateImport ? 'candidate' : 'student';
        $url = $import instanceof CandidateImport ? '/admin/company/candidates' : '/admin/students';
        $added = (int) $import->successful_rows;
        $skipped = (int) $import->failed_rows;
        $failed = $import->status === 'failed';

        $this->notifications->notify($import->uploaded_by, NotificationType::ImportCompleted, $failed ? "Your {$who} import failed" : "Your {$who} import is finished", $failed
            ? 'The file could not be processed. Check that it is a valid CSV with the required columns and upload it again.'
            : "{$added} {$who}".($added === 1 ? '' : 's').' added'.($skipped > 0 ? ", {$skipped} skipped — open the import to see why" : '').'.', [
                'url' => $url,
                'severity' => $failed ? 'warning' : ($skipped > 0 ? 'info' : 'success'),
                'data' => ['import_id' => $import->id, 'kind' => $who],
                'group_key' => "import.done:{$who}:{$import->id}",
            ]);
    }
}
