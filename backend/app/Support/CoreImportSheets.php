<?php

namespace App\Support;

use App\Models\CoreSubject;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * The template workbook content vendors fill in: a Questions sheet (header + two worked examples —
 * a multiple-choice and a numerical question), a "Subjects & topics" sheet listing the exact codes
 * accepted, and a Guide sheet explaining every column. The branch / subject / difficulty / type
 * columns carry drop-downs so the commonest errors cannot be typed.
 */
final class CoreImportSheets
{
    public const HEADER = [
        'external_id', 'discipline', 'subject', 'topic', 'type', 'difficulty', 'usage', 'marks', 'negative_marks',
        'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f', 'correct',
        'numeric_min', 'numeric_max', 'unit', 'explanation', 'tags', 'companies', 'source', 'image', 'status',
    ];

    private const GUIDE = [
        ['external_id', 'Your own unique id for the question (e.g. ECE-ANA-0001). Re-uploading the same id UPDATES the question instead of adding a duplicate. Strongly recommended.'],
        ['discipline', 'ece, eee, mech or civil.'],
        ['subject', 'Subject code or name from the "Subjects & topics" sheet.'],
        ['topic', 'Topic code or name inside that subject (optional).'],
        ['type', 'mcq_single (one correct option) · mcq_multi (one or more correct) · numeric (answer is a number).'],
        ['difficulty', 'easy · medium · hard.'],
        ['usage', 'practice (shown with the answer after each try) · test (only inside timed tests) · both. Keep tough or reused test questions as "test" so practice never reveals them.'],
        ['marks', 'Marks for a correct answer (0.25–10). Default 1.'],
        ['negative_marks', 'Marks deducted for a wrong answer, e.g. 0.33 (GATE-style: 1/3 of the marks). Default 0.'],
        ['question', 'The question text. Markdown and maths are supported: inline $V = IR$ and display $$\\int_0^1 x^2\\,dx$$ (LaTeX).'],
        ['option_a … option_f', 'Two to six options for multiple-choice questions. Leave unused ones empty. Maths supported.'],
        ['correct', 'Letter(s) of the correct option(s): B  or  A,C. Leave empty for numeric questions.'],
        ['numeric_min / numeric_max', 'For numeric questions: the accepted answer range, e.g. 3.14 and 3.15. For one exact value, fill only numeric_min.'],
        ['unit', 'Unit shown next to a numeric answer (optional), e.g. V, kW, MPa.'],
        ['explanation', 'The worked solution, shown after answering. Required for practice / both. Maths supported.'],
        ['tags / companies', 'Optional, separated by ; — e.g. "GATE;PSU" and "L&T;Tata Motors".'],
        ['source', 'Where it comes from, e.g. "Original" or "GATE 2019" (optional).'],
        ['image', 'File name of a figure inside the ZIP you upload with this file (PNG, JPG or WebP, up to 2 MB).'],
        ['status', 'draft (default) · in_review · published. A question that fails a check is never imported, whatever its status.'],
    ];

    private const EXAMPLES = [
        ['ECE-ANA-0001', null, null, null, 'mcq_single', 'medium', 'both', 1, 0.33,
            'A common-emitter amplifier has a collector resistor $R_C = 4\\,\\text{k}\\Omega$ and a transconductance $g_m = 40\\,\\text{mS}$. Ignoring $r_o$, the mid-band voltage gain is closest to:',
            '$-160$', '$-80$', '$+160$', '$-40$', null, null, 'A', null, null, null,
            'Mid-band gain is $A_v = -g_m R_C = -(40\\times10^{-3})(4\\times10^{3}) = -160$.', 'GATE;fundamentals', null, 'Original', null, 'draft'],
        ['ECE-ANA-0002', null, null, null, 'numeric', 'easy', 'both', 1, 0,
            'A 1 µF capacitor is charged to 10 V. The energy stored, in microjoules, is:',
            null, null, null, null, null, null, null, 50, 50, 'µJ',
            'Energy $E = \\tfrac12 C V^2 = \\tfrac12 (1\\,\\mu\\text{F})(10\\,\\text{V})^2 = 50\\,\\mu\\text{J}$.', null, null, 'Original', null, 'draft'],
    ];

    /** The .xlsx bytes. `$discipline` limits the Subjects sheet (and pre-fills the examples) to one family. */
    public static function template(?string $discipline = null): string
    {
        $book = new Spreadsheet;
        $questions = $book->getActiveSheet()->setTitle('Questions');
        $questions->fromArray(self::HEADER, null, 'A1');
        $questions->getStyle('A1:Z1')->getFont()->setBold(true);

        $subjects = CoreSubject::query()->when($discipline, fn ($q) => $q->where('discipline_code', $discipline))
            ->with('topics')->orderBy('discipline_code')->orderBy('sort')->get();
        $first = $subjects->first();

        foreach (self::EXAMPLES as $i => $example) {
            $example[1] = $discipline ?? ($first->discipline_code ?? 'ece');
            $example[2] = $first->code ?? 'analog_circuits';
            $example[3] = $first?->topics->first()->code ?? null;
            $questions->fromArray($example, null, 'A'.($i + 2));
        }

        foreach (range('A', 'Z') as $col) {
            $questions->getColumnDimension($col)->setWidth(in_array($col, ['J', 'U']) ? 60 : (in_array($col, ['K', 'L', 'M', 'N', 'O', 'P']) ? 28 : 14));
        }
        $questions->getStyle('J2:U2000')->getAlignment()->setWrapText(true);
        // Ids and answers are text: Excel must not turn "0012" into 12.
        $questions->getStyle('A2:A2000')->getNumberFormat()->setFormatCode('@');

        self::dropdown($questions, 'B2:B2000', '"ece,eee,mech,civil"');
        self::dropdown($questions, 'E2:E2000', '"mcq_single,mcq_multi,numeric"');
        self::dropdown($questions, 'F2:F2000', '"easy,medium,hard"');
        self::dropdown($questions, 'G2:G2000', '"practice,test,both"');
        self::dropdown($questions, 'Z2:Z2000', '"draft,in_review,published"');

        $list = new Worksheet($book, 'Subjects & topics');
        $book->addSheet($list);
        $list->fromArray(['discipline', 'subject code', 'subject name', 'topic code', 'topic name'], null, 'A1');
        $list->getStyle('A1:E1')->getFont()->setBold(true);
        $row = 2;
        foreach ($subjects as $subject) {
            foreach ($subject->topics as $topic) {
                $list->fromArray([$subject->discipline_code, $subject->code, $subject->name, $topic->code, $topic->name], null, "A{$row}");
                $row++;
            }
        }
        foreach (['A' => 12, 'B' => 30, 'C' => 38, 'D' => 34, 'E' => 56] as $col => $width) {
            $list->getColumnDimension($col)->setWidth($width);
        }

        $guide = new Worksheet($book, 'Guide');
        $book->addSheet($guide);
        $guide->fromArray(['Column', 'What to put there'], null, 'A1');
        $guide->getStyle('A1:B1')->getFont()->setBold(true);
        $guide->fromArray(self::GUIDE, null, 'A2');
        $guide->getColumnDimension('A')->setWidth(26);
        $guide->getColumnDimension('B')->setWidth(120);
        $guide->getStyle('B2:B40')->getAlignment()->setWrapText(true);

        $book->setActiveSheetIndex(0);

        $stream = fopen('php://temp', 'r+');
        (new Xlsx($book))->save($stream);
        rewind($stream);
        $bytes = (string) stream_get_contents($stream);
        fclose($stream);

        return $bytes;
    }

    /** The same template as a CSV (header + the two examples), for people who prefer plain text. */
    public static function csv(?string $discipline = null): string
    {
        $out = fopen('php://temp', 'r+');
        fputcsv($out, self::HEADER);
        $subject = CoreSubject::query()->when($discipline, fn ($q) => $q->where('discipline_code', $discipline))->orderBy('discipline_code')->orderBy('sort')->first();

        foreach (self::EXAMPLES as $example) {
            $example[1] = $discipline ?? ($subject->discipline_code ?? 'ece');
            $example[2] = $subject->code ?? 'analog_circuits';
            fputcsv($out, array_map(fn ($v) => $v ?? '', $example));
        }
        rewind($out);
        $csv = (string) stream_get_contents($out);
        fclose($out);

        return $csv;
    }

    private static function dropdown(Worksheet $sheet, string $range, string $formula): void
    {
        $validation = new DataValidation;
        $validation->setType(DataValidation::TYPE_LIST);
        $validation->setAllowBlank(true);
        $validation->setShowErrorMessage(true);
        $validation->setErrorTitle('Not an allowed value');
        $validation->setError('Pick a value from the list.');
        $validation->setShowDropDown(true);
        $validation->setFormula1($formula);
        $sheet->setDataValidation($range, $validation);
    }
}
