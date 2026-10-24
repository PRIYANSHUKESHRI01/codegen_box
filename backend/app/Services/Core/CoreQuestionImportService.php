<?php

namespace App\Services\Core;

use App\Jobs\ProcessCoreQuestionImportJob;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionImport;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use PhpOffice\PhpSpreadsheet\IOFactory;
use ZipArchive;

/**
 * Bulk question import — how the question banks get fed.
 *
 * A file of questions (CSV, XLSX or JSON, optionally with a ZIP of images) is parsed, every row is
 * checked with the SAME validator the authoring form uses, and either a report of what WOULD happen
 * is produced (dry-run — nothing is written) or the rows are upserted. Rows are keyed by
 * `external_id`, so uploading a corrected sheet updates questions instead of duplicating them.
 *
 * Safety: a published question whose answer key is locked (students have answered it) is never
 * silently re-keyed by an import; images are extension-allow-listed, size-capped and flattened to
 * their base name (no path from the zip is ever trusted); the import never un-publishes anything.
 */
class CoreQuestionImportService
{
    /** Maximum errors kept on the import record (the rest are only counted). */
    private const ERROR_CAP = 300;

    public function __construct(
        private readonly CoreQuestionValidator $validator,
        private readonly CoreQuestionService $questions,
        private readonly CoreTaxonomy $taxonomy,
    ) {}

    /**
     * Stores the upload and runs (or queues) it. `options`: discipline (force every row into one family),
     * status (default status for rows without one: draft | in_review | published).
     *
     * @param  array{discipline?: string|null, status?: string|null}  $options
     */
    public function start(UploadedFile $file, ?UploadedFile $images, User $actor, string $mode, array $options = []): CoreQuestionImport
    {
        $ext = strtolower($file->getClientOriginalExtension());
        if (! in_array($ext, ['csv', 'xlsx', 'json', 'txt'], true)) {
            throw ValidationException::withMessages(['file' => ['Upload a .xlsx, .csv or .json file.']]);
        }

        $import = CoreQuestionImport::create([
            'user_id' => $actor->id,
            'original_filename' => mb_substr($file->getClientOriginalName(), 0, 255),
            'mode' => $mode,
            'status' => CoreQuestionImport::STATUS_PENDING,
            'options' => $options,
        ]);

        $dir = "core-imports/{$import->id}";
        $import->forceFill(['file_path' => $file->storeAs($dir, 'data.'.($ext === 'txt' ? 'csv' : $ext), 'local')]);

        if ($images !== null) {
            try {
                $import->images_path = $this->extractImages($images, "{$dir}/images");
            } catch (ValidationException $e) {
                $import->delete();
                Storage::disk('local')->deleteDirectory($dir);
                throw $e;
            }
        }

        $import->save();

        // Small files are done before the response returns; big ones go to the queue (the UI polls).
        ($file->getSize() ?? 0) < 400 * 1024 ? ProcessCoreQuestionImportJob::dispatchSync($import->id) : ProcessCoreQuestionImportJob::dispatch($import->id);

        return $import->fresh();
    }

    /** Re-runs a checked file as a real import (same file, same options, mode = commit). */
    public function commitFrom(CoreQuestionImport $checked, User $actor): CoreQuestionImport
    {
        abort_unless($checked->mode === CoreQuestionImport::MODE_DRY_RUN && $checked->status === CoreQuestionImport::STATUS_CHECKED, 422, 'Only a checked dry-run can be imported.');
        abort_unless($checked->file_path && Storage::disk('local')->exists($checked->file_path), 422, 'The uploaded file is no longer available — upload it again.');

        $import = CoreQuestionImport::create([
            'user_id' => $actor->id,
            'original_filename' => $checked->original_filename,
            'file_path' => $checked->file_path,
            'images_path' => $checked->images_path,
            'mode' => CoreQuestionImport::MODE_COMMIT,
            'status' => CoreQuestionImport::STATUS_PENDING,
            'options' => $checked->options,
        ]);

        ProcessCoreQuestionImportJob::dispatchSync($import->id);

        return $import->fresh();
    }

    public function process(CoreQuestionImport $import): void
    {
        $import->update(['status' => CoreQuestionImport::STATUS_PROCESSING]);

        try {
            $commit = $import->mode === CoreQuestionImport::MODE_COMMIT;
            $actor = $import->user_id ? User::find($import->user_id) : null;
            $rows = $this->readRows($import);

            $max = (int) config('core_prep.import.max_rows', 20000);
            if (count($rows) > $max) {
                throw new \RuntimeException("This file has more than {$max} rows — split it into smaller files.");
            }

            $errors = [];
            $failed = $valid = $created = $updated = 0;
            $summary = ['by_subject' => [], 'by_difficulty' => [], 'by_type' => [], 'without_external_id' => 0, 'downgraded_to_review' => 0, 'images' => 0, 'unchanged' => 0];
            $seen = [];
            $work = [];

            foreach ($rows as $number => $data) {
                $outcome = $this->checkRow($number, $data, $import, $seen);

                if ($outcome['errors'] !== []) {
                    $failed++;
                    foreach ($outcome['errors'] as $error) {
                        if (count($errors) < self::ERROR_CAP) {
                            $errors[] = ['row' => $number, 'external_id' => $outcome['external_id'], 'field' => $error['field'], 'message' => $error['message']];
                        }
                    }

                    continue;
                }

                $valid++;
                $outcome['existing'] ? $updated++ : $created++;
                $summary['by_subject'][$outcome['subject_name']] = ($summary['by_subject'][$outcome['subject_name']] ?? 0) + 1;
                $summary['by_difficulty'][$outcome['row']['difficulty']] = ($summary['by_difficulty'][$outcome['row']['difficulty']] ?? 0) + 1;
                $summary['by_type'][$outcome['row']['type']] = ($summary['by_type'][$outcome['row']['type']] ?? 0) + 1;
                $summary['without_external_id'] += $outcome['row']['external_id'] === null ? 1 : 0;
                $summary['downgraded_to_review'] += $outcome['downgraded'] ? 1 : 0;
                $summary['images'] += $outcome['image'] !== null ? 1 : 0;

                $work[] = $outcome;
            }

            if ($commit) {
                foreach (array_chunk($work, 100) as $chunk) {
                    DB::transaction(fn () => array_walk($chunk, fn (array $item) => $this->apply($item, $actor)));
                }
            }

            $import->update([
                'status' => $commit
                    ? ($failed > 0 ? CoreQuestionImport::STATUS_COMPLETED_WITH_ERRORS : CoreQuestionImport::STATUS_COMPLETED)
                    : CoreQuestionImport::STATUS_CHECKED,
                'total_rows' => count($rows),
                'valid_rows' => $valid,
                'created_rows' => $created,
                'updated_rows' => $updated,
                'failed_rows' => $failed,
                'errors' => $errors,
                'summary' => $summary,
            ]);
        } catch (\Throwable $e) {
            report($e);
            $import->update([
                'status' => CoreQuestionImport::STATUS_FAILED,
                'errors' => [['row' => 0, 'external_id' => null, 'field' => 'file', 'message' => $e->getMessage()]],
            ]);
        } finally {
            // A committed import no longer needs its working files; a dry-run keeps them for the commit step.
            if ($import->mode === CoreQuestionImport::MODE_COMMIT && $import->status !== CoreQuestionImport::STATUS_FAILED) {
                Storage::disk('local')->deleteDirectory(dirname((string) $import->file_path));
            }
        }
    }

    // ───────────────────────────────── one row ─────────────────────────────────

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, int>  $seen  external ids already used in this file → first row number
     * @return array{errors: list<array{field: string, message: string}>, external_id: ?string, row: array<string, mixed>, existing: ?CoreQuestion, subject_name: string, downgraded: bool, image: ?string}
     */
    private function checkRow(int $number, array $data, CoreQuestionImport $import, array &$seen): array
    {
        $opts = $import->options ?? [];
        $input = $this->map($data);
        $errors = [];
        $fail = function (string $field, string $message) use (&$errors) {
            $errors[] = ['field' => $field, 'message' => $message];
        };

        // discipline → subject → topic, by code or by name
        $discipline = $this->resolveDiscipline($opts['discipline'] ?? null, (string) ($input['discipline'] ?? ''));
        $input['discipline_code'] = $discipline;
        $subject = null;
        if ($discipline === null) {
            $fail('discipline', 'Unknown branch family “'.($input['discipline'] ?? '').'”. Use ece, eee, mech or civil.');
        } else {
            $subject = $this->taxonomy->subject($discipline, (string) ($input['subject'] ?? ''));
            if ($subject === null) {
                $fail('subject', 'Unknown subject “'.($input['subject'] ?? '').'” for '.$discipline.'. See the Subjects & topics sheet of the template.');
            } else {
                $input['subject_id'] = $subject['id'];
                if (trim((string) ($input['topic'] ?? '')) !== '') {
                    $topic = $this->taxonomy->topic($subject['id'], (string) $input['topic']);
                    $topic === null
                        ? $fail('topic', 'Unknown topic “'.$input['topic'].'” in '.$subject['name'].'.')
                        : $input['topic_id'] = $topic['id'];
                }
            }
        }

        $requested = strtolower(trim((string) ($input['status'] ?? ''))) ?: ($opts['status'] ?? 'draft');
        $input['status'] = $requested;
        $row = $this->validator->normalise($input);

        $downgraded = false;
        if ($row['status'] === CoreQuestion::STATUS_PUBLISHED && config('core_prep.require_second_reviewer')) {
            // An import is one person; it cannot be the second pair of eyes.
            $row['status'] = CoreQuestion::STATUS_IN_REVIEW;
            $downgraded = true;
        }

        $errors = array_merge($errors, $discipline !== null && $subject !== null
            ? $this->questions->errorsFor($row, publishing: in_array($row['status'], [CoreQuestion::STATUS_IN_REVIEW, CoreQuestion::STATUS_PUBLISHED], true))
            : []);

        // duplicate external id inside the file
        $externalId = $row['external_id'];
        if ($externalId !== null) {
            if (isset($seen[$externalId])) {
                $fail('external_id', "Same id as row {$seen[$externalId]} — ids must be unique within a file.");
            }
            $seen[$externalId] ??= $number;
        }

        // existing question: key lock
        $existing = $externalId !== null ? CoreQuestion::where('external_id', $externalId)->first() : null;
        if ($existing !== null && $errors === []) {
            $candidate = clone $existing;
            $candidate->fill($this->questions->attributes($row));

            if ($existing->isKeyLocked() && $existing->keyFields() !== $candidate->keyFields()) {
                $fail('correct', "This question has been answered {$existing->attempts_count} time(s), so its key is locked. Fix it in Core Prep → the question → “Fix answer key”.");
            }
        }

        // image
        $image = null;
        $imageName = trim((string) ($input['image'] ?? ''));
        if ($imageName !== '' && $errors === []) {
            $image = $this->findImage($import, $imageName);
            if ($image === null) {
                $fail('image', "Image “{$imageName}” was not found in the uploaded ZIP (or is not a PNG / JPG / WebP under ".config('core_prep.import.max_image_kb', 2048).' KB).');
            }
        }

        return [
            'errors' => $errors,
            'external_id' => $externalId,
            'row' => $row,
            'existing' => $existing,
            'subject_name' => $subject['name'] ?? '',
            'downgraded' => $downgraded,
            'image' => $image,
        ];
    }

    /** @param  array{row: array<string, mixed>, existing: ?CoreQuestion, image: ?string}  $item */
    private function apply(array $item, ?User $actor): void
    {
        $row = $item['row'];
        $existing = $item['existing'];
        $attributes = $this->questions->attributes($row);

        if ($existing === null) {
            $question = new CoreQuestion($attributes);
            $question->created_by = $actor?->id;
            $this->stampPublication($question, $actor);
            $question->save();
            $this->questions->audit($question, $actor, 'imported', ['external_id' => $row['external_id']]);
        } else {
            $question = $existing;
            $beforeKey = $question->keyFields();
            // An import never un-publishes or re-opens anything: it only moves a draft / in-review question forward.
            $status = in_array($question->status, [CoreQuestion::STATUS_DRAFT, CoreQuestion::STATUS_IN_REVIEW], true) ? $row['status'] : $question->status;
            $question->fill($attributes);
            $question->status = $status;

            if ($beforeKey !== $question->keyFields()) {
                $question->version++;
            }
            if ($status === CoreQuestion::STATUS_PUBLISHED && $existing->getOriginal('status') !== CoreQuestion::STATUS_PUBLISHED) {
                $this->stampPublication($question, $actor);
            }
            if ($question->isDirty()) {
                $question->save();
                $this->questions->audit($question, $actor, 'imported', ['external_id' => $row['external_id'], 'updated' => true]);
            }
        }

        if ($item['image'] !== null) {
            $this->storeImage($question, $item['image']);
        }
    }

    private function stampPublication(CoreQuestion $question, ?User $actor): void
    {
        if ($question->status === CoreQuestion::STATUS_PUBLISHED) {
            $question->reviewed_by = $actor?->id;
            $question->reviewed_at = now();
            $question->published_at ??= now();
        }
    }

    // ───────────────────────────────── reading ─────────────────────────────────

    /**
     * @return array<int, array<string, mixed>> row number (as the author sees it: header = 1) → cells by column name
     */
    private function readRows(CoreQuestionImport $import): array
    {
        $disk = Storage::disk('local');
        abort_unless($import->file_path && $disk->exists($import->file_path), 422, 'The uploaded file is missing.');
        $path = $disk->path($import->file_path);
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));

        return match ($ext) {
            'xlsx' => $this->readSheet($path),
            'json' => $this->readJson($path),
            default => $this->readCsv($path),
        };
    }

    /** @return array<int, array<string, mixed>> */
    private function readCsv(string $path): array
    {
        $handle = fopen($path, 'r');
        $header = null;
        $rows = [];
        $line = 0;

        while (($cells = fgetcsv($handle)) !== false) {
            $line++;
            if ($header === null) {
                $header = $this->header($cells);

                continue;
            }
            if (count(array_filter($cells, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $rows[$line] = $this->combine($header, $cells);
        }
        fclose($handle);

        return $rows;
    }

    /** @return array<int, array<string, mixed>> */
    private function readSheet(string $path): array
    {
        $reader = IOFactory::createReader('Xlsx');
        if (! $reader->canRead($path)) {
            throw new \RuntimeException('That is not a readable Excel workbook.');
        }
        $reader->setReadDataOnly(true);
        $sheet = $reader->load($path)->getSheet(0);

        $header = null;
        $rows = [];
        foreach ($sheet->toArray(null, true, true, false) as $index => $cells) {
            $line = $index + 1;
            if ($header === null) {
                $header = $this->header($cells);

                continue;
            }
            if (count(array_filter($cells, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }
            $rows[$line] = $this->combine($header, $cells);
        }

        return $rows;
    }

    /** @return array<int, array<string, mixed>> */
    private function readJson(string $path): array
    {
        $json = json_decode((string) file_get_contents($path), true);

        if (! is_array($json)) {
            throw new \RuntimeException('The JSON file is not valid.');
        }
        $list = array_is_list($json) ? $json : ($json['questions'] ?? null);
        if (! is_array($list)) {
            throw new \RuntimeException('Expected a JSON list of questions (or {"questions": […]}).');
        }

        $rows = [];
        foreach (array_values($list) as $i => $item) {
            if (is_array($item)) {
                $rows[$i + 1] = $item;
            }
        }

        return $rows;
    }

    /** @param  array<int, mixed>  $cells */
    private function header(array $cells): array
    {
        return array_map(fn ($c) => trim((string) preg_replace('/[^a-z0-9]+/', '_', mb_strtolower(trim((string) preg_replace('/^\xEF\xBB\xBF/', '', (string) $c)))), '_'), $cells);
    }

    /**
     * @param  array<int, string>  $header
     * @param  array<int, mixed>  $cells
     * @return array<string, mixed>
     */
    private function combine(array $header, array $cells): array
    {
        $out = [];
        foreach ($header as $i => $name) {
            if ($name !== '' && ! array_key_exists($name, $out)) {
                $out[$name] = isset($cells[$i]) ? trim((string) $cells[$i]) : '';
            }
        }

        return $out;
    }

    /**
     * Column names → question fields. Sheets from content vendors name things their own way; the common
     * spellings are accepted so nobody has to rename columns to import.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function map(array $data): array
    {
        $first = function (array $names) use ($data) {
            foreach ($names as $name) {
                if (array_key_exists($name, $data) && trim((string) (is_array($data[$name]) ? json_encode($data[$name]) : $data[$name])) !== '') {
                    return $data[$name];
                }
            }

            return null;
        };

        $options = $data['options'] ?? null;
        if (! is_array($options)) {
            $options = [];
            foreach (['a', 'b', 'c', 'd', 'e', 'f'] as $letter) {
                $options[] = $first(["option_{$letter}", "opt_{$letter}", $letter, 'option_'.(ord($letter) - 96)]) ?? '';
            }
        }

        $answer = $first(['correct', 'answer', 'correct_answer', 'correct_option', 'key']);
        // A numerical answer given as one value ("answer_value": 3.14) means a range of one.
        $single = $first(['numeric_answer', 'answer_value', 'value']);

        return [
            'external_id' => $first(['external_id', 'id', 'qid', 'question_id', 'code']),
            'discipline' => $first(['discipline', 'branch', 'family', 'department']),
            'subject' => $first(['subject', 'subject_code', 'subject_name']),
            'topic' => $first(['topic', 'topic_code', 'topic_name']),
            'type' => $first(['type', 'question_type', 'format']),
            'stem' => $first(['stem', 'question', 'question_text', 'text']),
            'options' => $options,
            'correct' => $answer,
            'numeric_min' => $first(['numeric_min', 'answer_min', 'min', 'range_min']) ?? $single,
            'numeric_max' => $first(['numeric_max', 'answer_max', 'max', 'range_max']) ?? $single,
            'numeric_unit' => $first(['numeric_unit', 'unit']),
            'marks' => $first(['marks', 'mark', 'points']),
            'negative_marks' => $first(['negative_marks', 'negative', 'penalty']),
            'difficulty' => $first(['difficulty', 'level']),
            'explanation' => $first(['explanation', 'solution', 'answer_explanation']),
            'tags' => $first(['tags', 'keywords']),
            'companies' => $first(['companies', 'company']),
            'source' => $first(['source', 'reference']),
            'usage' => $first(['usage', 'use']),
            'status' => $first(['status']),
            'image' => $first(['image', 'image_file', 'figure']),
        ];
    }

    private function resolveDiscipline(?string $forced, string $value): ?string
    {
        $candidates = array_filter([$forced, $value], fn ($v) => $v !== null && trim($v) !== '');
        $catalog = BranchCatalog::instance();

        foreach ($candidates as $candidate) {
            $key = CoreTaxonomy::key($candidate);

            foreach ($this->taxonomy->disciplines() as $code) {
                $discipline = $catalog->discipline($code);
                $names = array_filter([$code, $discipline['name'] ?? null, $discipline['short'] ?? null]);

                foreach ($names as $name) {
                    if (CoreTaxonomy::key($name) === $key) {
                        return $code;
                    }
                }
            }

            // "Mechanical Engineering", "E&TC", "Electrical" → through the branch catalogue
            $branch = $catalog->resolve($candidate);
            if ($branch !== null && $this->taxonomy->hasDiscipline((string) $catalog->disciplineOf($branch))) {
                return $catalog->disciplineOf($branch);
            }
        }

        return null;
    }

    // ───────────────────────────────── images ─────────────────────────────────

    /** Extracts the zip's images (flattened, allow-listed, size-capped) into `$dir`; returns the folder. */
    private function extractImages(UploadedFile $zipFile, string $dir): string
    {
        $zip = new ZipArchive;
        if ($zip->open($zipFile->getRealPath()) !== true) {
            throw ValidationException::withMessages(['images' => ['That ZIP could not be opened.']]);
        }

        $cfg = config('core_prep.import');
        $allowed = $cfg['image_extensions'];
        $disk = Storage::disk('local');
        $disk->makeDirectory($dir);

        if ($zip->numFiles > $cfg['max_zip_files']) {
            $zip->close();
            throw ValidationException::withMessages(['images' => ["The ZIP has more than {$cfg['max_zip_files']} files."]]);
        }

        $total = 0;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $stat = $zip->statIndex($i);
            $name = (string) $stat['name'];

            if (str_ends_with($name, '/') || str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, '\\..')) {
                continue; // directories, and anything that tries to climb out
            }

            $base = basename(str_replace('\\', '/', $name));
            $ext = strtolower(pathinfo($base, PATHINFO_EXTENSION));
            if (! in_array($ext, $allowed, true) || str_starts_with($base, '.') || $stat['size'] > $cfg['max_image_kb'] * 1024) {
                continue;
            }

            $total += $stat['size'];
            if ($total > $cfg['max_zip_mb'] * 1024 * 1024) {
                $zip->close();
                throw ValidationException::withMessages(['images' => ["The images are larger than {$cfg['max_zip_mb']} MB in total."]]);
            }

            $disk->put("{$dir}/".preg_replace('/[^A-Za-z0-9._-]+/', '_', $base), (string) $zip->getFromIndex($i));
        }
        $zip->close();

        return $dir;
    }

    private function findImage(CoreQuestionImport $import, string $name): ?string
    {
        if (! $import->images_path) {
            return null;
        }

        $disk = Storage::disk('local');
        $wanted = preg_replace('/[^A-Za-z0-9._-]+/', '_', basename(str_replace('\\', '/', $name)));

        foreach ($disk->files($import->images_path) as $file) {
            if (strcasecmp(basename($file), (string) $wanted) === 0) {
                return $file;
            }
        }

        return null;
    }

    private function storeImage(CoreQuestion $question, string $localPath): void
    {
        $ext = strtolower(pathinfo($localPath, PATHINFO_EXTENSION));
        $new = "core-questions/{$question->public_id}-".now()->timestamp.".{$ext}";
        Storage::disk('public')->put($new, Storage::disk('local')->get($localPath));

        if ($question->image_path) {
            Storage::disk('public')->delete($question->image_path);
        }

        $question->forceFill(['image_path' => $new])->save();
    }
}
