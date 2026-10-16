<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Company;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\DriveApplication;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use App\Models\PlacementDrive;
use App\Models\Plan;
use App\Models\Problem;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillResponse;
use App\Models\SoftSkillSession;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegePurgeService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
use Tests\TestCase;

/**
 * Permanently deleting a university (superadmin only). The schema alone would
 * detach its people, orphan its content and refuse outright over drive
 * applications, so these tests build a university the way real life does — with
 * accounts, tokens, files, subscriptions, drives, applications (including the
 * awkward ones), a contest with submissions, a template, a track and an
 * assessment with responses — next to a second university that must come
 * through untouched.
 *
 * Run it against MySQL too, not just SQLite: the contest-submission and
 * assessment-response foreign keys are RESTRICT, and the two engines differ
 * on when they enforce that.
 */
class CollegePermanentDeletionTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    /** @return array<string, mixed> */
    private function world(): array
    {
        Storage::fake('public');

        $plan = Plan::create([
            'code' => 'standard', 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION,
            'list_price' => null, 'annual_price' => 149000, 'duration_days' => 365,
            'is_active' => true, 'sort_order' => 1, 'drive_access' => true, 'max_students' => 500,
        ]);

        $college = College::create(['name' => 'Tulas University', 'short_code' => 'TU', 'tier' => 'Standard']);
        $other = College::create(['name' => 'Other University', 'short_code' => 'OU', 'tier' => 'Standard']);
        foreach ([$college, $other] as $c) {
            Subscription::create([
                'subscriber_type' => College::class, 'subscriber_id' => $c->id, 'plan_id' => $plan->id,
                'status' => Subscription::STATUS_ACTIVE, 'started_at' => now(), 'current_period_end' => now()->addYear(), 'auto_renew' => false,
            ]);
        }

        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id, 'email' => 'tpo@tulas.test']);
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id]);
        $students = User::factory()->count(3)->create(['role' => User::ROLE_USER, 'college_id' => $college->id]);
        // Staff who merely carry this college_id are the university's to detach, never to lose.
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'college_id' => $college->id, 'permissions' => []]);

        $otherTpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $other->id]);
        $otherStudent = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $other->id]);
        $lead = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null]);

        foreach ([$tpo, $coordinator, $students[0], $students[1], $staff, $otherTpo, $otherStudent, $lead] as $u) {
            $u->createToken('session');
        }

        Storage::disk('public')->put('avatars/tulas-student.jpg', 'img');
        Storage::disk('public')->put('avatars/other-student.jpg', 'img');
        $students[0]->forceFill(['avatar_path' => 'avatars/tulas-student.jpg'])->save();
        $otherStudent->forceFill(['avatar_path' => 'avatars/other-student.jpg'])->save();

        // ---- what the college's TPO created ----
        $company = Company::create(['name' => 'Acme', 'slug' => 'acme-'.uniqid()]);
        $ownedDrive = PlacementDrive::create([
            'company_id' => $company->id, 'title' => 'Campus Drive', 'role_title' => 'SDE', 'drive_date' => now()->addWeek(),
            'status' => 'published', 'source' => PlacementDrive::SOURCE_TPO_CREATED, 'owning_college_id' => $college->id, 'created_by' => $tpo->id,
        ]);
        $globalDrive = PlacementDrive::create([
            'company_id' => $company->id, 'title' => 'Global Drive', 'role_title' => 'SDE', 'drive_date' => now()->addWeek(), 'status' => 'published',
        ]);
        $apply = fn (PlacementDrive $drive, User $user) => DriveApplication::create([
            'placement_drive_id' => $drive->id, 'user_id' => $user->id, 'college_id' => $college->id,
            'stage' => DriveApplication::STAGE_REGISTERED, 'stage_updated_at' => now(),
        ]);
        $apply($ownedDrive, $students[0]);
        $apply($globalDrive, $students[1]);       // the common case: a student applying to a platform drive
        $apply($ownedDrive, $otherStudent);        // stamped with this college although the student has since moved — RESTRICT must not veto

        $problem = Problem::create([
            'slug' => 'two-sum-t', 'title' => 'Two Sum', 'difficulty' => 'easy', 'tags' => [], 'description' => 'Find two numbers.',
            'function_name' => 'twoSum', 'params' => [['name' => 'nums', 'type' => 'integer[]']], 'return_type' => 'integer[]',
            'comparison_mode' => Problem::COMPARISON_EXACT, 'display_order' => 1,
        ]);
        $contestOf = fn (array $attrs) => Contest::create(array_merge([
            'title' => 'Contest', 'slug' => 'c-'.uniqid(), 'start_at' => now()->subHour(), 'end_at' => now()->addHour(),
            'is_rated' => false, 'status' => Contest::STATUS_PUBLISHED,
        ], $attrs));
        $submit = function (Contest $contest, User $user) use ($problem) {
            $cp = ContestProblem::firstOrCreate(['contest_id' => $contest->id, 'problem_id' => $problem->id], ['points' => 100, 'display_order' => 1]);
            ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $user->id, 'registered_at' => now()]);
            ContestSubmission::create([
                'contest_id' => $contest->id, 'contest_problem_id' => $cp->id, 'user_id' => $user->id,
                'language' => 'python', 'code' => 'x', 'status' => 'accepted', 'submitted_at' => now(), 'points_awarded' => 100,
            ]);
        };
        $mockContest = $contestOf(['contest_type' => Contest::CONTEST_TYPE_TPO_MOCK, 'owning_college_id' => $college->id]);
        $submit($mockContest, $students[0]);
        $submit($mockContest, $students[1]);
        $globalContest = $contestOf([]);
        $submit($globalContest, $students[0]);
        $submit($globalContest, $otherStudent);

        $template = InterviewRoleTemplate::create([
            'name' => 'College Private', 'rounds_config' => [['round_number' => 1, 'round_name' => 'Screening']],
            'owning_college_id' => $college->id, 'created_by' => $tpo->id,
        ]);
        $track = InterviewTrack::create([
            'title' => 'College Track', 'slug' => 'track-'.uniqid(), 'track_type' => 'tpo_mock',
            'owning_college_id' => $college->id, 'interview_role_template_id' => $template->id, 'created_by' => $tpo->id,
        ]);

        $assessment = SoftSkillAssessment::create([
            'title' => 'College Check', 'slug' => SoftSkillAssessment::uniqueSlug('College Check'), 'status' => SoftSkillAssessment::STATUS_PUBLISHED,
            'assessment_type' => SoftSkillAssessment::TYPE_TPO_MOCK, 'duration_minutes' => 30, 'pass_percentage' => 60, 'owning_college_id' => $college->id,
        ]);
        $question = SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q1', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0]);
        $aq = SoftSkillAssessmentQuestion::create(['soft_skill_assessment_id' => $assessment->id, 'soft_skill_question_id' => $question->id, 'display_order' => 0]);
        $session = SoftSkillSession::create([
            'soft_skill_assessment_id' => $assessment->id, 'user_id' => $students[0]->id,
            'status' => SoftSkillSession::STATUS_IN_PROGRESS, 'attempt_number' => 1, 'started_at' => now(),
        ]);
        SoftSkillResponse::create(['soft_skill_session_id' => $session->id, 'soft_skill_assessment_question_id' => $aq->id]);

        return compact(
            'college', 'other', 'tpo', 'coordinator', 'students', 'staff', 'otherTpo', 'otherStudent', 'lead',
            'ownedDrive', 'globalDrive', 'mockContest', 'globalContest', 'template', 'track', 'assessment', 'problem'
        );
    }

    private function deleteCollege(College $college, array $overrides = [])
    {
        return $this->deleteJson("/api/superadmin/colleges/{$college->id}", array_merge(
            ['password' => self::PASSWORD, 'confirm_name' => $college->name],
            $overrides
        ));
    }

    public function test_the_preview_counts_exactly_what_would_be_deleted(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        $this->getJson("/api/superadmin/colleges/{$w['college']->id}/deletion-preview")
            ->assertOk()
            ->assertJsonPath('college.name', 'Tulas University')
            ->assertJsonPath('impact', [
                'tpos' => 1,
                'coordinators' => 1,
                'students' => 3,
                'accounts_kept_detached' => 1,
                'drives' => 1,
                'contests' => 1,
                'interviews' => 0,
                'interview_tracks' => 1,
                'interview_role_templates' => 1,
                'soft_skill_assessments' => 1,
                'drive_applications' => 3,
            ]);
    }

    public function test_only_a_superadmin_can_preview_or_delete(): void
    {
        $w = $this->world();
        $url = "/api/superadmin/colleges/{$w['college']->id}";

        foreach ([$w['tpo'], $w['students'][0], $w['staff']] as $caller) {
            Sanctum::actingAs($caller);
            $this->getJson("{$url}/deletion-preview")->assertForbidden();
            $this->deleteJson($url, ['password' => 'anything', 'confirm_name' => 'Tulas University'])->assertForbidden();
        }

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
        $this->assertSame(3, User::where('college_id', $w['college']->id)->where('role', User::ROLE_USER)->count());
    }

    public function test_a_wrong_password_deletes_nothing_and_does_not_look_like_an_expired_session(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        // 422 (a validation error), never 401 — the frontend signs people out on 401.
        $this->deleteCollege($w['college'], ['password' => 'not-my-password'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
        $this->assertDatabaseHas('users', ['id' => $w['tpo']->id]);
    }

    public function test_the_university_name_must_be_typed_exactly(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        foreach (['tulas university', 'Tulas', ''] as $typed) {
            $this->deleteCollege($w['college'], ['confirm_name' => $typed])
                ->assertStatus(422)
                ->assertJsonValidationErrors('confirm_name');
        }

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
    }

    public function test_deleting_a_university_removes_everything_that_belongs_to_it_and_nothing_else(): void
    {
        $w = $this->world();
        /** @var College $college */
        $college = $w['college'];
        $deletedUserIds = collect([$w['tpo'], $w['coordinator'], ...$w['students']])->pluck('id');
        $tulasAvatar = 'avatars/tulas-student.jpg';

        $actor = $this->superadmin();
        Sanctum::actingAs($actor);
        $this->deleteCollege($college)
            ->assertOk()
            ->assertJsonPath('deleted', true)
            ->assertJsonPath('removed.students', 3);

        // The university and its people.
        $this->assertDatabaseMissing('colleges', ['id' => $college->id]);
        $this->assertSame(0, User::whereIn('id', $deletedUserIds)->count());
        $this->assertSame(0, DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $deletedUserIds)->count());
        $this->assertSame(0, DB::table('subscriptions')->where('subscriber_type', User::class)->whereIn('subscriber_id', $deletedUserIds)->count());
        $this->assertSame(0, DB::table('subscriptions')->where('subscriber_type', College::class)->where('subscriber_id', $college->id)->count());
        Storage::disk('public')->assertMissing($tulasAvatar);

        // What its TPO created — gone, not orphaned (an orphaned role template would turn into a PLATFORM template).
        $this->assertDatabaseMissing('placement_drives', ['id' => $w['ownedDrive']->id]);
        $this->assertDatabaseMissing('contests', ['id' => $w['mockContest']->id]);
        $this->assertSame(0, ContestSubmission::where('contest_id', $w['mockContest']->id)->count());
        $this->assertDatabaseMissing('interview_role_templates', ['id' => $w['template']->id]);
        $this->assertDatabaseMissing('interview_tracks', ['id' => $w['track']->id]);
        $this->assertDatabaseMissing('soft_skill_assessments', ['id' => $w['assessment']->id]);
        $this->assertSame(0, SoftSkillResponse::count());
        $this->assertSame(0, DriveApplication::count(), 'every application stamped with this college goes, including the one from a student who had moved');

        // Kept: staff are only detached.
        $this->assertSame(null, User::findOrFail($w['staff']->id)->college_id);

        // Untouched: the other university and shared platform content.
        $this->assertDatabaseHas('colleges', ['id' => $w['other']->id]);
        $this->assertDatabaseHas('users', ['id' => $w['otherTpo']->id, 'college_id' => $w['other']->id]);
        $this->assertDatabaseHas('users', ['id' => $w['otherStudent']->id, 'college_id' => $w['other']->id]);
        $this->assertDatabaseHas('users', ['id' => $w['lead']->id]);
        $this->assertSame(1, DB::table('personal_access_tokens')->where('tokenable_type', User::class)->where('tokenable_id', $w['otherStudent']->id)->count());
        Storage::disk('public')->assertExists('avatars/other-student.jpg');
        $this->assertDatabaseHas('placement_drives', ['id' => $w['globalDrive']->id]);
        $this->assertDatabaseHas('contests', ['id' => $w['globalContest']->id]);
        $this->assertDatabaseHas('problems', ['id' => $w['problem']->id]);
        // ...including the other university's student's own submission to the shared contest.
        $this->assertSame(1, ContestSubmission::where('contest_id', $w['globalContest']->id)->where('user_id', $w['otherStudent']->id)->count());
        $this->assertSame(0, ContestSubmission::where('contest_id', $w['globalContest']->id)->whereIn('user_id', $deletedUserIds)->count());

        // It's on the audit trail, with counts but no personal data.
        $log = ActivityLog::where('action', 'Permanently deleted a partner university')->firstOrFail();
        $this->assertSame($actor->id, $log->actor_id);
        $this->assertSame('Tulas University', $log->target_label);
        $this->assertSame(3, $log->meta['students']);
        $this->assertStringNotContainsString('tpo@tulas.test', json_encode($log->toArray()));

        // The deleted accounts' email addresses are free again.
        User::factory()->create(['email' => 'tpo@tulas.test']);
    }

    public function test_a_failure_part_way_through_rolls_everything_back(): void
    {
        $w = $this->world();
        // The very last step — deleting the college row — blows up, after almost everything else has been deleted.
        Event::listen('eloquent.deleting: '.College::class, fn () => throw new RuntimeException('boom'));

        try {
            app(CollegePurgeService::class)->purge($w['college']);
            $this->fail('the purge should have thrown');
        } catch (RuntimeException $e) {
            $this->assertSame('boom', $e->getMessage());
        }

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
        $this->assertSame(6, User::where('college_id', $w['college']->id)->count(), 'TPO + coordinator + 3 students + the staff account: nobody was deleted');
        $this->assertDatabaseHas('placement_drives', ['id' => $w['ownedDrive']->id]);
        $this->assertDatabaseHas('contests', ['id' => $w['mockContest']->id]);
        $this->assertSame(2, ContestSubmission::where('contest_id', $w['mockContest']->id)->count());
        $this->assertSame(1, SoftSkillResponse::count());
        $this->assertSame(3, DriveApplication::count());
        $this->assertSame(1, DB::table('personal_access_tokens')->where('tokenable_id', $w['tpo']->id)->count());
        // Files are only removed after a successful commit, so a rollback can't cost anyone their avatar.
        Storage::disk('public')->assertExists('avatars/tulas-student.jpg');
    }

    public function test_the_endpoint_reports_a_database_refusal_as_a_409_and_says_nothing_was_deleted(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        $this->mock(CollegePurgeService::class, function ($mock) {
            $mock->shouldReceive('purge')->once()->andThrow(new QueryException('mysql', 'delete from colleges', [], new RuntimeException('FK constraint fails')));
        });

        $this->deleteCollege($w['college'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Nothing was deleted'));

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
        $this->assertSame(0, ActivityLog::where('action', 'Permanently deleted a partner university')->count());
    }

    /** A QueryException the way MySQL builds it: the driver code in errorInfo[1] and its message text. */
    private function mysqlRefusal(int $driverCode, string $message): QueryException
    {
        $pdo = new \PDOException($message);
        $pdo->errorInfo = ['23000', $driverCode, $message];

        return new QueryException('mysql', 'delete from colleges', [], $pdo);
    }

    public function test_a_foreign_key_refusal_names_the_table_that_got_in_the_way(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        $this->mock(CollegePurgeService::class, function ($mock) {
            $mock->shouldReceive('purge')->once()->andThrow($this->mysqlRefusal(
                1451,
                'SQLSTATE[23000]: Integrity constraint violation: 1451 Cannot delete or update a parent row: a foreign key constraint fails '
                .'(`aptrun`.`hackathon_teams`, CONSTRAINT `hackathon_teams_college_id_foreign` FOREIGN KEY (`college_id`) REFERENCES `colleges` (`id`))'
            ));
        });

        $this->deleteCollege($w['college'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'hackathon_teams') && str_contains($m, 'Nothing was deleted'));

        $this->assertDatabaseHas('colleges', ['id' => $w['college']->id]);
    }

    public function test_a_busy_database_is_reported_as_try_again_not_as_records_in_use(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->superadmin());

        $this->mock(CollegePurgeService::class, function ($mock) {
            $mock->shouldReceive('purge')->once()->andThrow($this->mysqlRefusal(1213, 'SQLSTATE[40001]: Serialization failure: 1213 Deadlock found when trying to get lock; try restarting transaction'));
        });

        $this->deleteCollege($w['college'])
            ->assertStatus(409)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'busy') && str_contains($m, 'Nothing was deleted') && ! str_contains($m, 'still depend'));
    }
}
