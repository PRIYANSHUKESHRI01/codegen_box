<?php

namespace App\Services\ProjectLab;

use RuntimeException;

/**
 * A small streaming reader for the .tgz a workspace snapshot is stored as (GNU tar, gzip). It reads one entry at a time and never holds
 * an archive in memory, so a 200 MB snapshot costs a few kilobytes to list. Only what AptRun needs: regular files, their size and
 * modification time, and their bytes. Long names (GNU "L" entries and PAX "path") are followed; links and special files are reported
 * as such and never extracted.
 *
 *   $tar = TarReader::open($path);
 *   while (($entry = $tar->next()) !== null) {
 *       if ($entry['type'] === 'file') { $bytes = $tar->read(65536); }
 *   }
 *   $tar->close();
 */
final class TarReader
{
    private const BLOCK = 512;

    /** @var resource */
    private $handle;

    /** Bytes of the current entry's data not yet consumed (and its padding): skipped by next(). */
    private int $pending = 0;

    private int $currentSize = 0;

    private int $remaining = 0;

    private function __construct($handle)
    {
        $this->handle = $handle;
    }

    /** @throws RuntimeException when the file is not a readable tar (gzip or plain) */
    public static function open(string $path): self
    {
        $handle = @gzopen($path, 'rb');

        if ($handle === false) {
            throw new RuntimeException('The snapshot could not be opened.');
        }

        $reader = new self($handle);

        // The first header must look like one; "FAKE-SNAPSHOT" or a truncated download is not an archive.
        $first = @gzread($handle, self::BLOCK);

        if ($first === false || strlen($first) < self::BLOCK || ! (trim($first, "\0") === '' || self::checksumOk($first))) {
            gzclose($handle);

            throw new RuntimeException('The snapshot is not a readable archive.');
        }

        gzrewind($handle);

        return $reader;
    }

    public function close(): void
    {
        if (is_resource($this->handle)) {
            gzclose($this->handle);
        }
    }

    /**
     * The next entry, or null at the end of the archive.
     *
     * @return array{name: string, size: int, mtime: int, type: string}|null  type: file | dir | link | other
     *
     * @throws RuntimeException on a corrupt header
     */
    public function next(): ?array
    {
        $longName = null;

        while (true) {
            // The padding after a long-name / PAX record, or what is left of the previous file, comes before the next header.
            $this->skipPending();

            $header = $this->readBlock();

            if ($header === null || trim($header, "\0") === '') {
                return null;
            }

            if (! self::checksumOk($header)) {
                throw new RuntimeException('The snapshot is damaged (bad header).');
            }

            $type = $header[156];
            $size = $this->octal(substr($header, 124, 12));
            $name = $this->name($header);

            if ($type === 'L') {
                $longName = rtrim($this->readData($size), "\0\n");
                $this->pending = $this->padding($size);

                continue;
            }

            if ($type === 'x') {
                $path = $this->paxPath($this->readData($size));
                $this->pending = $this->padding($size);
                $longName = $path ?? $longName;

                continue;
            }

            if ($type === 'g') {
                $this->readData($size);
                $this->pending = $this->padding($size);

                continue;
            }

            $kind = match ($type) {
                '0', "\0", '7' => 'file',
                '5' => 'dir',
                '1', '2' => 'link',
                default => 'other',
            };

            $this->currentSize = $kind === 'file' ? $size : 0;
            $this->remaining = $this->currentSize;
            $this->pending = $kind === 'file' ? $this->padding($size) + $size : 0;

            return [
                'name' => $longName ?? $name,
                'size' => $this->currentSize,
                'mtime' => $this->octal(substr($header, 136, 12)),
                'type' => $kind,
            ];
        }
    }

    /** Up to `$limit` bytes of the current file entry's data (successive calls continue where the last stopped). */
    public function read(int $limit = 65536): string
    {
        $want = min($limit, $this->remaining);

        if ($want <= 0) {
            return '';
        }

        $data = (string) gzread($this->handle, $want);
        $this->remaining -= strlen($data);
        $this->pending = max(0, $this->pending - strlen($data));

        return $data;
    }

    // ---------------------------------------------------------------- internals

    private function skipPending(): void
    {
        $left = $this->pending;
        $this->pending = 0;
        $this->remaining = 0;

        while ($left > 0) {
            $chunk = (string) gzread($this->handle, min($left, 1048576));

            if ($chunk === '') {
                break;
            }

            $left -= strlen($chunk);
        }
    }

    private function readBlock(): ?string
    {
        $block = gzread($this->handle, self::BLOCK);

        return ($block === false || strlen($block) < self::BLOCK) ? null : $block;
    }

    private function readData(int $size): string
    {
        return $size > 0 ? (string) gzread($this->handle, min($size, 1048576)) : '';
    }

    private function padding(int $size): int
    {
        return (self::BLOCK - ($size % self::BLOCK)) % self::BLOCK;
    }

    private function name(string $header): string
    {
        $name = rtrim(substr($header, 0, 100), "\0");
        $prefix = rtrim(substr($header, 345, 155), "\0");

        // "ustar" headers carry a path prefix; GNU headers keep that field for other things, so it is only trusted with the ustar magic.
        return ($prefix !== '' && str_starts_with(substr($header, 257, 5), 'ustar')) ? $prefix.'/'.$name : $name;
    }

    private function octal(string $field): int
    {
        $field = rtrim($field, "\0 ");

        // GNU base-256 numbers (files over 8 GB) never occur under the snapshot's size cap.
        return $field === '' ? 0 : (int) octdec(trim($field));
    }

    private static function checksumOk(string $header): bool
    {
        $expected = (int) octdec(trim(rtrim(substr($header, 148, 8), "\0 ")));
        $sum = 0;

        for ($i = 0; $i < self::BLOCK; $i++) {
            $sum += ($i >= 148 && $i < 156) ? 32 : ord($header[$i]);
        }

        return $sum === $expected;
    }

    private function paxPath(string $records): ?string
    {
        foreach (explode("\n", $records) as $line) {
            if (preg_match('/^\d+ path=(.*)$/', $line, $m)) {
                return $m[1];
            }
        }

        return null;
    }
}
