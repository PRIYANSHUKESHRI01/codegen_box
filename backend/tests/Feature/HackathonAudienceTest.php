<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Hackathon;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHackathonFixtures;
use Tests\TestCase;

/**
 * Who a hackathon is shown to: every student, or the students of the colleges its host mapped it to.
 * Publishing is immediate — there is no approval step — so a college a host picks has the hackathon in its
 * students' Arena the moment it is published, and nobody else ever sees it.
 */
class HackathonAudienceTest extends TestCase
{
    use CreatesHackathonFixtures;
    use RefreshDatabase;

    private College $apex;

    private College $meridian;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();

        $this->apex = $this->college('Apex Institute');
        $this->meridian = $this->college('Meridian College');
    }

    private function slugsFor($user): array
    {
        Sanctum::actingAs($user);

        return collect($this->getJson('/api/arena/hackathons')->assertOk()->json('hackathons'))->pluck('slug')->all();
    }

    // ───────────────────────────── choosing colleges (host side) ─────────────────────────────

    public function test_hosts_get_the_list_of_active_colleges_with_honest_student_counts(): void
    {
        $this->studentAt($this->apex);
        $this->studentAt($this->apex);
        $this->studentAt($this->meridian);
        $this->studentAt(null);
        $this->college('Dormant College', ['is_active' => false]);

        foreach ([['staff', '/api/admin/hackathons/colleges'], ['company', '/api/company/hackathons/colleges']] as [$who, $url]) {
            Sanctum::actingAs($who === 'staff' ? $this->staff() : $this->companyAdmin());

            $response = $this->getJson($url)->assertOk();
            $byName = collect($response->json('colleges'))->keyBy('name');

            $this->assertSame(['Apex Institute', 'Meridian College'], $byName->keys()->sort()->values()->all(), 'inactive colleges are not offered');
            $this->assertSame(2, $byName['Apex Institute']['student_count']);
            $this->assertSame(1, $byName['Meridian College']['student_count']);
            $this->assertSame(4, $response->json('totals.students'));
            $this->assertSame(1, $response->json('totals.independent_students'));
            // Aggregates only — never a person.
            $this->assertArrayNotHasKey('email', $response->json('colleges.0'));
        }
    }

    public function test_the_college_list_is_for_hosts_only(): void
    {
        foreach ([$this->student(), $this->tpo()] as $denied) {
            Sanctum::actingAs($denied);
            $this->getJson('/api/admin/hackathons/colleges')->assertForbidden();
            $this->getJson('/api/company/hackathons/colleges')->assertForbidden();
        }

        Sanctum::actingAs($this->staff([User::PERM_CONTESTS]));
        $this->getJson('/api/admin/hackathons/colleges')->assertForbidden();
    }

    public function test_a_hackathon_can_be_created_for_everyone_or_for_chosen_colleges(): void
    {
        Sanctum::actingAs($this->staff());

        $open = $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'all']))
            ->assertCreated()
            ->assertJsonPath('hackathon.audience', 'all')
            ->assertJsonPath('hackathon.college_count', 0)
            ->assertJsonPath('hackathon.college_ids', []);

        $exclusive = $this->postJson('/api/admin/hackathons', $this->hostPayload([
            'title' => 'Campus Only',
            'audience' => 'colleges',
            'college_ids' => [$this->apex->id, $this->meridian->id],
        ]))->assertCreated()
            ->assertJsonPath('hackathon.audience', 'colleges')
            ->assertJsonPath('hackathon.college_count', 2);

        $this->assertEqualsCanonicalizing([$this->apex->id, $this->meridian->id], $exclusive->json('hackathon.college_ids'));
        $this->assertEqualsCanonicalizing(['Apex Institute', 'Meridian College'], collect($exclusive->json('hackathon.colleges'))->pluck('name')->all());
        $this->assertSame(0, Hackathon::find($open->json('hackathon.id'))->colleges()->count());
        $this->assertSame(2, Hackathon::find($exclusive->json('hackathon.id'))->colleges()->count());
    }

    public function test_the_audience_is_validated(): void
    {
        Sanctum::actingAs($this->staff());
        $inactive = $this->college('Dormant College', ['is_active' => false]);

        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => null]))->assertUnprocessable()->assertJsonValidationErrors('audience');
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'everyone-ish']))->assertUnprocessable()->assertJsonValidationErrors('audience');

        // 'colleges' needs colleges.
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges']))->assertUnprocessable()->assertJsonValidationErrors('college_ids');
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => []]))->assertUnprocessable()->assertJsonValidationErrors('college_ids');

        // …real, active, distinct ones.
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => [999999]]))->assertUnprocessable()->assertJsonValidationErrors('college_ids.0');
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => [$inactive->id]]))->assertUnprocessable()->assertJsonValidationErrors('college_ids.0');
        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => [$this->apex->id, $this->apex->id]]))->assertUnprocessable();

        $this->assertDatabaseCount('hackathons', 0);
    }

    public function test_college_ids_sent_with_an_open_audience_are_ignored(): void
    {
        Sanctum::actingAs($this->staff());

        $id = $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'all', 'college_ids' => [$this->apex->id]]))
            ->assertCreated()->json('hackathon.id');

        $this->assertSame(0, Hackathon::find($id)->colleges()->count());
    }

    public function test_the_audience_can_be_changed_later_and_the_mapping_follows(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->exclusiveHackathon([$this->apex]);
        $url = "/api/admin/hackathons/{$hackathon->id}";
        $body = fn (array $over) => $this->hostPayload($over + [
            'registration_opens_at' => $hackathon->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $hackathon->registration_closes_at->toIso8601String(),
            'starts_at' => $hackathon->starts_at->toIso8601String(),
            'ends_at' => $hackathon->ends_at->toIso8601String(),
            'results_expected_at' => null,
            'prizes' => $hackathon->prizes,
        ]);

        // replace the set
        $this->putJson($url, $body(['audience' => 'colleges', 'college_ids' => [$this->meridian->id]]))
            ->assertOk()->assertJsonPath('hackathon.college_ids', [$this->meridian->id]);
        $this->assertSame([$this->meridian->id], $hackathon->colleges()->pluck('colleges.id')->all());

        // open it to everyone: the mapping is cleared
        $this->putJson($url, $body(['audience' => 'all']))->assertOk()->assertJsonPath('hackathon.audience', 'all')->assertJsonPath('hackathon.college_ids', []);
        $this->assertSame(0, $hackathon->colleges()->count());
        $this->assertSame('all', $hackathon->fresh()->audience);

        // and back to a college
        $this->putJson($url, $body(['audience' => 'colleges', 'college_ids' => [$this->apex->id]]))->assertOk();
        $this->assertSame([$this->apex->id], $hackathon->colleges()->pluck('colleges.id')->all());
    }

    public function test_a_hiring_partner_can_map_its_hackathon_to_colleges_too(): void
    {
        $company = $this->company();
        Sanctum::actingAs($this->companyAdmin($company));

        $this->postJson('/api/company/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => [$this->apex->id]]))
            ->assertCreated()
            ->assertJsonPath('hackathon.audience', 'colleges')
            ->assertJsonPath('hackathon.host.type', 'company');
    }

    public function test_the_hosts_list_reports_each_hackathons_reach(): void
    {
        $this->exclusiveHackathon([$this->apex, $this->meridian], ['title' => 'Two colleges']);
        $this->hackathon(['title' => 'Everyone']);

        Sanctum::actingAs($this->staff());

        $rows = collect($this->getJson('/api/admin/hackathons')->assertOk()->json('hackathons'))->keyBy('title');
        $this->assertSame(['colleges', 2], [$rows['Two colleges']['audience'], $rows['Two colleges']['college_count']]);
        $this->assertSame(['all', 0], [$rows['Everyone']['audience'], $rows['Everyone']['college_count']]);
    }

    public function test_changes_to_reach_are_audit_logged(): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/hackathons', $this->hostPayload(['audience' => 'colleges', 'college_ids' => [$this->apex->id, $this->meridian->id]]))->assertCreated();

        $log = ActivityLog::where('action', 'Created a hackathon')->latest('id')->first();
        $this->assertSame(['audience' => 'colleges', 'colleges' => 2], $log->meta);
    }

    // ───────────────────────────── never stranding a registered student ─────────────────────────────

    public function test_the_audience_cannot_be_narrowed_to_exclude_students_who_already_registered(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon();
        $this->enter($hackathon, $this->studentAt($this->apex));
        $this->enter($hackathon, $this->studentAt($this->meridian));
        $this->enter($hackathon, $this->studentAt(null)); // an independent student

        $payload = fn (array $over) => $this->hostPayload($over + [
            'registration_opens_at' => $hackathon->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $hackathon->registration_closes_at->toIso8601String(),
            'starts_at' => $hackathon->starts_at->toIso8601String(),
            'ends_at' => $hackathon->ends_at->toIso8601String(),
            'results_expected_at' => null,
            'prizes' => $hackathon->prizes,
            'min_team_size' => $hackathon->min_team_size,
            'max_team_size' => $hackathon->max_team_size,
        ]);
        $url = "/api/admin/hackathons/{$hackathon->id}";

        // Dropping Meridian (1 student) and the independent student (1) strands two people.
        $this->putJson($url, $payload(['audience' => 'colleges', 'college_ids' => [$this->apex->id]]))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'audience_excludes_registered');
        $this->assertSame('all', $hackathon->fresh()->audience, 'a refused change leaves everything as it was');

        // Even every college is not enough while an independent (college-less) student is registered.
        $this->putJson($url, $payload(['audience' => 'colleges', 'college_ids' => [$this->apex->id, $this->meridian->id]]))
            ->assertUnprocessable()->assertJsonPath('code', 'audience_excludes_registered');

        // Staying open to everyone is always fine.
        $this->putJson($url, $payload(['audience' => 'all']))->assertOk();
    }

    public function test_a_college_with_no_registered_students_can_be_dropped_freely(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->exclusiveHackathon([$this->apex, $this->meridian]);
        $this->enter($hackathon, $this->studentAt($this->apex));

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $this->hostPayload([
            'audience' => 'colleges',
            'college_ids' => [$this->apex->id],
            'registration_opens_at' => $hackathon->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $hackathon->registration_closes_at->toIso8601String(),
            'starts_at' => $hackathon->starts_at->toIso8601String(),
            'ends_at' => $hackathon->ends_at->toIso8601String(),
            'results_expected_at' => null,
            'prizes' => $hackathon->prizes,
            'min_team_size' => 1,
            'max_team_size' => 4,
        ]))->assertOk();

        $this->assertSame([$this->apex->id], $hackathon->colleges()->pluck('colleges.id')->all());
    }

    // ───────────────────────────── what students see ─────────────────────────────

    public function test_a_college_hackathon_reaches_only_that_colleges_students_and_goes_live_with_no_approval(): void
    {
        $exclusive = $this->exclusiveHackathon([$this->apex], ['title' => 'Apex Only']);
        $open = $this->hackathon(['title' => 'For Everyone']);

        $this->assertEqualsCanonicalizing([$open->slug, $exclusive->slug], $this->slugsFor($this->studentAt($this->apex)));
        $this->assertSame([$open->slug], $this->slugsFor($this->studentAt($this->meridian)));
        $this->assertSame([$open->slug], $this->slugsFor($this->studentAt(null)), 'a student with no college only ever sees open hackathons');
    }

    public function test_an_outsider_cannot_open_register_or_browse_a_hackathon_mapped_to_other_colleges(): void
    {
        $hackathon = $this->exclusiveHackathon([$this->apex]);
        $this->enter($hackathon, $this->studentAt($this->apex));

        foreach ([$this->studentAt($this->meridian), $this->studentAt(null)] as $outsider) {
            Sanctum::actingAs($outsider);

            $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertNotFound();
            $this->getJson("/api/arena/hackathons/{$hackathon->slug}/gallery")->assertNotFound();
            $this->getJson("/api/arena/hackathons/{$hackathon->slug}/results")->assertNotFound();
            $this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", ['mode' => 'solo'])->assertNotFound();
        }

        $this->assertSame(1, $hackathon->participants()->count(), 'nobody from outside got a seat');
    }

    public function test_an_insider_can_use_it_normally(): void
    {
        $hackathon = $this->exclusiveHackathon([$this->apex]);
        Sanctum::actingAs($this->studentAt($this->apex));

        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk()->assertJsonPath('hackathon.audience', 'colleges');
        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", ['mode' => 'solo'])->assertCreated();
    }

    public function test_the_lobby_totals_themes_and_featured_event_respect_the_audience(): void
    {
        $this->exclusiveHackathon([$this->apex], ['title' => 'Apex Featured', 'is_featured' => true, 'themes' => ['SecretTheme']]);
        $this->hackathon(['title' => 'Public one', 'themes' => ['PublicTheme']]);

        Sanctum::actingAs($this->studentAt($this->meridian));
        $home = $this->getJson('/api/arena/home')->assertOk();
        $this->assertSame('Public one', $home->json('featured.title'), 'a hackathon you cannot see is never featured to you');
        $this->assertSame(1, $home->json('totals.upcoming'));
        $this->assertSame(['PublicTheme'], $this->getJson('/api/arena/hackathons')->json('themes'));

        Sanctum::actingAs($this->studentAt($this->apex));
        $home = $this->getJson('/api/arena/home')->assertOk();
        $this->assertSame('Apex Featured', $home->json('featured.title'));
        $this->assertSame(2, $home->json('totals.upcoming'));
        $this->assertEqualsCanonicalizing(['PublicTheme', 'SecretTheme'], $this->getJson('/api/arena/hackathons')->json('themes'));
    }

    public function test_filters_and_search_never_leak_an_exclusive_hackathon(): void
    {
        $this->exclusiveHackathon([$this->apex], ['title' => 'Quantum Apex Sprint', 'mode' => 'online', 'themes' => ['Quantum']]);

        Sanctum::actingAs($this->studentAt($this->meridian));

        foreach (['q=quantum', 'theme=Quantum', 'phase=open', 'mode=online', 'phase=upcoming'] as $query) {
            $this->getJson("/api/arena/hackathons?{$query}")->assertOk()->assertJsonCount(0, 'hackathons');
        }
    }

    public function test_someone_already_registered_keeps_access_to_their_own_project(): void
    {
        // Not reachable through the host UI (see the stranding rule) but guarded anyway: never lock a participant out.
        $hackathon = $this->exclusiveHackathon([$this->apex]);
        $stranded = $this->studentAt($this->meridian);
        $this->enter($hackathon, $stranded);

        Sanctum::actingAs($stranded);
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk();
        $this->getJson('/api/arena/mine')->assertOk()->assertJsonCount(1, 'hackathons');
    }

    public function test_hosts_preview_an_exclusive_hackathon_regardless_of_college(): void
    {
        $company = $this->company();
        $hackathon = $this->exclusiveHackathon([$this->apex], ['host_type' => 'company', 'company_id' => $company->id]);

        foreach ([$this->staff(), $this->companyAdmin($company), $this->superadmin()] as $host) {
            Sanctum::actingAs($host);
            $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk()->assertJsonPath('hackathon.viewer.can_manage', true);
        }
    }

    public function test_a_college_tpo_still_cannot_reach_any_of_it(): void
    {
        $this->exclusiveHackathon([$this->apex]);

        Sanctum::actingAs($this->tpo());
        $this->getJson('/api/arena/hackathons')->assertForbidden();
        $this->getJson('/api/admin/hackathons/colleges')->assertForbidden();
    }

    public function test_the_model_answers_availability_the_same_way_the_queries_do(): void
    {
        $exclusive = $this->exclusiveHackathon([$this->apex]);
        $open = $this->hackathon();

        $apexStudent = $this->studentAt($this->apex);
        $otherStudent = $this->studentAt($this->meridian);
        $independent = $this->studentAt(null);

        $this->assertTrue($exclusive->isAvailableTo($apexStudent));
        $this->assertFalse($exclusive->isAvailableTo($otherStudent));
        $this->assertFalse($exclusive->isAvailableTo($independent));
        $this->assertTrue($open->isAvailableTo($independent));

        foreach ([$apexStudent, $otherStudent, $independent] as $student) {
            $viaScope = Hackathon::availableTo($student)->pluck('id')->all();
            $this->assertSame($exclusive->isAvailableTo($student), in_array($exclusive->id, $viaScope, true));
            $this->assertSame($open->isAvailableTo($student), in_array($open->id, $viaScope, true));
        }

        // Non-students (hosts) are not narrowed by the scope.
        $this->assertCount(2, Hackathon::availableTo($this->staff())->get());
    }
}
