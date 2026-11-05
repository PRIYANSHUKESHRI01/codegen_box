<?php

namespace Database\Seeders;

use App\Models\CuratedSetQuestion;
use App\Models\MockInterviewQuestion;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Only the C# & .NET and ASP.NET Core questions (Vault AI Interview + Mock AI Interview), for a dev database that already has the rest:
 *
 *   php artisan db:seed --class=DotNetInterviewQuestionsSeeder
 *
 * It reads the same files as the 2026_11_19_100000 migration and as the all-stacks seeders (CuratedSetQuestionsSeeder and
 * MockInterviewQuestionsSeeder glob the same folders, so a full `db:seed` already includes these). Idempotent: rows are matched on
 * (set, position) / (stack, round, position) and updated in place.
 */
class DotNetInterviewQuestionsSeeder extends Seeder
{
    private const VAULT_FILES = ['dotnet_csharp_part10.php', 'dotnet_aspnet_part11.php'];

    private const MOCK_FILES = ['dotnet_mock.php'];

    public function run(): void
    {
        $adminId = User::where('role', User::ROLE_SUPERADMIN)->value('id');
        $vault = 0;
        $mock = 0;

        DB::transaction(function () use ($adminId, &$vault, &$mock) {
            foreach (self::VAULT_FILES as $file) {
                foreach ((array) require __DIR__.'/data/vault_questions/'.$file as $setId => $questions) {
                    if (! preg_match('/^[a-z_]+-([a-z0-9_]+)-s(\d+)-set(\d+)$/', $setId, $m)) {
                        $this->command?->warn("Skipping unrecognised set id [{$setId}].");

                        continue;
                    }

                    foreach (array_values($questions) as $i => $q) {
                        CuratedSetQuestion::updateOrCreate(
                            ['set_id' => $setId, 'position' => $i + 1],
                            [
                                'stack_key' => $m[1], 'series_number' => (int) $m[2], 'set_number' => (int) $m[3],
                                'text' => $q['text'], 'category' => $q['category'] ?? 'technical',
                                'duration_seconds' => $q['duration_seconds'] ?? 180, 'note' => $q['note'] ?? null, 'created_by' => $adminId,
                            ]
                        );
                        $vault++;
                    }
                }
            }

            foreach (self::MOCK_FILES as $file) {
                foreach ((array) require __DIR__.'/data/mock_questions/'.$file as $stackKey => $rounds) {
                    foreach ($rounds as $round => $questions) {
                        foreach (array_values($questions) as $i => $q) {
                            MockInterviewQuestion::updateOrCreate(
                                ['stack_key' => $stackKey, 'round_number' => (int) $round, 'position' => $i + 1],
                                [
                                    'text' => $q['text'], 'category' => $q['category'] ?? 'technical',
                                    'duration_seconds' => $q['duration_seconds'] ?? 180, 'note' => $q['note'] ?? null,
                                    'origin' => 'document', 'created_by' => $adminId,
                                ]
                            );
                            $mock++;
                        }
                    }
                }
            }
        });

        app(CuratedCatalog::class)->flush();
        app(MockInterviewCatalog::class)->flush();

        $this->command?->info("Seeded {$vault} Vault AI and {$mock} Mock AI questions for C# & .NET and ASP.NET Core.");
    }
}
