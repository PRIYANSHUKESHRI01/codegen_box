<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\Subscription;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * The Mellow Direct lead book (GET /marketing/leads), as the superadmin's Leads tab and the Marketing dashboard use it:
 * how quickly a page comes back, that search / status / owner are answered by the server across the WHOLE book (it is
 * paged), and that every number on the filter bar is exactly what picking that filter then lists.
 */
class MarketingLeadsDirectoryTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function lead(array $over = []): User
    {
        $owner = $over['assigned_marketing_id'] ?? null;
        unset($over['assigned_marketing_id']);

        $lead = User::factory()->create(array_merge([
            'role' => User::ROLE_USER,
            'college_id' => null,
            'lead_status' => User::LEAD_STATUS_NEW,
        ], $over));

        // A new lead is handed to a marketing employee automatically when one exists (LeadAssignmentService); these tests
        // want to say exactly who owns what, including nobody.
        DB::table('users')->where('id', $lead->id)->update(['assigned_marketing_id' => $owner]);

        return $lead->refresh();
    }

    private function list(array $query = []): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/marketing/leads?'.http_build_query($query))->assertOk();
    }

    private function plan(string $code, string $name, string $kind = Plan::KIND_BASE): Plan
    {
        return Plan::create([
            'code' => $code,
            'name' => $name,
            'audience' => Plan::AUDIENCE_INDIVIDUAL,
            'kind' => $kind,
            'list_price' => 0,
            'duration_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    public function test_a_page_of_leads_is_enriched_in_bulk_not_one_lead_at_a_time(): void
    {
        for ($i = 0; $i < 40; $i++) {
            $this->lead();
        }
        Sanctum::actingAs($this->superadmin());

        DB::enableQueryLog();
        $response = $this->list();
        $queries = count(DB::getQueryLog());

        $this->assertCount(40, $response->json('leads.data'));
        // Per lead this was ~5 queries plus a read of the whole problem catalogue each time (200+ queries for 40 leads).
        $this->assertLessThan(25, $queries, "the lead list ran {$queries} queries — it is enriching one lead at a time again");
    }

    public function test_each_row_carries_the_plan_and_solved_score_it_always_did(): void
    {
        $marketer = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'name' => 'Maya Marketer']);
        $free = $this->plan('coder-x', 'Coder');
        $paid = $this->plan('expert-x', 'Expert');
        $lead = $this->lead(['name' => 'Priya Lead', 'assigned_marketing_id' => $marketer->id]);
        $bare = $this->lead(['name' => 'No Plan Lead']);

        // Signing up gives everyone the free default plan; clear those so the plans below are the only ones in play.
        Subscription::query()->whereIn('subscriber_id', [$lead->id, $bare->id])->where('subscriber_type', User::class)->delete();

        // Two active base plans: the newest wins. An active ADD-ON never answers "which plan governs this account".
        $make = fn (Plan $plan, string $started) => Subscription::create([
            'subscriber_type' => User::class,
            'subscriber_id' => $lead->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => $started,
            'current_period_end' => now()->addYear(),
            'auto_renew' => false,
        ]);
        $make($free, now()->subMonths(3)->toDateTimeString());
        $make($paid, now()->subDay()->toDateTimeString());
        $make($this->plan('lab-x', 'Project Lab', Plan::KIND_ADDON), now()->toDateTimeString());

        // Solved: 2 easy + 1 hard (distinct problems) = 2*10 + 1*50 = 70; a Wrong Answer and a repeat solve don't count.
        $easy = [$this->makeProblem('easy'), $this->makeProblem('easy')];
        $hard = $this->makeProblem('hard');
        foreach ([...$easy, $hard] as $problem) {
            $this->practiceSubmission($lead, 'python', Submission::STATUS_ACCEPTED, $problem);
        }
        $this->practiceSubmission($lead, 'python', Submission::STATUS_ACCEPTED, $easy[0], now()->subDay());
        $this->practiceSubmission($lead, 'python', Submission::STATUS_WRONG_ANSWER, $this->makeProblem('hard'));

        Sanctum::actingAs($this->superadmin());
        $rows = collect($this->list()->json('leads.data'))->keyBy('id');

        $this->assertSame('Expert', $rows[$lead->id]['plan_name']);
        $this->assertSame('active', $rows[$lead->id]['subscription_status']);
        $this->assertSame(70, $rows[$lead->id]['solved_score']);
        $this->assertSame('Maya Marketer', $rows[$lead->id]['assigned_to_name']);

        $this->assertNull($rows[$bare->id]['plan_name']);
        $this->assertSame(0, $rows[$bare->id]['solved_score']);
        $this->assertNull($rows[$bare->id]['assigned_to_name']);
    }

    public function test_search_looks_through_the_whole_book_not_just_the_page_on_screen(): void
    {
        for ($i = 0; $i < 55; $i++) {
            $this->lead(['name' => "Filler Person {$i}", 'email' => "filler{$i}@example.com"]);
        }
        // Oldest of all, so it is NOT on the first page of 50.
        $this->lead(['name' => 'Zed Needle', 'email' => 'needle@haystack.test', 'created_at' => now()->subYear()]);

        Sanctum::actingAs($this->superadmin());

        $first = $this->list();
        $this->assertCount(50, $first->json('leads.data'));
        $this->assertNotContains('Zed Needle', collect($first->json('leads.data'))->pluck('name')->all());
        $this->assertSame(56, $first->json('leads.total'));

        $found = $this->list(['search' => 'needle']);
        $this->assertSame(['Zed Needle'], collect($found->json('leads.data'))->pluck('name')->all());
        $this->assertSame(['Zed Needle'], collect($this->list(['search' => 'Haystack'])->json('leads.data'))->pluck('name')->all(), 'email works too');

        $this->assertSame(6, $this->list(['page' => 2])->json('leads.total') - 50, 'page 2 holds the rest');
        $this->assertCount(6, $this->list(['page' => 2])->json('leads.data'));
    }

    public function test_status_and_owner_filters_narrow_the_list(): void
    {
        $marketer = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]);
        $this->lead(['name' => 'New One']);
        $this->lead(['name' => 'New Owned', 'assigned_marketing_id' => $marketer->id]);
        $this->lead(['name' => 'Called', 'lead_status' => User::LEAD_STATUS_CONTACTED]);
        $this->lead(['name' => 'Won', 'lead_status' => User::LEAD_STATUS_CONVERTED, 'assigned_marketing_id' => $marketer->id]);
        Sanctum::actingAs($this->superadmin());

        $names = fn (array $q) => collect($this->list($q)->json('leads.data'))->pluck('name')->sort()->values()->all();

        $this->assertSame(['New One', 'New Owned'], $names(['status' => 'new']));
        $this->assertSame(['Won'], $names(['status' => 'converted']));
        $this->assertSame(['Called', 'New One'], $names(['assigned' => 'unassigned']));
        $this->assertSame(['New One'], $names(['assigned' => 'unassigned', 'status' => 'new']));
        $this->assertSame(['Called', 'New One', 'New Owned', 'Won'], $names([]));
    }

    public function test_every_count_on_the_filter_bar_equals_what_choosing_it_then_lists(): void
    {
        $marketer = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]);
        foreach ([
            ['Asha New', 'new', null], ['Anil New', 'new', $marketer->id], ['Amit Called', 'contacted', null], ['Bela Called', 'contacted', $marketer->id],
            ['Chitra Engaged', 'engaged', null], ['Dev Won', 'converted', $marketer->id], ['Esha Won', 'converted', null], ['Farah Lost', 'lost', null],
        ] as [$name, $status, $owner]) {
            $this->lead(['name' => $name, 'lead_status' => $status, 'assigned_marketing_id' => $owner]);
        }
        Sanctum::actingAs($this->superadmin());

        foreach (['', 'a', 'won', 'zzz'] as $search) {
            foreach ([false, true] as $unassigned) {
                $q = ($search !== '' ? ['search' => $search] : []) + ($unassigned ? ['assigned' => 'unassigned'] : []);
                $facets = $this->list($q)->json('facets');

                $this->assertSame($this->list($q)->json('leads.total'), $facets['total'], "All chip, search '{$search}', unassigned ".(int) $unassigned);
                $this->assertSame($facets['total'], array_sum($facets['by_status']), 'the chips add up to All');

                foreach (User::LEAD_STATUSES as $status) {
                    $this->assertSame($facets['by_status'][$status], $this->list($q + ['status' => $status])->json('leads.total'), "chip {$status}, search '{$search}', unassigned ".(int) $unassigned);
                }
            }

            foreach ([null, ...User::LEAD_STATUSES] as $status) {
                $q = ($search !== '' ? ['search' => $search] : []) + ($status ? ['status' => $status] : []);
                $this->assertSame(
                    $this->list($q)->json('facets.unassigned'),
                    $this->list($q + ['assigned' => 'unassigned'])->json('leads.total'),
                    "'unassigned only' count, search '{$search}', status ".($status ?? 'any')
                );
            }
        }
    }

    public function test_the_headline_numbers_describe_the_whole_book_and_never_move_with_a_filter(): void
    {
        $this->lead();
        $this->lead(['lead_status' => User::LEAD_STATUS_CONVERTED]);
        $this->lead(['lead_status' => User::LEAD_STATUS_CONVERTED, 'created_at' => now()->subMonth()]);
        $this->lead(['lead_status' => User::LEAD_STATUS_LOST, 'created_at' => now()->subMonth()]);
        Sanctum::actingAs($this->superadmin());

        $plain = $this->list()->json('kpis');
        $this->assertSame(4, $plain['total_leads']);
        $this->assertSame(2, $plain['converted_count']);
        $this->assertSame(50.0, (float) $plain['conversion_rate']);
        $this->assertSame(2, $plain['new_this_week']);
        $this->assertSame(['new' => 1, 'contacted' => 0, 'engaged' => 0, 'converted' => 2, 'lost' => 1], $plain['by_status']);

        $this->assertSame($plain, $this->list(['status' => 'lost', 'search' => 'zzz', 'assigned' => 'unassigned'])->json('kpis'));
    }

    public function test_a_marketing_employee_only_ever_sees_and_counts_their_own_book(): void
    {
        $me = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'permissions' => ['leads']]);
        $other = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'permissions' => ['leads']]);
        $this->lead(['name' => 'Mine A', 'assigned_marketing_id' => $me->id]);
        $this->lead(['name' => 'Mine B', 'assigned_marketing_id' => $me->id, 'lead_status' => User::LEAD_STATUS_CONTACTED]);
        $this->lead(['name' => 'Theirs', 'assigned_marketing_id' => $other->id]);
        $this->lead(['name' => 'Nobody']);

        Sanctum::actingAs($me);
        $response = $this->list();

        $this->assertSame(['Mine A', 'Mine B'], collect($response->json('leads.data'))->pluck('name')->sort()->values()->all());
        $this->assertSame(2, $response->json('kpis.total_leads'));
        $this->assertSame(2, $response->json('facets.total'));
        $this->assertSame(0, $response->json('facets.unassigned'), "someone else's and unowned leads are not even counted");
        $this->assertSame([], $this->list(['search' => 'Theirs'])->json('leads.data'));
    }
}
