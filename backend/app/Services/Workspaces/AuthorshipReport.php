<?php

namespace App\Services\Workspaces;

use App\Models\ProjectEnrollment;
use App\Models\ProjectWorkspace;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The evidence behind "did the student write this?", gathered when a project is submitted and stored on the
 * submission, so what the reviewer reads is frozen at hand-in.
 *
 * It combines three things, none decisive alone:
 *  1. what the editor's guard reported (refused pastes, typing no person produces) and how much of the session it
 *     was confirmed running (coverage);
 *  2. the git history read from the container (many commits over time, or one enormous one);
 *  3. any extension installed beyond the curated set.
 *
 * The rules that turn these into a label live in config/authorship.php so they can be tuned without code. The label is
 * a pointer for a human ("worth a look"), never a verdict: building it must not fail a submission, and no part of it
 * blocks one.
 */
class AuthorshipReport
{
    public const LABEL_CLEAR = 'clear';

    public const LABEL_REVIEW = 'review';

    public const LABEL_ATTENTION = 'attention';

    /** Not judged: a project that allows pasting. */
    public const LABEL_NOT_CHECKED = 'not_checked';

    /** Kinds that mean text was refused, and so carry a size worth adding up. */
    private const REFUSED_WITH_SIZE = ['paste_blocked', 'clipboard_read_blocked', 'bulk_insert_blocked', 'drop_blocked', 'upload_blocked'];

    public function __construct(
        private readonly WorkspaceRuntime $runtime,
        private readonly WorkspaceHosts $hosts,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function build(ProjectWorkspace $workspace, ProjectEnrollment $enrollment, bool $inspectContainer): array
    {
        $mode = WorkspaceIntegrity::modeFor($enrollment->topic);
        $guard = $this->guardStats($workspace);

        $git = null;
        $extra = [];

        if ($inspectContainer) {
            [$git, $extra] = $this->inspectContainer($workspace);
        }

        $signals = $mode === WorkspaceIntegrity::MODE_OPEN ? [] : $this->signals($guard, $git, $extra);

        return [
            'version' => 1,
            'generated_at' => now()->toIso8601String(),
            'mode' => $mode,
            'guard' => $guard,
            'git' => $git,
            'extensions' => ['extra' => $extra],
            'signals' => $signals,
            'label' => $mode === WorkspaceIntegrity::MODE_OPEN ? self::LABEL_NOT_CHECKED : $this->label($signals),
        ];
    }

    /**
     * What the guard reported over the workspace's whole life.
     *
     * @return array<string, mixed>
     */
    public function guardStats(ProjectWorkspace $workspace): array
    {
        $sessionSeconds = (int) $workspace->sessions()->sum('seconds');
        $activeSeconds = (int) $workspace->sessions()->sum('guard_active_seconds');

        $events = $workspace->integrityEvents();
        $counts = (clone $events)->selectRaw('kind, count(*) as n, coalesce(sum(size), 0) as chars, coalesce(max(size), 0) as largest')
            ->groupBy('kind')->get()->keyBy('kind');

        $n = fn (string $kind): int => (int) ($counts[$kind]->n ?? 0);

        $refused = collect(self::REFUSED_WITH_SIZE)->filter(fn ($k) => isset($counts[$k]));
        $reportOnly = (clone $events)->where('meta->reportOnly', true)->count();

        return [
            'session_seconds' => $sessionSeconds,
            'active_seconds' => $activeSeconds,
            'coverage' => $sessionSeconds >= 60 ? round(min(1, $activeSeconds / $sessionSeconds), 3) : null,
            'last_seen_at' => $workspace->guard_last_seen_at?->toIso8601String(),
            'version' => $workspace->guard_version,
            'counts' => $counts->map(fn ($row) => (int) $row->n)->all(),
            'refused' => [
                'attempts' => (int) $refused->sum(fn ($k) => (int) $counts[$k]->n),
                'chars' => (int) $refused->sum(fn ($k) => (int) $counts[$k]->chars),
                'largest' => (int) $refused->max(fn ($k) => (int) $counts[$k]->largest),
                'would_have_been' => $reportOnly,
            ],
            'internal' => ['pastes' => $n('paste_internal'), 'chars' => (int) ($counts['paste_internal']->chars ?? 0), 'sow_commands' => $n('paste_trusted')],
            'typing' => ['fast' => $n('fast_typing'), 'robotic' => $n('robotic_typing')],
            'synthetic' => $n('synthetic_blocked'),
            'windows_refused' => $n('window_blocked'),
            'first_event_at' => (clone $events)->min('occurred_at'),
            'last_event_at' => (clone $events)->max('occurred_at'),
        ];
    }

    /**
     * Git history and extra extensions, read from the live container. Any failure leaves them unknown (null / empty)
     * and is logged: the reviewer simply sees "not available".
     *
     * @return array{0: array<string, mixed>|null, 1: list<string>}
     */
    private function inspectContainer(ProjectWorkspace $workspace): array
    {
        try {
            $host = $this->hosts->find($workspace->host);

            if ($host === null) {
                return [null, []];
            }

            $result = $this->runtime->exec($host, $workspace->container_name, ['bash', '-c', GitHistoryScript::build()], null, 60);

            if (! $result->successful()) {
                Log::warning("authorship: could not read history of workspace {$workspace->id}: ".trim($result->stderr));

                return [null, []];
            }

            $parsed = GitHistoryScript::parse($result->stdout);

            return [
                GitHistoryScript::summarise($parsed['repos']),
                GitHistoryScript::extraExtensions($parsed['extensions'], (array) config('authorship.curated_extensions')),
            ];
        } catch (Throwable $e) {
            Log::warning("authorship: container inspection failed for workspace {$workspace->id}: ".$e->getMessage());

            return [null, []];
        }
    }

    /**
     * The plain rules, each with its reason in words. Thresholds come from config/authorship.php.
     *
     * @param  array<string, mixed>  $guard
     * @param  array<string, mixed>|null  $git
     * @param  list<string>  $extra
     * @return list<array{code: string, level: string, text: string}>
     */
    public function signals(array $guard, ?array $git, array $extra): array
    {
        $r = (array) config('authorship.rules');
        $signals = [];
        $add = function (string $code, string $level, string $text) use (&$signals) {
            $signals[] = ['code' => $code, 'level' => $level, 'text' => $text];
        };

        // 1. Was the guard there? (Only meaningful once there is a real session to cover.)
        $session = $guard['session_seconds'];
        if ($session >= $r['coverage_min_session_seconds'] && $guard['coverage'] !== null) {
            $pct = (int) round($guard['coverage'] * 100);
            if ($guard['coverage'] < $r['coverage_attention_below']) {
                $add('low_coverage', self::LABEL_ATTENTION, "The paste guard was confirmed running for only {$pct}% of the {$this->hours($session)} spent in the workspace. It may have been blocked or disabled in the browser.");
            } elseif ($guard['coverage'] < $r['coverage_review_below']) {
                $add('low_coverage', self::LABEL_REVIEW, "The paste guard was confirmed running for {$pct}% of the {$this->hours($session)} spent in the workspace.");
            }
        }

        // 2. Pastes refused (volume and size, not the mere fact: a habitual Ctrl+V is normal).
        $refused = $guard['refused'];
        if ($refused['chars'] >= $r['blocked_chars_attention']) {
            $add('refused_volume', self::LABEL_ATTENTION, "{$refused['attempts']} paste/drop attempts from outside were refused, about ".number_format($refused['chars']).' characters in all.');
        } elseif ($refused['attempts'] >= $r['blocked_attempts_review'] || $refused['chars'] >= $r['blocked_chars_review'] || $refused['largest'] >= $r['largest_blocked_review']) {
            $add('refused_volume', self::LABEL_REVIEW, "{$refused['attempts']} paste/drop attempts from outside were refused (about ".number_format($refused['chars']).' characters; the largest '.number_format($refused['largest']).').');
        }

        if ($guard['synthetic'] > 0 || ($guard['counts']['bulk_insert_blocked'] ?? 0) > 0) {
            $add('scripted_input', self::LABEL_REVIEW, 'A script or browser extension tried to type or paste into the editor ('.($guard['synthetic'] + ($guard['counts']['bulk_insert_blocked'] ?? 0)).' times).');
        }

        // 3. Typing no person produces.
        if ($guard['typing']['robotic'] >= $r['robotic_typing_attention']) {
            $add('typing_pattern', self::LABEL_ATTENTION, "Keystrokes at metronome-regular intervals were detected {$guard['typing']['robotic']} times, which looks like a typing bot or text expander.");
        } elseif ($guard['typing']['robotic'] >= $r['robotic_typing_review'] || $guard['typing']['fast'] >= $r['fast_typing_review']) {
            $add('typing_pattern', self::LABEL_REVIEW, 'Typing faster than a person can type (or at perfectly regular intervals) was detected '.($guard['typing']['fast'] + $guard['typing']['robotic']).' time(s).');
        }

        // 4. Git history.
        if ($git !== null && $git['added_after_first'] >= $r['history_min_total_lines']) {
            if ($git['commits_after_first'] < $r['min_commits_review']) {
                $add('few_commits', self::LABEL_REVIEW, "Only {$git['commits_after_first']} commit(s) after the starting commit, for about ".number_format($git['added_after_first']).' lines of code.');
            }
            if ($git['largest'] !== null && $git['largest']['lines'] >= $r['single_commit_min_lines'] && $git['largest']['share'] >= $r['single_commit_share_review']) {
                $pct = (int) round($git['largest']['share'] * 100);
                $add('one_big_commit', self::LABEL_REVIEW, "One commit holds {$pct}% of the code ({$git['largest']['lines']} lines).");
            }
            if ($git['commits_after_first'] >= 2 && $git['span_minutes'] < $r['history_span_minutes_review']) {
                $add('compressed_history', self::LABEL_REVIEW, "All the history after the starting commit falls within {$git['span_minutes']} minutes.");
            }
        }

        // 5. Anything installed beyond the curated set.
        if ($extra !== []) {
            $add('extra_extensions', self::LABEL_REVIEW, 'Extensions beyond the curated set are installed: '.implode(', ', array_slice($extra, 0, 5)).'.');
        }

        return $signals;
    }

    /** @param  list<array{level: string}>  $signals */
    public function label(array $signals): string
    {
        $levels = array_column($signals, 'level');

        return in_array(self::LABEL_ATTENTION, $levels, true)
            ? self::LABEL_ATTENTION
            : (in_array(self::LABEL_REVIEW, $levels, true) ? self::LABEL_REVIEW : self::LABEL_CLEAR);
    }

    private function hours(int $seconds): string
    {
        return $seconds >= 3600 ? round($seconds / 3600, 1).' h' : max(1, (int) round($seconds / 60)).' min';
    }
}
