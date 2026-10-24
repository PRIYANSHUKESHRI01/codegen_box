<?php

namespace Tests\Feature;

use App\Mail\CoordinatorWeeklyDigestMail;
use App\Models\College;
use App\Models\CoordinatorNote;
use App\Models\User;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/** The Monday e-mail every Section Coordinator gets: their own section's numbers and who needs a call. */
class CoordinatorDigestTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private College $college;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create(['name' => 'Digest College', 'short_code' => 'DC', 'is_active' => true]);
    }

    private function coordinator(string $section, string $email, ?array $scope = null, array $over = [], ?College $college = null): User
    {
        $coordinator = User::factory()->create(array_merge(['name' => "Coach {$section}", 'email' => $email, 'role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => ($college ?? $this->college)->id, 'section' => $section, 'must_change_password' => false], $over));
        $coordinator->forceFill(['coordinator_scope' => $scope])->save();

        return $coordinator;
    }

    private function student(string $name, string $branch, string $section, array $over = []): User
    {
        return User::factory()->create(array_merge(['name' => $name, 'role' => User::ROLE_USER, 'college_id' => $this->college->id, 'branch' => $branch, 'section' => $section, 'must_change_password' => false], $over));
    }

    public function test_each_coordinator_gets_their_own_digest_with_their_own_students_only(): void
    {
        Mail::fake();
        $dormant = $this->student('Dormant Dev', 'CSE', 'A');
        $this->practiceSubmission($dormant, 'python', 'accepted', null, now()->subDays(40));
        $this->student('Other Section Olga', 'CSE', 'B', ['must_change_password' => true, 'created_at' => now()->subDays(30)]);
        $this->coordinator('A', 'coach.a@example.com');
        $this->coordinator('B', 'coach.b@example.com');

        $this->artisan('report:coordinator-digest')->expectsOutputToContain('2 sent')->assertSuccessful();

        Mail::assertSent(CoordinatorWeeklyDigestMail::class, 2);
        Mail::assertSent(CoordinatorWeeklyDigestMail::class, function (CoordinatorWeeklyDigestMail $mail) {
            return $mail->hasTo('coach.a@example.com')
                && $mail->summary['size'] === 1
                && $mail->assertSeeInHtml('Dormant Dev')
                && $mail->assertDontSeeInHtml('Other Section Olga')
                && $mail->assertSeeInHtml('No practice for 40 days');
        });
        Mail::assertSent(CoordinatorWeeklyDigestMail::class, fn ($mail) => $mail->hasTo('coach.b@example.com') && $mail->assertDontSeeInHtml('Dormant Dev'));
    }

    public function test_a_branch_scoped_coordinators_digest_covers_only_their_branches(): void
    {
        Mail::fake();
        $this->student('Cyrus CSE', 'CSE', 'A', ['must_change_password' => true, 'created_at' => now()->subDays(20)]);
        $this->student('Esha ECE', 'ECE', 'A', ['must_change_password' => true, 'created_at' => now()->subDays(20)]);
        $this->coordinator('A', 'ece.coach@example.com', ['disciplines' => ['ece'], 'branches' => []]);

        $this->artisan('report:coordinator-digest')->assertSuccessful();

        Mail::assertSent(CoordinatorWeeklyDigestMail::class, fn ($mail) => $mail->hasTo('ece.coach@example.com')
            && $mail->summary['size'] === 1
            && $mail->assertSeeInHtml('Esha ECE')
            && $mail->assertDontSeeInHtml('Cyrus CSE')
            && $mail->assertSeeInHtml('ECE'));
    }

    public function test_follow_ups_and_overdue_counts_make_it_into_the_digest(): void
    {
        Mail::fake();
        $student = $this->student('Follow Up Fay', 'CSE', 'A');
        $coach = $this->coordinator('A', 'coach.a@example.com');
        CoordinatorNote::create(['college_id' => $this->college->id, 'student_id' => $student->id, 'author_id' => $coach->id, 'kind' => 'call', 'body' => 'Call the parent', 'follow_up_on' => now()->subDays(2)->toDateString()]);

        $this->artisan('report:coordinator-digest')->assertSuccessful();

        Mail::assertSent(CoordinatorWeeklyDigestMail::class, fn ($mail) => $mail->summary['overdue_follow_ups'] === 1 && $mail->assertSeeInHtml('1 follow-up is overdue') && $mail->assertSeeInHtml('Follow-up overdue since'));
    }

    public function test_nobody_is_mailed_who_should_not_be(): void
    {
        Mail::fake();
        $this->student('Someone', 'CSE', 'A');
        $this->student('Someone Else', 'CSE', 'C');
        $this->coordinator('A', 'blocked@example.com', null, ['is_blocked' => true, 'blocked_at' => now()]);
        $this->coordinator('C', 'never.signed.in@example.com', null, ['must_change_password' => true]);
        $this->coordinator('Z', 'empty.section@example.com');
        $closed = College::create(['name' => 'Closed College', 'short_code' => 'CL', 'is_active' => false]);
        $closedStudent = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $closed->id, 'section' => 'A', 'must_change_password' => false]);
        $this->coordinator('A', 'closed.college@example.com', null, [], $closed);

        $this->artisan('report:coordinator-digest')->expectsOutputToContain('1 skipped')->assertSuccessful();

        Mail::assertNothingSent();
    }

    public function test_the_digest_says_so_when_nobody_needs_chasing(): void
    {
        Mail::fake();
        $healthy = $this->student('Healthy Hana', 'CSE', 'A');
        $this->practiceSubmission($healthy, 'python', 'accepted', null, now()->subDay());
        $this->coordinator('A', 'coach.a@example.com');

        $this->artisan('report:coordinator-digest')->assertSuccessful();

        Mail::assertSent(CoordinatorWeeklyDigestMail::class, fn ($mail) => $mail->attention === [] && str_contains($mail->build()->subject, 'nobody needs chasing'));
    }

    public function test_it_runs_every_monday_morning(): void
    {
        $event = collect(app(Schedule::class)->events())->first(fn ($e) => str_contains((string) $e->command, 'report:coordinator-digest'));

        $this->assertNotNull($event);
        $this->assertSame('30 7 * * 1', $event->expression);
    }
}
