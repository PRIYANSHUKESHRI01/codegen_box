<?php

namespace App\Support;

/**
 * The single definition of how a Listening Lab lesson is cut into sentences.
 *
 * Server and client must agree on sentence boundaries exactly: the audio
 * player speaks one sentence at a time (which is also what keeps long
 * passages from being cut off by browsers), and every question's `evidence`
 * is the INDEX of the sentence that contains its answer. So the split happens
 * here, once, and the client is only ever handed the finished list — it never
 * re-splits text itself.
 *
 * The split is deliberately simple (terminal punctuation followed by
 * whitespace). Lesson text is written — and AI-generated text is validated —
 * to avoid abbreviations such as "p.m." that would break it.
 */
final class ListeningScript
{
    /** @return list<string> */
    public static function splitText(string $text): array
    {
        $text = trim(preg_replace('/\s+/u', ' ', $text) ?? '');
        if ($text === '') {
            return [];
        }

        // A sentence ends at . ! or ? — optionally followed by a closing quote or bracket ("...solving.") — then whitespace.
        $parts = preg_split('/(?<=[.!?])\s+|(?<=[.!?]["\')\]])\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return array_values(array_filter(array_map('trim', $parts), fn (string $s) => $s !== ''));
    }

    /**
     * Every sentence of a lesson in spoken order, each tagged with its
     * speaker key (null for a single-speaker passage or a dictation).
     *
     * @param  list<array{speaker:string,text:string}>|null  $turns  conversation turns, or null
     * @return list<array{index:int,text:string,speaker:?string}>
     */
    public static function sentences(string $passageText, ?array $turns): array
    {
        $out = [];

        if ($turns !== null && $turns !== []) {
            foreach ($turns as $turn) {
                foreach (self::splitText((string) ($turn['text'] ?? '')) as $sentence) {
                    $out[] = ['index' => count($out), 'text' => $sentence, 'speaker' => (string) ($turn['speaker'] ?? '')];
                }
            }

            return $out;
        }

        foreach (self::splitText($passageText) as $sentence) {
            $out[] = ['index' => count($out), 'text' => $sentence, 'speaker' => null];
        }

        return $out;
    }

    /** The conversation as one continuous transcript — what `passage_text` holds for a conversation lesson. */
    public static function flatten(array $turns): string
    {
        return trim(implode(' ', array_map(fn (array $t) => trim((string) ($t['text'] ?? '')), $turns)));
    }

    /**
     * The index of the one sentence that contains `$quote`, or null when the
     * quote is absent or ambiguous. Comparison ignores case, punctuation and
     * spacing, so a quote copied loosely (by an author or by a model) still
     * resolves — but a quote that fits several sentences is rejected rather
     * than guessed at, because a wrong "the answer is here" highlight is worse
     * than none.
     *
     * @param  list<array{index:int,text:string,speaker:?string}>  $sentences
     */
    public static function locate(array $sentences, string $quote): ?int
    {
        $needle = self::normalise($quote);
        if ($needle === '' || mb_strlen($needle) < 6) {
            return null;
        }

        $hits = [];
        foreach ($sentences as $sentence) {
            if (str_contains(self::normalise($sentence['text']), $needle)) {
                $hits[] = $sentence['index'];
            }
        }

        return count($hits) === 1 ? $hits[0] : null;
    }

    private static function normalise(string $text): string
    {
        $text = mb_strtolower($text);
        $text = str_replace(["'", "\u{2019}", "\u{2018}", '`'], '', $text);
        $text = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? '';

        return trim($text);
    }

    /** Spoken length at a comfortable pace (~140 words a minute), never less than a few seconds. */
    public static function estimateSeconds(string $passageText): int
    {
        $words = count(preg_split('/\s+/u', trim($passageText), -1, PREG_SPLIT_NO_EMPTY) ?: []);

        return max(5, (int) round($words / 2.33));
    }
}
