<?php

namespace App\Services\Core;

use App\Models\CoreTestSession;
use App\Services\Vault\VaultRefreshService;
use Illuminate\Support\Facades\DB;

/**
 * The one place a Core test attempt is graded — shared by the student submitting, the deadline sweeper,
 * proctoring ending the attempt and the regrader after a key fix, so they can never disagree about a score.
 *
 * Grading reads the question's CURRENT key (a "fix key" is applied to everyone), applies each question's own
 * marks and negative marking, and never trusts anything the client computed. Idempotent: finalising an
 * attempt that already ended is a no-op.
 */
class CoreTestGradingService
{
    /**
     * `$terminatedByProctoring` attempts still get a real score (kept for transparency, built from whatever was
     * autosaved) but can never be marked passed.
     */
    public function finalize(CoreTestSession $session, bool $terminatedByProctoring = false): CoreTestSession
    {
        $justFinalized = false;

        $finalized = DB::transaction(function () use ($session, $terminatedByProctoring, &$justFinalized) {
            /** @var CoreTestSession $locked */
            $locked = CoreTestSession::whereKey($session->id)->lockForUpdate()->first();

            if ($locked->isCompleted()) {
                return $locked;
            }

            $justFinalized = true;
            $locked->loadMissing('test');
            $this->score($locked);
            $locked->forceFill([
                'status' => CoreTestSession::STATUS_COMPLETED,
                'completed_at' => now(),
                'terminated_by_proctoring' => $terminatedByProctoring,
            ]);
            $locked->passed = ! $terminatedByProctoring && $locked->score_percent >= $locked->test->pass_percentage;
            $locked->save();

            return $locked->fresh();
        });

        // A finished test is part of readiness (and so maybe the Vault) — re-score now, not at the next refresh.
        if ($justFinalized) {
            app(VaultRefreshService::class)->refreshQuietly([$finalized->user_id]);
        }

        return $finalized;
    }

    /**
     * Re-scores an attempt that has ALREADY ended (after a key fix): same arithmetic, `passed` re-judged
     * unless proctoring ended it. Not for in-progress attempts — those are graded when they finish.
     */
    public function regrade(CoreTestSession $session): CoreTestSession
    {
        return DB::transaction(function () use ($session) {
            /** @var CoreTestSession $locked */
            $locked = CoreTestSession::whereKey($session->id)->lockForUpdate()->first();

            if (! $locked->isCompleted()) {
                return $locked;
            }

            $locked->loadMissing('test');
            $this->score($locked);
            $locked->passed = ! $locked->terminated_by_proctoring && $locked->score_percent >= $locked->test->pass_percentage;
            $locked->save();

            return $locked->fresh();
        });
    }

    /** Writes each response's verdict and the session's totals and per-subject breakdown (does not change status). */
    private function score(CoreTestSession $session): void
    {
        $responses = $session->responses()->with('question.subject:id,name')->get();

        $score = 0.0;
        $max = 0.0;
        $correct = $wrong = $skipped = 0;
        $bySubject = [];

        foreach ($responses as $response) {
            $question = $response->question;
            $verdict = CoreGrader::evaluate($question, $response->selected, $response->numeric_value);

            $response->forceFill([
                'is_correct' => $verdict['answered'] ? $verdict['correct'] : null,
                'marks_awarded' => $verdict['answered'] ? $verdict['marks'] : 0.0,
            ])->save();

            $subjectId = $question->subject_id;
            $bySubject[$subjectId] ??= ['subject_id' => $subjectId, 'subject' => $question->subject?->name ?? '', 'correct' => 0, 'wrong' => 0, 'skipped' => 0, 'score' => 0.0, 'max' => 0.0];
            $bySubject[$subjectId]['max'] += (float) $question->marks;
            $max += (float) $question->marks;

            if (! $verdict['answered']) {
                $skipped++;
                $bySubject[$subjectId]['skipped']++;

                continue;
            }

            $score += $verdict['marks'];
            $bySubject[$subjectId]['score'] += $verdict['marks'];

            if ($verdict['correct']) {
                $correct++;
                $bySubject[$subjectId]['correct']++;
            } else {
                $wrong++;
                $bySubject[$subjectId]['wrong']++;
            }
        }

        foreach ($bySubject as &$row) {
            $row['score'] = round($row['score'], 2);
            $row['max'] = round($row['max'], 2);
            $row['percent'] = $row['max'] > 0 ? round(max(0, $row['score']) / $row['max'] * 100, 1) : 0.0;
        }
        unset($row);

        $session->forceFill([
            'score' => round($score, 2),
            'max_score' => round($max, 2),
            // A heavily penalised paper can total below zero; the percentage never does.
            'score_percent' => $max > 0 ? round(max(0, $score) / $max * 100, 2) : 0,
            'correct_count' => $correct,
            'wrong_count' => $wrong,
            'skipped_count' => $skipped,
            'subject_breakdown' => array_values($bySubject),
        ]);
    }
}
