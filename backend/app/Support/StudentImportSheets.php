<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Excel in, Excel out for the student roster import.
 *
 * Colleges keep rosters in Excel; asking a TPO to "Save As CSV" is where imports go wrong
 * (mangled roll numbers, wrong encodings). An uploaded .xlsx is turned into the same CSV the
 * import job has always read, so ProcessStudentImportJob stays the single place rows are
 * understood. The template workbook carries a Branches sheet and a drop-down on the branch
 * column, so the most common data error — a branch typed six different ways — is prevented at
 * the source instead of mapped afterwards.
 */
final class StudentImportSheets
{
    public const HEADER = ['name', 'email', 'roll_number', 'branch', 'section', 'cgpa', 'backlogs', 'phone', 'parent_phone', 'year'];

    /** What the year column's drop-down offers: the way a person writes it, which AcademicYear::parse() reads back. */
    private const YEAR_CHOICES = '1st year,2nd year,3rd year,4th year';

    private const MAX_ROWS = 20000;

    public static function isSpreadsheet(UploadedFile $file): bool
    {
        return in_array(strtolower($file->getClientOriginalExtension()), ['xlsx', 'xls'], true);
    }

    /** First worksheet as CSV text (UTF-8, comma-separated), blank rows dropped. */
    public static function toCsv(UploadedFile $file): string
    {
        // The reader is chosen by the extension and must recognise the file: createReaderForFile() falls back
        // to the CSV reader for anything that is text, which would "import" a renamed .txt as a one-line sheet.
        $reader = IOFactory::createReader(strtolower($file->getClientOriginalExtension()) === 'xls' ? 'Xls' : 'Xlsx');

        if (! $reader->canRead($file->getRealPath())) {
            throw new \RuntimeException('Not a readable workbook.');
        }

        $reader->setReadDataOnly(true);
        $sheet = $reader->load($file->getRealPath())->getSheet(0);

        $out = fopen('php://temp', 'r+');
        $written = 0;

        foreach ($sheet->toArray(null, true, true, false) as $row) {
            $cells = array_map(fn ($v) => $v === null ? '' : trim((string) $v), $row);

            if (count(array_filter($cells, fn ($v) => $v !== '')) === 0) {
                continue;
            }

            if (++$written > self::MAX_ROWS) {
                break;
            }

            fputcsv($out, $cells);
        }

        rewind($out);
        $csv = (string) stream_get_contents($out);
        fclose($out);

        return $csv;
    }

    /**
     * A ready-to-fill workbook: a Students sheet whose branch column offers every branch name the
     * platform recognises, and a Branches sheet listing them by family.
     *
     * `$department` (name) and `$sample` ([branch, roll number]) make the workbook the department's own: a Commerce roster
     * is handed the Commerce branch list and a Commerce example row, never the engineering ones.
     *
     * @param  list<array{name: string, discipline: string}>  $branches
     * @param  array{0: string, 1: string}|null  $sample
     */
    public static function template(array $branches, ?string $department = null, ?array $sample = null): string
    {
        [$sampleBranch, $sampleRoll] = $sample ?? ['Mechanical Engineering', '21ME1042'];

        $book = new Spreadsheet;
        $students = $book->getActiveSheet()->setTitle('Students');
        $students->fromArray([
            self::HEADER,
            ['Alex Chen', 'alex.chen@student.example.edu', $sampleRoll, $sampleBranch, 'A', 8.4, 0, '+91-9876543210', '+91-9876500000', '3rd year'],
        ], null, 'A1');

        $students->getStyle('A1:J1')->getFont()->setBold(true);
        foreach (range('A', 'J') as $col) {
            $students->getColumnDimension($col)->setAutoSize(true);
        }
        // Roll numbers and phones are text: Excel must not turn 0123 into 123 or 9876543210 into 9.87E+9.
        foreach (['C', 'H', 'I'] as $col) {
            $students->getStyle("{$col}2:{$col}2000")->getNumberFormat()->setFormatCode('@');
        }

        $list = new Worksheet($book, 'Branches');
        $book->addSheet($list);
        $list->setCellValue('A1', $department === null ? 'Branch (pick one of these in the Students sheet)' : "Branch — {$department} (pick one of these in the Students sheet)");
        $list->setCellValue('B1', 'Family');
        $list->getStyle('A1:B1')->getFont()->setBold(true);

        $row = 2;
        foreach ($branches as $branch) {
            $list->setCellValue("A{$row}", $branch['name']);
            $list->setCellValue("B{$row}", $branch['discipline']);
            $row++;
        }
        $list->getColumnDimension('A')->setWidth(52);
        $list->getColumnDimension('B')->setWidth(30);

        $last = max(2, $row - 1);
        $validation = new DataValidation;
        $validation->setType(DataValidation::TYPE_LIST);
        $validation->setAllowBlank(true);
        // A college's own wording is still allowed (TPOs map it afterwards) — this is a hint, not a wall.
        $validation->setShowErrorMessage(false);
        $validation->setShowDropDown(true);
        $validation->setFormula1('Branches!$A$2:$A$'.$last);
        $students->setDataValidation('D2:D2000', $validation);

        // The year of study is one of a few fixed choices, so it is a drop-down too - and a hint, not a wall: "3", "III" and "2028" are read as well.
        $yearValidation = new DataValidation;
        $yearValidation->setType(DataValidation::TYPE_LIST);
        $yearValidation->setAllowBlank(true);
        $yearValidation->setShowErrorMessage(false);
        $yearValidation->setShowDropDown(true);
        $yearValidation->setFormula1('"'.self::YEAR_CHOICES.'"');
        $students->setDataValidation('J2:J2000', $yearValidation);

        $book->setActiveSheetIndex(0);

        $stream = fopen('php://temp', 'r+');
        (new Xlsx($book))->save($stream);
        rewind($stream);
        $bytes = (string) stream_get_contents($stream);
        fclose($stream);

        return $bytes;
    }
}
