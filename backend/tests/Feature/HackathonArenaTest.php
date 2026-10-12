<?php

namespace Tests\Feature;

use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHackathonFixtures;
use Tests\TestCase;

/**
 * The student's side of the Hack Arena: what they can see, how they register
 * and form teams, and how they submit a project.
 */
class HackathonArenaTest extends TestCase
{
    use CreatesHackathonFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function register(Hackathon $hackathon, array $body = ['mode' => 'solo'])
    {
        return $this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", $body);
    }

    // ───────────────────────────── visibility ─────────────────────────────

    public function test_students_never_see_drafts_or_cancelled_hackathons(): void
    {
        $live = $this->hackathon(['title' => 'Visible one']);
        $draft = $this->hackathon(['status' => 'draft', 'title' => 'Secret draft']);
        $cancelled = $this->hackathon(['status' => 'cancelled', 'title' => 'Called off']);

        Sanctum::actingAs($this->student());

        $titles = collect($this->getJson('/api/arena/hackathons')->assertOk()->json('hackathons'))->pluck('title');
        $this->assertEquals(['Visible one'], $titles->all());

        $this->getJson("/api/arena/hackathons/{$live->slug}")->assertOk();
        $this->getJson("/api/arena/hackathons/{$draft->slug}")->assertNotFound();
        $this->getJson("/api/arena/hackathons/{$cancelled->slug}")->assertNotFound();
        $this->register($draft)->assertNotFound();

        $this->assertCount(1, $this->getJson('/api/arena/home')->json('upcoming'));
    }

    public function test_a_host_previews_a_draft_but_a_stranger_does_not(): void
    {
        $company = $this->company();
        $draft = $this->hackathon(['status' => 'draft', 'host_type' => 'company', 'company_id' => $company->id]);

        Sanctum::actingAs($this->companyAdmin($company));
        $this->getJson("/api/arena/hackathons/{$draft->slug}")
            ->assertOk()
            ->assertJsonPath('hackathon.viewer.can_manage', true)
            ->assertJsonPath('hackathon.viewer.is_preview', true)
            ->assertJsonPath('hackathon.registration.can_register', false);

        Sanctum::actingAs($this->companyAdmin());
        $this->getJson("/api/arena/hackathons/{$draft->slug}")->assertNotFound();

        Sanctum::actingAs($this->staff());
        $this->getJson("/api/arena/hackathons/{$draft->slug}")->assertOk();

        Sanctum::actingAs($this->staff([User::PERM_CONTESTS]));
        $this->getJson("/api/arena/hackathons/{$draft->slug}")->assertNotFound();
    }

    public function test_hosts_browse_the_arena_read_only(): void
    {
        $hackathon = $this->hackathon();

        foreach ([$this->staff(), $this->companyAdmin(), $this->superadmin()] as $host) {
            Sanctum::actingAs($host);

            $this->getJson('/api/arena/home')->assertOk()->assertJsonPath('stats', null);
            $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk()->assertJsonPath('hackathon.my_team', null);
            $this->register($hackathon)->assertForbidden();
            $this->getJson('/api/arena/mine')->assertForbidden();
        }
    }

    public function test_the_arena_requires_a_signed_in_user(): void
    {
        $hackathon = $this->hackathon();

        $this->getJson('/api/arena/home')->assertUnauthorized();
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertUnauthorized();
        $this->register($hackathon)->assertUnauthorized();
    }

    // ───────────────────────────── the catalogue ─────────────────────────────

    public function test_the_catalogue_lists_live_first_then_upcoming_then_the_archive(): void
    {
        $this->endedHackathon(['title' => 'Archive']);
        $this->hackathon(['title' => 'Soon', 'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(4)]);
        $this->hackathon(['title' => 'Later', 'starts_at' => now()->addDays(20), 'ends_at' => now()->addDays(22), 'registration_closes_at' => now()->addDays(15)]);
        $this->liveHackathon(['title' => 'Live now']);

        Sanctum::actingAs($this->student());

        $titles = collect($this->getJson('/api/arena/hackathons')->json('hackathons'))->pluck('title')->all();

        $this->assertSame(['Live now', 'Soon', 'Later', 'Archive'], $titles);
    }

    public function test_the_catalogue_filters_by_phase_mode_host_theme_and_search(): void
    {
        $company = $this->company();
        $this->liveHackathon(['title' => 'Alpha AI Sprint', 'themes' => ['AI']]);
        $this->hackathon(['title' => 'Beta Cloud Jam', 'themes' => ['Cloud'], 'mode' => 'hybrid', 'location' => 'Pune', 'host_type' => 'company', 'company_id' => $company->id]);
        $this->endedHackathon(['title' => 'Gamma Archive', 'themes' => ['AI', 'Web']]);

        Sanctum::actingAs($this->student());

        $get = fn (string $query) => collect($this->getJson("/api/arena/hackathons?{$query}")->assertOk()->json('hackathons'))->pluck('title')->all();

        $this->assertSame(['Alpha AI Sprint'], $get('phase=live'));
        $this->assertSame(['Beta Cloud Jam'], $get('phase=upcoming'));
        $this->assertSame(['Gamma Archive'], $get('phase=past'));
        $this->assertEqualsCanonicalizing(['Alpha AI Sprint', 'Beta Cloud Jam'], $get('phase=open'));
        $this->assertSame(['Beta Cloud Jam'], $get('mode=hybrid'));
        $this->assertSame(['Beta Cloud Jam'], $get('host=company'));
        $this->assertEqualsCanonicalizing(['Alpha AI Sprint', 'Gamma Archive'], $get('theme=AI'));
        $this->assertSame(['Beta Cloud Jam'], $get('q=cloud'));
        $this->assertSame([], $get('q=nothing-matches-this'));

        $this->getJson('/api/arena/hackathons?phase=nonsense')->assertUnprocessable();
        $this->assertEqualsCanonicalizing(['AI', 'Cloud', 'Web'], $this->getJson('/api/arena/hackathons')->json('themes'));
    }

    public function test_the_catalogue_paginates(): void
    {
        for ($i = 0; $i < 14; $i++) {
            $this->hackathon(['title' => "Hack {$i}", 'starts_at' => now()->addDays(2 + $i), 'ends_at' => now()->addDays(4 + $i)]);
        }

        Sanctum::actingAs($this->student());

        $first = $this->getJson('/api/arena/hackathons')->assertJsonPath('meta.total', 14)->assertJsonPath('meta.last_page', 2);
        $this->assertCount(12, $first->json('hackathons'));
        $this->assertCount(2, $this->getJson('/api/arena/hackathons?page=2')->json('hackathons'));
    }

    public function test_the_home_payload_picks_a_featured_event_and_the_students_stats(): void
    {
        $student = $this->student();
        $live = $this->liveHackathon(['title' => 'Live one']);
        $featured = $this->hackathon(['title' => 'Featured one', 'is_featured' => true]);
        $this->enter($live, $student);

        Sanctum::actingAs($student);

        $home = $this->getJson('/api/arena/home')->assertOk();
        $home->assertJsonPath('featured.title', 'Featured one')
            ->assertJsonPath('totals.live', 1)
            ->assertJsonPath('stats.joined', 1)
            ->assertJsonPath('stats.active', 1)
            ->assertJsonPath('stats.wins', 0);

        $this->assertSame('Live one', $home->json('live.0.title'));
        $this->assertNotNull($home->json('live.0.mine'), 'the live card carries the student\'s own entry');
        $this->assertNull(collect($home->json('upcoming'))->firstWhere('slug', $featured->slug)['mine']);
    }

    public function test_my_hackathons_lists_only_what_the_student_entered(): void
    {
        $student = $this->student();
        $entered = $this->hackathon(['title' => 'Entered']);
        $this->hackathon(['title' => 'Not entered']);
        $this->enter($entered, $student);
        $this->enter($this->hackathon(['title' => 'Someone else']), $this->student());

        Sanctum::actingAs($student);

        $titles = collect($this->getJson('/api/arena/mine')->assertOk()->json('hackathons'))->pluck('title')->all();
        $this->assertSame(['Entered'], $titles);
    }

    // ───────────────────────────── registering ─────────────────────────────

    public function test_a_student_registers_solo_and_becomes_a_team_of_one(): void
    {
        $student = $this->student(['name' => 'Alex Chen']);
        $hackathon = $this->hackathon();

        Sanctum::actingAs($student);

        $this->register($hackathon)
            ->assertCreated()
            ->assertJsonPath('hackathon.registration.state', 'registered')
            ->assertJsonPath('hackathon.my_team.name', 'Alex Chen')
            ->assertJsonPath('hackathon.my_team.is_leader', true)
            ->assertJsonPath('hackathon.participants_count', 1)
            ->assertJsonCount(1, 'hackathon.my_team.members');
    }

    public function test_registering_twice_is_refused(): void
    {
        $hackathon = $this->hackathon();
        Sanctum::actingAs($this->student());

        $this->register($hackathon)->assertCreated();
        $this->register($hackathon)->assertStatus(409)->assertJsonPath('code', 'already_registered');
        $this->assertSame(1, HackathonParticipant::count());
    }

    public function test_registration_respects_its_window(): void
    {
        Sanctum::actingAs($this->student());

        $notYet = $this->hackathon(['registration_opens_at' => now()->addDay(), 'registration_closes_at' => now()->addDays(3), 'starts_at' => now()->addDays(5), 'ends_at' => now()->addDays(7)]);
        $closed = $this->hackathon(['registration_opens_at' => now()->subDays(5), 'registration_closes_at' => now()->subDay(), 'starts_at' => now()->addDay(), 'ends_at' => now()->addDays(3)]);
        $over = $this->endedHackathon();

        $this->register($notYet)->assertUnprocessable()->assertJsonPath('code', 'registration_not_open');
        $this->register($closed)->assertUnprocessable()->assertJsonPath('code', 'registration_closed');
        $this->register($over)->assertUnprocessable()->assertJsonPath('code', 'registration_closed');

        $this->assertSame(0, HackathonParticipant::count());
    }

    public function test_late_registration_works_after_kickoff_while_the_window_is_open(): void
    {
        $live = $this->liveHackathon();
        Sanctum::actingAs($this->student());

        $this->register($live)->assertCreated();
    }

    public function test_capacity_is_enforced(): void
    {
        $hackathon = $this->hackathon(['max_participants' => 2]);

        Sanctum::actingAs($this->student());
        $this->register($hackathon)->assertCreated();
        Sanctum::actingAs($this->student());
        $this->register($hackathon)->assertCreated();

        Sanctum::actingAs($this->student());
        $this->register($hackathon)->assertStatus(409)->assertJsonPath('code', 'full');
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")
            ->assertJsonPath('hackathon.registration.state', 'full')
            ->assertJsonPath('hackathon.spots_left', 0);
    }

    public function test_blocked_and_non_student_accounts_cannot_register(): void
    {
        $hackathon = $this->hackathon();

        Sanctum::actingAs($this->student(['is_blocked' => true]));
        $this->register($hackathon)->assertForbidden()->assertJsonPath('code', 'not_a_student');
    }

    // ───────────────────────────── teams ─────────────────────────────

    public function test_a_student_creates_a_team_and_a_friend_joins_with_its_code(): void
    {
        $hackathon = $this->hackathon();
        $leader = $this->student(['name' => 'Leader One']);
        $friend = $this->student(['name' => 'Friend Two']);

        Sanctum::actingAs($leader);
        $code = $this->register($hackathon, ['mode' => 'create', 'team_name' => 'Alpha Squad'])
            ->assertCreated()
            ->assertJsonPath('hackathon.my_team.name', 'Alpha Squad')
            ->json('hackathon.my_team.invite_code');

        $this->assertMatchesRegularExpression('/^[A-HJ-KM-NP-Z2-9]{8}$/', $code);

        Sanctum::actingAs($friend);
        $this->register($hackathon, ['mode' => 'join', 'invite_code' => strtolower(" {$code} ")])
            ->assertCreated()
            ->assertJsonPath('hackathon.my_team.name', 'Alpha Squad')
            ->assertJsonPath('hackathon.my_team.is_leader', false)
            ->assertJsonCount(2, 'hackathon.my_team.members');
    }

    public function test_team_rules_are_enforced(): void
    {
        $hackathon = $this->hackathon(['max_team_size' => 2]);

        Sanctum::actingAs($this->student());
        $code = $this->register($hackathon, ['mode' => 'create', 'team_name' => 'Duo'])->json('hackathon.my_team.invite_code');

        Sanctum::actingAs($this->student());
        $this->register($hackathon, ['mode' => 'create', 'team_name' => 'Duo'])->assertStatus(409)->assertJsonPath('code', 'team_name_taken');
        $this->register($hackathon, ['mode' => 'create', 'team_name' => 'ab'])->assertUnprocessable()->assertJsonPath('code', 'invalid_team_name');
        $this->register($hackathon, ['mode' => 'join', 'invite_code' => 'NOTACODE'])->assertUnprocessable()->assertJsonPath('code', 'invalid_invite_code');
        $this->register($hackathon, ['mode' => 'join'])->assertUnprocessable()->assertJsonPath('code', 'invalid_invite_code');
        $this->register($hackathon, ['mode' => 'teleport'])->assertUnprocessable();

        $this->register($hackathon, ['mode' => 'join', 'invite_code' => $code])->assertCreated();

        Sanctum::actingAs($this->student());
        $this->register($hackathon, ['mode' => 'join', 'invite_code' => $code])->assertStatus(409)->assertJsonPath('code', 'team_full');
    }

    public function test_an_invite_code_only_works_in_its_own_hackathon(): void
    {
        $one = $this->hackathon();
        $two = $this->hackathon();

        Sanctum::actingAs($this->student());
        $code = $this->register($one, ['mode' => 'create', 'team_name' => 'Cross Over'])->json('hackathon.my_team.invite_code');

        Sanctum::actingAs($this->student());
        $this->register($two, ['mode' => 'join', 'invite_code' => $code])->assertUnprocessable()->assertJsonPath('code', 'invalid_invite_code');
    }

    public function test_solo_and_team_requirements_follow_the_hackathons_team_size(): void
    {
        $teamsOnly = $this->hackathon(['min_team_size' => 2, 'max_team_size' => 4]);
        $soloOnly = $this->hackathon(['min_team_size' => 1, 'max_team_size' => 1]);

        Sanctum::actingAs($this->student());

        $this->register($teamsOnly)->assertUnprocessable()->assertJsonPath('code', 'team_required');
        $this->register($teamsOnly, ['mode' => 'create', 'team_name' => 'Pair Up'])->assertCreated();

        $this->register($soloOnly, ['mode' => 'create', 'team_name' => 'Cannot Team'])->assertUnprocessable()->assertJsonPath('code', 'solo_only');
        $this->register($soloOnly)->assertCreated();

        $this->assertFalse($this->getJson("/api/arena/hackathons/{$soloOnly->slug}")->json('hackathon.registration.allows_teams'));
    }

    public function test_leaving_hands_leadership_on_and_the_last_member_out_removes_the_team(): void
    {
        $hackathon = $this->hackathon();
        $leader = $this->student();
        $member = $this->student();

        Sanctum::actingAs($leader);
        $code = $this->register($hackathon, ['mode' => 'create', 'team_name' => 'Handover'])->json('hackathon.my_team.invite_code');
        Sanctum::actingAs($member);
        $this->register($hackathon, ['mode' => 'join', 'invite_code' => $code]);

        Sanctum::actingAs($leader);
        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/withdraw")
            ->assertOk()
            ->assertJsonPath('hackathon.registration.state', 'open')
            ->assertJsonPath('hackathon.my_team', null);

        $team = HackathonTeam::first();
        $this->assertSame($member->id, $team->leader_id);
        $this->assertSame('leader', $team->participants()->first()->role);

        Sanctum::actingAs($member);
        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/withdraw")->assertOk();
        $this->assertSame(0, HackathonTeam::count());
        $this->assertSame(0, HackathonParticipant::count());

        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/withdraw")->assertNotFound()->assertJsonPath('code', 'not_registered');
    }

    public function test_only_the_leader_can_remove_a_teammate(): void
    {
        $hackathon = $this->hackathon();
        [$leader, $member, $other] = [$this->student(), $this->student(), $this->student()];

        Sanctum::actingAs($leader);
        $code = $this->register($hackathon, ['mode' => 'create', 'team_name' => 'Crew'])->json('hackathon.my_team.invite_code');
        Sanctum::actingAs($member);
        $this->register($hackathon, ['mode' => 'join', 'invite_code' => $code]);
        Sanctum::actingAs($other);
        $this->register($hackathon);

        $remove = fn (User $target) => $this->postJson("/api/arena/hackathons/{$hackathon->slug}/team/members/{$target->id}/remove");

        Sanctum::actingAs($member);
        $remove($leader)->assertForbidden()->assertJsonPath('code', 'not_team_leader');

        Sanctum::actingAs($leader);
        $remove($other)->assertNotFound()->assertJsonPath('code', 'not_on_team');
        $remove($leader)->assertUnprocessable()->assertJsonPath('code', 'cannot_remove_leader');
        $remove($member)->assertOk()->assertJsonCount(1, 'hackathon.my_team.members');
    }

    public function test_teams_are_locked_once_the_deadline_passes_or_the_project_is_submitted(): void
    {
        // Past the deadline.
        $ended = $this->endedHackathon();
        $late = $this->student();
        $this->enter($ended, $late);
        Sanctum::actingAs($late);
        $this->postJson("/api/arena/hackathons/{$ended->slug}/withdraw")->assertStatus(409)->assertJsonPath('code', 'teams_locked');

        // Submitted.
        $live = $this->liveHackathon();
        $team = $this->student();
        $submission = $this->submittedProject($live, [], $team);
        $joiner = $this->student();

        Sanctum::actingAs($team);
        $this->postJson("/api/arena/hackathons/{$live->slug}/withdraw")->assertStatus(409)->assertJsonPath('code', 'team_locked');

        $code = HackathonTeam::find($submission->hackathon_team_id)->invite_code;
        Sanctum::actingAs($joiner);
        $this->register($live, ['mode' => 'join', 'invite_code' => $code])->assertStatus(409)->assertJsonPath('code', 'team_locked');
    }

    // ───────────────────────────── submitting ─────────────────────────────

    private function projectBody(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'KisanBol',
            'tagline' => 'Voice-first crop advice.',
            'description' => 'Farmers ask in their language and get spoken advice back.',
            'repo_url' => 'https://github.com/team/kisanbol',
            'demo_url' => 'https://kisanbol.example.com',
            'tech_stack' => ['Python', 'React', 'python'],
        ];
    }

    private function save(Hackathon $hackathon, array $body)
    {
        return $this->putJson("/api/arena/hackathons/{$hackathon->slug}/submission", $body);
    }

    public function test_a_draft_can_be_saved_then_submitted(): void
    {
        $live = $this->liveHackathon();
        $student = $this->student();
        $this->enter($live, $student);
        Sanctum::actingAs($student);

        $this->save($live, ['title' => 'Half done'])
            ->assertOk()
            ->assertJsonPath('hackathon.my_submission.status', 'draft')
            ->assertJsonPath('hackathon.my_submission.title', 'Half done')
            ->assertJsonPath('hackathon.mine.submission_status', 'draft');

        $this->save($live, $this->projectBody(['submit' => true]))
            ->assertOk()
            ->assertJsonPath('hackathon.my_submission.status', 'submitted')
            ->assertJsonPath('hackathon.my_team.locked', true)
            ->assertJsonPath('hackathon.my_submission.tech_stack', ['Python', 'React', 'python']);

        $this->assertSame(1, HackathonSubmission::count(), 'one project per team');
        $this->assertNotNull(HackathonSubmission::first()->submitted_at);
    }

    public function test_submitting_needs_a_complete_project(): void
    {
        $live = $this->liveHackathon();
        $student = $this->student();
        $this->enter($live, $student);
        Sanctum::actingAs($student);

        $this->save($live, ['title' => 'No links yet', 'submit' => true])
            ->assertUnprocessable()
            ->assertJsonPath('code', 'incomplete_submission');

        $this->assertSame(0, HackathonSubmission::count(), 'a rejected submit leaves no half-written row');
    }

    public function test_a_title_is_needed_even_for_a_draft_and_links_must_be_http(): void
    {
        $live = $this->liveHackathon();
        $student = $this->student();
        $this->enter($live, $student);
        Sanctum::actingAs($student);

        $this->save($live, [])->assertUnprocessable()->assertJsonValidationErrors('title');
        $this->save($live, $this->projectBody(['repo_url' => 'javascript:alert(1)']))->assertUnprocessable()->assertJsonValidationErrors('repo_url');
        $this->save($live, $this->projectBody(['demo_url' => 'ftp://files.example.com']))->assertUnprocessable()->assertJsonValidationErrors('demo_url');
        $this->save($live, $this->projectBody(['tech_stack' => array_fill(0, 16, 'x')]))->assertUnprocessable()->assertJsonValidationErrors('tech_stack');
    }

    public function test_a_project_cannot_be_forged_into_a_scored_one(): void
    {
        $live = $this->liveHackathon();
        $student = $this->student();
        $this->enter($live, $student);
        Sanctum::actingAs($student);

        $this->save($live, $this->projectBody(['final_score' => 100, 'rank' => 1, 'award_label' => 'Champion', 'is_disqualified' => false, 'feedback' => 'Great!', 'status' => 'submitted']))->assertOk();

        $submission = HackathonSubmission::first();
        $this->assertNull($submission->final_score);
        $this->assertNull($submission->rank);
        $this->assertNull($submission->award_label);
        $this->assertNull($submission->feedback);
        $this->assertSame('draft', $submission->status);
    }

    public function test_tracks_are_validated_and_required_to_submit(): void
    {
        $live = $this->liveHackathon(['tracks' => [['name' => 'Agri AI', 'description' => null], ['name' => 'Civic Tech', 'description' => null]]]);
        $student = $this->student();
        $this->enter($live, $student);
        Sanctum::actingAs($student);

        $this->save($live, $this->projectBody(['track' => 'Made-up track']))->assertUnprocessable()->assertJsonPath('code', 'invalid_track');
        $this->save($live, $this->projectBody(['submit' => true]))->assertUnprocessable()->assertJsonPath('code', 'track_required');
        $this->save($live, $this->projectBody(['track' => 'Agri AI', 'submit' => true]))->assertOk()->assertJsonPath('hackathon.my_submission.track', 'Agri AI');
    }

    public function test_a_team_must_reach_the_minimum_size_before_submitting(): void
    {
        $live = $this->liveHackathon(['min_team_size' => 2, 'max_team_size' => 3]);
        $leader = $this->student();
        Sanctum::actingAs($leader);
        $this->register($live, ['mode' => 'create', 'team_name' => 'Short Handed'])->assertCreated();

        $this->save($live, $this->projectBody(['submit' => true]))->assertUnprocessable()->assertJsonPath('code', 'team_too_small');

        $code = HackathonTeam::first()->invite_code;
        Sanctum::actingAs($this->student());
        $this->register($live, ['mode' => 'join', 'invite_code' => $code])->assertCreated();

        Sanctum::actingAs($leader);
        $this->save($live, $this->projectBody(['submit' => true]))->assertOk();
    }

    public function test_any_teammate_can_edit_the_teams_one_project(): void
    {
        $live = $this->liveHackathon();
        $leader = $this->student();
        $member = $this->student();

        Sanctum::actingAs($leader);
        $code = $this->register($live, ['mode' => 'create', 'team_name' => 'Pair'])->json('hackathon.my_team.invite_code');
        $this->save($live, ['title' => 'By the leader'])->assertOk();

        Sanctum::actingAs($member);
        $this->register($live, ['mode' => 'join', 'invite_code' => $code]);
        $this->save($live, ['title' => 'Edited by the member'])->assertOk();

        $this->assertSame(1, HackathonSubmission::count());
        $this->assertSame('Edited by the member', HackathonSubmission::first()->title);
        $this->assertSame($member->id, HackathonSubmission::first()->submitted_by);
    }

    public function test_the_submission_window_runs_from_kickoff_to_the_deadline(): void
    {
        $upcoming = $this->hackathon();
        $ended = $this->endedHackathon();
        $student = $this->student();
        $this->enter($upcoming, $student);
        $this->enter($ended, $student);
        Sanctum::actingAs($student);

        $this->save($upcoming, $this->projectBody())->assertStatus(409)->assertJsonPath('code', 'not_started');
        $this->save($ended, $this->projectBody())->assertStatus(409)->assertJsonPath('code', 'submissions_closed');

        $this->getJson("/api/arena/hackathons/{$upcoming->slug}")->assertJsonPath('hackathon.submission_access.code', 'not_started');
        $this->getJson("/api/arena/hackathons/{$ended->slug}")->assertJsonPath('hackathon.submission_access.code', 'submissions_closed');
    }

    public function test_only_registered_students_can_submit(): void
    {
        $live = $this->liveHackathon();
        Sanctum::actingAs($this->student());

        $this->save($live, $this->projectBody())->assertForbidden()->assertJsonPath('code', 'not_registered');
    }

    public function test_one_students_project_is_not_visible_to_another(): void
    {
        $live = $this->liveHackathon();
        $author = $this->student();
        $rival = $this->student();
        $this->submittedProject($live, ['title' => 'Secret sauce'], $author);
        $this->enter($live, $rival);

        Sanctum::actingAs($rival);
        $this->getJson("/api/arena/hackathons/{$live->slug}")->assertJsonPath('hackathon.my_submission', null);
        $this->getJson("/api/arena/hackathons/{$live->slug}/gallery")->assertForbidden()->assertJsonPath('code', 'gallery_closed');
    }

    // ───────────────────────────── what stays private until results ─────────────────────────────

    public function test_the_gallery_opens_after_the_deadline_and_lists_only_real_entries(): void
    {
        $ended = $this->endedHackathon();
        $this->submittedProject($ended, ['title' => 'Shown']);
        $this->submittedProject($ended, ['title' => 'Disqualified', 'is_disqualified' => true, 'disqualified_reason' => 'Copied']);
        $this->submittedProject($ended, ['title' => 'Only a draft', 'status' => 'draft', 'submitted_at' => null]);

        Sanctum::actingAs($this->student());

        $titles = collect($this->getJson("/api/arena/hackathons/{$ended->slug}/gallery")->assertOk()->json('projects'))->pluck('title')->all();
        $this->assertSame(['Shown'], $titles);
    }

    public function test_scores_and_feedback_stay_hidden_until_the_host_publishes_results(): void
    {
        $ended = $this->endedHackathon();
        $author = $this->student();
        $this->submittedProject($ended, ['final_score' => 91.5, 'feedback' => 'Superb.', 'scores' => ['Innovation' => 9]], $author);

        Sanctum::actingAs($author);

        $detail = $this->getJson("/api/arena/hackathons/{$ended->slug}")->assertOk();
        $detail->assertJsonPath('hackathon.my_submission.score', null)
            ->assertJsonPath('hackathon.my_submission.feedback', null)
            ->assertJsonPath('hackathon.mine.score', null)
            ->assertJsonPath('hackathon.mine.rank', null)
            ->assertJsonPath('hackathon.results_published', false)
            ->assertJsonPath('hackathon.podium', []);

        $this->assertStringNotContainsString('91.5', $detail->getContent());
        $this->assertStringNotContainsString('Superb', $detail->getContent());

        $gallery = $this->getJson("/api/arena/hackathons/{$ended->slug}/gallery")->assertOk();
        $this->assertNull($gallery->json('projects.0.score'));
        $this->getJson("/api/arena/hackathons/{$ended->slug}/results")->assertForbidden()->assertJsonPath('code', 'results_pending');
    }

    public function test_an_invite_code_is_only_ever_sent_to_a_member_of_that_team(): void
    {
        $live = $this->liveHackathon();
        $owner = $this->student();
        $this->enter($live, $owner, null, 'Private Crew');
        $code = HackathonTeam::first()->invite_code;

        Sanctum::actingAs($this->student());
        $other = $this->getJson("/api/arena/hackathons/{$live->slug}")->assertOk();
        $this->assertStringNotContainsString($code, $other->getContent());

        Sanctum::actingAs($owner);
        $this->assertStringContainsString($code, $this->getJson("/api/arena/hackathons/{$live->slug}")->getContent());
    }

    public function test_a_teammates_email_is_never_exposed(): void
    {
        $live = $this->liveHackathon();
        $leader = $this->student(['email' => 'leader.secret@example.com']);
        $member = $this->student(['email' => 'member.secret@example.com']);
        $participant = $this->enter($live, $leader);
        $this->enter($live, $member, $participant->team);

        Sanctum::actingAs($leader);
        $body = $this->getJson("/api/arena/hackathons/{$live->slug}")->getContent();

        $this->assertStringNotContainsString('secret@example.com', $body);
    }

    public function test_the_phase_is_derived_from_the_clock_not_stored(): void
    {
        $hackathon = $this->hackathon();
        Sanctum::actingAs($this->student());

        $this->assertSame('registration_open', $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->json('hackathon.phase'));

        $this->travel(3)->days();
        $this->assertSame('live', $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->json('hackathon.phase'));

        $this->travel(3)->days();
        $this->assertSame('judging', $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->json('hackathon.phase'));
    }
}
