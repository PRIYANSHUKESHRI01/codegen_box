<?php

namespace App\Services\ProjectLab;

use Carbon\Carbon;
use Throwable;

/**
 * Reads the headers of a snapshot and reports what a reviewer should know about where the code came from.
 *
 * Nothing in a project folder can prove it was typed in the editor, but one thing gives a copied-in project away: a file's
 * modification time. A file written in the editor, by a tool or by `git clone` is stamped with the moment it was written, so every
 * file in a project built in the workspace is newer than the workspace itself. A project that was unzipped, or copied with `cp -p` /
 * `rsync -a` / `docker cp`, keeps the times of the machine it came from — files from before the workspace existed.
 *
 * Evidence, not a verdict: it is stored with the submission for the reviewer, and it only blocks a hand-in when MOST of a sizeable
 * project is like that (config/project_lab.php → provenance). Failure to read the archive is never an error: the answer is "unknown".
 */
class SnapshotInspector
{
    /**
     * @return array{files: int, bytes: int, predating: int, ratio: float, archives: list<string>, examples: list<string>, cutoff: string, oldest: ?string, would_block: bool}|null
     *                                                                                                                                                                         null when the archive cannot be read
     */
    public function inspect(string $localPath, Carbon $workspaceCreatedAt): ?array
    {
        $cfg = (array) config('project_lab.provenance');
        $cutoff = $workspaceCreatedAt->copy()->subMinutes((int) ($cfg['slack_minutes'] ?? 30))->getTimestamp();
        $extensions = array_map('strtolower', (array) ($cfg['archive_extensions'] ?? []));
        $max = (int) ($cfg['max_entries'] ?? 100000);

        try {
            $tar = TarReader::open($localPath);
        } catch (Throwable) {
            return null;
        }

        $files = 0;
        $bytes = 0;
        $predating = 0;
        $oldest = null;
        $archives = [];
        $examples = [];

        try {
            while (($entry = $tar->next()) !== null && $files < $max) {
                if ($entry['type'] !== 'file') {
                    continue;
                }

                $files++;
                $bytes += $entry['size'];

                if ($entry['mtime'] > 0 && $entry['mtime'] < $cutoff) {
                    $predating++;
                    $oldest = $oldest === null ? $entry['mtime'] : min($oldest, $entry['mtime']);

                    if (count($examples) < 10) {
                        $examples[] = ltrim($entry['name'], './');
                    }
                }

                if (in_array(strtolower(pathinfo($entry['name'], PATHINFO_EXTENSION)), $extensions, true) && count($archives) < 10) {
                    $archives[] = ltrim($entry['name'], './');
                }
            }
        } catch (Throwable) {
            return null;
        } finally {
            $tar->close();
        }

        $ratio = $files === 0 ? 0.0 : round($predating / $files, 3);

        return [
            'files' => $files,
            'bytes' => $bytes,
            'predating' => $predating,
            'ratio' => $ratio,
            'archives' => $archives,
            'examples' => $examples,
            'cutoff' => Carbon::createFromTimestamp($cutoff)->toIso8601String(),
            'oldest' => $oldest === null ? null : Carbon::createFromTimestamp($oldest)->toIso8601String(),
            'would_block' => $files >= (int) ($cfg['min_files'] ?? 10) && $ratio >= (float) ($cfg['block_ratio'] ?? 0.8),
        ];
    }

    /** What a reviewer reads about the result of inspect(): a sentence per finding, nothing when everything is as it should be. */
    public static function warnings(?array $p): array
    {
        if ($p === null) {
            return [];
        }

        $out = [];

        if ($p['predating'] > 0 && $p['files'] > 0) {
            $out[] = $p['predating'].' of the '.$p['files'].' files in this project are older than the workspace itself ('.round($p['ratio'] * 100).'%), so they were copied in from outside AptRun rather than written in the editor.';
        }

        if ($p['archives'] !== []) {
            $out[] = 'The project contains archive file(s): '.implode(', ', array_slice($p['archives'], 0, 5)).'.';
        }

        return $out;
    }
}
