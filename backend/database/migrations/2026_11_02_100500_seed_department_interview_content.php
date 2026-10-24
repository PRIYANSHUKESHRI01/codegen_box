<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * AI interviews for the Management, Commerce and Arts / Humanities departments: Mellow's own role templates (one per role card
 * except the generic "fundamentals" one) and a starter set of spoken technical questions in the interview bank, tagged with the
 * discipline so only that field's students are asked them. Everything comes from database/data/department_interview_content.php —
 * the same file the Practice-interview studio reads its role cards from.
 *
 * Idempotent: a template is matched by name and a question by (text, discipline), and neither is touched if it exists. down()
 * removes only what this migration made, and never a template a track was built from or a question an interview already asked.
 */
return new class extends Migration
{
    /** @return array<string, array{label: string, roles: list<array<string, mixed>>, questions: list<array<string, mixed>>}> */
    private function content(): array
    {
        return require database_path('data/department_interview_content.php');
    }

    /** @return list<array<string, mixed>> */
    private function rounds(): array
    {
        return [
            ['round_number' => 1, 'round_name' => 'Core Fundamentals', 'question_count' => 6, 'difficulty' => 'easy', 'category_weights' => ['technical' => 70, 'aptitude' => 30], 'qualifying_score_percent' => 50.0],
            ['round_number' => 2, 'round_name' => 'Applied Reasoning', 'question_count' => 6, 'difficulty' => 'medium', 'category_weights' => ['technical' => 70, 'situational' => 30], 'qualifying_score_percent' => 55.0],
            ['round_number' => 3, 'round_name' => 'Projects, Managerial & HR', 'question_count' => 5, 'difficulty' => 'medium', 'category_weights' => ['technical' => 30, 'behavioral' => 30, 'situational' => 20, 'hr' => 20], 'qualifying_score_percent' => 50.0],
        ];
    }

    /** @return list<array{name: string, discipline: string, description: string, tags: list<string>}> */
    private function templates(): array
    {
        $out = [];

        foreach ($this->content() as $discipline => $block) {
            foreach ($block['roles'] as $role) {
                // The "fundamentals — any role" card is a studio convenience, not a job a college would build a track for.
                if (str_ends_with($role['key'], '_fundamentals')) {
                    continue;
                }

                $out[] = [
                    'name' => $role['title'],
                    'discipline' => $discipline,
                    'description' => $role['blurb'].' Built for '.$block['label'].' students.',
                    'tags' => $role['tags'],
                ];
            }
        }

        return $out;
    }

    public function up(): void
    {
        $now = now();

        foreach ($this->templates() as $t) {
            $exists = DB::table('interview_role_templates')->where('name', $t['name'])->whereNull('owning_college_id')->whereNull('owning_company_id')->exists();

            if (! $exists) {
                DB::table('interview_role_templates')->insert([
                    'name' => $t['name'],
                    'description' => $t['description'],
                    'tech_stack_tags' => json_encode($t['tags']),
                    'rounds_config' => json_encode($this->rounds()),
                    'discipline' => $t['discipline'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }

        foreach ($this->content() as $discipline => $block) {
            foreach ($block['questions'] as $q) {
                $exists = DB::table('interview_question_banks')->where('question_text', $q['q'])->where('discipline', $discipline)->exists();

                if (! $exists) {
                    DB::table('interview_question_banks')->insert([
                        'question_text' => $q['q'],
                        'category' => 'technical',
                        'difficulty' => $q['difficulty'],
                        'expected_duration_seconds' => $q['secs'],
                        'tags' => json_encode(array_values($q['tags'])),
                        'notes_for_reviewer' => $q['notes'],
                        'discipline' => $discipline,
                        'is_active' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        $inUse = DB::table('interview_tracks')->whereNotNull('interview_role_template_id')->pluck('interview_role_template_id')->all();

        DB::table('interview_role_templates')->whereIn('name', array_column($this->templates(), 'name'))
            ->whereIn('discipline', array_keys($this->content()))
            ->whereNull('owning_college_id')->whereNull('owning_company_id')->whereNotIn('id', $inUse)->delete();

        $asked = DB::table('interview_questions')->pluck('interview_question_bank_id')->all();

        foreach ($this->content() as $discipline => $block) {
            DB::table('interview_question_banks')->whereIn('question_text', array_column($block['questions'], 'q'))
                ->where('discipline', $discipline)->whereNotIn('id', $asked)->delete();
        }
    }
};
