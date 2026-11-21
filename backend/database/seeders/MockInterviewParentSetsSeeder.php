<?php

namespace Database\Seeders;

use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MockInterviewParentSetsSeeder extends Seeder
{
    /**
     * Seeds practical, authentic interview questions for Parent Sets 2 to 5 across all tech stacks.
     * Each stack gets 4 parent sets (Sets 2-5) x 3 rounds x 5 questions = 60 questions per stack.
     */
    public function run(): void
    {
        $admin = User::where('role', User::ROLE_SUPERADMIN)->first();
        $adminId = $admin?->id;

        $files = $this->files();

        $totalQuestions = 0;
        $totalRounds = 0;
        $seenStacks = [];

        $this->command?->info(sprintf('Loading Mock AI interview parent sets questions from %d files...', count($files)));

        DB::beginTransaction();

        try {
            foreach ($files as $file) {
                /** @var array<string, array<int, array<int, list<array{text: string, category: string, duration_seconds: int, note: string, topic?: string}>>>> $fileData */
                $fileData = require $file;

                foreach ($fileData as $stackKey => $sets) {
                    $seenStacks[$stackKey] = true;

                    foreach ($sets as $setNumber => $rounds) {
                        foreach ($rounds as $roundNumber => $questions) {
                            $totalRounds++;

                            foreach ($questions as $index => $q) {
                                $pos = $index + 1;
                                MockInterviewQuestion::updateOrCreate(
                                    [
                                        'stack_key' => $stackKey,
                                        'parent_set_number' => (int) $setNumber,
                                        'round_number' => (int) $roundNumber,
                                        'position' => $pos,
                                    ],
                                    [
                                        'text' => $q['text'],
                                        'category' => $q['category'] ?? 'technical',
                                        'duration_seconds' => $q['duration_seconds'] ?? 180,
                                        'note' => $q['note'] ?? null,
                                        'topic' => isset($q['topic']) ? substr((string) $q['topic'], 0, 95) : null,
                                        'needs_review' => (bool) ($q['needs_review'] ?? false),
                                        'origin' => $q['origin'] ?? 'staff',
                                        'image' => $q['image'] ?? null,
                                        'created_by' => $adminId,
                                    ]
                                );
                                $totalQuestions++;
                            }
                        }
                    }
                }
            }

            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        $this->flushCatalog();

        $this->command?->info(sprintf(
            'Successfully seeded %d Mock AI Interview questions across %d rounds for %d stacks (Series 2-10).',
            $totalQuestions,
            $totalRounds,
            count($seenStacks)
        ));
    }

    /** @return list<string> the data files */
    protected function files(): array
    {
        return glob(__DIR__.'/data/mock_questions_parent_sets/*.php') ?: [];
    }

    private function flushCatalog(): void
    {
        app(MockInterviewCatalog::class)->flush();
    }
}
