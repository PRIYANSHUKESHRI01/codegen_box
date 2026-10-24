<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;
use App\Models\CoreQuestionStat;
use App\Models\CoreTestSession;
use Illuminate\Support\Facades\DB;

/**
 * Item analysis: what students' answers say about each question, so a wrong key or a useless question is found by the
 * numbers instead of waiting for a student to report it.
 *
 * Two measures from timed tests (where there is a total score to compare against):
 *   facility        the share who got the question right — near 1 is too easy, near 0 too hard.
 *   discrimination  the point-biserial correlation between getting THIS question right and the test score overall.
 *                   Healthy questions are positive; ~0 means it separates strong from weak students not at all;
 *                   clearly negative means the stronger students get it WRONG — the signature of a wrong answer key.
 * Practice answers add a facility of their own (no total score there, so no discrimination).
 *
 * Everything is a grouped query over all questions at once, and nothing is judged on thin evidence: a question needs
 * `min_attempts` answers first. A flag is a prompt for a human reviewer — nothing here edits a key or retires a question.
 */
class CoreItemAnalysisService
{
    /** @return array{analysed: int, flagged: int} */
    public function run(): array
    {
        $cfg = (array) config('core_prep.item_analysis');
        $min = (int) ($cfg['min_attempts'] ?? 30);
        $since = now()->subDays((int) ($cfg['window_days'] ?? 365));

        $tests = DB::table('core_test_responses as r')
            ->join('core_test_sessions as s', 's.id', '=', 'r.core_test_session_id')
            ->where('s.status', CoreTestSession::STATUS_COMPLETED)->whereNotNull('s.score_percent')->whereNotNull('r.is_correct')
            ->where('s.completed_at', '>=', $since)
            ->groupBy('r.core_question_id')
            ->select('r.core_question_id')
            ->selectRaw('count(*) as n, sum(case when r.is_correct then 1 else 0 end) as k')
            ->selectRaw('avg(case when r.is_correct then s.score_percent else null end) as m1')
            ->selectRaw('avg(case when r.is_correct then null else s.score_percent end) as m0')
            ->selectRaw('avg(s.score_percent) as mean')
            ->selectRaw('avg(s.score_percent * s.score_percent) as mean_sq')
            ->get()->keyBy('core_question_id');

        $practice = DB::table('core_practice_answers')->where('created_at', '>=', $since)
            ->groupBy('core_question_id')->select('core_question_id')
            ->selectRaw('count(*) as n, sum(case when is_correct then 1 else 0 end) as k')
            ->get()->keyBy('core_question_id');

        $ids = $tests->keys()->merge($practice->keys())->unique()->values();
        $questions = CoreQuestion::query()->whereIn('id', $ids)->get(['id', 'type', 'correct'])->keyBy('id');
        $now = now();
        $rows = [];
        $flagged = 0;

        foreach ($ids as $id) {
            $question = $questions[$id] ?? null;
            if ($question === null) {
                continue;
            }

            $t = $tests[$id] ?? null;
            $p = $practice[$id] ?? null;
            $testN = $t ? (int) $t->n : 0;
            $facility = $testN > 0 ? (int) $t->k / $testN : null;
            $discrimination = $t ? $this->pointBiserial($t) : null;
            $practiceN = $p ? (int) $p->n : 0;
            $practiceFacility = $practiceN > 0 ? (int) $p->k / $practiceN : null;

            // Judge on tests when there are enough of them, otherwise on practice; with neither, say nothing.
            $judged = $testN >= $min ? $facility : ($practiceN >= $min ? $practiceFacility : null);
            $flags = [];
            $suspect = null;

            if ($judged !== null) {
                if ($judged >= (float) ($cfg['too_easy'] ?? 0.95)) {
                    $flags[] = CoreQuestionStat::FLAG_TOO_EASY;
                }
                if ($judged <= (float) ($cfg['too_hard'] ?? 0.15)) {
                    $flags[] = CoreQuestionStat::FLAG_TOO_HARD;
                }
            }

            if ($testN >= $min && $discrimination !== null) {
                if ($discrimination < (float) ($cfg['negative_discrimination'] ?? -0.05)) {
                    $flags[] = CoreQuestionStat::FLAG_NEGATIVE_DISCRIMINATION;
                    $suspect = $this->optionStrongStudentsPrefer($question);

                    if ($suspect !== null) {
                        $flags[] = CoreQuestionStat::FLAG_SUSPECTED_KEY;
                    }
                } elseif ($discrimination < (float) ($cfg['low_discrimination'] ?? 0.10)) {
                    $flags[] = CoreQuestionStat::FLAG_LOW_DISCRIMINATION;
                }
            }

            $flagged += $flags === [] ? 0 : 1;

            $rows[] = [
                'core_question_id' => $id,
                'test_attempts' => $testN,
                'facility' => $facility === null ? null : round($facility, 4),
                'discrimination' => $discrimination === null ? null : round($discrimination, 4),
                'practice_attempts' => $practiceN,
                'practice_facility' => $practiceFacility === null ? null : round($practiceFacility, 4),
                'flags' => $flags === [] ? null : json_encode($flags),
                'flagged' => $flags !== [],
                'suspect_option' => $suspect,
                'computed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        foreach (array_chunk($rows, 200) as $chunk) {
            CoreQuestionStat::upsert($chunk, ['core_question_id'], ['test_attempts', 'facility', 'discrimination', 'practice_attempts', 'practice_facility', 'flags', 'flagged', 'suspect_option', 'computed_at', 'updated_at']);
        }

        // A question that has no answers in the window any more has nothing to say.
        CoreQuestionStat::query()->whereNotIn('core_question_id', $ids->all() ?: [0])->delete();

        return ['analysed' => count($rows), 'flagged' => $flagged];
    }

    /**
     * r = (M1 − M0) / S · √(p·q): M1/M0 the mean overall score of those who got the question right/wrong, S the standard
     * deviation of overall scores, p the share right. Null when it cannot be computed (everyone right, everyone wrong, or
     * every score identical).
     */
    private function pointBiserial(object $row): ?float
    {
        $n = (int) $row->n;
        $k = (int) $row->k;

        if ($n < 2 || $k === 0 || $k === $n || $row->m1 === null || $row->m0 === null) {
            return null;
        }

        $variance = (float) $row->mean_sq - (float) $row->mean ** 2;
        if ($variance <= 0.0) {
            return null;
        }

        $p = $k / $n;

        return ((float) $row->m1 - (float) $row->m0) / sqrt($variance) * sqrt($p * (1 - $p));
    }

    /**
     * For a single-answer multiple-choice question that discriminates negatively: the wrong option that the better half of
     * the students (by overall test score) choose most — if it is a clear favourite there. That is the option the key
     * probably should have been. Null when no wrong option stands out, or the question is not single-answer MCQ.
     */
    private function optionStrongStudentsPrefer(CoreQuestion $question): ?string
    {
        if ($question->type !== CoreQuestion::TYPE_MCQ_SINGLE) {
            return null;
        }

        $rows = DB::table('core_test_responses as r')
            ->join('core_test_sessions as s', 's.id', '=', 'r.core_test_session_id')
            ->where('r.core_question_id', $question->id)->where('s.status', CoreTestSession::STATUS_COMPLETED)->whereNotNull('s.score_percent')->whereNotNull('r.selected')
            ->orderByDesc('s.score_percent')->limit(2000)->get(['r.selected', 's.score_percent']);

        if ($rows->count() < 10) {
            return null;
        }

        $upper = $rows->take((int) ceil($rows->count() / 2));
        $counts = [];

        foreach ($upper as $row) {
            $selected = json_decode((string) $row->selected, true);
            $option = is_array($selected) && count($selected) === 1 ? (string) $selected[0] : null;
            if ($option !== null) {
                $counts[$option] = ($counts[$option] ?? 0) + 1;
            }
        }

        if ($counts === []) {
            return null;
        }

        arsort($counts);
        $top = array_key_first($counts);
        $key = (string) (($question->correct ?? [])[0] ?? '');

        return $top !== $key && $counts[$top] / $upper->count() >= 0.4 ? $top : null;
    }
}
