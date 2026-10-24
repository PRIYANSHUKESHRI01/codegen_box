<?php

namespace App\Services\Core;

use App\Events\CoreQuestionKeyFixed;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionAudit;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Every write to a Core Prep question goes through here, so the rules live in one place:
 *
 *  • validation (CoreQuestionValidator) — the same one the bulk importer uses;
 *  • the lifecycle draft → in_review → published → retired, with publish requirements;
 *  • the answer-key lock — once students have answered, the key changes only through fixKey(),
 *    which is audited and triggers a regrade (CoreQuestionKeyFixed);
 *  • an audit row for every change, so "why did this answer change?" always has an answer.
 */
class CoreQuestionService
{
    /** Allowed status moves. A published question is never edited back to draft — retire it. */
    private const TRANSITIONS = [
        CoreQuestion::STATUS_DRAFT => [CoreQuestion::STATUS_IN_REVIEW, CoreQuestion::STATUS_PUBLISHED],
        CoreQuestion::STATUS_IN_REVIEW => [CoreQuestion::STATUS_DRAFT, CoreQuestion::STATUS_PUBLISHED],
        CoreQuestion::STATUS_PUBLISHED => [CoreQuestion::STATUS_RETIRED],
        CoreQuestion::STATUS_RETIRED => [CoreQuestion::STATUS_DRAFT],
    ];

    public function __construct(private readonly CoreQuestionValidator $validator) {}

    /** @param  array<string, mixed>  $input */
    public function create(array $input, User $actor): CoreQuestion
    {
        $row = $this->validator->normalise($input);
        $status = $row['status'];
        // A new question starts as a draft; moving it on is a deliberate, separately-checked step.
        $row['status'] = CoreQuestion::STATUS_DRAFT;

        $this->assertValid($row);

        return DB::transaction(function () use ($row, $actor, $status) {
            $question = new CoreQuestion($this->attributes($row));
            $question->created_by = $actor->id;
            $question->save();

            $this->audit($question, $actor, 'created');

            if ($status !== CoreQuestion::STATUS_DRAFT) {
                $this->transition($question, $status, $actor);
            }

            return $question->refresh();
        });
    }

    /**
     * Edits a question. Everything is editable until students answer it; after that the answer key
     * (type, correct option, option ids, numeric range, marks) is locked and must go through fixKey().
     *
     * @param  array<string, mixed>  $input  The full question (the editor sends it whole).
     */
    public function update(CoreQuestion $question, array $input, User $actor): CoreQuestion
    {
        $input['status'] = $question->status; // status moves have their own action
        $row = $this->validator->normalise($input + ['external_id' => $question->external_id]);

        $this->assertValid($row);

        $before = $this->snapshot($question);
        $beforeKey = $question->keyFields();
        $question->fill($this->attributes($row));
        $keyChanged = $beforeKey !== $question->keyFields();

        if ($keyChanged && $question->isKeyLocked()) {
            throw ValidationException::withMessages([
                'correct' => ["{$question->attempts_count} student(s) have answered this question, so its answer key is locked. Use “Fix answer key” — it records why and regrades everyone."],
            ]);
        }

        if ($question->isPublished()) {
            $this->assertValid($row, publishing: true);
        }

        if (! $question->isDirty()) {
            return $question;
        }

        return DB::transaction(function () use ($question, $before, $actor, $keyChanged) {
            if ($keyChanged) {
                $question->version++;
            }
            $question->save();
            $this->audit($question, $actor, 'edited', $this->diff($before, $this->snapshot($question)));

            return $question->refresh();
        });
    }

    /** Moves a question along its lifecycle. Publishing re-checks everything a student will see. */
    public function transition(CoreQuestion $question, string $to, User $actor, ?string $note = null): CoreQuestion
    {
        $from = $question->status;

        if (! in_array($to, self::TRANSITIONS[$from] ?? [], true)) {
            throw ValidationException::withMessages(['status' => ["A {$from} question cannot move to {$to}."]]);
        }

        if ($to === CoreQuestion::STATUS_PUBLISHED) {
            $row = $this->validator->normalise($this->asInput($question));
            $this->assertValid($row, publishing: true);

            if (config('core_prep.require_second_reviewer') && $question->created_by === $actor->id && $actor->role !== User::ROLE_SUPERADMIN) {
                throw ValidationException::withMessages(['status' => ['A second person has to review and publish this — the author cannot publish their own question.']]);
            }
        }

        return DB::transaction(function () use ($question, $to, $from, $actor, $note) {
            $question->status = $to;

            if ($to === CoreQuestion::STATUS_PUBLISHED) {
                $question->reviewed_by = $actor->id;
                $question->reviewed_at = now();
                $question->published_at ??= now();
            }

            $question->save();
            $this->audit($question, $actor, 'status', ['from' => $from, 'to' => $to], $note);

            return $question->refresh();
        });
    }

    /**
     * The audited way to change an answered question's key: records why, bumps the version and tells the
     * graders to rescore. `$changes` may carry correct / options (text only once locked) / numeric range /
     * marks / negative_marks — never the type or the number of options of an answered question.
     *
     * @param  array<string, mixed>  $changes
     */
    public function fixKey(CoreQuestion $question, array $changes, string $reason, User $actor): CoreQuestion
    {
        if (mb_strlen(trim($reason)) < 10) {
            throw ValidationException::withMessages(['reason' => ['Say why the key is being changed (at least a sentence) — it is recorded with the change.']]);
        }

        $merged = array_merge($this->asInput($question), array_intersect_key($changes, array_flip(['correct', 'options', 'numeric_min', 'numeric_max', 'marks', 'negative_marks'])));
        $row = $this->validator->normalise($merged);

        if ($question->isKeyLocked()) {
            $beforeIds = collect($question->options ?? [])->pluck('id')->all();
            $afterIds = collect($row['options'] ?? [])->pluck('id')->all();

            if ($row['type'] !== $question->type || $beforeIds !== $afterIds) {
                throw ValidationException::withMessages(['options' => ['An answered question keeps its type and its options — only the correct answer, the wording and the marks can be fixed.']]);
            }
        }

        $this->assertValid($row, publishing: $question->isPublished());

        $before = $this->snapshot($question);
        $beforeKey = $question->keyFields();
        $question->fill($this->attributes($row));

        if ($beforeKey === $question->keyFields()) {
            throw ValidationException::withMessages(['correct' => ['That is the key it already has.']]);
        }

        return DB::transaction(function () use ($question, $before, $actor, $reason) {
            $question->version++;
            $question->key_fixed_at = now();
            $question->save();
            $this->audit($question, $actor, 'key_fixed', $this->diff($before, $this->snapshot($question)), $reason);

            CoreQuestionKeyFixed::dispatch($question);

            return $question->refresh();
        });
    }

    /** Only a draft nobody has answered can be deleted; anything else is retired so history stays whole. */
    public function delete(CoreQuestion $question): void
    {
        if ($question->status !== CoreQuestion::STATUS_DRAFT || $question->attempts_count > 0) {
            throw ValidationException::withMessages(['question' => ['Only an unused draft can be deleted — retire the question instead.']]);
        }

        if ($question->image_path) {
            Storage::disk('public')->delete($question->image_path);
        }

        $question->delete();
    }

    public function attachImage(CoreQuestion $question, UploadedFile $file, User $actor): CoreQuestion
    {
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->extension());
        abort_unless(in_array($ext, config('core_prep.import.image_extensions', ['png', 'jpg', 'jpeg', 'webp']), true), 422, 'Use a PNG, JPG or WebP image.');

        $old = $question->image_path;
        $path = $file->storeAs('core-questions', "{$question->public_id}-".now()->timestamp.".{$ext}", 'public');

        $question->forceFill(['image_path' => $path])->save();
        $this->audit($question, $actor, 'image', ['image' => $path]);

        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return $question->refresh();
    }

    public function removeImage(CoreQuestion $question, User $actor): CoreQuestion
    {
        if ($question->image_path) {
            Storage::disk('public')->delete($question->image_path);
            $question->forceFill(['image_path' => null])->save();
            $this->audit($question, $actor, 'image', ['image' => null]);
        }

        return $question->refresh();
    }

    public function audit(CoreQuestion $question, ?User $actor, string $action, ?array $changes = null, ?string $note = null): void
    {
        CoreQuestionAudit::create([
            'core_question_id' => $question->id, 'user_id' => $actor?->id, 'action' => $action, 'changes' => $changes, 'note' => $note,
        ]);
    }

    /**
     * Whether a normalised row would be accepted, as a list of errors (the importer reports these per row).
     *
     * @param  array<string, mixed>  $row
     * @return list<array{field: string, message: string}>
     */
    public function errorsFor(array $row, bool $publishing = false): array
    {
        return array_merge($this->validator->validate($row), $publishing ? $this->validator->publishErrors($row) : []);
    }

    /**
     * The question as an input array (what the editor would send back) — so a status move or a key
     * fix re-validates exactly what is stored.
     *
     * @return array<string, mixed>
     */
    public function asInput(CoreQuestion $question): array
    {
        return [
            'external_id' => $question->external_id, 'discipline_code' => $question->discipline_code, 'subject_id' => $question->subject_id,
            'topic_id' => $question->topic_id, 'type' => $question->type, 'stem' => $question->stem, 'options' => $question->options,
            'correct' => $question->correct, 'numeric_min' => $question->numeric_min, 'numeric_max' => $question->numeric_max,
            'numeric_unit' => $question->numeric_unit, 'marks' => $question->marks, 'negative_marks' => $question->negative_marks,
            'difficulty' => $question->difficulty, 'explanation' => $question->explanation, 'tags' => $question->tags,
            'companies' => $question->companies, 'source' => $question->source, 'usage' => $question->usage, 'status' => $question->status,
        ];
    }

    /**
     * The columns to write from a normalised row.
     *
     * @param  array<string, mixed>  $row
     * @return array<string, mixed>
     */
    public function attributes(array $row): array
    {
        return array_intersect_key($row, array_flip([
            'external_id', 'discipline_code', 'subject_id', 'topic_id', 'type', 'stem', 'options', 'correct', 'numeric_min',
            'numeric_max', 'numeric_unit', 'marks', 'negative_marks', 'difficulty', 'explanation', 'tags', 'companies', 'source',
            'usage', 'status',
        ]));
    }

    /** @param  array<string, mixed>  $row */
    private function assertValid(array $row, bool $publishing = false): void
    {
        $errors = $this->errorsFor($row, $publishing);

        if ($errors === []) {
            return;
        }

        $messages = [];
        foreach ($errors as $error) {
            $messages[$error['field']][] = $error['message'];
        }

        throw ValidationException::withMessages($messages);
    }

    /** @return array<string, mixed> */
    private function snapshot(CoreQuestion $question): array
    {
        return $this->asInput($question);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return array<string, array{from: mixed, to: mixed}>
     */
    private function diff(array $before, array $after): array
    {
        $changes = [];

        foreach ($after as $field => $value) {
            if (($before[$field] ?? null) != $value) {
                $changes[$field] = ['from' => $before[$field] ?? null, 'to' => $value];
            }
        }

        return $changes;
    }
}
