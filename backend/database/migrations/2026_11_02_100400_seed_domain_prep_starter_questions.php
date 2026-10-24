<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The first Domain Prep questions for the Management, Commerce and Arts / Humanities departments: at least one for EVERY branch
 * (database/data/domain_questions/*.json — 85 questions), original and modelled on the exams those students actually sit
 * (CAT / CMAT, CA Foundation, UGC-NET). They arrive PUBLISHED but nothing reaches a student: each discipline stays hidden until
 * Superadmin → Core Prep → Coverage switches it on (a pilot college needs just one published question; the public go-live bar
 * is 150). More questions are added through the normal importer; this only gives every branch something real on day one.
 *
 * Idempotent (keyed by external_id) and AI-free: the text was written and checked by hand, and every key was verified. A question
 * a student has already answered is never touched by down().
 */
return new class extends Migration
{
    private const FILES = ['management', 'commerce', 'arts', 'engineering_other'];

    public function up(): void
    {
        $now = now();
        $subjects = [];
        $topics = [];

        foreach (DB::table('core_subjects')->get(['id', 'discipline_code', 'code']) as $s) {
            $subjects[$s->discipline_code][$s->code] = (int) $s->id;
        }

        foreach (DB::table('core_topics')->get(['id', 'subject_id', 'name']) as $t) {
            $topics[(int) $t->subject_id][mb_strtolower($t->name)] = (int) $t->id;
        }

        foreach (self::FILES as $file) {
            $rows = json_decode((string) file_get_contents(database_path("data/domain_questions/{$file}.json")), true) ?: [];

            foreach ($rows as $q) {
                $subjectId = $subjects[$q['discipline']][$q['subject']] ?? null;

                // A deployment that removed the subject would rather skip a question than fail the whole migration.
                if ($subjectId === null || DB::table('core_questions')->where('external_id', $q['external_id'])->exists()) {
                    continue;
                }

                $numeric = $q['type'] === 'numeric';
                $options = $numeric ? null : array_map(
                    fn (string $id) => ['id' => $id, 'text' => $q["option_{$id}"]],
                    array_values(array_filter(['a', 'b', 'c', 'd', 'e', 'f'], fn (string $id) => isset($q["option_{$id}"]) && trim((string) $q["option_{$id}"]) !== ''))
                );

                DB::table('core_questions')->insert([
                    'public_id' => (string) Str::ulid(),
                    'external_id' => $q['external_id'],
                    'discipline_code' => $q['discipline'],
                    'subject_id' => $subjectId,
                    'topic_id' => $topics[$subjectId][mb_strtolower($q['topic'] ?? '')] ?? null,
                    'type' => $q['type'],
                    'stem' => $q['question'],
                    'options' => $options === null ? null : json_encode($options, JSON_UNESCAPED_UNICODE),
                    'correct' => $numeric ? null : json_encode([strtolower($q['correct'])]),
                    'numeric_min' => $numeric ? $q['numeric_min'] : null,
                    'numeric_max' => $numeric ? $q['numeric_max'] : null,
                    'numeric_unit' => $q['numeric_unit'] ?? null,
                    'marks' => $q['marks'],
                    'negative_marks' => $q['negative_marks'],
                    'difficulty' => $q['difficulty'],
                    'explanation' => $q['explanation'],
                    'tags' => json_encode(array_values(array_filter(array_map('trim', explode(';', (string) ($q['tags'] ?? '')))))),
                    'source' => $q['source'] ?? null,
                    'usage' => $q['usage'] ?? 'both',
                    'status' => 'published',
                    'version' => 1,
                    'attempts_count' => 0,
                    'published_at' => $now,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        $ids = [];

        foreach (self::FILES as $file) {
            foreach (json_decode((string) file_get_contents(database_path("data/domain_questions/{$file}.json")), true) ?: [] as $q) {
                $ids[] = $q['external_id'];
            }
        }

        // Anything a student has answered stays (their history points at it).
        DB::table('core_questions')->whereIn('external_id', $ids)->where('attempts_count', 0)->delete();
    }
};
