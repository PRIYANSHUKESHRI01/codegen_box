<?php

namespace App\Services\ProjectLab;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

/**
 * What can be done with a stored snapshot (.tgz): list what is in it, show one text file, and hand it over as a .zip.
 *
 * The stored file is never altered — the hash recorded when it was taken stays true. A .zip is built on demand from it, entry by entry
 * through a temporary folder (so a large project never sits in memory), with every name made safe (no absolute paths, no "..", no
 * links) and hard limits on entries and size so a hostile archive cannot fill the disk.
 */
class SnapshotArchive
{
    /** The disk the snapshots are kept on (shared with config/workspaces.php, which is only read here). */
    private function disk(): \Illuminate\Contracts\Filesystem\Filesystem
    {
        return Storage::disk((string) config('workspaces.snapshot.disk'));
    }

    /**
     * A readable local path for a stored snapshot: the file itself on a local disk, a temporary copy otherwise.
     *
     * @return array{0: string, 1: bool} path, and whether it is a temporary copy to delete afterwards
     */
    private function local(string $path): array
    {
        $disk = $this->disk();

        if (! $disk->exists($path)) {
            throw new RuntimeException('The snapshot file is no longer available.');
        }

        if (method_exists($disk, 'path') && ! ($disk->getAdapter() instanceof \League\Flysystem\AwsS3V3\AwsS3V3Adapter)) {
            return [$disk->path($path), false];
        }

        $tmp = tempnam(sys_get_temp_dir(), 'aptrun-snap-');
        $stream = $disk->readStream($path);
        file_put_contents($tmp, $stream);
        is_resource($stream) && fclose($stream);

        return [$tmp, true];
    }

    /**
     * @return array{files: list<array{path: string, size: int, mtime: string}>, total_files: int, total_bytes: int, truncated: bool}
     *
     * @throws RuntimeException when the snapshot is gone or not an archive
     */
    public function listing(string $path): array
    {
        [$local, $temp] = $this->local($path);
        $limit = (int) config('project_lab.archive.list_limit', 5000);
        $files = [];
        $total = 0;
        $bytes = 0;

        try {
            $tar = TarReader::open($local);

            while (($entry = $tar->next()) !== null) {
                if ($entry['type'] !== 'file') {
                    continue;
                }

                $total++;
                $bytes += $entry['size'];

                if (count($files) < $limit) {
                    $files[] = ['path' => $this->safe($entry['name']) ?? $entry['name'], 'size' => $entry['size'], 'mtime' => gmdate('c', $entry['mtime'])];
                }
            }

            $tar->close();
        } finally {
            $temp && @unlink($local);
        }

        usort($files, fn (array $a, array $b) => strnatcasecmp($a['path'], $b['path']));

        return ['files' => $files, 'total_files' => $total, 'total_bytes' => $bytes, 'truncated' => $total > count($files)];
    }

    /**
     * One file's text, for the reviewer's viewer. Binary files and anything over the preview size are not shown.
     *
     * @return array{path: string, size: int, binary: bool, truncated: bool, content: ?string}|null null when there is no such file
     */
    public function preview(string $path, string $name): ?array
    {
        [$local, $temp] = $this->local($path);
        $max = (int) config('project_lab.archive.preview_bytes', 262144);
        $wanted = $this->safe($name);

        if ($wanted === null) {
            return null;
        }

        try {
            $tar = TarReader::open($local);

            while (($entry = $tar->next()) !== null) {
                if ($entry['type'] !== 'file' || $this->safe($entry['name']) !== $wanted) {
                    continue;
                }

                $data = '';
                while (strlen($data) < $max && ($chunk = $tar->read(min(65536, $max - strlen($data)))) !== '') {
                    $data .= $chunk;
                }

                $binary = str_contains(substr($data, 0, 8000), "\0") || (! mb_check_encoding($data, 'UTF-8') && ! mb_check_encoding(rtrim($data, "\x80..\xFF"), 'UTF-8'));

                return [
                    'path' => $wanted,
                    'size' => $entry['size'],
                    'binary' => $binary,
                    'truncated' => $entry['size'] > strlen($data),
                    'content' => $binary ? null : $data,
                ];
            }

            $tar->close();
        } finally {
            $temp && @unlink($local);
        }

        return null;
    }

    /**
     * The snapshot as a .zip download (the temporary file is deleted after it is sent).
     *
     * @throws RuntimeException when it cannot be converted (gone, damaged, or over the limits)
     */
    public function zipResponse(string $path, string $downloadName): BinaryFileResponse
    {
        [$local, $temp] = $this->local($path);
        $cfg = (array) config('project_lab.archive');
        $work = storage_path('app/private/zip-'.Str::random(12));
        @mkdir($work, 0775, true);
        $zipPath = $work.'.zip';
        $zip = new ZipArchive;

        try {
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('The zip file could not be created.');
            }

            $tar = TarReader::open($local);
            $entries = 0;
            $bytes = 0;
            $n = 0;

            while (($entry = $tar->next()) !== null) {
                if ($entry['type'] !== 'file') {
                    continue;
                }

                $name = $this->safe($entry['name']);

                if ($name === null) {
                    continue;
                }

                $entries++;
                $bytes += $entry['size'];

                if ($entries > (int) $cfg['max_entries'] || $bytes > (int) $cfg['max_bytes'] || $entry['size'] > (int) $cfg['max_file_bytes']) {
                    throw new RuntimeException('This project is too large to convert to a zip. Download the original archive instead.');
                }

                $file = $work.'/'.(++$n);
                $out = fopen($file, 'wb');

                while (($chunk = $tar->read(65536)) !== '') {
                    fwrite($out, $chunk);
                }

                fclose($out);
                $zip->addFile($file, $name);
                $zip->setMtimeName($name, max(0, $entry['mtime']));
            }

            $tar->close();
            $zip->close();
        } catch (\Throwable $e) {
            @$zip->close();
            $this->rmdir($work);
            @unlink($zipPath);
            $temp && @unlink($local);

            throw $e instanceof RuntimeException ? $e : new RuntimeException('The snapshot could not be converted to a zip.', 0, $e);
        }

        $this->rmdir($work);
        $temp && @unlink($local);

        return response()->download($zipPath, $downloadName, ['Content-Type' => 'application/zip', 'X-Content-Type-Options' => 'nosniff'])->deleteFileAfterSend(true);
    }

    /** A name that is safe to use as a path inside a zip and as a lookup key: relative, forward slashes, no "." or ".." parts. */
    private function safe(string $name): ?string
    {
        $parts = [];

        foreach (explode('/', str_replace('\\', '/', $name)) as $part) {
            if ($part === '' || $part === '.') {
                continue;
            }

            if ($part === '..') {
                return null;
            }

            $parts[] = $part;
        }

        return $parts === [] ? null : implode('/', $parts);
    }

    private function rmdir(string $dir): void
    {
        if (! is_dir($dir)) {
            return;
        }

        foreach (scandir($dir) ?: [] as $f) {
            if ($f !== '.' && $f !== '..') {
                @unlink($dir.'/'.$f);
            }
        }

        @rmdir($dir);
    }
}
