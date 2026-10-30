<?php

namespace App\Services\Answers;

use App\Models\MockInterviewQuestion;
use Illuminate\Support\Facades\Cache;

/**
 * How distinctive each word is across the picture questions' model answers (the Rule of the Road cards).
 *
 * The cards' answers are built from the same parts - "you see her red (port) sidelight and masthead light(s); she is crossing your bow from
 * your starboard side to your port side" appears, nearly word for word, under every vessel at the same bearing - so a student who names
 * the WRONG vessel but describes how she is moving would still cover most of the words. What tells the answers apart is the rare words:
 * "trawling", "aground", "pilot", "cushion". A word that is in nearly every answer is therefore worth less, and one that is in few, more
 * (the same idea as a search engine's inverse document frequency).
 *
 * Worked out from the picture bank itself, so a card staff add or correct is reflected within the hour. With no picture bank at all (or no
 * vocabulary given) every word is worth what it always was.
 */
class PictureVocabulary
{
    private const CACHE_KEY = 'answers.picture_vocabulary';

    /** @var array{n: int, df: array<string, int>}|null */
    private ?array $stats = null;

    /** @param  list<string>|null  $answers  the model answers to learn from; null = the picture questions in the database */
    public function __construct(private readonly ?array $answers = null) {}

    /** What a word of a picture question's model answer is worth, as a multiple of its usual weight: about 0.4 for a word in every answer, up to 2.2 for a rare one. */
    public function factor(string $stem): float
    {
        $stats = $this->stats();
        $df = $stats['df'][$stem] ?? 0;

        // Not in any picture answer (a figure, or a word only the student used): it keeps its usual weight.
        if ($stats['n'] < 20 || $df === 0) {
            return 1.0;
        }

        return max(0.4, min(2.2, 0.4 + 0.55 * log($stats['n'] / $df)));
    }

    /** @return array{n: int, df: array<string, int>} */
    private function stats(): array
    {
        return $this->stats ??= $this->answers !== null ? $this->compute($this->answers) : Cache::remember(self::CACHE_KEY, 3600, fn () => $this->compute(
            MockInterviewQuestion::query()->whereNotNull('image')->pluck('note')->filter()->values()->all()
        ));
    }

    /**
     * @param  list<string>  $answers
     * @return array{n: int, df: array<string, int>}
     */
    private function compute(array $answers): array
    {
        $df = [];

        foreach ($answers as $answer) {
            foreach (array_unique(AnswerText::tokens((string) $answer)) as $stem) {
                $df[$stem] = ($df[$stem] ?? 0) + 1;
            }
        }

        return ['n' => count($answers), 'df' => $df];
    }
}
