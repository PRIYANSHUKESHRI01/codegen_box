<?php

namespace App\Console\Commands;

use App\Models\InterviewQuestionBank;
use App\Models\User;
use App\Support\InterviewDiscipline;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Loads interview question-bank files (the JSON in content/interview-bank/) into the permanent InterviewQuestionBank — the same table
 * Ops edits by hand. Idempotent: a question is identified by its text and branch, so running it again updates in place instead of
 * duplicating. Every row passes the same rules as the Ops form before anything is written; `--dry-run` writes nothing.
 */
class ImportInterviewBank extends Command
{
    protected $signature = 'interview:import-bank {path : a .json file, or a folder of .json files} {--dry-run : check the files, save nothing}';

    protected $description = 'Import spoken-interview questions into the interview question bank (idempotent)';

    public function handle(): int
    {
        $path = (string) $this->argument('path');
        $files = is_dir($path) ? glob(rtrim(str_replace('\\', '/', $path), '/').'/*.json') : [$path];

        if ($files === [] || $files === false || ! is_file($files[0])) {
            $this->error("No .json file found at {$path}.");

            return self::FAILURE;
        }

        $actor = User::where('role', User::ROLE_SUPERADMIN)->orderBy('id')->first();
        $dry = (bool) $this->option('dry-run');
        $totals = ['created' => 0, 'updated' => 0, 'invalid' => 0];

        foreach ($files as $file) {
            $rows = json_decode((string) file_get_contents($file), true);

            if (! is_array($rows)) {
                $this->error(basename($file).': not a JSON array.');
                $totals['invalid']++;

                continue;
            }

            foreach ($rows as $i => $row) {
                $validator = Validator::make($row, [
                    'question_text' => ['required', 'string', 'min:20'],
                    'category' => ['required', Rule::in(InterviewQuestionBank::CATEGORIES)],
                    'difficulty' => ['required', Rule::in(InterviewQuestionBank::DIFFICULTIES)],
                    'expected_duration_seconds' => ['required', 'integer', 'min:30', 'max:1800'],
                    'tags' => ['nullable', 'array'],
                    'tags.*' => ['string'],
                    'notes_for_reviewer' => ['nullable', 'string'],
                    'discipline' => ['nullable', Rule::in(InterviewDiscipline::families())],
                ]);

                if ($validator->fails()) {
                    $this->warn(basename($file).' #'.($i + 1).': '.$validator->errors()->first());
                    $totals['invalid']++;

                    continue;
                }

                $data = $validator->validated();
                $existing = InterviewQuestionBank::where('question_text', $data['question_text'])->where('discipline', $data['discipline'] ?? null)->first();

                if (! $dry) {
                    InterviewQuestionBank::updateOrCreate(
                        ['question_text' => $data['question_text'], 'discipline' => $data['discipline'] ?? null],
                        [...$data, 'tags' => $data['tags'] ?? [], 'is_active' => true] + ($existing ? [] : ['created_by' => $actor?->id]),
                    );
                }

                $existing ? $totals['updated']++ : $totals['created']++;
            }

            $this->line(basename($file).': read '.count($rows).' question(s)');
        }

        $this->info(($dry ? '[dry run] would create ' : 'Created ').$totals['created'].', update '.$totals['updated'].($totals['invalid'] ? ", {$totals['invalid']} invalid" : '').'.');

        return $totals['invalid'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
