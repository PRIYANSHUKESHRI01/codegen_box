<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Hackathon;
use App\Models\HackathonSubmission;
use App\Services\Hackathons\HackathonResultsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHackathonFixtures;
use Tests\TestCase;

/**
 * Scoring, ranking and publishing results.
 */
class HackathonJudgingTest extends TestCase
{
    use CreatesHackathonFixtures;
    use RefreshDatabase;

    /** Two criteria worth 60 and 40, so the arithmetic is easy to check by hand. */
    private const CRITERIA = [
        ['name' => 'Impact', 'weight' => 60, 'description' => null],
        ['name' => 'Craft', 'weight' => 40, 'description' => null],
    ];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function judged(array $overrides = []): Hackathon
    {
        return $this->endedHackathon($overrides + ['criteria' => self::CRITERIA]);
    }

    private function score(Hackathon $h, HackathonSubmission $s, float $impact, float $craft, ?string $feedback = null, string $prefix = 'admin')
    {
        return $this->postJson("/api/{$prefix}/hackathons/{$h->id}/submissions/{$s->id}/score", [
            'scores' => [['criterion' => 'Impact', 'score' => $impact], ['criterion' => 'Craft', 'score' => $craft]],
            'feedback' => $feedback,
        ]);
    }

    // ───────────────────────────── the maths ─────────────────────────────

    public function test_the_score_is_the_weighted_average_out_of_100(): void
    {
        $service = app(HackathonResultsService::class);
        $hackathon = $this->judged();

        $this->assertSame(100.0, $service->weightedScore($hackathon, ['Impact' => 10, 'Craft' => 10]));
        $this->assertSame(0.0, $service->weightedScore($hackathon, ['Impact' => 0, 'Craft' => 0]));
        $this->assertSame(50.0, $service->weightedScore($hackathon, ['Impact' => 5, 'Craft' => 5]));
        // 8/10 of 60 + 5/10 of 40 = 48 + 20
        $this->assertSame(68.0, $service->weightedScore($hackathon, ['Impact' => 8, 'Craft' => 5]));
        $this->assertSame(81.0, $service->weightedScore($hackathon, ['Impact' => 9.5, 'Craft' => 6]));
    }

    public function test_the_default_criteria_apply_when_a_host_sets_none(): void
    {
        $service = app(HackathonResultsService::class);
        $hackathon = $this->endedHackathon(['criteria' => null]);

        $this->assertCount(4, $hackathon->effectiveCriteria());
        $this->assertSame(100, array_sum(array_column($hackathon->effectiveCriteria(), 'weight')));
        $this->assertSame(
            100.0,
            $service->weightedScore($hackathon, ['Innovation' => 10, 'Technical depth' => 10, 'Impact' => 10, 'Presentation' => 10])
        );
    }

    public function test_weights_that_do_not_sum_to_100_are_normalised_defensively(): void
    {
        $hackathon = $this->endedHackathon(['criteria' => [['name' => 'A', 'weight' => 30], ['name' => 'B', 'weight' => 30]]]);

        $this->assertSame(100.0, app(HackathonResultsService::class)->weightedScore($hackathon, ['A' => 10, 'B' => 10]));
    }

    // ───────────────────────────── scoring ─────────────────────────────

    public function test_a_host_scores_a_submitted_project(): void
    {
        Sanctum::actingAs($host = $this->staff());
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon);

        $this->score($hackathon, $project, 8, 5, 'Nicely done.')
            ->assertOk()
            ->assertJsonPath('submission.final_score', 68)
            ->assertJsonPath('submission.feedback', 'Nicely done.')
            ->assertJsonPath('submission.scores.Impact', 8)
            ->assertJsonPath('unscored_count', 0);

        $this->assertSame($host->id, $project->fresh()->scored_by);
    }

    public function test_scoring_is_refused_before_the_deadline_and_for_unsubmitted_drafts(): void
    {
        Sanctum::actingAs($this->staff());

        $live = $this->liveHackathon(['criteria' => self::CRITERIA]);
        $early = $this->submittedProject($live);
        $this->score($live, $early, 5, 5)->assertStatus(409)->assertJsonPath('code', 'judging_not_open');

        $ended = $this->judged();
        $draft = $this->submittedProject($ended, ['status' => 'draft', 'submitted_at' => null]);
        $this->score($ended, $draft, 5, 5)->assertStatus(409)->assertJsonPath('code', 'not_submitted');
    }

    public function test_marks_are_validated(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon);
        $url = "/api/admin/hackathons/{$hackathon->id}/submissions/{$project->id}/score";

        $this->postJson($url, ['scores' => [['criterion' => 'Impact', 'score' => 11], ['criterion' => 'Craft', 'score' => 5]]])
            ->assertUnprocessable()->assertJsonValidationErrors('scores.0.score');

        $this->postJson($url, ['scores' => [['criterion' => 'Impact', 'score' => 8]]])
            ->assertUnprocessable()->assertJsonValidationErrors('scores');

        $this->postJson($url, ['scores' => [['criterion' => 'Impact', 'score' => 8], ['criterion' => 'Craft', 'score' => 5], ['criterion' => 'Vibes', 'score' => 10]]])
            ->assertUnprocessable()->assertJsonValidationErrors('scores');

        $this->assertNull($project->fresh()->final_score);
    }

    public function test_a_project_can_only_be_scored_through_its_own_hackathon(): void
    {
        Sanctum::actingAs($this->staff());
        $mine = $this->judged();
        $other = $this->judged();
        $foreign = $this->submittedProject($other);

        $this->score($mine, $foreign, 5, 5)->assertNotFound();
        $this->assertNull($foreign->fresh()->final_score);
    }

    public function test_a_company_judges_only_its_own_hackathon(): void
    {
        $company = $this->company();
        $own = $this->judged(['host_type' => 'company', 'company_id' => $company->id]);
        $ownProject = $this->submittedProject($own);
        $platform = $this->judged();
        $platformProject = $this->submittedProject($platform);

        Sanctum::actingAs($this->companyAdmin($company));

        $this->score($own, $ownProject, 7, 7, null, 'company')->assertOk();
        $this->score($platform, $platformProject, 7, 7, null, 'company')->assertNotFound();
        $this->assertNull($platformProject->fresh()->final_score);
    }

    public function test_the_judging_list_shows_everything_to_the_host(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $this->submittedProject($hackathon, ['title' => 'One']);
        $this->submittedProject($hackathon, ['title' => 'Two', 'final_score' => 70]);
        $this->submittedProject($hackathon, ['title' => 'Draft', 'status' => 'draft', 'submitted_at' => null]);

        $this->getJson("/api/admin/hackathons/{$hackathon->id}/submissions")
            ->assertOk()
            ->assertJsonCount(3, 'submissions')
            ->assertJsonPath('judging_open', true)
            ->assertJsonPath('unscored_count', 1)
            ->assertJsonPath('criteria.0.name', 'Impact');
    }

    // ───────────────────────────── publishing results ─────────────────────────────

    public function test_projects_are_ranked_by_score_with_prizes_attached(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $low = $this->submittedProject($hackathon, ['title' => 'Low']);
        $top = $this->submittedProject($hackathon, ['title' => 'Top']);
        $mid = $this->submittedProject($hackathon, ['title' => 'Mid']);

        $this->score($hackathon, $low, 4, 4);
        $this->score($hackathon, $top, 9, 9);
        $this->score($hackathon, $mid, 7, 7);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")
            ->assertOk()
            ->assertJsonPath('outcome.ranked', 3)
            ->assertJsonPath('hackathon.phase', 'completed');

        $this->assertSame([1, 2, 3], [$top->fresh()->rank, $mid->fresh()->rank, $low->fresh()->rank]);
        $this->assertSame('Champion', $top->fresh()->award_label);
        $this->assertSame('Runner-up', $mid->fresh()->award_label);
        $this->assertNull($low->fresh()->award_label, 'third place has no prize defined in the fixture');
        $this->assertNotNull($hackathon->fresh()->results_published_at);
    }

    public function test_a_tie_goes_to_the_team_that_submitted_first(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $later = $this->submittedProject($hackathon, ['title' => 'Later', 'submitted_at' => now()->subHours(2)]);
        $earlier = $this->submittedProject($hackathon, ['title' => 'Earlier', 'submitted_at' => now()->subHours(9)]);

        $this->score($hackathon, $later, 8, 8);
        $this->score($hackathon, $earlier, 8, 8);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $this->assertSame(1, $earlier->fresh()->rank);
        $this->assertSame(2, $later->fresh()->rank);
    }

    public function test_disqualified_and_unsubmitted_projects_are_never_ranked(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $good = $this->submittedProject($hackathon, ['title' => 'Good']);
        $cheat = $this->submittedProject($hackathon, ['title' => 'Cheat']);
        $draft = $this->submittedProject($hackathon, ['title' => 'Draft', 'status' => 'draft', 'submitted_at' => null]);

        $this->score($hackathon, $good, 5, 5);
        $this->score($hackathon, $cheat, 10, 10);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/submissions/{$cheat->id}/disqualify", ['reason' => 'Copied from another repo'])
            ->assertOk()->assertJsonPath('submission.is_disqualified', true);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk()->assertJsonPath('outcome.disqualified', 1);

        $this->assertSame(1, $good->fresh()->rank);
        $this->assertNull($cheat->fresh()->rank);
        $this->assertNull($draft->fresh()->rank);
    }

    public function test_results_cannot_be_published_until_every_project_is_scored(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $scored = $this->submittedProject($hackathon);
        $this->submittedProject($hackathon);
        $this->score($hackathon, $scored, 5, 5);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")
            ->assertUnprocessable()
            ->assertJsonPath('code', 'unscored_submissions');

        $this->assertNull($hackathon->fresh()->results_published_at);
    }

    public function test_results_need_a_finished_hackathon_and_something_to_rank(): void
    {
        Sanctum::actingAs($this->staff());

        $live = $this->liveHackathon();
        $this->postJson("/api/admin/hackathons/{$live->id}/publish-results")->assertStatus(409)->assertJsonPath('code', 'not_ended');

        $empty = $this->judged();
        $this->postJson("/api/admin/hackathons/{$empty->id}/publish-results")->assertUnprocessable()->assertJsonPath('code', 'nothing_to_rank');
    }

    public function test_republishing_after_a_correction_recomputes_the_ranks(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $a = $this->submittedProject($hackathon, ['title' => 'A']);
        $b = $this->submittedProject($hackathon, ['title' => 'B']);
        $this->score($hackathon, $a, 9, 9);
        $this->score($hackathon, $b, 5, 5);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();
        $this->assertSame(1, $a->fresh()->rank);

        // The host spots a mistake and swaps the marks.
        $this->score($hackathon, $a, 3, 3);
        $this->score($hackathon, $b, 9, 9);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $this->assertSame(1, $b->fresh()->rank);
        $this->assertSame(2, $a->fresh()->rank);
        $this->assertSame('Champion', $b->fresh()->award_label);
    }

    public function test_disqualifying_after_results_are_out_drops_the_rank_until_republished(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $a = $this->submittedProject($hackathon);
        $b = $this->submittedProject($hackathon);
        $this->score($hackathon, $a, 9, 9);
        $this->score($hackathon, $b, 5, 5);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/submissions/{$a->id}/disqualify", ['reason' => 'Late discovery of plagiarism'])->assertOk();
        $this->assertNull($a->fresh()->rank);
        $this->assertNull($a->fresh()->award_label);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();
        $this->assertSame(1, $b->fresh()->rank);

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/submissions/{$a->id}/reinstate")->assertOk()->assertJsonPath('submission.is_disqualified', false);
    }

    public function test_criteria_and_prizes_lock_once_judging_or_results_begin(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon);
        $this->score($hackathon, $project, 6, 6);

        $same = fn (array $over = []) => $this->hostPayload($over + [
            'registration_opens_at' => $hackathon->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $hackathon->registration_closes_at->toIso8601String(),
            'starts_at' => $hackathon->starts_at->toIso8601String(),
            'ends_at' => $hackathon->ends_at->toIso8601String(),
            'results_expected_at' => null,
            'criteria' => self::CRITERIA,
            'prizes' => $hackathon->prizes,
            'min_team_size' => 1,
            'max_team_size' => 4,
        ]);

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $same(['criteria' => [['name' => 'Everything', 'weight' => 100]]]))
            ->assertStatus(409)->assertJsonPath('code', 'criteria_locked');

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $same(['prizes' => [['place' => 1, 'title' => 'Renamed']]]))
            ->assertStatus(409)->assertJsonPath('code', 'results_locked');

        // Ordinary copy edits are still fine.
        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $same(['tagline' => 'A better tagline']))->assertOk();
    }

    public function test_a_published_hackathon_with_results_cannot_be_cancelled(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon);
        $this->score($hackathon, $project, 6, 6);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/cancel", ['reason' => 'Changed our minds'])
            ->assertStatus(409)->assertJsonPath('code', 'results_published');
    }

    // ───────────────────────────── what students see afterwards ─────────────────────────────

    public function test_students_see_their_outcome_the_podium_and_the_ranked_results_once_published(): void
    {
        $hackathon = $this->judged();
        $winner = $this->student();
        $runnerUp = $this->student();
        $first = $this->submittedProject($hackathon, ['title' => 'First'], $winner);
        $second = $this->submittedProject($hackathon, ['title' => 'Second', 'feedback' => null], $runnerUp);

        Sanctum::actingAs($this->staff());
        $this->score($hackathon, $first, 9, 9, 'Outstanding work.');
        $this->score($hackathon, $second, 6, 6, 'Good, keep going.');

        // Before publishing: nothing leaks.
        Sanctum::actingAs($winner);
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertJsonPath('hackathon.mine.rank', null)->assertJsonPath('hackathon.my_submission.feedback', null);

        Sanctum::actingAs($this->staff());
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        Sanctum::actingAs($winner);
        $detail = $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk();
        $detail->assertJsonPath('hackathon.phase', 'completed')
            ->assertJsonPath('hackathon.mine.rank', 1)
            ->assertJsonPath('hackathon.mine.award_label', 'Champion')
            ->assertJsonPath('hackathon.mine.score', 90)
            ->assertJsonPath('hackathon.my_submission.feedback', 'Outstanding work.')
            ->assertJsonPath('hackathon.my_submission.scores.Impact', 9)
            ->assertJsonPath('hackathon.podium.0.title', 'First')
            ->assertJsonPath('hackathon.podium.1.title', 'Second');

        $results = $this->getJson("/api/arena/hackathons/{$hackathon->slug}/results")->assertOk();
        $this->assertSame(['First', 'Second'], collect($results->json('results'))->pluck('title')->all());
        $this->assertSame(90, $results->json('results.0.score'));

        // A rival sees the ranking but not the winner's private feedback.
        Sanctum::actingAs($runnerUp);
        $own = $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->json('hackathon');
        $this->assertSame('Good, keep going.', $own['my_submission']['feedback']);
        $this->assertSame(2, $own['mine']['rank']);
        $this->assertStringNotContainsString('Outstanding work', json_encode($own));
    }

    public function test_a_disqualified_team_is_told_after_results_but_gets_no_rank(): void
    {
        $hackathon = $this->judged();
        $cheat = $this->student();
        $other = $this->student();
        $bad = $this->submittedProject($hackathon, ['title' => 'Bad'], $cheat);
        $good = $this->submittedProject($hackathon, ['title' => 'Good'], $other);

        Sanctum::actingAs($this->staff());
        $this->score($hackathon, $bad, 10, 10);
        $this->score($hackathon, $good, 5, 5);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/submissions/{$bad->id}/disqualify", ['reason' => 'Plagiarised'])->assertOk();
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        Sanctum::actingAs($cheat);
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")
            ->assertJsonPath('hackathon.mine.rank', null)
            ->assertJsonPath('hackathon.mine.is_disqualified', true)
            ->assertJsonPath('hackathon.my_submission.disqualified_reason', 'Plagiarised');

        $titles = collect($this->getJson("/api/arena/hackathons/{$hackathon->slug}/results")->json('results'))->pluck('title')->all();
        $this->assertSame(['Good'], $titles);
    }

    public function test_the_home_page_reports_a_students_wins_and_podiums(): void
    {
        $student = $this->student();
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon, [], $student);
        $other = $this->submittedProject($hackathon);

        Sanctum::actingAs($this->staff());
        $this->score($hackathon, $project, 9, 9);
        $this->score($hackathon, $other, 4, 4);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        Sanctum::actingAs($student);
        $this->getJson('/api/arena/home')
            ->assertJsonPath('stats.joined', 1)
            ->assertJsonPath('stats.submitted', 1)
            ->assertJsonPath('stats.wins', 1)
            ->assertJsonPath('stats.podiums', 1)
            ->assertJsonPath('recent_results.0.winner.rank', 1);
    }

    public function test_judging_actions_are_written_to_the_audit_trail_and_students_cannot_trigger_them(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->judged();
        $project = $this->submittedProject($hackathon);
        $this->score($hackathon, $project, 6, 6);
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertOk();

        $actions = ActivityLog::pluck('action')->all();
        $this->assertContains('Scored a hackathon project', $actions);
        $this->assertContains('Published hackathon results', $actions);

        Sanctum::actingAs($this->student());
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish-results")->assertForbidden();
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/submissions/{$project->id}/disqualify", ['reason' => 'nope nope'])->assertForbidden();
        $this->assertNull($project->fresh()->disqualified_reason);
    }
}
