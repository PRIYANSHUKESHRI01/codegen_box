<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Hackathon;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesHackathonFixtures;
use Tests\TestCase;

/**
 * Who may host a hackathon, and the rules a host works within.
 */
class HackathonHostingTest extends TestCase
{
    use CreatesHackathonFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    // ───────────────────────────── who may host ─────────────────────────────

    public function test_only_ops_with_the_hackathons_permission_and_superadmin_reach_the_staff_routes(): void
    {
        $this->getJson('/api/admin/hackathons')->assertUnauthorized();

        foreach ([
            $this->student(),
            $this->tpo(),
            User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'permissions' => ['leads']]),
            User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR]),
            $this->companyAdmin(),
            $this->staff([User::PERM_CONTESTS]),
        ] as $denied) {
            Sanctum::actingAs($denied);
            $this->getJson('/api/admin/hackathons')->assertForbidden();
        }

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/admin/hackathons')->assertOk();

        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/admin/hackathons')->assertOk();
    }

    public function test_a_college_tpo_cannot_host_or_even_enter_the_arena(): void
    {
        $tpo = $this->tpo();
        $hackathon = $this->hackathon();

        Sanctum::actingAs($tpo);

        $this->getJson('/api/admin/hackathons')->assertForbidden();
        $this->postJson('/api/admin/hackathons', $this->hostPayload())->assertForbidden();
        $this->getJson('/api/company/hackathons')->assertForbidden();
        $this->postJson('/api/company/hackathons', $this->hostPayload())->assertForbidden();
        $this->getJson('/api/arena/home')->assertForbidden();
        $this->getJson('/api/arena/hackathons')->assertForbidden();
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertForbidden();
        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", ['mode' => 'solo'])->assertForbidden();

        $this->assertDatabaseCount('hackathons', 1);
    }

    public function test_company_routes_are_for_hiring_partners_only(): void
    {
        foreach ([$this->student(), $this->staff(), $this->superadmin(), $this->tpo()] as $denied) {
            Sanctum::actingAs($denied);
            $this->getJson('/api/company/hackathons')->assertForbidden();
        }

        Sanctum::actingAs($this->companyAdmin());
        $this->getJson('/api/company/hackathons')->assertOk();
    }

    public function test_the_hackathons_permission_is_part_of_the_internal_catalogue(): void
    {
        $this->assertContains(User::PERM_HACKATHONS, User::PERMISSIONS_INTERNAL);
        $this->assertContains(User::PERM_HACKATHONS, User::permissionCatalogForRole(User::ROLE_ADMIN_INTERNAL));
    }

    // ───────────────────────────── creating ─────────────────────────────

    public function test_ops_creates_a_draft_hosted_by_the_platform(): void
    {
        Sanctum::actingAs($this->staff());

        $response = $this->postJson('/api/admin/hackathons', $this->hostPayload())->assertCreated();

        $response->assertJsonPath('hackathon.status', 'draft')
            ->assertJsonPath('hackathon.phase', 'draft')
            ->assertJsonPath('hackathon.host.type', 'platform')
            ->assertJsonPath('hackathon.slug', 'open-source-sprint')
            ->assertJsonPath('hackathon.prizes.0.place', 1);

        $this->assertDatabaseHas('hackathons', ['slug' => 'open-source-sprint', 'host_type' => 'platform', 'company_id' => null]);
        $this->assertSame('Created a hackathon', ActivityLog::latest('id')->first()->action);
    }

    public function test_a_hiring_partner_creates_a_hackathon_hosted_by_its_own_company(): void
    {
        $company = $this->company('Nimbus Labs');
        Sanctum::actingAs($this->companyAdmin($company));

        $this->postJson('/api/company/hackathons', $this->hostPayload())
            ->assertCreated()
            ->assertJsonPath('hackathon.host.type', 'company')
            ->assertJsonPath('hackathon.host.name', 'Nimbus Labs');

        $this->assertDatabaseHas('hackathons', ['host_type' => 'company', 'company_id' => $company->id]);
    }

    public function test_slugs_are_unique_and_never_collide_with_a_route_segment(): void
    {
        Sanctum::actingAs($this->staff());

        $first = $this->postJson('/api/admin/hackathons', $this->hostPayload())->json('hackathon.slug');
        $second = $this->postJson('/api/admin/hackathons', $this->hostPayload())->json('hackathon.slug');
        $reserved = $this->postJson('/api/admin/hackathons', $this->hostPayload(['title' => 'New']))->json('hackathon.slug');

        $this->assertSame('open-source-sprint', $first);
        $this->assertSame('open-source-sprint-2', $second);
        $this->assertSame('new-2', $reserved);
    }

    #[DataProvider('invalidPayloads')]
    public function test_invalid_hackathons_are_rejected(array $overrides, string $errorKey): void
    {
        Sanctum::actingAs($this->staff());

        $this->postJson('/api/admin/hackathons', $this->hostPayload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($errorKey);

        $this->assertDatabaseCount('hackathons', 0);
    }

    public static function invalidPayloads(): array
    {
        return [
            'registration closes before it opens' => [['registration_opens_at' => Carbon::now()->addDays(5)->toIso8601String(), 'registration_closes_at' => Carbon::now()->addDays(2)->toIso8601String()], 'registration_closes_at'],
            'deadline before kickoff' => [['starts_at' => Carbon::now()->addDays(10)->toIso8601String(), 'ends_at' => Carbon::now()->addDays(9)->toIso8601String()], 'ends_at'],
            'registration outlasts the deadline' => [['registration_closes_at' => Carbon::now()->addDays(20)->toIso8601String()], 'registration_closes_at'],
            'results expected before the deadline' => [['results_expected_at' => Carbon::now()->addDays(11)->toIso8601String()], 'results_expected_at'],
            'criteria weights do not add up to 100' => [['criteria' => [['name' => 'A', 'weight' => 50], ['name' => 'B', 'weight' => 30]]], 'criteria'],
            'two prizes share a place' => [['prizes' => [['place' => 1, 'title' => 'A'], ['place' => 1, 'title' => 'B']]], 'prizes'],
            'duplicate track names' => [['tracks' => [['name' => 'Same'], ['name' => 'Same']]], 'tracks.0.name'],
            'max team smaller than min' => [['min_team_size' => 4, 'max_team_size' => 2], 'max_team_size'],
            'resource link is not http(s)' => [['resources' => [['label' => 'Bad', 'url' => 'javascript:alert(1)']]], 'resources.0.url'],
            'unknown accent colour' => [['accent' => 'chartreuse'], 'accent'],
            'unknown mode' => [['mode' => 'telepathic'], 'mode'],
            'description too short' => [['description' => 'Too short.'], 'description'],
        ];
    }

    public function test_only_ops_can_feature_a_hackathon(): void
    {
        Sanctum::actingAs($this->staff());
        $id = $this->postJson('/api/admin/hackathons', $this->hostPayload(['is_featured' => true]))->json('hackathon.id');
        $this->assertTrue(Hackathon::find($id)->is_featured);

        Sanctum::actingAs($this->companyAdmin());
        $own = $this->postJson('/api/company/hackathons', $this->hostPayload(['is_featured' => true]))->json('hackathon.id');
        $this->assertFalse(Hackathon::find($own)->is_featured);
    }

    public function test_a_companys_edit_does_not_un_feature_what_ops_featured(): void
    {
        $company = $this->company();
        $admin = $this->companyAdmin($company);
        $hackathon = $this->hackathon(['host_type' => 'company', 'company_id' => $company->id, 'is_featured' => true]);

        Sanctum::actingAs($admin);
        $this->putJson("/api/company/hackathons/{$hackathon->id}", $this->hostPayload())->assertOk();

        $this->assertTrue($hackathon->fresh()->is_featured);
    }

    // ───────────────────────────── tenancy ─────────────────────────────

    public function test_a_company_sees_and_touches_only_its_own_hackathons(): void
    {
        $mine = $this->company('Mine Co');
        $theirs = $this->company('Theirs Co');
        $ownHackathon = $this->hackathon(['host_type' => 'company', 'company_id' => $mine->id]);
        $otherHackathon = $this->hackathon(['host_type' => 'company', 'company_id' => $theirs->id]);
        $platformHackathon = $this->hackathon();

        Sanctum::actingAs($this->companyAdmin($mine));

        $this->getJson('/api/company/hackathons')
            ->assertOk()
            ->assertJsonCount(1, 'hackathons')
            ->assertJsonPath('hackathons.0.id', $ownHackathon->id);

        foreach ([$otherHackathon, $platformHackathon] as $notMine) {
            $this->getJson("/api/company/hackathons/{$notMine->id}")->assertNotFound();
            $this->putJson("/api/company/hackathons/{$notMine->id}", $this->hostPayload())->assertNotFound();
            $this->postJson("/api/company/hackathons/{$notMine->id}/publish")->assertNotFound();
            $this->deleteJson("/api/company/hackathons/{$notMine->id}")->assertNotFound();
            $this->getJson("/api/company/hackathons/{$notMine->id}/submissions")->assertNotFound();
            $this->getJson("/api/company/hackathons/{$notMine->id}/registrations")->assertNotFound();
        }
    }

    public function test_ops_and_superadmin_see_every_hackathon_including_partners(): void
    {
        $company = $this->company();
        $this->hackathon(['host_type' => 'company', 'company_id' => $company->id]);
        $this->hackathon();

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/admin/hackathons')->assertJsonCount(2, 'hackathons');

        Sanctum::actingAs($this->superadmin());
        $this->getJson('/api/admin/hackathons')->assertJsonCount(2, 'hackathons');
    }

    public function test_only_hackathons_past_their_deadline_count_as_needing_scoring(): void
    {
        Sanctum::actingAs($this->staff());

        // A live hackathon's submitted projects are not "waiting for a judge" — scoring is not open yet.
        $live = $this->liveHackathon();
        $this->submittedProject($live);
        $ended = $this->endedHackathon();
        $this->submittedProject($ended);
        $this->submittedProject($ended);

        $response = $this->getJson('/api/admin/hackathons')->assertOk();

        $response->assertJsonPath('counts.needs_scoring', 1);
        $byPhase = collect($response->json('hackathons'))->keyBy('phase');
        $this->assertSame(2, $byPhase['judging']['unscored_count']);
        $this->assertSame(1, $byPhase['live']['unscored_count'], 'the raw figure is still reported; the UI decides when it matters');
    }

    public function test_manageable_by_follows_one_rule_for_every_role(): void
    {
        $company = $this->company();
        $own = $this->hackathon(['host_type' => 'company', 'company_id' => $company->id]);
        $platform = $this->hackathon();

        $this->assertTrue($own->isManagedBy($this->companyAdmin($company)));
        $this->assertFalse($own->isManagedBy($this->companyAdmin()));
        $this->assertFalse($platform->isManagedBy($this->companyAdmin($company)));
        $this->assertTrue($platform->isManagedBy($this->staff()));
        $this->assertFalse($platform->isManagedBy($this->staff([User::PERM_CONTESTS])));
        $this->assertTrue($own->isManagedBy($this->superadmin()));
        $this->assertFalse($own->isManagedBy($this->student()));
        $this->assertFalse($own->isManagedBy($this->tpo()));
    }

    // ───────────────────────────── lifecycle ─────────────────────────────

    public function test_publishing_makes_a_draft_visible_and_needs_a_location_when_not_online(): void
    {
        Sanctum::actingAs($this->staff());
        $id = $this->postJson('/api/admin/hackathons', $this->hostPayload(['mode' => 'hybrid']))->json('hackathon.id');

        $this->postJson("/api/admin/hackathons/{$id}/publish")->assertUnprocessable()->assertJsonPath('code', 'location_required');

        $this->putJson("/api/admin/hackathons/{$id}", $this->hostPayload(['mode' => 'hybrid', 'location' => 'Pune']))->assertOk();
        $this->postJson("/api/admin/hackathons/{$id}/publish")
            ->assertOk()
            ->assertJsonPath('hackathon.status', 'published')
            ->assertJsonPath('hackathon.phase', 'upcoming');

        $this->postJson("/api/admin/hackathons/{$id}/publish")->assertStatus(409)->assertJsonPath('code', 'already_published');
    }

    public function test_a_hackathon_whose_deadline_has_passed_cannot_be_published(): void
    {
        Sanctum::actingAs($this->staff());
        $past = $this->hackathon(['status' => 'draft', 'registration_opens_at' => now()->subDays(10), 'registration_closes_at' => now()->subDays(6), 'starts_at' => now()->subDays(5), 'ends_at' => now()->subDays(3)]);

        $this->postJson("/api/admin/hackathons/{$past->id}/publish")->assertUnprocessable()->assertJsonPath('code', 'already_over');
    }

    public function test_unpublishing_is_only_possible_before_anyone_registers(): void
    {
        Sanctum::actingAs($this->staff());
        $quiet = $this->hackathon();
        $busy = $this->hackathon();
        $this->enter($busy, $this->student());

        $this->postJson("/api/admin/hackathons/{$quiet->id}/unpublish")->assertOk()->assertJsonPath('hackathon.status', 'draft');
        $this->postJson("/api/admin/hackathons/{$busy->id}/unpublish")->assertStatus(409)->assertJsonPath('code', 'has_registrations');
    }

    public function test_cancelling_needs_a_reason_and_is_final(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon();

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/cancel", [])->assertUnprocessable()->assertJsonValidationErrors('reason');

        $this->postJson("/api/admin/hackathons/{$hackathon->id}/cancel", ['reason' => 'The venue fell through.'])
            ->assertOk()
            ->assertJsonPath('hackathon.status', 'cancelled')
            ->assertJsonPath('hackathon.cancelled_reason', 'The venue fell through.');

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $this->hostPayload())->assertStatus(409)->assertJsonPath('code', 'hackathon_cancelled');
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/publish")->assertStatus(409)->assertJsonPath('code', 'hackathon_cancelled');
        $this->postJson("/api/admin/hackathons/{$hackathon->id}/cancel", ['reason' => 'Again, for luck.'])->assertStatus(409);
    }

    public function test_only_drafts_and_cancelled_hackathons_without_registrations_can_be_deleted(): void
    {
        Sanctum::actingAs($this->staff());

        $draft = $this->hackathon(['status' => 'draft']);
        $published = $this->hackathon();
        $busyCancelled = $this->hackathon(['status' => 'cancelled']);
        $this->enter($busyCancelled, $this->student());

        $this->deleteJson("/api/admin/hackathons/{$published->id}")->assertStatus(409)->assertJsonPath('code', 'is_published');
        $this->deleteJson("/api/admin/hackathons/{$busyCancelled->id}")->assertStatus(409)->assertJsonPath('code', 'has_registrations');
        $this->deleteJson("/api/admin/hackathons/{$draft->id}")->assertOk();

        $this->assertDatabaseMissing('hackathons', ['id' => $draft->id]);
    }

    // ───────────────────────────── editing a hackathon people have joined ─────────────────────────────

    public function test_team_size_is_locked_once_students_register(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon(['min_team_size' => 1, 'max_team_size' => 4]);
        $this->enter($hackathon, $this->student());

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $this->hostPayload(['max_team_size' => 2]))
            ->assertStatus(409)
            ->assertJsonPath('code', 'team_size_locked');

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $this->hostPayload(['min_team_size' => 1, 'max_team_size' => 4]))->assertOk();
    }

    public function test_capacity_cannot_drop_below_the_students_already_registered(): void
    {
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon(['min_team_size' => 1, 'max_team_size' => 4]);
        $this->enter($hackathon, $this->student());
        $this->enter($hackathon, $this->student());
        $this->enter($hackathon, $this->student());

        $this->putJson("/api/admin/hackathons/{$hackathon->id}", $this->hostPayload(['max_participants' => 2]))
            ->assertUnprocessable()
            ->assertJsonPath('code', 'capacity_below_registrations');
    }

    public function test_kickoff_cannot_move_once_the_hackathon_has_started_but_the_deadline_can_be_extended(): void
    {
        Sanctum::actingAs($this->staff());
        $live = $this->liveHackathon();

        $unchanged = $this->hostPayload([
            'registration_opens_at' => $live->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $live->registration_closes_at->toIso8601String(),
            'starts_at' => $live->starts_at->toIso8601String(),
            'ends_at' => $live->ends_at->copy()->addDay()->toIso8601String(),
            'results_expected_at' => null,
        ]);

        $this->putJson("/api/admin/hackathons/{$live->id}", $unchanged)->assertOk();
        $this->assertTrue($live->fresh()->ends_at->gt($live->ends_at));

        // (left operand of + wins, so the override goes first)
        $this->putJson("/api/admin/hackathons/{$live->id}", ['starts_at' => now()->subHours(2)->toIso8601String()] + $unchanged)
            ->assertStatus(409)
            ->assertJsonPath('code', 'already_started');
    }

    public function test_the_deadline_cannot_be_changed_after_it_has_passed(): void
    {
        Sanctum::actingAs($this->staff());
        $ended = $this->endedHackathon();

        $this->putJson("/api/admin/hackathons/{$ended->id}", $this->hostPayload([
            'registration_opens_at' => $ended->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $ended->registration_closes_at->toIso8601String(),
            'starts_at' => $ended->starts_at->toIso8601String(),
            'ends_at' => now()->addDays(3)->toIso8601String(),
        ]))->assertStatus(409)->assertJsonPath('code', 'already_ended');
    }

    // ───────────────────────────── cover image ─────────────────────────────

    public function test_a_cover_can_be_uploaded_replaced_and_removed(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon();

        $first = $this->post("/api/admin/hackathons/{$hackathon->id}/cover", ['cover' => UploadedFile::fake()->image('a.jpg', 1200, 630)], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('hackathon.has_cover', true);

        $firstPath = $hackathon->fresh()->cover_image;
        Storage::disk('public')->assertExists($firstPath);
        $this->assertStringStartsWith('hackathons/covers/', $firstPath);
        $this->assertNotNull($first->json('hackathon.cover_url'));

        $this->post("/api/admin/hackathons/{$hackathon->id}/cover", ['cover' => UploadedFile::fake()->image('b.png', 1200, 630)], ['Accept' => 'application/json'])->assertOk();
        Storage::disk('public')->assertMissing($firstPath);

        $secondPath = $hackathon->fresh()->cover_image;
        $this->deleteJson("/api/admin/hackathons/{$hackathon->id}/cover")->assertOk()->assertJsonPath('hackathon.has_cover', false);
        Storage::disk('public')->assertMissing($secondPath);
    }

    public function test_a_cover_must_be_a_reasonably_sized_image(): void
    {
        Storage::fake('public');
        Sanctum::actingAs($this->staff());
        $hackathon = $this->hackathon();

        foreach ([
            UploadedFile::fake()->create('notes.pdf', 100, 'application/pdf'),
            UploadedFile::fake()->image('tiny.jpg', 100, 100),
            UploadedFile::fake()->image('script.svg')->mimeType('image/svg+xml'),
        ] as $bad) {
            $this->post("/api/admin/hackathons/{$hackathon->id}/cover", ['cover' => $bad], ['Accept' => 'application/json'])->assertUnprocessable();
        }

        $this->assertNull($hackathon->fresh()->cover_image);
    }

    public function test_a_bundled_cover_is_never_deleted_from_storage_and_is_served_as_is(): void
    {
        Storage::fake('public');
        $hackathon = $this->hackathon(['cover_image' => '/hackathons/demo.svg']);

        $this->assertFalse($hackathon->hasStoredCover());
        $this->assertSame('/hackathons/demo.svg', $hackathon->coverUrl());

        Sanctum::actingAs($this->staff());
        $this->deleteJson("/api/admin/hackathons/{$hackathon->id}/cover")->assertOk();
        $this->assertNull($hackathon->fresh()->cover_image);
    }

    // ───────────────────────────── people ─────────────────────────────

    public function test_the_host_sees_registrations_and_can_export_them_without_csv_injection(): void
    {
        $company = $this->company();
        $hackathon = $this->hackathon(['host_type' => 'company', 'company_id' => $company->id]);
        $this->enter($hackathon, $this->student(['name' => '=HYPERLINK("http://evil")', 'email' => 'evil@example.com']), null, 'Alpha');
        $this->enter($hackathon, $this->student(['name' => 'Sneha Reddy']), null, 'Beta');

        Sanctum::actingAs($this->companyAdmin($company));

        $this->getJson("/api/company/hackathons/{$hackathon->id}/registrations")
            ->assertOk()
            ->assertJsonCount(2, 'registrations')
            ->assertJsonPath('totals.participants', 2)
            ->assertJsonPath('totals.teams', 2);

        $this->getJson("/api/company/hackathons/{$hackathon->id}/registrations?q=sneha")->assertJsonCount(1, 'registrations');

        $csv = $this->get("/api/company/hackathons/{$hackathon->id}/registrations/export", ['Accept' => 'text/csv']);
        $csv->assertOk();
        $body = $csv->streamedContent();
        $this->assertStringContainsString('Sneha Reddy', $body);
        $this->assertStringContainsString("'=HYPERLINK", $body);
        $this->assertStringNotContainsString(',=HYPERLINK', $body);
    }

    public function test_a_registrations_list_never_exposes_another_hackathons_students(): void
    {
        $mine = $this->hackathon();
        $other = $this->hackathon();
        $this->enter($other, $this->student(['name' => 'Someone Else']));

        Sanctum::actingAs($this->staff());
        $this->getJson("/api/admin/hackathons/{$mine->id}/registrations")->assertJsonCount(0, 'registrations');
    }

    /** Regression: an ungrouped `AND … OR` let a search term match teams from *other* hackathons. */
    public function test_searching_registrations_never_reaches_into_another_hackathon(): void
    {
        $company = $this->company();
        $mine = $this->hackathon(['host_type' => 'company', 'company_id' => $company->id]);
        $theirs = $this->hackathon(['host_type' => 'company', 'company_id' => $this->company('Rival')->id]);

        $this->enter($mine, $this->student(['name' => 'Ours One']), null, 'Rocket Squad');
        $this->enter($theirs, $this->student(['name' => 'Theirs One', 'email' => 'theirs@example.com']), null, 'Rocket Rivals');
        $this->enter($theirs, $this->student(['name' => 'Theirs Two']), null, 'Rocket Crew');

        Sanctum::actingAs($this->companyAdmin($company));

        // "Rocket" matches a team name in BOTH hackathons; only our own may come back.
        $names = collect($this->getJson("/api/company/hackathons/{$mine->id}/registrations?q=rocket")->assertOk()->json('registrations'))
            ->pluck('student.name')->all();
        $this->assertSame(['Ours One'], $names);

        $this->getJson("/api/company/hackathons/{$mine->id}/registrations?q=theirs")->assertJsonCount(0, 'registrations');
    }

    // ───────────────────────────── announcements ─────────────────────────────

    public function test_updates_can_be_posted_to_a_published_hackathon_and_removed(): void
    {
        Sanctum::actingAs($this->staff());
        $published = $this->hackathon();
        $draft = $this->hackathon(['status' => 'draft']);

        $this->postJson("/api/admin/hackathons/{$draft->id}/announcements", ['title' => 'Hello', 'body' => 'Not yet.'])
            ->assertStatus(409)->assertJsonPath('code', 'not_published');

        $created = $this->postJson("/api/admin/hackathons/{$published->id}/announcements", ['title' => 'Mentors announced', 'body' => 'Six mentors are joining us.'])
            ->assertCreated()->assertJsonPath('announcement.title', 'Mentors announced');

        $this->deleteJson("/api/admin/hackathons/{$published->id}/announcements/{$created->json('announcement.id')}")->assertOk();
        $this->assertDatabaseCount('hackathon_announcements', 0);
    }

    public function test_an_update_cannot_be_deleted_through_a_different_hackathon(): void
    {
        Sanctum::actingAs($this->staff());
        $a = $this->hackathon();
        $b = $this->hackathon();
        $update = $a->announcements()->create(['title' => 'Hi there', 'body' => 'Hello everyone']);

        $this->deleteJson("/api/admin/hackathons/{$b->id}/announcements/{$update->id}")->assertNotFound();
        $this->assertDatabaseCount('hackathon_announcements', 1);
    }
}
