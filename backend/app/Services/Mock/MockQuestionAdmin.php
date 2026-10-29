<?php

namespace App\Services\Mock;

use App\Models\ActivityLog;
use App\Models\InterviewQuestionBank;
use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Support\QuestionSheet;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\Cell\DataValidation;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * The staff side of the Mock AI Interview question bank: see which stacks have questions, add / edit / remove them on any round, or
 * load hundreds at once from a spreadsheet. The ONLY writer of mock_interview_questions.
 *
 * A round opens to students as soon as it has `mock_interviews.min_questions_per_round` questions - there is no series to strand a
 * student in, so a deletion is always allowed (interviews already built keep their own copy of the questions).
 */
class MockQuestionAdmin
{
    public const MAX_IMPORT_ROWS = 3000;

    public function __construct(private readonly MockInterviewCatalog $catalog) {}

    // ───────────────────────────── reading ─────────────────────────────

    /**
     * Every domain and stack with how ready it is and the question count of each of its 3 rounds.
     *
     * @return array<string, mixed>
     */
    public function coverage(): array
    {
        $roles = [];
        $live = 0;
        $stacks = 0;

        foreach ($this->catalog->roles() as $role) {
            $rows = [];

            foreach ($role['stacks'] as $stack) {
                $progress = $this->catalog->progress($stack);
                $stacks++;
                $live += $progress['live'] ? 1 : 0;

                $rows[] = [
                    'key' => $stack['key'],
                    'name' => $stack['name'],
                    'aliases' => $stack['aliases'],
                    'live' => $progress['live'],
                    'ready_rounds' => $progress['ready_rounds'],
                    'total_rounds' => $progress['total_rounds'],
                    'questions' => array_sum(array_map(fn ($r) => count($r['questions']), $stack['rounds'])),
                    'grid' => array_map(fn ($r) => count($r['questions']), $stack['rounds']),
                ];
            }

            $roles[] = ['key' => $role['key'], 'title' => $role['title'], 'color' => $role['color'], 'stacks' => $rows];
        }

        return [
            'min_questions' => $this->catalog->minQuestions(),
            'stats' => ['stacks' => $stacks, 'live' => $live, 'coming_soon' => $stacks - $live],
            'roles' => $roles,
        ];
    }

    /** @return array<string, mixed> */
    public function stackDetail(string $stackKey): array
    {
        $found = $this->catalog->stack($stackKey);

        if ($found === null) {
            abort(404, "Unknown stack [{$stackKey}].");
        }

        $stack = $found['stack'];

        return [
            'key' => $stack['key'],
            'name' => $stack['name'],
            'blurb' => $stack['blurb'],
            'role' => ['key' => $found['role']['key'], 'title' => $found['role']['title']],
            'live' => $this->catalog->progress($stack)['live'],
            'min_questions' => $this->catalog->minQuestions(),
            'rounds' => array_map(fn (array $r) => [
                'id' => $r['id'],
                'round_number' => $r['round_number'],
                'title' => $r['title'],
                'description' => $r['description'],
                'ready' => $this->catalog->isRoundReady($r),
                'questions' => $r['questions'],
            ], $stack['rounds']),
        ];
    }

    // ───────────────────────────── writing ─────────────────────────────

    /** @param array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string} $data */
    public function add(User $actor, string $roundId, array $data): MockInterviewQuestion
    {
        $target = $this->locate($roundId);
        $text = $this->clean($data['text']);

        $question = DB::transaction(function () use ($actor, $target, $text, $data) {
            $this->assertNotDuplicate($target['round'], $text);

            return MockInterviewQuestion::create($this->row($target, $text, $data, $actor));
        });

        $this->catalog->flush();
        ActivityLog::record($actor, 'Added a Mock AI Interview question', 'MockInterviewRound', $target['round']['title'], ['stack' => $target['stack']['key'], 'round_id' => $roundId, 'question_id' => $question->id]);

        return $question;
    }

    /** @param array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string} $data */
    public function update(User $actor, MockInterviewQuestion $question, array $data): MockInterviewQuestion
    {
        $target = $this->locate(MockInterviewCatalog::roundId($question->stack_key, $question->round_number));
        $text = $this->clean($data['text']);

        DB::transaction(function () use ($question, $target, $text, $data) {
            $this->assertNotDuplicate($target['round'], $text, $question->id);

            $question->forceFill([
                'text' => $text,
                'category' => $data['category'] ?? $question->category,
                'duration_seconds' => $data['duration_seconds'] ?? $question->duration_seconds,
                'note' => array_key_exists('note', $data) ? $this->nullable($data['note']) : $question->note,
                'topic' => array_key_exists('topic', $data) ? $this->topic($data['topic']) : $question->topic,
                'needs_review' => array_key_exists('needs_review', $data) ? (bool) $data['needs_review'] : $question->needs_review,
            ])->save();
        });

        $this->catalog->flush();
        ActivityLog::record($actor, 'Edited a Mock AI Interview question', 'MockInterviewRound', $target['round']['title'], ['stack' => $question->stack_key, 'question_id' => $question->id]);

        return $question->refresh();
    }

    public function delete(User $actor, MockInterviewQuestion $question): void
    {
        $title = $this->catalog->round(MockInterviewCatalog::roundId($question->stack_key, $question->round_number))['round']['title'] ?? $question->stack_key;
        $question->delete();

        $this->catalog->flush();
        ActivityLog::record($actor, 'Removed a Mock AI Interview question', 'MockInterviewRound', $title, ['stack' => $question->stack_key, 'question_id' => $question->id]);
    }

    /**
     * Load questions from a .xlsx or .csv: columns stack, round, question, category, seconds, note. Valid rows are added; a row that is
     * wrong is reported with its line number and skipped; a question already in its round is skipped, so fixing the file and uploading it
     * again is always safe.
     *
     * @return array{added: int, duplicates: int, errors: list<array{row: int, message: string}>, opened: list<string>}
     */
    public function import(User $actor, UploadedFile $file): array
    {
        $rows = QuestionSheet::rows($file, 'stack, round, question, category, seconds, note');

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => ['The file has no questions in it.']]);
        }

        if (count($rows) > self::MAX_IMPORT_ROWS) {
            throw ValidationException::withMessages(['file' => ['That file has more than '.self::MAX_IMPORT_ROWS.' rows. Split it and upload it in parts.']]);
        }

        $before = $this->catalog->liveMap();
        $added = 0;
        $duplicates = 0;
        $errors = [];
        $seen = []; // round id => question texts added by this very file, so the same question twice in one upload is caught

        DB::transaction(function () use ($rows, $actor, &$added, &$duplicates, &$errors, &$seen) {
            foreach ($rows as $line => $row) {
                $checked = $this->checkImportRow($row);

                if (is_string($checked)) {
                    $errors[] = ['row' => $line, 'message' => $checked];

                    continue;
                }

                [$target, $text] = $checked;
                $roundId = $target['round']['id'];

                if (isset($seen[$roundId][mb_strtolower($text)]) || $this->isDuplicate($target['round'], $text)) {
                    $duplicates++;

                    continue;
                }

                MockInterviewQuestion::create($this->row($target, $text, [
                    'category' => $row['category'] ?? null,
                    'duration_seconds' => $row['seconds'] ?? null,
                    'note' => $row['note'] ?? null,
                    'topic' => $row['topic'] ?? null,
                    'needs_review' => $this->truthy($row['review'] ?? null),
                ], $actor));

                $seen[$roundId][mb_strtolower($text)] = true;
                $added++;
            }
        });

        $this->catalog->flush();

        $opened = [];
        foreach ($this->catalog->liveMap() as $key => $live) {
            if ($live && ! ($before[$key] ?? false)) {
                $opened[] = $this->catalog->stack($key)['stack']['name'];
            }
        }

        ActivityLog::record($actor, 'Imported Mock AI Interview questions', 'MockInterviewRound', $file->getClientOriginalName(), ['added' => $added, 'duplicates' => $duplicates, 'errors' => count($errors)]);

        return ['added' => $added, 'duplicates' => $duplicates, 'errors' => $errors, 'opened' => $opened];
    }

    /** The .xlsx a staff member fills in: the exact columns, an example, every valid stack and a guide. */
    public function template(): string
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Questions');
        $sheet->fromArray(['stack', 'round', 'question', 'category', 'seconds', 'note', 'topic', 'review'], null, 'A1');
        $sheet->getStyle('A1:H1')->getFont()->setBold(true);

        $stackKeys = collect($this->catalog->roles())->flatMap(fn ($r) => array_keys($r['stacks']));
        $example = $stackKeys->first(fn ($key) => ! ($this->catalog->liveMap()[(string) $key] ?? false)) ?? $stackKeys->first();

        $sheet->fromArray([$example, 1, 'Walk me through how you would find out why a report query suddenly became slow.', 'technical', 180, 'Looks for: measuring first, checking the plan and indexes, then fixing the cause rather than guessing.'], null, 'A2');
        foreach (['A' => 22, 'B' => 8, 'C' => 80, 'D' => 14, 'E' => 9, 'F' => 70, 'G' => 30, 'H' => 9] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->getStyle('C2:G3000')->getAlignment()->setWrapText(true);
        $this->dropdown($sheet, 'D2:D3000', '"'.implode(',', InterviewQuestionBank::CATEGORIES).'"');
        $this->dropdown($sheet, 'B2:B3000', '"1,2,3"');

        $stacks = new Worksheet($book, 'Stacks');
        $book->addSheet($stacks);
        $stacks->fromArray(['stack (use this exact key)', 'name', 'domain', 'status'], null, 'A1');
        $stacks->getStyle('A1:D1')->getFont()->setBold(true);
        $row = 2;
        $live = $this->catalog->liveMap();

        foreach ($this->catalog->roles() as $role) {
            foreach ($role['stacks'] as $key => $stack) {
                $stacks->fromArray([$key, $stack['name'], $role['title'], ($live[(string) $key] ?? false) ? 'open' : 'coming soon'], null, "A{$row}");
                $row++;
            }
        }
        foreach (['A' => 28, 'B' => 42, 'C' => 28, 'D' => 14] as $col => $width) {
            $stacks->getColumnDimension($col)->setWidth($width);
        }

        $guide = new Worksheet($book, 'Guide');
        $book->addSheet($guide);
        $guide->fromArray([
            ['Column', 'What to put there'],
            ['stack', 'The stack key from the "Stacks" sheet, e.g. data_analytics.'],
            ['round', '1, 2 or 3 - each stack has three practice rounds; their themes are shown in Admin -> AI Interviews -> Mock interview questions.'],
            ['question', 'What the AI interviewer asks aloud (15-800 characters). Write it so it can be answered by speaking in 2-3 minutes.'],
            ['category', 'technical (default), behavioral, hr, situational or aptitude.'],
            ['seconds', 'How long to allow for the answer. Blank = 180.'],
            ['note', 'What a strong answer covers. The AI scorer is given this as its rubric - the better the note, the fairer the score.'],
            ['topic', 'Optional. The syllabus section, e.g. "Lights, Shapes & Sound Signals". A round with a big bank asks across its topics instead of ten from one.'],
            ['review', 'Optional. Put "yes" when the answer has a figure someone still has to check against the current text. The scorer then judges the concept, and the question shows a "needs review" badge to staff.'],
            ['', ''],
            ['Rules', 'A round opens to students once it has at least '.$this->catalog->minQuestions().' questions; a stack opens as soon as one of its rounds does. A round with more than '.config('mock_interviews.questions_per_interview', 10).' questions asks a different mix each time.'],
            ['', 'A question already in its round is skipped, so uploading a corrected file again is safe. Rows with a problem are reported by line number and skipped; every other row is still added.'],
        ], null, 'A1');
        $guide->getStyle('A1:B1')->getFont()->setBold(true);
        $guide->getColumnDimension('A')->setWidth(16);
        $guide->getColumnDimension('B')->setWidth(120);
        $guide->getStyle('B1:B20')->getAlignment()->setWrapText(true);

        $book->setActiveSheetIndex(0);

        $stream = fopen('php://temp', 'r+');
        (new Xlsx($book))->save($stream);
        rewind($stream);
        $bytes = (string) stream_get_contents($stream);
        fclose($stream);

        return $bytes;
    }

    // ───────────────────────────── internals ─────────────────────────────

    /** @return array{role: array, stack: array, round: array} */
    private function locate(string $roundId): array
    {
        return $this->catalog->round($roundId) ?? abort(404, "Unknown mock interview round [{$roundId}].");
    }

    /** @return array<string, mixed> */
    private function row(array $target, string $text, array $data, User $actor): array
    {
        $category = $data['category'] ?? null;
        $round = $target['round']['round_number'];
        $position = (int) MockInterviewQuestion::where('stack_key', $target['stack']['key'])->where('round_number', $round)->max('position') + 1;

        return [
            'stack_key' => $target['stack']['key'],
            'round_number' => $round,
            'position' => $position,
            'text' => $text,
            'category' => in_array($category, InterviewQuestionBank::CATEGORIES, true) ? $category : InterviewQuestionBank::CATEGORY_TECHNICAL,
            'duration_seconds' => max(30, min(600, (int) ($data['duration_seconds'] ?? 180) ?: 180)),
            'note' => $this->nullable($data['note'] ?? null),
            'topic' => $this->topic($data['topic'] ?? null),
            'needs_review' => (bool) ($data['needs_review'] ?? false),
            'created_by' => $actor->id,
        ];
    }

    private function topic(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, 100);
    }

    /** A spreadsheet cell that means yes: "yes", "y", "x", "true", "1", "review". */
    private function truthy(mixed $cell): bool
    {
        return in_array(mb_strtolower(trim((string) $cell)), ['yes', 'y', 'x', 'true', '1', 'review'], true);
    }

    private function clean(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text) ?? $text);
    }

    private function nullable(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : mb_substr($value, 0, 1000);
    }

    private function isDuplicate(array $round, string $text, ?int $ignoreId = null): bool
    {
        $needle = mb_strtolower($text);

        foreach ($round['questions'] as $existing) {
            if ($ignoreId !== null && ($existing['id'] ?? null) === $ignoreId) {
                continue;
            }

            if (mb_strtolower($this->clean($existing['text'])) === $needle) {
                return true;
            }
        }

        return false;
    }

    private function assertNotDuplicate(array $round, string $text, ?int $ignoreId = null): void
    {
        if ($this->isDuplicate($round, $text, $ignoreId)) {
            throw ValidationException::withMessages(['text' => ['This question is already in the round.']]);
        }
    }

    /** @return array{0: array, 1: string}|string the round and the cleaned text, or what is wrong with the row */
    private function checkImportRow(array $row): array|string
    {
        $stack = trim((string) ($row['stack'] ?? ''));
        $round = (int) ($row['round'] ?? 0);
        $text = $this->clean((string) ($row['question'] ?? ''));

        if ($stack === '' || $this->catalog->stack($stack) === null) {
            return $stack === '' ? 'The stack is empty.' : "Unknown stack \"{$stack}\" - use a key from the Stacks sheet.";
        }

        if ($round < 1 || $round > MockInterviewCatalog::ROUNDS) {
            return 'Round must be 1, 2 or 3.';
        }

        $length = mb_strlen($text);

        if ($length < 15 || $length > 800) {
            return $length < 15 ? 'The question is too short (at least 15 characters).' : 'The question is too long (at most 800 characters).';
        }

        $category = trim((string) ($row['category'] ?? ''));

        if ($category !== '' && ! in_array(mb_strtolower($category), InterviewQuestionBank::CATEGORIES, true)) {
            return "Unknown category \"{$category}\" - use technical, behavioral, hr, situational or aptitude.";
        }

        return [$this->locate(MockInterviewCatalog::roundId($stack, $round)), $text];
    }

    private function dropdown(Worksheet $sheet, string $range, string $list): void
    {
        $validation = $sheet->getCell(explode(':', $range)[0])->getDataValidation();
        $validation->setType(DataValidation::TYPE_LIST)->setShowDropDown(true)->setFormula1($list);
        $validation->setShowErrorMessage(true);
        $sheet->setDataValidation($range, $validation);
    }
}
