<?php

namespace Database\Seeders;

use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MockInterviewQuestionsSeeder extends Seeder
{
    /**
     * Seeds practical, authentic interview practice questions for all 41 Mock AI Interview tech stacks.
     * Populates mock_interview_questions with 5 questions per round across 3 rounds (15 questions/stack = 615 total).
     */
    public function run(): void
    {
        $admin = User::where('role', User::ROLE_SUPERADMIN)->first();
        $adminId = $admin?->id;

        $files = $this->files();

        $totalQuestions = 0;
        $totalRounds = 0;
        $seenStacks = [];

        $this->command?->info(sprintf('Loading Mock AI interview questions from %d files...', count($files)));

        DB::beginTransaction();

        try {
            foreach ($files as $file) {
                /** @var array<string, array<int, list<array{text: string, category: string, duration_seconds: int, note: string}>>> $fileData */
                $fileData = require $file;

                foreach ($fileData as $stackKey => $rounds) {
                    $seenStacks[$stackKey] = true;

                    foreach ($rounds as $roundNumber => $questions) {
                        $totalRounds++;

                        foreach ($questions as $index => $q) {
                            $pos = $index + 1;
                            MockInterviewQuestion::updateOrCreate(
                                [
                                    'stack_key' => $stackKey,
                                    'round_number' => (int) $roundNumber,
                                    'position' => $pos,
                                ],
                                [
                                    'text' => $q['text'],
                                    'category' => $q['category'] ?? 'technical',
                                    'duration_seconds' => $q['duration_seconds'] ?? 180,
                                    'note' => $q['note'] ?? null,
                                    'topic' => $q['topic'] ?? null,
                                    'needs_review' => (bool) ($q['needs_review'] ?? false),
                                    'created_by' => $adminId,
                                ]
                            );
                            $totalQuestions++;
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
            'Successfully seeded %d Mock AI Interview questions across %d rounds for %d stacks.',
            $totalQuestions,
            $totalRounds,
            count($seenStacks)
        ));
    }

    /** @return list<string> the data files (one per domain, each returning stack => round => questions) this seeder loads */
    protected function files(): array
    {
        return glob(__DIR__.'/data/mock_questions/*.php') ?: [];
    }

    private function flushCatalog(): void
    {
        // Flush the Mock catalog cache so that fresh database rows are reflected immediately
        app(MockInterviewCatalog::class)->flush();
    }
}

