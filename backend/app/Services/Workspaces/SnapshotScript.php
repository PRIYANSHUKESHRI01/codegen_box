<?php

namespace App\Services\Workspaces;

/**
 * Builds the script run INSIDE a workspace to archive the student's project
 * for submission. A `find … | tar` pipeline rather than `tar --exclude`
 * because the rules need "skip .env and .env.* but keep .env.example", which
 * tar's exclude globs cannot express.
 *
 * What is left out (config workspaces.snapshot): dependency and build output
 * and tool caches — a reviewer can reinstall them — and anything named like a
 * secret. Symlinks are skipped (only regular files are archived), so a link
 * to somewhere else on the workspace can never smuggle that file in.
 *
 * The script prints the archive size in bytes on success.
 */
final class SnapshotScript
{
    public const ROOT = '/home/workspace';

    public const OUTPUT = '/var/tmp/aptrun-submission.tgz';

    /** @param array<string, mixed> $config config('workspaces.snapshot') */
    public static function build(array $config): string
    {
        $anywhere = array_map(fn (string $n) => '-name '.self::quote($n), $config['prune_anywhere'] ?? []);

        $shallow = self::alternation($config['prune_shallow'] ?? []);
        $home = self::alternation($config['prune_home'] ?? []);

        $prune = [];

        if ($anywhere !== []) {
            $prune[] = '\\( -type d \\( '.implode(' -o ', $anywhere).' \\) \\) -prune';
        }

        if ($shallow !== null) {
            $prune[] = '\\( -type d -regex '.self::quote('\\./([^/]+/)?'.$shallow).' \\) -prune';
        }

        if ($home !== null) {
            $prune[] = '\\( -type d -regex '.self::quote('\\./'.$home).' \\) -prune';
        }

        $paths = array_map(fn (string $p) => '-path '.self::quote($p), $config['prune_paths'] ?? []);

        if ($paths !== []) {
            $prune[] = '\\( -type d \\( '.implode(' -o ', $paths).' \\) \\) -prune';
        }

        $skip = array_map(fn (string $n) => '-name '.self::quote($n), $config['skip_files'] ?? []);
        $keep = array_map(fn (string $n) => '-name '.self::quote($n), $config['keep_files'] ?? []);

        $fileTest = '-type f';

        if ($skip !== []) {
            $skipExpr = '\\( '.implode(' -o ', $skip).' \\)';
            $keepExpr = $keep !== [] ? ' ! \\( '.implode(' -o ', $keep).' \\)' : '';
            $fileTest .= ' ! \\( '.$skipExpr.$keepExpr.' \\)';
        }

        $find = 'find . -regextype posix-extended '.($prune !== [] ? implode(' -o ', $prune).' -o ' : '').$fileTest.' -print0';

        $out = self::quote(self::OUTPUT);

        return implode("\n", [
            'set -o pipefail',
            'cd '.self::quote(self::ROOT).' || exit 2',
            "rm -f {$out}",
            "{$find} | tar --null --no-recursion -czf {$out} -T -",
            // GNU tar exits 1 when a file changed while it was being read — normal in a live workspace.
            'rc=$?',
            '[ "$rc" -le 1 ] || exit "$rc"',
            "stat -c %s {$out}",
        ]);
    }

    /**
     * POSIX single-quoting: everything is literal, and an embedded ' becomes '\''.
     * Not escapeshellarg(): that quotes for the OS PHP happens to run on (double
     * quotes on a Windows developer machine), while this script always runs in
     * bash inside the Linux workspace container.
     */
    private static function quote(string $value): string
    {
        return "'".str_replace("'", "'\\''", $value)."'";
    }

    /** `(a|b|c)` with regex metacharacters escaped, or null for an empty list. */
    private static function alternation(array $names): ?string
    {
        if ($names === []) {
            return null;
        }

        return '('.implode('|', array_map(fn (string $n) => preg_quote($n, '/'), $names)).')';
    }
}
