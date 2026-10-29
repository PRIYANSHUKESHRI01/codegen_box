<?php

namespace App\Services\Vault;

use App\Models\ActivityLog;
use App\Models\CuratedSetQuestion;
use App\Models\InterviewQuestionBank;
use App\Models\User;
use App\Models\VaultStackInterest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * The staff side of the Vault AI Interview question bank: see which stacks are ready, add / edit / remove questions on any
 * set, or load hundreds at once from a spreadsheet. The ONLY writer of curated_set_questions.
 *
 * Whatever changes, the catalog is rebuilt and compared with how it stood before: any stack that has just become live
 * (all 9 sets ready) is announced to the students who asked to be told (StackLaunchNotifier).
 *
 * A stack that is already live can never be taken below the minimum by a deletion — a student may be halfway through it.
 */
class CuratedQuestionAdmin
{
    public const MAX_IMPORT_ROWS = 3000;

    public const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

    public function __construct(
        private readonly CuratedCatalog $catalog,
        private readonly StackLaunchNotifier $launches,
    ) {}

    // ───────────────────────────── reading ─────────────────────────────

    /**
     * Every role and stack with how ready it is, and the question count of each of its 9 sets.
     *
     * @return array<string, mixed>
     */
    public function coverage(): array
    {
        $interest = $this->interestCounts();
        $roles = [];
        $live = 0;
        $stacks = 0;

        foreach ($this->catalog->roles() as $roleKey => $role) {
            $rows = [];

            foreach ($role['stacks'] as $stackKey => $stack) {
                $progress = $this->catalog->progress($stack);
                $stacks++;
                $live += $progress['live'] ? 1 : 0;

                $rows[] = [
                    'key' => (string) $stackKey,
                    'name' => $stack['name'],
                    'aliases' => $stack['aliases'] ?? [],
                    'live' => $progress['live'],
                    'ready_sets' => $progress['ready_sets'],
                    'total_sets' => $progress['total_sets'],
                    'questions' => array_sum(array_map(fn ($s) => count($s['questions'] ?? []), $this->catalog->allSets($stack))),
                    'custom_questions' => array_sum(array_map(fn ($s) => count($s['questions'] ?? []) - ($s['builtin_count'] ?? 0), $this->catalog->allSets($stack))),
                    'waiting' => $interest[$stackKey]['waiting'] ?? 0,
                    'interested' => $interest[$stackKey]['total'] ?? 0,
                    // 3 series x 3 sets, row-major: how many questions each has.
                    'grid' => array_map(fn ($series) => array_map(fn ($set) => count($set['questions'] ?? []), $series['sets']), $stack['series']),
                ];
            }

            $roles[] = ['key' => (string) $roleKey, 'title' => $role['title'], 'color' => $role['color'] ?? 'indigo', 'stacks' => $rows];
        }

        return [
            'min_questions' => $this->catalog->minQuestions(),
            'stats' => ['stacks' => $stacks, 'live' => $live, 'coming_soon' => $stacks - $live],
            'roles' => $roles,
        ];
    }

    /**
     * One stack with every question, so staff can see exactly what a candidate will be asked.
     *
     * @return array<string, mixed>
     */
    public function stackDetail(string $stackKey): array
    {
        $found = $this->catalog->stack($stackKey);
        abort_if($found === null, 404, "Unknown stack [{$stackKey}].");

        $stack = $found['stack'];
        $progress = $this->catalog->progress($stack);

        return [
            'key' => $stackKey,
            'name' => $stack['name'],
            'blurb' => $stack['blurb'],
            'role' => ['key' => $found['role']['key'], 'title' => $found['role']['title']],
            'aliases' => $stack['aliases'] ?? [],
            'live' => $progress['live'],
            'ready_sets' => $progress['ready_sets'],
            'total_sets' => $progress['total_sets'],
            'min_questions' => $this->catalog->minQuestions(),
            'waiting' => $this->interestCounts()[$stackKey]['waiting'] ?? 0,
            'series' => array_map(fn ($series) => [
                'series_number' => $series['series_number'],
                'title' => $series['title'],
                'sets' => array_map(fn ($set) => [
                    'id' => $set['id'],
                    'set_number' => $set['set_number'],
                    'title' => $set['title'],
                    'description' => $set['description'],
                    'ready' => $this->catalog->isSetReady($set),
                    'questions' => array_map(fn ($q) => [
                        'id' => $q['id'] ?? null,
                        'text' => $q['text'],
                        'category' => $q['category'] ?? InterviewQuestionBank::CATEGORY_TECHNICAL,
                        'duration_seconds' => (int) ($q['duration_seconds'] ?? 180),
                        'note' => $q['note'] ?? null,
                        'source' => $q['source'] ?? 'builtin',
                    ], $set['questions']),
                ], $series['sets']),
            ], $stack['series']),
        ];
    }

    // ───────────────────────────── writing ─────────────────────────────

    /** @param array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string} $data */
    public function add(User $actor, string $setId, array $data): CuratedSetQuestion
    {
        $set = $this->locate($setId);
        $text = $this->clean($data['text']);

        [$question] = $this->changing(function () use ($actor, $set, $text, $data) {
            $this->assertNotDuplicate($set['set'], $text);

            return CuratedSetQuestion::create($this->row($set, $text, $data, $actor));
        });

        ActivityLog::record($actor, 'Added a Vault AI Interview question', 'VaultInterviewSet', $set['set']['title'], ['stack' => $set['stack']['key'], 'set_id' => $setId, 'question_id' => $question->id]);

        return $question;
    }

    /** @param array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string} $data */
    public function update(User $actor, CuratedSetQuestion $question, array $data): CuratedSetQuestion
    {
        $set = $this->locate($question->set_id);
        $text = $this->clean($data['text']);

        $this->changing(function () use ($question, $set, $text, $data) {
            $this->assertNotDuplicate($set['set'], $text, $question->id);

            $question->forceFill([
                'text' => $text,
                'category' => $data['category'] ?? $question->category,
                'duration_seconds' => $data['duration_seconds'] ?? $question->duration_seconds,
                'note' => array_key_exists('note', $data) ? $this->nullable($data['note']) : $question->note,
            ])->save();
        });

        ActivityLog::record($actor, 'Edited a Vault AI Interview question', 'VaultInterviewSet', $set['set']['title'], ['stack' => $set['stack']['key'], 'set_id' => $question->set_id, 'question_id' => $question->id]);

        return $question->refresh();
    }

    public function delete(User $actor, CuratedSetQuestion $question): void
    {
        $set = $this->locate($question->set_id);

        // A live stack may be mid-attempt for somebody: never take one of its sets below what makes it live.
        if ($this->catalog->isLive($set['stack']['key']) && count($set['set']['questions']) - 1 < $this->catalog->minQuestions()) {
            throw ValidationException::withMessages(['question' => [
                "This stack is open to students, and removing this would leave Series {$set['set']['series_number']} Set {$set['set']['set_number']} with fewer than {$this->catalog->minQuestions()} questions. Add a replacement first, then remove this one.",
            ]]);
        }

        $this->changing(fn () => $question->delete());

        ActivityLog::record($actor, 'Removed a Vault AI Interview question', 'VaultInterviewSet', $set['set']['title'], ['stack' => $set['stack']['key'], 'set_id' => $question->set_id, 'question_id' => $question->id]);
    }

    /**
     * Load questions from a .xlsx or .csv: columns stack, series, set, question, category, seconds, note. Valid rows are
     * added; a row that is wrong is reported with its line number and skipped; a question already in its set is skipped, so
     * fixing the file and uploading it again is always safe.
     *
     * @return array{added: int, duplicates: int, errors: list<array{row: int, message: string}>, opened: list<string>}
     */
    public function import(User $actor, UploadedFile $file): array
    {
        $rows = $this->readRows($file);

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => ['The file has no questions in it.']]);
        }

        if (count($rows) > self::MAX_IMPORT_ROWS) {
            throw ValidationException::withMessages(['file' => ['That file has more than '.self::MAX_IMPORT_ROWS.' rows. Split it and upload it in parts.']]);
        }

        $added = 0;
        $duplicates = 0;
        $errors = [];
        $seen = [];   // set id => question texts added by this very file, so the same question twice in one upload is caught

        [, $openedKeys] = $this->changing(function () use ($rows, $actor, &$added, &$duplicates, &$errors, &$seen) {
            foreach ($rows as $line => $row) {
                $problem = $this->checkImportRow($row);

                if (is_string($problem)) {
                    $errors[] = ['row' => $line, 'message' => $problem];

                    continue;
                }

                [$set, $text] = $problem;

                $setId = $set['set']['id'];

                if (isset($seen[$setId][mb_strtolower($text)]) || $this->isDuplicate($set['set'], $text)) {
                    $duplicates++;

                    continue;
                }

                CuratedSetQuestion::create($this->row($set, $text, [
                    'category' => $row['category'] ?? null,
                    'duration_seconds' => $row['seconds'] ?? null,
                    'note' => $row['note'] ?? null,
                ], $actor));

                $seen[$setId][mb_strtolower($text)] = true;
                $added++;
            }
        });

        $opened = array_map(fn (string $key) => $this->catalog->stack($key)['stack']['name'], $openedKeys);

        ActivityLog::record($actor, 'Imported Vault AI Interview questions', 'VaultInterviewSet', $file->getClientOriginalName(), ['added' => $added, 'duplicates' => $duplicates, 'errors' => count($errors)]);

        return ['added' => $added, 'duplicates' => $duplicates, 'errors' => $errors, 'opened' => $opened];
    }

    /** The .xlsx a staff member fills in: the exact columns, an example, every valid stack and a guide. */
    public function template(): string
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Questions');
        $sheet->fromArray(['stack', 'series', 'set', 'question', 'category', 'seconds', 'note'], null, 'A1');
        $sheet->getStyle('A1:G1')->getFont()->setBold(true);

        $stackKeys = collect($this->catalog->roles())->flatMap(fn ($r) => array_keys($r['stacks']));
        $example = $stackKeys->first(fn ($key) => ! $this->catalog->isLive((string) $key)) ?? $stackKeys->first();

        $sheet->fromArray([$example, 1, 1, 'Walk me through how you would find out why a report query suddenly became slow.', 'technical', 180, 'Looks for: measuring first, checking the plan and indexes, then fixing the cause rather than guessing.'], null, 'A2');
        foreach (['A' => 22, 'B' => 8, 'C' => 6, 'D' => 80, 'E' => 14, 'F' => 9, 'G' => 70] as $col => $width) {
            $sheet->getColumnDimension($col)->setWidth($width);
        }
        $sheet->getStyle('D2:G3000')->getAlignment()->setWrapText(true);
        $this->dropdown($sheet, 'E2:E3000', '"'.implode(',', InterviewQuestionBank::CATEGORIES).'"');
        $this->dropdown($sheet, 'B2:B3000', '"1,2,3"');
        $this->dropdown($sheet, 'C2:C3000', '"1,2,3"');

        $stacks = new Worksheet($book, 'Stacks');
        $book->addSheet($stacks);
        $stacks->fromArray(['stack (use this exact key)', 'name', 'role', 'Mellow Vault domains it covers', 'status'], null, 'A1');
        $stacks->getStyle('A1:E1')->getFont()->setBold(true);
        $row = 2;

        foreach ($this->catalog->roles() as $role) {
            foreach ($role['stacks'] as $key => $stack) {
                $stacks->fromArray([$key, $stack['name'], $role['title'], implode(', ', $stack['aliases'] ?? []), $this->catalog->progress($stack)['live'] ? 'open' : 'coming soon'], null, "A{$row}");
                $row++;
            }
        }
        foreach (['A' => 28, 'B' => 42, 'C' => 28, 'D' => 60, 'E' => 14] as $col => $width) {
            $stacks->getColumnDimension($col)->setWidth($width);
        }

        $guide = new Worksheet($book, 'Guide');
        $book->addSheet($guide);
        $guide->fromArray([
            ['Column', 'What to put there'],
            ['stack', 'The stack key from the "Stacks" sheet, e.g. data_analytics.'],
            ['series', '1, 2 or 3. A candidate who fails a series moves to the next, so each series needs its own, different questions.'],
            ['set', '1, 2 or 3 — the round inside the series. Each set\'s theme is shown in Admin → Vault AI questions.'],
            ['question', 'What the AI interviewer asks aloud (15–800 characters). Write it so it can be answered by speaking in 2–3 minutes.'],
            ['category', 'technical (default), behavioral, hr, situational or aptitude.'],
            ['seconds', 'How long to allow for the answer. Blank = 180.'],
            ['note', 'What a strong answer covers. The AI scorer is given this as its rubric — the better the note, the fairer the score.'],
            ['', ''],
            ['Rules', 'A stack opens to students only when ALL 9 of its sets (3 series x 3 sets) have at least '.$this->catalog->minQuestions().' questions.'],
            ['', 'A question that is already in its set is skipped, so uploading a corrected file again is safe. Rows with a problem are reported by line number and skipped; every other row is still added.'],
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

    /**
     * Runs a change in one transaction, rebuilds the catalog, and tells whoever was waiting for a stack the change just opened.
     *
     * @return array{0: mixed, 1: list<string>} what the change returned, and the keys of the stacks it opened
     */
    private function changing(callable $work): array
    {
        $before = $this->catalog->liveMap();

        $result = DB::transaction($work);

        $this->catalog->flush();

        $opened = array_values(array_keys(array_filter($this->catalog->liveMap(), fn (bool $live, string $key) => $live && ! ($before[$key] ?? false), ARRAY_FILTER_USE_BOTH)));

        if ($opened !== []) {
            $this->launches->opened($opened);
        }

        return [$result, $opened];
    }

    /** @return array{role: array, stack: array, set: array} */
    private function locate(string $setId): array
    {
        foreach ($this->catalog->roles() as $roleKey => $role) {
            foreach ($role['stacks'] as $stackKey => $stack) {
                foreach ($this->catalog->allSets($stack) as $set) {
                    if ($set['id'] === $setId) {
                        return ['role' => ['key' => (string) $roleKey], 'stack' => ['key' => (string) $stackKey], 'set' => $set];
                    }
                }
            }
        }

        abort(404, "Unknown interview set [{$setId}].");
    }

    /** @return array<string, mixed> */
    private function row(array $set, string $text, array $data, User $actor): array
    {
        $category = $data['category'] ?? null;
        $position = (int) CuratedSetQuestion::where('set_id', $set['set']['id'])->max('position') + 1;

        return [
            'set_id' => $set['set']['id'],
            'stack_key' => $set['stack']['key'],
            'series_number' => (int) $set['set']['series_number'],
            'set_number' => (int) $set['set']['set_number'],
            'position' => $position,
            'text' => $text,
            'category' => in_array($category, InterviewQuestionBank::CATEGORIES, true) ? $category : InterviewQuestionBank::CATEGORY_TECHNICAL,
            'duration_seconds' => max(30, min(600, (int) ($data['duration_seconds'] ?? 180) ?: 180)),
            'note' => $this->nullable($data['note'] ?? null),
            'created_by' => $actor->id,
        ];
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

    private function isDuplicate(array $set, string $text, ?int $ignoreId = null): bool
    {
        $needle = mb_strtolower($text);

        foreach ($set['questions'] as $existing) {
            if ($ignoreId !== null && ($existing['id'] ?? null) === $ignoreId && ($existing['source'] ?? '') === 'custom') {
                continue;
            }

            if (mb_strtolower($this->clean($existing['text'])) === $needle) {
                return true;
            }
        }

        return false;
    }

    private function assertNotDuplicate(array $set, string $text, ?int $ignoreId = null): void
    {
        if ($this->isDuplicate($set, $text, $ignoreId)) {
            throw ValidationException::withMessages(['text' => ['This question is already in the set.']]);
        }
    }

    /** @return array{0: array, 1: string}|string the set and the cleaned text, or what is wrong with the row */
    private function checkImportRow(array $row): array|string
    {
        $stack = trim((string) ($row['stack'] ?? ''));
        $series = (int) ($row['series'] ?? 0);
        $setNumber = (int) ($row['set'] ?? 0);
        $text = $this->clean((string) ($row['question'] ?? ''));

        if ($stack === '' || $this->catalog->stack($stack) === null) {
            return $stack === '' ? 'The stack is empty.' : "Unknown stack \"{$stack}\" — use a key from the Stacks sheet.";
        }

        if ($series < 1 || $series > CuratedCatalog::SERIES || $setNumber < 1 || $setNumber > CuratedCatalog::SETS_PER_SERIES) {
            return 'Series and set must each be 1, 2 or 3.';
        }

        $length = mb_strlen($text);

        if ($length < 15 || $length > 800) {
            return $length < 15 ? 'The question is too short (at least 15 characters).' : 'The question is too long (at most 800 characters).';
        }

        $category = trim((string) ($row['category'] ?? ''));

        if ($category !== '' && ! in_array(mb_strtolower($category), InterviewQuestionBank::CATEGORIES, true)) {
            return "Unknown category \"{$category}\" — use technical, behavioral, hr, situational or aptitude.";
        }

        foreach ($this->catalog->allSets($this->catalog->stack($stack)['stack']) as $set) {
            if ((int) $set['series_number'] === $series && (int) $set['set_number'] === $setNumber) {
                return [['role' => ['key' => ''], 'stack' => ['key' => $stack], 'set' => $set], $text];
            }
        }

        return 'That series/set does not exist.';
    }

    /** @return array<int, array<string, mixed>> line number => header-keyed cells */
    private function readRows(UploadedFile $file): array
    {
        if ($file->getSize() > self::MAX_IMPORT_BYTES) {
            throw ValidationException::withMessages(['file' => ['That file is larger than 2 MB. Split it and upload it in parts.']]);
        }

        $extension = strtolower($file->getClientOriginalExtension());
        $cells = $extension === 'xlsx' ? $this->sheetCells($file->getRealPath()) : $this->csvCells($file->getRealPath());

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
            throw ValidationException::withMessages(['file' => ['The first row must be the header: stack, series, set, question, category, seconds, note. Download the template to start from it.']]);
        }

        return $rows;
    }

    /** @return list<list<mixed>> */
    private function sheetCells(string $path): array
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
    private function csvCells(string $path): array
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

    private function dropdown(Worksheet $sheet, string $range, string $list): void
    {
        $validation = $sheet->getCell(explode(':', $range)[0])->getDataValidation();
        $validation->setType(\PhpOffice\PhpSpreadsheet\Cell\DataValidation::TYPE_LIST)->setShowDropDown(true)->setFormula1($list);
        $validation->setShowErrorMessage(true);
        $sheet->setDataValidation($range, $validation);
    }

    /** @return array<string, array{total: int, waiting: int}> */
    private function interestCounts(): array
    {
        $out = [];

        foreach (VaultStackInterest::query()->selectRaw('stack_key, COUNT(*) as total, SUM(CASE WHEN notified_at IS NULL THEN 1 ELSE 0 END) as waiting')->groupBy('stack_key')->get() as $row) {
            $out[$row->stack_key] = ['total' => (int) $row->total, 'waiting' => (int) $row->waiting];
        }

        return $out;
    }
}
