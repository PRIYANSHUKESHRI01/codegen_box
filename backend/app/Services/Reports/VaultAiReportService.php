<?php

namespace App\Services\Reports;

use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Models\VaultAiResult;
use App\Models\VaultInterviewQualification;
use App\Services\CuratedInterviewSetService;
use App\Services\Vault\CuratedCatalog;
use App\Services\Vault\VaultAiResultService;
use App\Support\ReportFormat;
use Illuminate\Support\Str;

/**
 * The Vault AI Interview report: one PDF per student and stack, kept in the report archive. It states the FINAL AVERAGE of the three sets
 * of the student's best series, every attempt that led there, and — for the best series — each set with every question, the answer and
 * the AI's feedback.
 *
 * Replacing, not accumulating: a student who sits again gets a new report that supersedes the old file (the ledger row, not the file, is
 * the history), so a college never opens a stale one by mistake. It carries no internal notes, so the same file is for the student,
 * their TPO, their coordinator and platform staff (see ReportAccess).
 */
class VaultAiReportService
{
    public function __construct(
        private readonly PdfRenderer $pdf,
        private readonly ReportArchive $archive,
        private readonly MockInterviewReportService $sittings,
        private readonly CuratedInterviewSetService $sets,
        private readonly CuratedCatalog $catalog,
    ) {}

    /**
     * Renders the result's report, stores it and points the result at it; the previous file is removed.
     */
    public function generate(VaultAiResult $result, ?User $actor = null): GeneratedReport
    {
        $result->loadMissing('user.college');
        $student = $result->user;

        $id = (string) Str::ulid();
        $label = 'VA-'.strtoupper(substr($id, -10));
        $data = $this->compose($result);

        $rendered = $this->pdf->render('reports.vault-ai', ['data' => $data], "Report {$label}  |  Confidential: personal data of ".Str::limit($student->name, 28));

        $report = $this->archive->store($rendered['binary'], [
            'public_id' => $id,
            'kind' => GeneratedReport::KIND_VAULT_AI,
            'title' => $student->name.' — Vault AI Interview report ('.($result->stack_name ?? $result->stack_key).')',
            'filename' => 'AptRun-Vault-AI-Interview-'.ReportFormat::slug($result->stack_name ?? $result->stack_key).'-'.ReportFormat::slug($student->name).'-'.now()->format('Ymd').'.pdf',
            'college_id' => $student->college_id,
            'subject_user_id' => $student->id,
            'audience' => GeneratedReport::AUDIENCE_STUDENT,
            'pages' => $rendered['pages'],
            'params' => ['label' => $label, 'stack_key' => $result->stack_key, 'best_series' => $result->best_series],
            'summary' => [
                'stack' => $result->stack_name,
                'final_average' => $result->best_average,
                'set_scores' => $result->best_scores,
                'attempts' => $result->attempts,
                'qualified' => $result->ever_qualified,
            ],
        ], $actor);

        $previous = $result->report_id;
        $result->forceFill(['report_id' => $report->public_id, 'report_generated_at' => now()])->save();

        if ($previous !== null && $previous !== $report->public_id) {
            GeneratedReport::where('public_id', $previous)->get()->each(fn (GeneratedReport $old) => $this->archive->forget($old));
        }

        return $report;
    }

    /**
     * What the report shows.
     *
     * @return array<string, mixed>
     */
    public function compose(VaultAiResult $result): array
    {
        $student = $result->user;
        $college = $student->college;
        $stack = $this->catalog->stack($result->stack_key);
        $roleTitle = $stack['role']['title'] ?? null;

        $history = collect($result->history ?? []);
        $bestIndex = $history->keys()->first(fn ($i) => (float) $history[$i]['average'] === (float) $history->max('average'));
        $bestEntry = $bestIndex !== null ? $history[$bestIndex] : null;

        $sets = [];

        if ($bestEntry !== null) {
            foreach ([1, 2, 3] as $n) {
                $score = $bestEntry['scores'][(string) $n] ?? null;
                $meta = $this->sets->findSetBySeries($result->stack_key, (int) $bestEntry['series'], $n)['set'] ?? [];

                $sets[] = [
                    'number' => $n,
                    // The catalogue names a set "Set 1: Core Foundations …"; the report already says which set it is.
                    'title' => preg_replace('/^\s*Set\s*\d+\s*[:\-–]\s*/iu', '', (string) ($meta['title'] ?? '')) ?: "Set {$n}",
                    'score' => $score,
                    'sitting' => $score === null ? null : $this->sitting($result, (int) $bestEntry['series'], $n, (int) $score),
                ];
            }
        }

        return [
            'generated_at' => now()->toIso8601String(),
            'student' => [
                'name' => $student->name,
                'email' => $student->email,
                'roll_number' => $student->roll_number,
                'branch' => $student->branch,
                'section' => $student->section,
            ],
            'college' => ['name' => $college?->name, 'city' => $college?->city],
            'stack' => ['name' => $result->stack_name ?? $result->stack_key, 'role' => $roleTitle],
            'pass_mark' => VaultAiResultService::PASS,
            'final' => [
                'average' => $result->best_average,
                'series' => $result->best_series,
                'at' => $result->best_at?->toIso8601String(),
                'passed' => $result->best_average !== null && $result->best_average >= VaultAiResultService::PASS,
                'tier' => $this->tier($result->best_average),
                'by_admin' => ($bestEntry['source'] ?? 'interview') === 'admin',
            ],
            'status' => $result->status,
            'attempts' => $result->attempts,
            'history' => $history->map(fn (array $e, int $i) => $e + ['is_best' => $i === $bestIndex])->values()->all(),
            'sets' => $sets,
        ];
    }

    /** The word under the score. Tied to the 60% pass mark, so a qualifying average is never called "developing". */
    private function tier(?float $average): string
    {
        return match (true) {
            $average === null => 'Not scored',
            $average >= 85 => 'Excellent',
            $average >= 70 => 'Strong',
            $average >= VaultAiResultService::PASS => 'Qualifying',
            $average >= 40 => 'Developing',
            default => 'Needs work',
        };
    }

    /**
     * The student's actual sitting of one set of the best series: the interview whose finished score is the one recorded. Null when
     * it cannot be found (an admin granted the result, or the interview was deleted) — the report then shows the score alone.
     *
     * @return array<string, mixed>|null
     */
    private function sitting(VaultAiResult $result, int $series, int $set, int $score): ?array
    {
        $qual = VaultInterviewQualification::where('user_id', $result->user_id)->where('stack_key', $result->stack_key)->first();

        if ($qual === null) {
            return null;
        }

        $interviews = Interview::where('created_by', $result->user_id)
            ->where('practice_config->qualification_id', $qual->id)
            ->where('practice_config->series_number', $series)
            ->where('practice_config->set_number', $set)
            ->orderByDesc('id')
            ->get();

        foreach ($interviews as $interview) {
            $session = InterviewSession::where('interview_id', $interview->id)->where('user_id', $result->user_id)->first();

            if ($session !== null && $session->status === InterviewSession::STATUS_COMPLETED && $session->composite_score_percent !== null
                && (int) round($session->composite_score_percent) === $score) {
                return $this->sittings->sitting($session);
            }
        }

        return null;
    }
}
