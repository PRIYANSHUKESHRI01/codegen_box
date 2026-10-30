<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\VaultProfile;
use App\Services\ScoreLedger;
use App\Services\Vault\VaultService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A student's Vault AI Interview result is their BEST: qualifying again (another stack) with a lower average must never replace a higher
 * one on the profile that companies and Mellow Vault see, while a superadmin's deliberate correction still applies exactly.
 */
class VaultAiBestScoreTest extends TestCase
{
    use RefreshDatabase;

    private function profile(User $student): ?VaultProfile
    {
        return VaultProfile::where('user_id', $student->id)->first();
    }

    public function test_a_lower_later_result_never_replaces_a_higher_one(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $vault = app(VaultService::class);

        $vault->applyAiInterviewQualification($student, 'laravel', 'backend', 85.0, [1 => 90, 2 => 85, 3 => 80], 1);
        $vault->applyAiInterviewQualification($student, 'react', 'frontend', 65.0, [1 => 60, 2 => 65, 3 => 70], 2);

        $p = $this->profile($student);
        $this->assertSame(85.0, (float) $p->ai_interview_score);
        // One real qualification, described whole: its stack, role, set scores and attempt travel together.
        $this->assertSame('laravel', $p->ai_interview_stack);
        $this->assertSame('backend', $p->ai_interview_role);
        $this->assertSame(1, $p->ai_interview_attempt);
        $this->assertEquals([1 => 90, 2 => 85, 3 => 80], $p->ai_interview_scores);
        $this->assertTrue($p->is_eligible);
    }

    public function test_a_higher_later_result_replaces_it_and_an_equal_one_changes_nothing(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $vault = app(VaultService::class);

        $vault->applyAiInterviewQualification($student, 'laravel', 'backend', 70.0, [1 => 70, 2 => 70, 3 => 70], 1);
        $vault->applyAiInterviewQualification($student, 'react', 'frontend', 70.0, [1 => 70, 2 => 70, 3 => 70], 1);
        $this->assertSame('laravel', $this->profile($student)->ai_interview_stack, 'a tie keeps the first');

        $vault->applyAiInterviewQualification($student, 'django', 'backend', 92.5, [1 => 90, 2 => 95, 3 => 92], 1);
        $p = $this->profile($student);
        $this->assertSame(92.5, (float) $p->ai_interview_score);
        $this->assertSame('django', $p->ai_interview_stack);
    }

    public function test_a_superadmins_correction_is_applied_exactly_even_when_it_lowers_the_score(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $vault = app(VaultService::class);

        $vault->applyAiInterviewQualification($student, 'laravel', 'backend', 85.0, [1 => 90, 2 => 85, 3 => 80], 1);
        $vault->applyAiInterviewQualification($student, 'laravel', 'backend', 62.0, [1 => 60, 2 => 62, 3 => 64], 1, override: true);

        $this->assertSame(62.0, (float) $this->profile($student)->ai_interview_score);
    }

    public function test_the_score_kept_on_the_student_is_also_only_ever_the_best(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $ledger = app(ScoreLedger::class);

        $ledger->vaultAi($student->id, 55.0);
        $ledger->vaultAi($student->id, 78.5);
        $ledger->vaultAi($student->id, 40.0);
        $ledger->vaultAi($student->id, 78.5);

        $this->assertSame(78.5, (float) $student->fresh()->vault_ai_score);
    }
}
