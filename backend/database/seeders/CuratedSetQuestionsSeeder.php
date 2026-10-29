<?php

namespace Database\Seeders;

use App\Models\CuratedSetQuestion;
use App\Models\User;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CuratedSetQuestionsSeeder extends Seeder
{
    /**
     * Seeds production-grade, authentic interview questions for all Mellow Vault AI Interview domains.
     * Populates curated_set_questions with 5 questions per set across 3 series x 3 sets (45 questions/stack).
     */
    public function run(): void
    {
        $admin = User::where('role', User::ROLE_SUPERADMIN)->first();
        $adminId = $admin?->id;

        $roles = array_keys((array) config('curated_interview_domains.roles', []));
        // Sort roles by length descending so longer matching prefixes match first
        usort($roles, fn ($a, $b) => strlen($b) <=> strlen($a));

        $dataDir = __DIR__ . '/data/vault_questions';
        $files = glob($dataDir . '/*.php');

        $totalQuestions = 0;
        $totalSets = 0;
        $seenStacks = [];

        $this->command?->info(sprintf('Loading curated Vault AI interview questions from %d files...', count($files)));

        DB::beginTransaction();

        try {
            foreach ($files as $file) {
                /** @var array<string, list<array{text: string, category: string, duration_seconds: int, note: string}>> $setData */
                $setData = require $file;

                foreach ($setData as $setId => $questions) {
                    // Parse setId: {roleKey}-{stackKey}-s{series}-set{set}
                    $matchedRole = null;
                    foreach ($roles as $roleKey) {
                        if (str_starts_with($setId, $roleKey . '-')) {
                            $matchedRole = $roleKey;
                            break;
                        }
                    }

                    if (! $matchedRole) {
                        $this->command?->warn("Could not determine role for set ID [{$setId}], skipping.");
                        continue;
                    }

                    $remaining = substr($setId, strlen($matchedRole) + 1);
                    if (! preg_match('/^(.*)-s(\d+)-set(\d+)$/', $remaining, $matches)) {
                        $this->command?->warn("Could not parse series/set for set ID [{$setId}], skipping.");
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
        } catch (\Throwable $e) {
            DB::rollBack();
            throw $e;
        }

        // Flush the catalog cache so the fresh database rows are reflected immediately
        app(CuratedCatalog::class)->flush();

        $this->command?->info(sprintf(
            'Successfully seeded %d questions across %d sets and %d stacks!',
            $totalQuestions,
            $totalSets,
            count($seenStacks)
        ));
    }
}

