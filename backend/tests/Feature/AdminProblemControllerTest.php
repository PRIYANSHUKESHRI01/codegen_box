<?php

namespace Tests\Feature;

use App\Models\Problem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the one write path for the problem catalog: every problem must be
 * created/updated with exactly 10 test cases (3 samples first, then 7
 * hidden — the shape JudgeService's reveal policy assumes), and the
 * submitted reference solution must actually pass all of them or nothing is
 * persisted. See AdminProblemController.
 */
class AdminProblemControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_PROBLEM_BANK]]);
    }

    /** @return array<string, mixed> */
    private function payload(array $overrides = []): array
    {
        $testCases = [];
        foreach (range(0, 9) as $i) {
            $testCases[] = [
                'inputs' => ['nums' => [$i, $i + 1], 'target' => 2 * $i + 1],
                'expected_output' => [0, 1],
                'is_sample' => $i < 3,
            ];
        }

        return array_merge([
            'title' => 'Two Sum Admin Test',
            'difficulty' => 'easy',
            'tags' => ['Array'],
            'description' => 'Find two numbers.',
            'constraints' => [],
            'hints' => [],
            'function_name' => 'twoSum',
            'params' => [
                ['name' => 'nums', 'type' => 'integer[]'],
                ['name' => 'target', 'type' => 'integer'],
            ],
            'return_type' => 'integer[]',
            'test_cases' => $testCases,
            'reference_solution' => ['language' => 'python', 'code' => 'pass'],
        ], $overrides);
    }

    private function fakeAllCasesCorrect(int $count = 10): void
    {
        Http::fake(['piston-test:2000/*' => Http::response([
            'run' => ['stdout' => str_repeat("[0,1]\n", $count), 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 10, 'memory' => 2048000],
            'compile' => null,
        ])]);
    }

    public function test_store_requires_exactly_ten_test_cases(): void
    {
        Sanctum::actingAs($this->admin());

        $payload = $this->payload(['test_cases' => array_slice($this->payload()['test_cases'], 0, 5)]);

        $this->postJson('/api/admin/problems', $payload)->assertStatus(422)->assertJsonValidationErrors('test_cases');
        $this->assertSame(0, Problem::count());
    }

    public function test_store_requires_the_first_three_cases_to_be_samples_and_the_rest_hidden(): void
    {
        Sanctum::actingAs($this->admin());

        $testCases = $this->payload()['test_cases'];
        // Flip one sample flag so the 3-then-7 shape is violated.
        $testCases[0]['is_sample'] = false;
        $testCases[3]['is_sample'] = true;

        $this->postJson('/api/admin/problems', $this->payload(['test_cases' => $testCases]))
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'exactly 3 sample'));

        $this->assertSame(0, Problem::count());
    }

    public function test_store_creates_a_verified_problem_with_three_samples_and_seven_hidden_cases(): void
    {
        Sanctum::actingAs($this->admin());
        $this->fakeAllCasesCorrect();

        $this->postJson('/api/admin/problems', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('verification.all_passed', true);

        $problem = Problem::firstOrFail();
        $this->assertSame(10, $problem->testCases()->count());
        $this->assertSame(3, $problem->sampleTestCases()->count());
    }

    public function test_store_rolls_back_everything_when_the_reference_solution_fails_a_case(): void
    {
        Sanctum::actingAs($this->admin());

        // Only 9 of the 10 expected lines, so the comparison fails on the last case.
        Http::fake(['piston-test:2000/*' => Http::response([
            'run' => ['stdout' => str_repeat("[0,1]\n", 9)."[9,9]\n", 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 10, 'memory' => 2048000],
            'compile' => null,
        ])]);

        $this->postJson('/api/admin/problems', $this->payload())
            ->assertStatus(422)
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'did not pass every test case'));

        $this->assertSame(0, Problem::count(), 'nothing persists when verification fails, even though the row and its test cases were written inside the transaction');
    }

    public function test_store_is_rejected_without_the_problem_bank_permission(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => []]));

        $this->postJson('/api/admin/problems', $this->payload())->assertForbidden();
        $this->assertSame(0, Problem::count());
    }

    public function test_update_replaces_the_test_cases_and_reverifies_them(): void
    {
        Sanctum::actingAs($this->admin());
        $this->fakeAllCasesCorrect();
        $this->postJson('/api/admin/problems', $this->payload())->assertStatus(201);
        $problem = Problem::firstOrFail();
        $originalCaseId = $problem->testCases()->first()->id;

        $newPayload = $this->payload(['title' => 'Two Sum Admin Test Renamed']);
        $this->putJson("/api/admin/problems/{$problem->slug}", $newPayload)
            ->assertOk()
            ->assertJsonPath('verification.all_passed', true);

        $problem->refresh();
        $this->assertSame('Two Sum Admin Test Renamed', $problem->title);
        $this->assertSame(10, $problem->testCases()->count());
        $this->assertDatabaseMissing('problem_test_cases', ['id' => $originalCaseId]);
        $this->assertSame(1, Problem::count(), 'update() must not create a second row');
    }
}
