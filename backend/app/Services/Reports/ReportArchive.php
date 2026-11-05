<?php

namespace App\Services\Reports;

use App\Models\GeneratedReport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The archive behind every "Download report" button. A finished PDF is written once to the private `local` disk, indexed in
 * `generated_reports`, and from then on served from there — so the file a TPO downloads in December is byte-for-byte the one
 * that was generated in October (the checksum is verified on every download).
 *
 * Files have no foreign key, so this class is also the only thing that deletes them: purge() before a delete that would
 * cascade the rows away, or forget() for a single report.
 */
class ReportArchive
{
    public const DISK = 'local';

    /**
     * Writes the PDF and its index row.
     *
     * @param  array<string, mixed>  $meta  kind, title, filename, college_id, subject_user_id, interview_id, interview_session_id,
     *                                      audience, params, summary, pages
     */
    public function store(string $binary, array $meta, ?User $actor): GeneratedReport
    {
        $id = (string) ($meta['public_id'] ?? Str::ulid());
        $folder = 'reports/'.($meta['college_id'] ?? 'platform').'/'.$meta['kind'];
        $path = "{$folder}/{$id}.pdf";

        Storage::disk(self::DISK)->put($path, $binary);

        try {
            return GeneratedReport::create([
                'public_id' => $id,
                'kind' => $meta['kind'],
                'title' => $meta['title'],
                'filename' => $meta['filename'],
                'college_id' => $meta['college_id'] ?? null,
                'subject_user_id' => $meta['subject_user_id'] ?? null,
                'interview_id' => $meta['interview_id'] ?? null,
                'interview_session_id' => $meta['interview_session_id'] ?? null,
                'generated_by' => $actor?->id,
                'generated_by_role' => $actor?->role,
                'audience' => $meta['audience'] ?? GeneratedReport::AUDIENCE_STAFF,
                'disk' => self::DISK,
                'path' => $path,
                'size_bytes' => strlen($binary),
                'sha256' => hash('sha256', $binary),
                'pages' => $meta['pages'] ?? null,
                'params' => $meta['params'] ?? null,
                'summary' => $meta['summary'] ?? null,
            ]);
        } catch (\Throwable $e) {
            // An orphan file with no row can never be served or cleaned up by anyone — don't leave one behind.
            Storage::disk(self::DISK)->delete($path);
            throw $e;
        }
    }

    /** Streams the stored file. 410 (not 500) when the file is gone or no longer matches its checksum, so the screen can offer "generate again". */
    public function download(GeneratedReport $report): StreamedResponse
    {
        $disk = Storage::disk($report->disk);

        abort_unless($disk->exists($report->path), 410, 'This report file is no longer available. Generate it again.');

        $binary = $disk->get($report->path);

        abort_unless($report->sha256 === null || hash_equals($report->sha256, hash('sha256', $binary)), 410, 'This report file failed its integrity check. Generate it again.');

        $report->forceFill(['downloads' => $report->downloads + 1, 'last_downloaded_at' => now()])->saveQuietly();

        return response()->streamDownload(function () use ($binary) {
            echo $binary;
        }, $report->filename, [
            'Content-Type' => 'application/pdf',
            'Content-Length' => (string) strlen($binary),
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** Deletes one report and its file. */
    public function forget(GeneratedReport $report): void
    {
        Storage::disk($report->disk)->delete($report->path);
        $report->delete();
    }

    /**
     * The files behind these reports, for the delete paths that cascade the rows away (UserPurgeService / CollegePurgeService
     * collect them first and delete them once the transaction has committed).
     *
     * @param  list<int>  $userIds
     * @return list<string>
     */
    public static function pathsForUsers(array $userIds): array
    {
        return DB::table('generated_reports')
            ->where(fn ($q) => $q->whereIn('subject_user_id', $userIds)->orWhereIn('generated_by', $userIds))
            ->where('disk', self::DISK)
            ->pluck('path')
            ->all();
    }

    /** @return list<string> */
    public static function pathsForCollege(int $collegeId): array
    {
        return DB::table('generated_reports')->where('college_id', $collegeId)->where('disk', self::DISK)->pluck('path')->all();
    }

    /**
     * A report list, newest first, scoped to a college (and optionally a student, a kind or an interview). Never returns another
     * college's reports: the caller passes its own college id, and the controllers 404 on a mismatch before they get here.
     *
     * @return \Illuminate\Database\Eloquent\Builder<GeneratedReport>
     */
    public function query(int $collegeId, Request $request)
    {
        $query = GeneratedReport::query()
            ->where('college_id', $collegeId)
            ->with(['subject:id,name,roll_number,section,branch', 'generator:id,name', 'interview:id,slug,title'])
            ->latest('id');

        if ($kind = $request->query('kind')) {
            $query->where('kind', $kind);
        }

        if ($student = $request->query('student_id')) {
            $query->where('subject_user_id', (int) $student);
        }

        if ($interview = $request->query('interview_id')) {
            $query->where('interview_id', (int) $interview);
        }

        if ($search = trim((string) $request->query('q'))) {
            $like = '%'.str_replace(['%', '_'], ['\\%', '\\_'], $search).'%';
            $query->where(fn ($q) => $q->where('title', 'like', $like)
                ->orWhereHas('subject', fn ($s) => $s->where('name', 'like', $like)->orWhere('roll_number', 'like', $like)));
        }

        return $query;
    }
}
