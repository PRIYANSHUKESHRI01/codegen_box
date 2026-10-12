<?php

namespace App\Services\Workspaces;

/**
 * Reads a student's git history and installed extensions out of their container, for the reviewer.
 *
 * It runs INSIDE the container (the student's own sandbox, the same one the snapshot is taken from), only reads, and
 * prints a fixed, line-based format that parse() turns into numbers. Commit subjects are the student's own text and
 * are shown to the reviewer; file contents are never read, only line counts per file.
 *
 * What it is for: a project written over a week leaves a history of many commits spread over time; code that arrived
 * all at once leaves one enormous commit, or a few minutes of history. The framework skeleton (the repository's first
 * commit) is excluded from the numbers, because every Laravel project starts with thousands of generated lines.
 */
final class GitHistoryScript
{
    public const ROOT = '/home/workspace';

    /** Where the image keeps the curated extensions, and where a student could (on an older volume) have put their own. */
    public const EXTENSION_DIRS = ['/opt/aptrun-extensions', '/home/workspace/.openvscode-server/extensions'];

    public static function build(int $maxCommits = 5000): string
    {
        $root = self::ROOT;
        $dirs = implode(' ', array_map('escapeshellarg', self::EXTENSION_DIRS));

        return <<<BASH
set +e
cd {$root} || exit 0

# Repositories: the project folder and anything a level or two below it (never dependency folders).
find . -maxdepth 3 -name .git -type d -not -path '*/node_modules/*' -not -path '*/vendor/*' 2>/dev/null | head -5 | while read -r gitdir; do
  repo="\${gitdir%/.git}"
  echo "@@REPO \$repo"
  git -C "\$repo" -c core.fsmonitor=false -c core.hooksPath=/dev/null -c safe.directory='*' --no-pager \\
      log --no-merges --max-count={$maxCommits} --numstat --format='@@C|%H|%at|%an|%s' 2>/dev/null
done

for dir in {$dirs}; do
  [ -d "\$dir" ] && ls -1 "\$dir" 2>/dev/null | grep -v '^extensions.json\$' | sed 's/^/@@EXT /'
done
exit 0
BASH;
    }

    /**
     * @return array{repos: list<array{path: string, commits: list<array{at: int, author: string, subject: string, added: int, files: int}>}>, extensions: list<string>}
     */
    public static function parse(string $output, ?string $ignorePattern = null): array
    {
        $ignorePattern ??= (string) config('authorship.git_ignore_paths');
        $repos = [];
        $extensions = [];
        $repo = null;
        $commit = null;

        $flush = function () use (&$repo, &$commit) {
            if ($repo !== null && $commit !== null) {
                $repo['commits'][] = $commit;
            }
            $commit = null;
        };

        foreach (preg_split('/\R/', $output) ?: [] as $line) {
            if (str_starts_with($line, '@@REPO ')) {
                $flush();
                if ($repo !== null) {
                    $repos[] = $repo;
                }
                $repo = ['path' => preg_replace('#^\./#', '', trim(substr($line, 7))) ?: '.', 'commits' => []];
            } elseif (str_starts_with($line, '@@EXT ')) {
                $extensions[] = trim(substr($line, 6));
            } elseif (str_starts_with($line, '@@C|') && $repo !== null) {
                $flush();
                $parts = explode('|', substr($line, 4), 4);
                $commit = [
                    'at' => (int) ($parts[1] ?? 0),
                    'author' => mb_substr((string) ($parts[2] ?? ''), 0, 60),
                    'subject' => mb_substr((string) ($parts[3] ?? ''), 0, 80),
                    'added' => 0,
                    'files' => 0,
                ];
            } elseif ($commit !== null && preg_match('/^(\d+|-)\t(\d+|-)\t(.+)$/', $line, $m)) {
                // numstat: added <tab> deleted <tab> path. "-" is a binary file: no lines to count.
                if ($m[1] === '-' || ($ignorePattern !== '' && preg_match($ignorePattern, $m[3]))) {
                    continue;
                }
                $commit['added'] += (int) $m[1];
                $commit['files']++;
            }
        }

        $flush();
        if ($repo !== null) {
            $repos[] = $repo;
        }

        return ['repos' => $repos, 'extensions' => array_values(array_unique(array_filter($extensions)))];
    }

    /**
     * Numbers for the reviewer from the repository with the most commits. The oldest commit (the skeleton) is left out
     * of the line counts.
     *
     * @param  list<array{path: string, commits: list<array>}>  $repos
     * @return array<string, mixed>|null
     */
    public static function summarise(array $repos): ?array
    {
        $repos = array_values(array_filter($repos, fn ($r) => $r['commits'] !== []));

        if ($repos === []) {
            return null;
        }

        usort($repos, fn ($a, $b) => count($b['commits']) <=> count($a['commits']));
        $primary = $repos[0];

        // git log prints newest first.
        $commits = $primary['commits'];
        $all = count($commits);
        $afterFirst = array_slice($commits, 0, max(0, $all - 1));
        $added = array_sum(array_column($afterFirst, 'added'));

        $times = array_column($commits, 'at');
        $afterTimes = array_column($afterFirst, 'at');

        $largest = null;
        foreach ($afterFirst as $c) {
            if ($largest === null || $c['added'] > $largest['added']) {
                $largest = $c;
            }
        }

        usort($afterFirst, fn ($a, $b) => $b['added'] <=> $a['added']);

        return [
            'path' => $primary['path'],
            'commits' => $all,
            'commits_after_first' => count($afterFirst),
            'first_at' => $times === [] ? null : gmdate('c', min($times)),
            'last_at' => $times === [] ? null : gmdate('c', max($times)),
            'span_minutes' => $afterTimes === [] ? 0 : (int) round((max($afterTimes) - min($afterTimes)) / 60),
            'added_after_first' => $added,
            'largest' => $largest === null ? null : [
                'lines' => $largest['added'],
                'share' => $added > 0 ? round($largest['added'] / $added, 3) : 0,
                'subject' => $largest['subject'],
            ],
            'top' => array_map(
                fn ($c) => ['lines' => $c['added'], 'subject' => $c['subject'], 'at' => gmdate('c', $c['at'])],
                array_slice($afterFirst, 0, 3)
            ),
            'authors' => count(array_unique(array_column($commits, 'author'))),
            'other_repositories' => count($repos) - 1,
        ];
    }

    /**
     * Extension folder names ("publisher.name-1.2.3-universal") to lower-case ids that are not in the curated set.
     *
     * @param  list<string>  $folders
     * @param  list<string>  $curated
     * @return list<string>
     */
    public static function extraExtensions(array $folders, array $curated): array
    {
        $curated = array_map('strtolower', $curated);
        $extra = [];

        foreach ($folders as $folder) {
            $id = strtolower((string) preg_replace('/-\d+\.\d+\.\d+.*$/', '', $folder));

            if ($id !== '' && ! str_starts_with($id, '.') && ! in_array($id, $curated, true)) {
                $extra[] = $id;
            }
        }

        return array_values(array_unique($extra));
    }
}
