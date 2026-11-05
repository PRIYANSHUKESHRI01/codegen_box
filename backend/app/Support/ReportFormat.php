<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * Small formatting helpers shared by the PDF report views — kept out of the Blade files so the wording and the colour
 * bands live in one place (and are unit-testable).
 */
final class ReportFormat
{
    /** IST, the way every date in a college-facing document is written: 4 Nov 2026. */
    public static function date(null|string|\DateTimeInterface $iso, bool $withTime = false): string
    {
        if (! $iso) {
            return '—';
        }

        try {
            $d = Carbon::parse($iso)->timezone(config('app.display_timezone', 'Asia/Kolkata'));

            return $d->format($withTime ? 'j M Y, g:i A' : 'j M Y');
        } catch (\Throwable) {
            return '—';
        }
    }

    public static function percent(null|int|float $value): string
    {
        return $value === null ? '—' : ((int) round($value)).'%';
    }

    public static function humanise(?string $key): string
    {
        if ($key === null || $key === '') {
            return '—';
        }

        $special = ['dsa' => 'DSA', 'dbms' => 'DBMS', 'sql' => 'SQL', 'os' => 'OS', 'cn' => 'CN', 'oop' => 'OOP', 'ai' => 'AI', 'ml' => 'ML'];
        $words = array_map(fn (string $w) => $special[strtolower($w)] ?? Str::ucfirst($w), preg_split('/[\s_\-]+/', $key) ?: []);

        return implode(' ', $words);
    }

    /** The label students read for a judge language id (the same names the editor's picker uses). */
    public static function language(?string $id): string
    {
        static $labels = [
            'cpp' => 'C++', 'java' => 'Java', 'python' => 'Python3', 'python2' => 'Python', 'javascript' => 'JavaScript',
            'typescript' => 'TypeScript', 'csharp' => 'C#', 'c' => 'C', 'go' => 'Go', 'kotlin' => 'Kotlin', 'swift' => 'Swift',
            'rust' => 'Rust', 'ruby' => 'Ruby', 'php' => 'PHP', 'dart' => 'Dart', 'scala' => 'Scala', 'elixir' => 'Elixir',
            'erlang' => 'Erlang', 'racket' => 'Racket',
        ];

        return $id === null || $id === '' ? '—' : ($labels[$id] ?? self::humanise($id));
    }

    /** A score band: the colour a number is drawn in. 70+ green, 40–69 amber, below red. */
    public static function tone(null|int|float $score, int $good = 70, int $ok = 40): string
    {
        if ($score === null) {
            return 'muted';
        }

        return $score >= $good ? 'good' : ($score >= $ok ? 'warn' : 'bad');
    }

    public static function interviewKind(string $type, bool $isMock, array $config): string
    {
        return match (true) {
            ! empty($config['qualification_id']) => 'Vault AI Interview',
            ($config['source'] ?? null) === 'curated_set' => 'Vault AI set',
            ($config['study'] ?? false) === true => 'Study set',
            $type === 'tpo_mock' => 'College mock interview',
            $type === 'company' || $type === 'company_hiring' => 'Company interview',
            $type === 'practice' || $isMock => 'Practice interview',
            default => 'AptRun interview',
        };
    }

    /** Seconds → "12 min" / "1 h 05 min". */
    public static function duration(?int $seconds): string
    {
        if ($seconds === null || $seconds <= 0) {
            return '—';
        }

        $minutes = intdiv($seconds, 60);

        return $minutes >= 60 ? intdiv($minutes, 60).' h '.str_pad((string) ($minutes % 60), 2, '0', STR_PAD_LEFT).' min' : max(1, $minutes).' min';
    }

    public static function bytes(int $bytes): string
    {
        return $bytes >= 1048576 ? round($bytes / 1048576, 1).' MB' : max(1, (int) round($bytes / 1024)).' KB';
    }

    public static function slug(string $text): string
    {
        return Str::slug($text) ?: 'report';
    }
}
