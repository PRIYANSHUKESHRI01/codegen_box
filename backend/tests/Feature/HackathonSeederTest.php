<?php

namespace Tests\Feature;

use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\User;
use Database\Seeders\HackathonSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The demo hackathons must always show the arena in each of its states, however long after the
 * seeder was written it is run — and must be safe to run twice.
 */
class HackathonSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_seeds_five_hackathons_in_five_different_phases(): void
    {
        $this->seed(HackathonSeeder::class);

        $phases = Hackathon::orderBy('id')->get()->mapWithKeys(fn (Hackathon $h) => [$h->slug => $h->phase()])->all();

        $this->assertSame([
            'ai-for-bharat-build-sprint' => 'live',
            'nimbus-cloud-native-challenge' => 'registration_open',
            'greencode-climate-hack' => 'upcoming',
            'healthtech-hack-day' => 'judging',
            'campus-connect-hack-2' => 'completed',
        ], $phases);
    }

    public function test_the_company_hackathon_is_hosted_by_a_company_and_the_rest_by_the_platform(): void
    {
        $this->seed(HackathonSeeder::class);

        $company = Hackathon::where('slug', 'nimbus-cloud-native-challenge')->first();
        $this->assertTrue($company->isHostedByCompany());
        $this->assertSame('Nimbus Labs', $company->company->name);

        $this->assertSame(4, Hackathon::where('host_type', 'platform')->count());
        $this->assertSame(1, Hackathon::where('is_featured', true)->count());
    }

    public function test_the_demo_student_has_something_to_see_in_every_state(): void
    {
        $this->seed(HackathonSeeder::class);

        $alex = User::where('email', 'alex.chen@student.apex.edu')->first();
        $states = HackathonParticipant::where('user_id', $alex->id)
            ->with(['hackathon', 'team.submission'])
            ->get()
            ->mapWithKeys(fn ($p) => [$p->hackathon->slug => [$p->team->submission?->status, $p->team->submission?->rank]])
            ->all();

        $this->assertSame(['draft', null], $states['ai-for-bharat-build-sprint'], 'a draft in progress on the live hackathon');
        $this->assertSame(['submitted', null], $states['healthtech-hack-day'], 'submitted and waiting to be judged');
        $this->assertSame(['submitted', 2], $states['campus-connect-hack-2'], 'second place in the finished one');
        $this->assertArrayNotHasKey('nimbus-cloud-native-challenge', $states, 'left unregistered so the Register path is demoable');
    }

    public function test_the_finished_hackathon_has_a_podium_a_disqualification_and_an_unsubmitted_team(): void
    {
        $this->seed(HackathonSeeder::class);

        $done = Hackathon::where('slug', 'campus-connect-hack-2')->first();

        $this->assertTrue($done->resultsArePublished());
        $this->assertSame(
            ['StudySync', 'CampusBuzz', 'NotesNest'],
            $done->submissions()->whereIn('rank', [1, 2, 3])->orderBy('rank')->pluck('title')->all()
        );
        $this->assertSame(['Campus Champion', 'Runner-up', 'Third place'], $done->submissions()->whereIn('rank', [1, 2, 3])->orderBy('rank')->pluck('award_label')->all());
        $this->assertSame(1, $done->submissions()->where('is_disqualified', true)->count());
        $this->assertNull($done->submissions()->where('is_disqualified', true)->first()->rank);
        $this->assertSame(10, $done->teams()->count());
        $this->assertSame(9, $done->submissions()->count());
    }

    public function test_the_judging_hackathon_is_part_scored_so_the_host_has_work_to_do(): void
    {
        $this->seed(HackathonSeeder::class);

        $judging = Hackathon::where('slug', 'healthtech-hack-day')->first();

        $this->assertSame(6, $judging->submissions()->where('status', 'submitted')->count());
        $this->assertSame(3, $judging->submissions()->whereNotNull('final_score')->count());
        $this->assertFalse($judging->resultsArePublished());
    }

    public function test_one_demo_hackathon_is_exclusive_to_a_college_and_the_rest_are_open(): void
    {
        $this->seed(HackathonSeeder::class);

        $exclusive = Hackathon::where('audience', Hackathon::AUDIENCE_COLLEGES)->get();
        $this->assertSame(['healthtech-hack-day'], $exclusive->pluck('slug')->all());
        $this->assertSame(['APEX'], $exclusive->first()->colleges()->pluck('short_code')->all());
        $this->assertSame(4, Hackathon::where('audience', Hackathon::AUDIENCE_ALL)->count());

        // Everyone registered in it belongs to that college, as the stranding rule requires.
        $this->assertSame(
            0,
            $exclusive->first()->participants()->whereHas('user', fn ($u) => $u->whereNull('college_id')->orWhere('college_id', '!=', $exclusive->first()->colleges()->value('colleges.id')))->count()
        );
    }

    public function test_it_is_idempotent(): void
    {
        $this->seed(HackathonSeeder::class);
        $counts = fn () => [
            Hackathon::count(),
            HackathonParticipant::count(),
            HackathonSubmission::count(),
            User::count(),
        ];
        $first = $counts();

        $this->seed(HackathonSeeder::class);

        $this->assertSame($first, $counts());
    }

    public function test_a_seeded_student_can_actually_use_the_seeded_arena(): void
    {
        $this->seed(HackathonSeeder::class);
        Sanctum::actingAs(User::where('email', 'alex.chen@student.apex.edu')->first());

        $home = $this->getJson('/api/arena/home')->assertOk();
        $home->assertJsonPath('featured.slug', 'ai-for-bharat-build-sprint')
            ->assertJsonPath('stats.joined', 3)
            ->assertJsonPath('stats.podiums', 1);

        $this->getJson('/api/arena/hackathons/campus-connect-hack-2')
            ->assertOk()
            ->assertJsonPath('hackathon.mine.rank', 2)
            ->assertJsonPath('hackathon.mine.award_label', 'Runner-up');

        $this->assertCount(5, $this->getJson('/api/arena/hackathons')->json('hackathons'));
    }
}
