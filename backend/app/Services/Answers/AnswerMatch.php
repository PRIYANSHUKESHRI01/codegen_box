<?php

namespace App\Services\Answers;

/**
 * What AnswerMatcher found when it compared an answer with a model answer.
 *
 * `percent` is the share of the model answer's content (weighted: a figure or a technical term counts for more than a common word) that
 * the answer contained. `segments` are the model answer cut into its key points, in order, each marked covered / partial / missed, so a
 * screen can show the model answer with exactly what the student left out.
 */
final class AnswerMatch
{
    public const COVERED = 'covered';

    public const PARTIAL = 'partial';

    public const MISSED = 'missed';

    /**
     * @param  list<array{text: string, status: string}>  $segments  the model answer in pieces; joined, they read as the model answer
     */
    public function __construct(
        public readonly int $percent,
        public readonly string $band,
        public readonly array $segments,
    ) {}

    public static function bandFor(int $percent): string
    {
        return match (true) {
            $percent >= (int) config('answer_match.bands.green_from', 70) => 'green',
            $percent >= (int) config('answer_match.bands.yellow_from', 30) => 'yellow',
            default => 'red',
        };
    }

    public function label(): string
    {
        return match ($this->band) {
            'green' => 'Strong answer',
            'yellow' => 'Getting there',
            default => 'Needs more work',
        };
    }

    public function count(string $status): int
    {
        return count(array_filter($this->segments, fn (array $s) => $s['status'] === $status));
    }

    /** The model answer as one piece of text, exactly as it was written. */
    public function referenceText(): string
    {
        return trim(implode('', array_column($this->segments, 'text')));
    }

    /**
     * The key points the answer left out, most important first (the longest), for the one-line summary.
     *
     * @return list<string>
     */
    public function missedPoints(int $limit = 3): array
    {
        $missed = array_values(array_filter($this->segments, fn (array $s) => $s['status'] === self::MISSED));
        usort($missed, fn (array $a, array $b) => strlen($b['text']) <=> strlen($a['text']));

        return array_map(fn (array $s) => trim($s['text'], " \t\n\r\0\x0B;,:."), array_slice($missed, 0, $limit));
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'percent' => $this->percent,
            'band' => $this->band,
            'label' => $this->label(),
            'covered' => $this->count(self::COVERED),
            'partial' => $this->count(self::PARTIAL),
            'missed' => $this->count(self::MISSED),
            'total' => count($this->segments),
            'segments' => $this->segments,
        ];
    }
}
