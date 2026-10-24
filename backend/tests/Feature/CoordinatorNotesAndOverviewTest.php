<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\CoordinatorNote;
use App\Models\ProctoringSession;
use App\Models\User;
use App\Services\CoordinatorOverviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * The coordinator's follow-up log (who may write and read it, where it stops) and the roster's summary / "needs your
 * attention" queue built from the same rows the table shows.
 */
class CoordinatorNotesAndOverviewTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private College $college;

    private User $coordinator;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create(['name' => 'Notes College', 'short_code' => 'NC']);
        $this->coordinator = $this->coordinator('A');
    }

    private function coordinator(string $section, ?array $scope = null, ?College $college = null): User
    {
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => ($college ?? $this->college)->id, 'section' => $section, 'must_change_password' => false]);
        $coordinator->forceFill(['coordinator_scope' => $scope])->save();

        return $coordinator;
    }

    private function student(string $section = 'A', array $over = [], ?College $college = null): User
    {
        $n = ++$this->seq;

        return User::factory()->create(array_merge(['name' => "Pupil {$n}", 'role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id, 'branch' => 'CSE', 'section' => $section, 'must_change_password' => false], $over));
    }

    private function note(User $student, User $author, array $over = []): CoordinatorNote
    {
        return CoordinatorNote::create(array_merge(['college_id' => $student->college_id, 'student_id' => $student->id, 'author_id' => $author->id, 'kind' => 'call', 'body' => 'Spoke to the parent.'], $over));
    }

    // ───────────────────────────── notes ─────────────────────────────

    public function test_a_coordinator_writes_and_reads_notes_on_a_student_they_look_after(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->coordinator);

        $created = $this->postJson("/api/coordinator/students/{$student->id}/notes", ['body' => '  Called the parent — will retake the test.  ', 'kind' => 'call', 'follow_up_on' => now()->addDays(3)->toDateString()])
            ->assertCreated()->json('note');

        $this->assertSame('Called the parent — will retake the test.', $created['body']);
        $this->assertSame('call', $created['kind']);
        $this->assertTrue($created['mine']);
        $this->assertFalse($created['overdue']);
        $this->assertSame($this->coordinator->name, $created['author']['name']);

        $this->getJson("/api/coordinator/students/{$student->id}/notes")->assertOk()->assertJsonCount(1, 'notes');
        $this->assertSame($this->college->id, CoordinatorNote::first()->college_id);
    }

    public function test_notes_are_validated(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->coordinator);
        $url = "/api/coordinator/students/{$student->id}/notes";

        $this->postJson($url, [])->assertStatus(422)->assertJsonValidationErrors('body');
        $this->postJson($url, ['body' => 'x'])->assertStatus(422)->assertJsonValidationErrors('body');
        $this->postJson($url, ['body' => str_repeat('a', 1001)])->assertStatus(422)->assertJsonValidationErrors('body');
        $this->postJson($url, ['body' => 'ok ok', 'kind' => 'gossip'])->assertStatus(422)->assertJsonValidationErrors('kind');
        $this->postJson($url, ['body' => 'ok ok', 'follow_up_on' => now()->subDay()->toDateString()])->assertStatus(422)->assertJsonValidationErrors('follow_up_on');
        $this->postJson($url, ['body' => 'ok ok', 'follow_up_on' => now()->addYears(2)->toDateString()])->assertStatus(422)->assertJsonValidationErrors('follow_up_on');
        $this->postJson($url, ['body' => 'ok ok', 'follow_up_on' => 'next friday'])->assertStatus(422)->assertJsonValidationErrors('follow_up_on');
        $this->postJson($url, ['body' => 'ok ok', 'follow_up_on' => now()->toDateString()])->assertCreated();

        $this->assertSame(1, CoordinatorNote::count());
    }

    public function test_notes_cannot_be_written_or_read_for_students_outside_the_scope(): void
    {
        $outside = [
            'another section' => $this->student('B'),
            'another college' => $this->student('A', [], College::create(['name' => 'Elsewhere', 'short_code' => 'EW'])),
        ];
        $branchScoped = $this->coordinator('C', ['disciplines' => ['ece'], 'branches' => []]);
        $outside['another branch'] = $this->student('C');  // CSE student; the coordinator is ECE-only

        $victimNote = $this->note($outside['another section'], $this->coordinator('B'));

        foreach ([$this->coordinator, $branchScoped] as $viewer) {
            Sanctum::actingAs($viewer);
            foreach ($outside as $why => $student) {
                if ($viewer === $this->coordinator && $why === 'another branch') {
                    continue;
                }
                $this->getJson("/api/coordinator/students/{$student->id}/notes")->assertNotFound();
                $this->postJson("/api/coordinator/students/{$student->id}/notes", ['body' => 'sneaky note'])->assertNotFound();
            }
            $this->putJson("/api/coordinator/notes/{$victimNote->id}", ['resolved' => true])->assertNotFound();
            $this->deleteJson("/api/coordinator/notes/{$victimNote->id}")->assertNotFound();
        }

        $this->assertNull($victimNote->fresh()->resolved_at);
        $this->assertSame(1, CoordinatorNote::count(), 'nothing was written');
    }

    public function test_a_note_can_be_marked_done_and_reopened_and_only_its_author_can_delete_it(): void
    {
        $student = $this->student();
        $note = $this->note($student, $this->coordinator, ['follow_up_on' => now()->addDay()->toDateString()]);

        Sanctum::actingAs($this->coordinator);
        $this->putJson("/api/coordinator/notes/{$note->id}", ['resolved' => true])->assertOk()->assertJsonPath('note.resolved', true);
        $this->assertSame($this->coordinator->id, $note->fresh()->resolved_by);
        $this->putJson("/api/coordinator/notes/{$note->id}", ['resolved' => false])->assertOk()->assertJsonPath('note.resolved', false);
        $this->putJson("/api/coordinator/notes/{$note->id}", [])->assertStatus(422);

        // A successor who covers the same student can mark it done but cannot delete the previous coordinator's note.
        $successor = $this->coordinator('A', null, null);
        $this->coordinator->forceFill(['section' => 'Z'])->save();
        Sanctum::actingAs($successor);
        $this->putJson("/api/coordinator/notes/{$note->id}", ['resolved' => true])->assertOk();
        $this->deleteJson("/api/coordinator/notes/{$note->id}")->assertForbidden();
        $this->assertNotNull(CoordinatorNote::find($note->id));

        Sanctum::actingAs($this->coordinator);
        $this->deleteJson("/api/coordinator/notes/{$note->id}")->assertNotFound(); // moved to another section: no longer theirs to touch

        $mine = $this->note($student, $successor);
        Sanctum::actingAs($successor);
        $this->deleteJson("/api/coordinator/notes/{$mine->id}")->assertOk();
        $this->assertNull(CoordinatorNote::find($mine->id));
    }

    public function test_open_notes_are_listed_before_resolved_ones(): void
    {
        $student = $this->student();
        $done = $this->note($student, $this->coordinator, ['body' => 'Old, done', 'resolved_at' => now()]);
        $open = $this->note($student, $this->coordinator, ['body' => 'Still open']);
        $newerDone = $this->note($student, $this->coordinator, ['body' => 'Newer, done', 'resolved_at' => now()]);

        Sanctum::actingAs($this->coordinator);
        $bodies = collect($this->getJson("/api/coordinator/students/{$student->id}/notes")->assertOk()->json('notes'))->pluck('body')->all();

        $this->assertSame(['Still open', 'Newer, done', 'Old, done'], $bodies);
    }

    public function test_a_departed_coordinators_notes_stay_for_whoever_looks_after_the_student_next(): void
    {
        $student = $this->student();
        $this->note($student, $this->coordinator, ['body' => 'Handover: promised to retake the test.']);

        $this->coordinator->delete();
        $this->assertNull(CoordinatorNote::first()->author_id);

        Sanctum::actingAs($this->coordinator('A'));
        $notes = $this->getJson("/api/coordinator/students/{$student->id}/notes")->assertOk()->json('notes');

        $this->assertSame('Handover: promised to retake the test.', $notes[0]['body']);
        $this->assertNull($notes[0]['author']);
        $this->assertFalse($notes[0]['mine']);
    }

    public function test_a_students_notes_go_when_the_student_does(): void
    {
        $student = $this->student();
        $this->note($student, $this->coordinator);

        $student->delete();

        $this->assertSame(0, CoordinatorNote::count());
    }

    public function test_the_tpo_can_read_but_not_write_and_only_for_their_own_college(): void
    {
        $student = $this->student();
        $this->note($student, $this->coordinator, ['body' => 'Called the parent']);
        $other = College::create(['name' => 'Elsewhere', 'short_code' => 'EW']);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id]));
        $this->getJson("/api/tpo/students/{$student->id}/notes")->assertOk()->assertJsonPath('notes.0.body', 'Called the parent');
        $this->postJson("/api/tpo/students/{$student->id}/notes", ['body' => 'x y'])->assertStatus(405);
        $this->postJson("/api/coordinator/students/{$student->id}/notes", ['body' => 'x y'])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $other->id]));
        $this->getJson("/api/tpo/students/{$student->id}/notes")->assertNotFound();
    }

    public function test_students_and_other_roles_cannot_read_notes_anywhere(): void
    {
        $student = $this->student();
        $this->note($student, $this->coordinator, ['body' => 'Private']);

        Sanctum::actingAs($student);
        $this->getJson("/api/coordinator/students/{$student->id}/notes")->assertForbidden();
        $this->getJson("/api/tpo/students/{$student->id}/notes")->assertForbidden();

        $me = $this->getJson('/api/me')->assertOk()->json();
        $this->assertStringNotContainsString('Private', json_encode($me), 'a student never sees what is written about them');
    }

    // ───────────────────────────── overview ─────────────────────────────

    private function roster(): array
    {
        Sanctum::actingAs($this->coordinator);

        return $this->getJson('/api/coordinator/students')->assertOk()->json();
    }

    private function lockOut(User $student): void
    {
        $contest = Contest::create(['title' => 'Mock', 'slug' => 'm-'.uniqid(), 'start_at' => now()->subHour(), 'end_at' => now()->addHour(), 'status' => 'published', 'contest_type' => 'general']);
        $participant = ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $student->id, 'registered_at' => now()]);
        ProctoringSession::create(['contest_participant_id' => $participant->id, 'status' => 'locked', 'violation_count' => 3, 'locked_at' => now()->subDay(), 'consented_at' => now()->subDay()]);
    }

    public function test_the_summary_counts_what_the_roster_shows(): void
    {
        $active = $this->student();
        $this->practiceSubmission($active, 'python', 'accepted', null, now()->subDays(2));
        $slipping = $this->student();
        $this->practiceSubmission($slipping, 'python', 'accepted', null, now()->subDays(12));
        $dormant = $this->student();
        $this->practiceSubmission($dormant, 'python', 'accepted', null, now()->subDays(40));
        $notStarted = $this->student();
        $pending = $this->student('A', ['must_change_password' => true, 'created_at' => now()->subDays(10)]);
        $blocked = $this->student('A', ['is_blocked' => true, 'blocked_at' => now()]);
        $this->student('B');   // not in this section

        $summary = $this->roster()['summary'];

        $this->assertSame(6, $summary['size']);
        $this->assertSame(['active' => 1, 'slipping' => 1, 'dormant' => 1, 'not_started' => 2, 'pending_activation' => 1], $summary['engagement']);
        $this->assertSame(1, $summary['blocked']);
        $this->assertSame(1, $summary['never_signed_in']);
        $this->assertSame(array_sum($summary['tiers']), 6);
        $this->assertSame(6, $summary['at_risk'], 'a brand-new roster is all below 60');
    }

    public function test_the_attention_queue_ranks_by_reasons_and_explains_each_one(): void
    {
        $lockedOut = $this->student();
        $this->practiceSubmission($lockedOut, 'python', 'accepted', null, now()->subDays(1));
        $this->lockOut($lockedOut);

        $overdue = $this->student();
        $this->note($overdue, $this->coordinator, ['follow_up_on' => now()->subDays(2)->toDateString()]);

        $dueToday = $this->student();
        $this->note($dueToday, $this->coordinator, ['follow_up_on' => now()->toDateString()]);

        $pending = $this->student('A', ['must_change_password' => true, 'created_at' => now()->subDays(9)]);
        $newPending = $this->student('A', ['must_change_password' => true, 'created_at' => now()->subDay()]);

        $dormant = $this->student();
        $this->practiceSubmission($dormant, 'python', 'accepted', null, now()->subDays(40));

        $scheduled = $this->student();
        $this->note($scheduled, $this->coordinator, ['follow_up_on' => now()->addDays(5)->toDateString()]);

        $blocked = $this->student('A', ['is_blocked' => true, 'blocked_at' => now(), 'must_change_password' => true, 'created_at' => now()->subDays(30)]);

        $queue = collect($this->roster()['attention'])->keyBy('student_id');

        $codes = fn (User $u) => collect($queue[$u->id]['reasons'] ?? [])->pluck('code')->all();

        $this->assertContains('locked_out', $codes($lockedOut));
        $this->assertContains('follow_up_overdue', $codes($overdue));
        $this->assertContains('follow_up_due', $codes($dueToday));
        $this->assertContains('never_signed_in', $codes($pending));
        $this->assertContains('dormant', $codes($dormant));

        $this->assertArrayNotHasKey($newPending->id, $queue->all(), 'a one-day-old account has not been given a chance to sign in yet');
        $this->assertArrayNotHasKey($blocked->id, $queue->all(), 'a blocked account has already been dealt with');

        // Ranked by what is going on, highest first: every reason adds up (the overdue follow-up also hasn't practised at all).
        $ranked = collect($this->roster()['attention']);
        $this->assertSame($ranked->sortByDesc('score')->pluck('student_id')->values()->all(), $ranked->pluck('student_id')->values()->all());
        $this->assertSame($overdue->id, $ranked->first()['student_id']);
        $this->assertGreaterThan($queue[$pending->id]['score'], $queue[$lockedOut->id]['score']);
        $this->assertGreaterThan($queue[$dormant->id]['score'], $queue[$dueToday->id]['score']);

        // The explanation reads like a sentence a coordinator can act on.
        $labels = collect($queue[$overdue->id]['reasons'])->pluck('label')->implode(' | ');
        $this->assertStringContainsString('Follow-up overdue since', $labels);
        $this->assertStringContainsString('No practice for 40 days', collect($queue[$dormant->id]['reasons'])->pluck('label')->implode(' | '));
    }

    public function test_a_scheduled_follow_up_takes_the_urgency_out_of_a_student(): void
    {
        $student = $this->student();
        $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDays(12)); // slipping (12) + at risk (8) = 20 → in the queue

        $before = collect($this->roster()['attention'])->pluck('student_id')->all();
        $this->assertContains($student->id, $before);

        $this->note($student, $this->coordinator, ['follow_up_on' => now()->addDays(4)->toDateString()]);

        $after = collect($this->roster()['attention'])->pluck('student_id')->all();
        $this->assertNotContains($student->id, $after, 'the coordinator is already on it');
    }

    public function test_every_row_carries_its_follow_up_state_and_the_queue_is_capped(): void
    {
        $withNote = $this->student();
        $this->note($withNote, $this->coordinator, ['follow_up_on' => now()->subDay()->toDateString()]);
        $this->note($withNote, $this->coordinator, ['resolved_at' => now()]);
        foreach (range(1, 20) as $i) {
            $this->student('A', ['must_change_password' => true, 'created_at' => now()->subDays(20)]);
        }

        $json = $this->roster();
        $row = collect($json['students'])->firstWhere('id', $withNote->id);

        $this->assertSame(1, $row['follow_up']['open']);
        $this->assertTrue($row['follow_up']['overdue']);
        $this->assertSame(now()->subDay()->toDateString(), $row['follow_up']['next_due']);
        $this->assertSame(['open' => 0, 'next_due' => null, 'overdue' => false, 'due_today' => false, 'last_note_at' => null], collect($json['students'])->firstWhere('id', '!=', $withNote->id)['follow_up']);
        $this->assertCount(CoordinatorOverviewService::QUEUE_SIZE, $json['attention']);
        $this->assertSame(1, $json['summary']['open_follow_ups']);
        $this->assertSame(1, $json['summary']['overdue_follow_ups']);
    }

    public function test_the_queue_and_summary_only_ever_use_the_coordinators_students(): void
    {
        $other = $this->student('B', ['must_change_password' => true, 'created_at' => now()->subDays(30)]);
        $this->note($other, $this->coordinator('B'), ['follow_up_on' => now()->subDay()->toDateString()]);
        $mine = $this->student();

        $json = $this->roster();

        $this->assertSame(1, $json['summary']['size']);
        $this->assertSame(0, $json['summary']['overdue_follow_ups'], "another section's follow-ups never count here");
        $this->assertNotContains($other->id, collect($json['attention'])->pluck('student_id')->all());
        $this->assertNotContains($other->id, collect($json['students'])->pluck('id')->all());
    }

    public function test_a_tpo_sees_why_and_by_whom_a_student_was_blocked(): void
    {
        $student = $this->student();
        $student->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $this->coordinator->id, 'blocked_reason' => 'Account shared'])->save();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id]));
        $row = collect($this->getJson('/api/tpo/students/cohort')->assertOk()->json('students'))->firstWhere('id', $student->id);

        $this->assertSame('Account shared', $row['blocked']['reason']);
        $this->assertTrue($row['blocked']['by_coordinator']);

        $fine = $this->student();
        $this->assertNull(collect($this->getJson('/api/tpo/students/cohort')->json('students'))->firstWhere('id', $fine->id)['blocked']);
    }
}
