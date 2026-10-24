<?php

namespace App\Services\Integrity;

use App\Models\IntegrityEvent;
use App\Models\IntegritySession;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * The append-only, hash-chained log. Rows are INSERTED and never updated; each row's hash covers the previous row's hash
 * and its own content, so changing or deleting any row (a database admin, a careless script, an attacker with a SQL
 * injection) breaks every hash after it and `integrity:verify` says exactly where.
 *
 * Usage: open a Chain from a session that is already row-locked, append any number of events, then flush() once — one
 * multi-row INSERT and the session's head/count are updated by the caller in the same transaction.
 */
final class EventLog
{
    public const GENESIS = '0000000000000000000000000000000000000000000000000000000000000000';

    /** Largest payload kept per event (bytes of JSON). Anything bigger is replaced by a marker — a page cannot bloat the log. */
    private const MAX_PAYLOAD_BYTES = 4096;

    /** @var list<array<string, mixed>> */
    private array $rows = [];

    private function __construct(
        private readonly int $sessionId,
        private int $seq,
        private string $head,
    ) {}

    public static function open(IntegritySession $session): self
    {
        return new self((int) $session->id, (int) $session->event_count, $session->chain_head ?: self::GENESIS);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return int the new event's seq
     */
    public function append(
        string $source,
        string $type,
        string $severity,
        int $strike,
        int $weight,
        CarbonInterface $occurredAt,
        ?CarbonInterface $clientAt,
        array $data = [],
    ): int {
        $this->seq++;
        $occurred = $occurredAt->format('Y-m-d H:i:s.v');
        $payload = $data === [] ? null : self::canonical($data);
        $hash = hash('sha256', $this->head.'|'.$this->seq.'|'.$source.'|'.$type.'|'.$occurred.'|'.($payload ?? ''));

        $this->rows[] = [
            'integrity_session_id' => $this->sessionId,
            'seq' => $this->seq,
            'source' => $source,
            'type' => $type,
            'severity' => $severity,
            'strike' => $strike,
            'weight' => $weight,
            'occurred_at' => $occurred,
            'client_at' => $clientAt?->format('Y-m-d H:i:s.v'),
            'payload' => $payload,
            'prev_hash' => $this->head,
            'hash' => $hash,
        ];
        $this->head = $hash;

        return $this->seq;
    }

    /** Writes everything appended so far. @return array{count: int, head: string} the values to store on the session */
    public function flush(): array
    {
        if ($this->rows !== []) {
            foreach (array_chunk($this->rows, 100) as $chunk) {
                DB::table('integrity_events')->insert($chunk);
            }
            $this->rows = [];
        }

        return ['count' => $this->seq, 'head' => $this->head];
    }

    /**
     * Re-walks a session's chain. Returns null when intact, or a description of the first break.
     *
     * @return array{seq: int, reason: string}|null
     */
    public static function verify(IntegritySession $session): ?array
    {
        $prev = self::GENESIS;
        $expectedSeq = 0;
        $last = null;

        foreach (IntegrityEvent::where('integrity_session_id', $session->id)->orderBy('seq')->cursor() as $event) {
            $expectedSeq++;
            $raw = $event->getRawOriginal();

            if ((int) $event->seq !== $expectedSeq) {
                return ['seq' => $expectedSeq, 'reason' => 'a row is missing or out of order'];
            }
            if (! hash_equals($prev, (string) $event->prev_hash)) {
                return ['seq' => (int) $event->seq, 'reason' => 'prev_hash does not match the previous row'];
            }

            $occurred = self::normaliseStamp((string) $raw['occurred_at']);
            $expected = hash('sha256', $prev.'|'.$event->seq.'|'.$event->source.'|'.$event->type.'|'.$occurred.'|'.($raw['payload'] ?? ''));
            if (! hash_equals($expected, (string) $event->hash)) {
                return ['seq' => (int) $event->seq, 'reason' => 'row content was changed after it was written'];
            }

            $prev = (string) $event->hash;
            $last = $event;
        }

        if ($last !== null && $session->chain_head !== null && ! hash_equals($prev, (string) $session->chain_head)) {
            return ['seq' => (int) $last->seq, 'reason' => 'rows were removed from the end of the log'];
        }

        return null;
    }

    /** MySQL returns "2026-11-01 10:00:00.123", SQLite stores what was inserted — both normalise to the format that was hashed. */
    private static function normaliseStamp(string $value): string
    {
        if (preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/', $value, $m)) {
            return $m[1].'.'.substr(str_pad($m[2] ?? '', 3, '0'), 0, 3);
        }

        return $value;
    }

    /**
     * Canonical JSON: keys sorted at every level, no whitespace, no escaping of slashes or unicode. A payload larger
     * than MAX_PAYLOAD_BYTES is replaced by a marker rather than stored.
     *
     * @param  array<string, mixed>  $data
     */
    public static function canonical(array $data): string
    {
        $json = json_encode(self::sortKeys(self::limit($data, 0)), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);

        if ($json === false || strlen($json) > self::MAX_PAYLOAD_BYTES) {
            return '{"_truncated":true}';
        }

        return $json;
    }

    /** Depth, breadth and string length are bounded, so a hostile page cannot make one event arbitrarily large. */
    private static function limit(mixed $value, int $depth): mixed
    {
        if (is_string($value)) {
            return mb_substr($value, 0, 300);
        }
        if (is_array($value)) {
            if ($depth >= 4) {
                return '…';
            }
            $out = [];
            foreach (array_slice($value, 0, 40, true) as $k => $v) {
                $out[is_string($k) ? mb_substr($k, 0, 64) : $k] = self::limit($v, $depth + 1);
            }

            return $out;
        }
        if (is_scalar($value) || $value === null) {
            return $value;
        }

        return null;
    }

    private static function sortKeys(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $isList = array_is_list($value);
        $value = array_map([self::class, 'sortKeys'], $value);
        if (! $isList) {
            ksort($value);
        }

        return $value;
    }
}
