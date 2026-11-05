<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two new Backend stacks for the Vault AI Interview and the Mock AI Interview: "C# & .NET" (csharp_dotnet) and "ASP.NET Core" (aspnet_core).
 *
 * The stacks themselves are catalogue config (config/curated_interview_domains.php, which the Mock catalogue reads too), so they need no
 * schema. What this migration ships is their QUESTIONS, because a deploy runs `migrate` and never `db:seed`:
 *   - 90 Vault AI questions   (2 stacks x 3 series x 3 sets x 5)  -> curated_set_questions
 *   - 30 Mock AI questions    (2 stacks x 3 rounds x 5)            -> mock_interview_questions
 * The rows come from the same data files the seeders load (database/seeders/data/{vault,mock}_questions/dotnet_*), so a fresh dev
 * database seeded with `db:seed` and a deployed one end up identical.
 *
 * Safe to run twice and safe next to staff edits: a row is matched on (set, position) / (stack, round, position) and updated in place;
 * questions staff added at later positions, or to other stacks, are never touched. Once a stack has 5 questions in each of its 9 sets it
 * opens to students by itself (CuratedCatalog), and its Mock rounds open at 5 each.
 */
return new class extends Migration
{
    private const VAULT_FILES = ['dotnet_csharp_part10.php', 'dotnet_aspnet_part11.php'];

    private const MOCK_FILES = ['dotnet_mock.php'];

    public function up(): void
    {
        $now = now();

        foreach (self::VAULT_FILES as $file) {
            /** @var array<string, list<array{text: string, category: string, duration_seconds: int, note: string}>> $sets */
            $sets = require database_path('seeders/data/vault_questions/'.$file);

            foreach ($sets as $setId => $questions) {
                // {role}-{stack}-s{series}-set{set}, e.g. backend-aspnet_core-s2-set3
                if (! preg_match('/^[a-z_]+-([a-z0-9_]+)-s(\d+)-set(\d+)$/', $setId, $m)) {
                    throw new RuntimeException("Unrecognised Vault set id [{$setId}] in {$file}.");
                }

                foreach (array_values($questions) as $i => $q) {
                    $position = $i + 1;
                    $row = [
                        'stack_key' => $m[1],
                        'series_number' => (int) $m[2],
                        'set_number' => (int) $m[3],
                        'text' => $q['text'],
                        'category' => $q['category'] ?? 'technical',
                        'duration_seconds' => $q['duration_seconds'] ?? 180,
                        'note' => $q['note'] ?? null,
                        'updated_at' => $now,
                    ];

                    $existing = DB::table('curated_set_questions')->where('set_id', $setId)->where('position', $position)->first(['id']);

                    if ($existing) {
                        DB::table('curated_set_questions')->where('id', $existing->id)->update($row);
                    } else {
                        DB::table('curated_set_questions')->insert($row + ['set_id' => $setId, 'position' => $position, 'created_at' => $now]);
                    }
                }
            }
        }

        $hasOrigin = Schema::hasColumn('mock_interview_questions', 'origin');

        foreach (self::MOCK_FILES as $file) {
            /** @var array<string, array<int, list<array{text: string, category: string, duration_seconds: int, note: string}>>> $stacks */
            $stacks = require database_path('seeders/data/mock_questions/'.$file);

            foreach ($stacks as $stackKey => $rounds) {
                foreach ($rounds as $round => $questions) {
                    foreach (array_values($questions) as $i => $q) {
                        $position = $i + 1;
                        $row = [
                            'text' => $q['text'],
                            'category' => $q['category'] ?? 'technical',
                            'duration_seconds' => $q['duration_seconds'] ?? 180,
                            'note' => $q['note'] ?? null,
                            'updated_at' => $now,
                        ] + ($hasOrigin ? ['origin' => 'document'] : []);

                        $where = ['stack_key' => $stackKey, 'round_number' => (int) $round, 'position' => $position];
                        $existing = DB::table('mock_interview_questions')->where($where)->first(['id']);

                        if ($existing) {
                            DB::table('mock_interview_questions')->where('id', $existing->id)->update($row);
                        } else {
                            DB::table('mock_interview_questions')->insert($row + $where + ['created_at' => $now]);
                        }
                    }
                }
            }
        }
    }

    /** Removes exactly the rows this migration put in place (matched on the same keys), leaving any other question alone. */
    public function down(): void
    {
        DB::table('curated_set_questions')->whereIn('stack_key', ['csharp_dotnet', 'aspnet_core'])->where('position', '<=', 5)->delete();
        DB::table('mock_interview_questions')->whereIn('stack_key', ['csharp_dotnet', 'aspnet_core'])->where('position', '<=', 5)->delete();
    }
};
