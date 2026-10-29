<?php

namespace App\Services\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * Reads a staff-filled question sheet (.xlsx or .csv) into header-keyed rows, whatever the question bank behind it.
 *
 * The first row is the header (case-insensitive); blank rows are skipped; the result is keyed by the line number in the file so a
 * problem can be reported against the row the person sees. The Vault AI Interview's CuratedQuestionAdmin has its own copy of these
 * readers from before this class existed.
 */
class QuestionSheet
{
    public const MAX_BYTES = 2 * 1024 * 1024;

    /**
     * @param  string  $headerHint  what the first row must look like, for the error shown when `question` is missing from it
     * @return array<int, array<string, mixed>> line number => header-keyed cells
     */
    public static function rows(UploadedFile $file, string $headerHint): array
    {
        if ($file->getSize() > self::MAX_BYTES) {
            throw ValidationException::withMessages(['file' => ['That file is larger than 2 MB. Split it and upload it in parts.']]);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        $cells = $extension === 'xlsx' ? self::sheetCells($file->getRealPath()) : self::csvCells($file->getRealPath());

        $header = null;
        $rows = [];

        foreach ($cells as $index => $line) {
            $number = $index + 1;

            if ($header === null) {
                $header = array_map(fn ($h) => mb_strtolower(trim((string) $h)), $line);

                continue;
            }

            if (count(array_filter($line, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $rows[$number] = array_combine($header, array_pad(array_slice($line, 0, count($header)), count($header), null)) ?: [];
        }

        if ($header !== null && ! in_array('question', $header, true)) {
            throw ValidationException::withMessages(['file' => ["The first row must be the header: {$headerHint}. Download the template to start from it."]]);
        }

        return $rows;
    }

    /** @return list<list<mixed>> */
    private static function sheetCells(string $path): array
    {
        $reader = IOFactory::createReader('Xlsx');

        if (! $reader->canRead($path)) {
            throw ValidationException::withMessages(['file' => ['That is not a readable Excel workbook.']]);
        }

        $reader->setReadDataOnly(true);
        $book = $reader->load($path);
        $sheet = $book->getSheetByName('Questions') ?? $book->getSheet(0);

        return $sheet->toArray(null, true, true, false);
    }

    /** @return list<list<mixed>> */
    private static function csvCells(string $path): array
    {
        $handle = fopen($path, 'r');
        $lines = [];

        while (($cells = fgetcsv($handle)) !== false) {
            $lines[] = $cells;
        }

        fclose($handle);

        // Excel saves CSV with a byte-order mark that would otherwise glue itself to the first header.
        if (isset($lines[0][0])) {
            $lines[0][0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $lines[0][0]);
        }

        return $lines;
    }
}
