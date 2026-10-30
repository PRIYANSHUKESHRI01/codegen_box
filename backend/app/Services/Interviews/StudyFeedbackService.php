<?php

namespace App\Services\Interviews;

use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Services\Answers\AnswerMatch;
use App\Services\Answers\AnswerMatcher;
use App\Services\InterviewTrackAdvancementService;

/**
 * Study mode: an interview (the Merchant Navy orals) in which nothing is sent to an AI. Each answer is compared, by AnswerMatcher, with the
 * question's model answer the moment it is submitted, and the student is shown the model answer and how much of it they covered - so they
 * can learn from it and go straight to the next question. When the last answer is in, the session is finished here, by the same code that
 * finishes every other standalone interview, with the average match as its score.
 *
 * Nothing here calls Gemini or any network service. The result is stored on the response (score = the match, match_details = what was
 * found) so the end-of-set summary shows the same thing again without recomputing it.
 */
class StudyFeedbackService
{
    public function __construct(
        private readonly AnswerMatcher $matcher,
        private readonly InterviewTrackAdvancementService $finalizer,
    ) {}

    /**
     * Compares the answer with the model answer, stores the result on the response, and returns what the screen shows.
     *
     * @return array<string, mixed>
     */
    public function record(InterviewResponse $response, InterviewQuestionBank $question): array
    {
        // A picture question is answered by reading the picture ("I see her red sidelight"): a colour or a side said wrongly is the error to catch.
        $match = $this->matcher->match((string) $response->transcript_text, (string) $question->notes_for_reviewer, picture: filled($question->image));
        $unverified = (bool) $question->reference_unverified;

        $response->update([
            'score' => $match->percent,
            'review_notes' => $this->summary($match),
            'match_details' => $match->toArray() + ['method' => 'text_match', 'unverified' => $unverified],
            'ai_scored' => false,
            'scored_by' => null,
            'scored_at' => now(),
        ]);

        return $this->payload($match->toArray(), $match->referenceText(), $match->missedPoints(), $unverified);
    }

    /**
     * What the screen shows for an answer already recorded (the end-of-set summary).
     *
     * @return array<string, mixed>|null null when this response was not scored by matching (nothing to show)
     */
    public function stored(InterviewResponse $response, InterviewQuestionBank $question): ?array
    {
        $details = $response->match_details;

        if (! is_array($details) || ($details['method'] ?? null) !== 'text_match') {
            return null;
        }

        $reference = trim(implode('', array_column($details['segments'] ?? [], 'text')));
        $missed = array_values(array_filter($details['segments'] ?? [], fn (array $s) => $s['status'] === AnswerMatch::MISSED));
        usort($missed, fn (array $a, array $b) => strlen($b['text']) <=> strlen($a['text']));

        return $this->payload(
            $details,
            $reference,
            array_map(fn (array $s) => trim($s['text'], " \t\n\r\0\x0B;,:."), array_slice($missed, 0, 3)),
            (bool) ($details['unverified'] ?? $question->reference_unverified),
        );
    }

    /**
     * Finishes a completed study session: every response already has its match, so the composite is simply their average (the same
     * finalizer every standalone interview uses, which also refreshes whatever depends on it).
     */
    public function finalize(InterviewSession $session): void
    {
        $this->finalizer->finalizeStandaloneScoring($session);

        // The sitting is over and scored: keep it for good (score history, the downloadable report), before "Practise again" can reset it.
        // Resolved here, not injected: the recorder reads answers back through this class.
        app(StudyAttemptRecorder::class)->recordQuietly($session->fresh());
    }

    public function isStudy(Interview $interview): bool
    {
        return $interview->isStudyMode();
    }

    // ───────────────────────────── internals ─────────────────────────────

    /**
     * @param  array<string, mixed>  $details  AnswerMatch::toArray()
     * @param  list<string>  $missed
     * @return array<string, mixed>
     */
    private function payload(array $details, string $reference, array $missed, bool $unverified): array
    {
        return [
            'method' => 'text_match',
            'match_percent' => (int) $details['percent'],
            'band' => $details['band'],
            'label' => $details['label'],
            'points' => ['covered' => $details['covered'], 'partial' => $details['partial'], 'missed' => $details['missed'], 'total' => $details['total']],
            'reference_answer' => $reference,
            'segments' => $details['segments'],
            'missed' => $missed,
            // The model answer has a figure still to be checked, or was written by AptRun and not yet reviewed: the student is told.
            'unverified' => $unverified,
        ];
    }

    /** The one-line note kept with the response (and shown to staff and in reports): what was covered, and what to revise. */
    private function summary(AnswerMatch $match): string
    {
        $covered = $match->count(AnswerMatch::COVERED);
        $partial = $match->count(AnswerMatch::PARTIAL);
        $total = count($match->segments);

        $text = "Matched {$match->percent}% of the model answer: {$covered} of {$total} key points covered".($partial > 0 ? ", {$partial} partly" : '').'.';
        $missed = $match->missedPoints(3);

        if ($missed !== []) {
            $text .= ' To revise: '.implode('; ', $missed).'.';
        }

        return mb_substr($text, 0, 900);
    }
}
