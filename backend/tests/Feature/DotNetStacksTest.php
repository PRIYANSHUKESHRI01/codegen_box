<?php

namespace Tests\Feature;

use App\Models\CuratedSetQuestion;
use App\Models\MockInterviewQuestion;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * C# & .NET (csharp_dotnet) and ASP.NET Core (aspnet_core): two Backend stacks in BOTH the Vault AI Interview and the Mock AI Interview.
 * Their questions arrive with the 2026_11_19_100000 migration (a deploy runs `migrate`, never `db:seed`), so a freshly migrated database
 * already has them open to students — which is what these tests check, on the migrated data itself.
 */
class DotNetStacksTest extends TestCase
{
    use RefreshDatabase;

    private const STACKS = ['csharp_dotnet', 'aspnet_core'];

    private function migration(): object
    {
        return require database_path('migrations/2026_11_19_100000_add_dotnet_interview_questions.php');
    }

    public function test_both_stacks_are_in_the_backend_role_and_findable_by_the_names_people_search(): void
    {
        $catalog = app(CuratedCatalog::class);

        foreach (self::STACKS as $key) {
            $found = $catalog->stack($key);
            $this->assertNotNull($found, $key);
            $this->assertSame('backend', $found['role']['key']);
            $this->assertCount(3, $found['stack']['series']);
        }

        $csharp = $catalog->stack('csharp_dotnet')['stack'];
        $aspnet = $catalog->stack('aspnet_core')['stack'];
        $this->assertSame('C# & .NET', $csharp['name']);
        $this->assertSame('ASP.NET Core', $aspnet['name']);
        $this->assertContains('.NET Developer', $csharp['aliases']);
        $this->assertContains('C#', $csharp['aliases']);
        $this->assertContains('ASP.NET', $aspnet['aliases']);
    }

    public function test_the_vault_ai_stacks_ship_open_with_five_real_questions_in_each_of_nine_sets(): void
    {
        $catalog = app(CuratedCatalog::class);

        foreach (self::STACKS as $key) {
            $stack = $catalog->stack($key)['stack'];
            $progress = $catalog->progress($stack);

            $this->assertTrue($progress['live'], "{$key} is open to students");
            $this->assertSame(9, $progress['ready_sets']);

            $texts = [];
            foreach ($catalog->allSets($stack) as $set) {
                $this->assertCount(5, $set['questions'], $set['id']);

                foreach ($set['questions'] as $q) {
                    $this->assertGreaterThan(40, mb_strlen($q['text']), "{$set['id']}: question text");
                    $this->assertGreaterThan(60, mb_strlen((string) $q['note']), "{$set['id']}: the answer rubric the AI scorer is given");
                    $this->assertContains($q['category'], ['technical', 'architecture', 'scenario', 'situational']);
                    $texts[] = $q['text'];
                }
            }

            $this->assertCount(45, $texts);
            $this->assertCount(45, array_unique($texts), "{$key}: no question is asked twice");
        }
    }

    public function test_the_mock_ai_interview_lists_both_stacks_with_three_ready_rounds_that_follow_the_vault_themes(): void
    {
        $mock = app(MockInterviewCatalog::class);

        foreach (self::STACKS as $key) {
            $found = $mock->stack($key);
            $this->assertNotNull($found, $key);
            $this->assertSame('backend', $found['role']['key']);
            $this->assertCount(3, $found['stack']['rounds']);

            foreach ($found['stack']['rounds'] as $round) {
                $this->assertTrue($mock->isRoundReady($round), "{$key} {$round['title']}");
                $this->assertCount(5, $round['questions']);
            }
        }

        $this->assertSame('Round 1: C# Language Core & OOP', $mock->stack('csharp_dotnet')['stack']['rounds'][0]['title']);
        $this->assertSame('Round 1: Middleware, Routing & Dependency Injection', $mock->stack('aspnet_core')['stack']['rounds'][0]['title']);
    }

    public function test_the_migration_is_safe_to_run_again_and_leaves_staff_questions_alone(): void
    {
        $vaultBefore = CuratedSetQuestion::whereIn('stack_key', self::STACKS)->count();
        $mockBefore = MockInterviewQuestion::whereIn('stack_key', self::STACKS)->count();
        $this->assertSame(90, $vaultBefore);
        $this->assertSame(30, $mockBefore);

        // Staff edit one shipped question and add a sixth to a set.
        $edited = CuratedSetQuestion::where('set_id', 'backend-aspnet_core-s1-set1')->where('position', 1)->firstOrFail();
        $edited->update(['text' => 'A rewritten question that staff prefer.']);
        $added = CuratedSetQuestion::create([
            'set_id' => 'backend-aspnet_core-s1-set1', 'stack_key' => 'aspnet_core', 'series_number' => 1, 'set_number' => 1,
            'position' => 6, 'text' => 'A sixth question staff added by hand.', 'category' => 'technical', 'duration_seconds' => 180,
        ]);

        $this->migration()->up();
        $this->migration()->up();

        $this->assertSame($vaultBefore + 1, CuratedSetQuestion::whereIn('stack_key', self::STACKS)->count(), 'no duplicates, and the staff row is still there');
        $this->assertSame($mockBefore, MockInterviewQuestion::whereIn('stack_key', self::STACKS)->count());
        $this->assertSame('A sixth question staff added by hand.', $added->fresh()->text);
        $this->assertStringContainsString('middleware', mb_strtolower($edited->fresh()->text), 'a shipped question is put back to the shipped wording when the migration is re-run');
    }

    public function test_rolling_the_migration_back_removes_only_what_it_added(): void
    {
        $other = CuratedSetQuestion::create([
            'set_id' => 'backend-laravel-s1-set1', 'stack_key' => 'laravel', 'series_number' => 1, 'set_number' => 1,
            'position' => 99, 'text' => 'Another stack question that must survive.', 'category' => 'technical', 'duration_seconds' => 180,
        ]);
        $staffs = CuratedSetQuestion::create([
            'set_id' => 'backend-aspnet_core-s1-set1', 'stack_key' => 'aspnet_core', 'series_number' => 1, 'set_number' => 1,
            'position' => 6, 'text' => 'A sixth question staff added by hand.', 'category' => 'technical', 'duration_seconds' => 180,
        ]);

        $this->migration()->down();

        $this->assertSame(1, CuratedSetQuestion::where('stack_key', 'aspnet_core')->count());
        $this->assertSame(0, CuratedSetQuestion::where('stack_key', 'csharp_dotnet')->count());
        $this->assertSame(0, MockInterviewQuestion::whereIn('stack_key', self::STACKS)->count());
        $this->assertNotNull($other->fresh());
        $this->assertNotNull($staffs->fresh());
    }
}
