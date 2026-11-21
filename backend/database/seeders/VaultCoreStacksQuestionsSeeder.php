<?php

namespace Database\Seeders;

use App\Models\CuratedSetQuestion;
use App\Models\User;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class VaultCoreStacksQuestionsSeeder extends Seeder
{
    /**
     * Seeds authentic, production-grade interview questions for core developer stacks
     * (Node.js, Python, Java, Go, React, TypeScript, MERN, Next.js Fullstack, LLM/RAG, PyTorch, Docker/K8s).
     * Populates curated_set_questions with 5 questions per set across 3 series x 3 sets (45 questions/stack).
     */
    public function run(): void
    {
        $admin = User::where('role', User::ROLE_SUPERADMIN)->first();
        $adminId = $admin?->id;

        $roles = array_keys((array) config('curated_interview_domains.roles', []));
        usort($roles, fn ($a, $b) => strlen($b) <=> strlen($a));

        $dataDir = __DIR__ . '/data/vault_questions';
        $coreFiles = [
            $dataDir . '/core_backend_part12.php',
            $dataDir . '/core_frontend_fullstack_part13.php',
            $dataDir . '/core_aiml_devops_part14.php',
        ];

        $totalQuestions = 0;
        $totalSets = 0;
        $seenStacks = [];

        $this->command?->info('Seeding Vault AI interview questions for core developer stacks...');

        DB::beginTransaction();

        try {
            foreach ($coreFiles as $file) {
                if (! file_exists($file)) {
                    continue;
                }

                /** @var array<string, list<array{text: string, category: string, duration_seconds: int, note: string}>> $setData */
                $setData = require $file;

                foreach ($setData as $setId => $questions) {
                    $matchedRole = null;
                    foreach ($roles as $roleKey) {
                        if (str_starts_with($setId, $roleKey . '-')) {
                            $matchedRole = $roleKey;
                            break;
                        }
                    }

                    if (! $matchedRole) {
                        continue;
                    }

                    $remaining = substr($setId, strlen($matchedRole) + 1);
                    if (! preg_match('/^(.*)-s(\d+)-set(\d+)$/', $remaining, $matches)) {
                        continue;
                    }

                    $stackKey = $matches[1];
                    $seriesNumber = (int) $matches[2];
                    $setNumber = (int) $matches[3];

                    $seenStacks[$stackKey] = true;
                    $totalSets++;

                    foreach ($questions as $index => $q) {
                        $pos = $index + 1;
                        CuratedSetQuestion::updateOrCreate(
                            [
                                'set_id' => $setId,
                                'position' => $pos,
                            ],
                            [
                                'stack_key' => $stackKey,
                                'series_number' => $seriesNumber,
                                'set_number' => $setNumber,
                                'text' => $q['text'],
                                'category' => $q['category'] ?? 'technical',
                                'duration_seconds' => $q['duration_seconds'] ?? 180,
                                'note' => $q['note'] ?? null,
                                'created_by' => $adminId,
                            ]
                        );
                        $totalQuestions++;
                    }
                }
            }

            DB::commit();
            app(CuratedCatalog::class)->flush();

            $this->command?->info(sprintf(
                'Successfully seeded %d core stack questions across %d sets in %d stacks.',
                $totalQuestions,
                $totalSets,
                count($seenStacks)
            ));
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->command?->error('Failed to seed core stack questions: ' . $e->getMessage());
            throw $e;
        }
    }
}
