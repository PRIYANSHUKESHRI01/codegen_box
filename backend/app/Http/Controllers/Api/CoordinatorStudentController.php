<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\CoordinatorOverviewService;
use App\Services\SectionCoordinatorService;
use App\Services\StudentBulkNotificationService;
use App\Services\StudentCohortService;
use App\Support\BranchAudience;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Section-Coordinator-facing roster management — deliberately the narrow
 * slice of TpoStudentController's capability a coordinator gets: they can
 * view every student already in their assigned section (full academic/
 * readiness/contact profile, real per-drive eligibility, and downloadable
 * reports — see the frontend's generateTpoReports/generateCoordinatorReports),
 * block/unblock an account, and send notifications — but never edit a
 * student's profile data. Name, contact info, academic record and section
 * assignment all stay TPO-owned (the placement cell's source of truth,
 * same rule that already keeps a student from self-editing their own
 * record) — deliberately no update()/edit endpoint exists here at all,
 * not just a hidden frontend button, so this is enforced server-side.
 * There is also no create/import here — a coordinator never adds headcount,
 * only a TPO does (see TpoStudentController/StudentImportController).
 *
 * "Their" students are defined once, in User::scopeCoordinatedBy(): their own college, their own section and, if the
 * TPO narrowed them to some branches, those branches. Every method here — and the report, notes and proctoring
 * controllers — answers "may this coordinator touch that student?" with that same query, so a coordinator can never reach
 * another section's, another branch's — let alone another college's — students, no matter what id is guessed. An
 * out-of-scope id is a 404, never a 403: it never confirms the student exists.
 *
 * Blocking is the one consequential thing a coordinator can do to an account, so it is held to a higher bar than the
 * rest: a reason is required, it is written to the activity log, and a coordinator can lift only a block a coordinator
 * placed — one placed by Mellow staff stays until staff lift it.
 */
class CoordinatorStudentController extends Controller
{
    public function __construct(
        private readonly StudentCohortService $cohort,
        private readonly StudentBulkNotificationService $notifier,
        private readonly SectionCoordinatorService $coordinators,
        private readonly CoordinatorOverviewService $overview,
    ) {}

    public function index(Request $request)
    {
        $coordinator = $request->user();

        $students = $this->scopedStudents($coordinator)->orderBy('name')->get();
        $activeMappings = $this->cohort->activeMappingsFor((int) $coordinator->college_id);

        $ids = $students->pluck('id')->all();
        $followUps = $this->overview->followUpsFor($ids);
        $lockedOut = $this->overview->recentlyLockedOut($ids);

        // Each row carries its follow-up state (open notes, next due date); the summary and the "needs attention" queue
        // are built from those very rows, so the cards, the table and the queue always tell the same story.
        $rows = array_map(
            fn (array $row) => $row + ['follow_up' => $followUps[$row['id']] ?? ['open' => 0, 'next_due' => null, 'overdue' => false, 'due_today' => false, 'last_note_at' => null]],
            $this->cohort->payloads($students, $activeMappings)
        );

        return response()->json([
            'students' => $rows,
            'section' => $coordinator->section,
            'scope' => $this->scopeSummary($coordinator),
        ] + $this->overview->build($rows, $lockedOut));
    }

    public function toggleBlock(Request $request, User $user)
    {
        $coordinator = $request->user();
        $this->authorizeInScope($coordinator, $user);

        $validated = $request->validate(['reason' => ['nullable', 'string', 'max:255']]);
        $reason = trim((string) ($validated['reason'] ?? ''));

        if ($user->is_blocked) {
            $blocker = $user->blocked_by !== null ? User::find($user->blocked_by) : null;

            // Lifting a block placed by Mellow staff is staff's call. (A block whose author no longer exists has no one to defer to.)
            abort_unless(
                $blocker === null || ($blocker->role === User::ROLE_SECTION_COORDINATOR && (int) $blocker->college_id === (int) $coordinator->college_id),
                403,
                'This account was blocked by your TPO or Mellow. Ask them to lift it.'
            );

            $user->forceFill(['is_blocked' => false, 'blocked_at' => null, 'blocked_by' => null, 'blocked_reason' => null])->save();
        } else {
            abort_if($reason === '', 422, 'Say why you are blocking this account — the reason is kept for your TPO.');

            $user->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $coordinator->id, 'blocked_reason' => $reason])->save();
        }

        ActivityLog::record(
            $coordinator,
            $user->is_blocked ? 'Section coordinator blocked a student' : 'Section coordinator unblocked a student',
            'User',
            $user->name,
            array_filter(['college_id' => $coordinator->college_id, 'section' => $coordinator->section, 'reason' => $user->is_blocked ? $reason : null])
        );

        $activeMappings = $this->cohort->activeMappingsFor((int) $coordinator->college_id);
        $row = $this->cohort->payload($user->fresh(), $activeMappings);

        return response()->json(['student' => $row + ['follow_up' => $this->overview->followUpsFor([$user->id])[$user->id] ?? ['open' => 0, 'next_due' => null, 'overdue' => false, 'due_today' => false, 'last_note_at' => null]]]);
    }

    /** Same shape as TpoStudentController::bulkNotify, scoped to the students this coordinator looks after. */
    public function bulkNotify(Request $request)
    {
        $coordinator = $request->user();

        $validated = $request->validate([
            'student_ids' => 'required|array|min:1|max:5000',
            'student_ids.*' => 'integer',
            'channel' => 'required|in:email,whatsapp,in_app',
            'template' => 'required_unless:channel,in_app|in:generic,termination',
            'recipient' => 'required_unless:channel,in_app|in:student,parent',
            // An in-app announcement is the one channel with free text: it lands in each student's notification bell.
            'title' => 'required_if:channel,in_app|nullable|string|max:120',
            'message' => 'required_if:channel,in_app|nullable|string|max:500',
        ]);

        $recipients = $this->scopedStudents($coordinator)
            ->whereIn('users.id', $validated['student_ids'])
            ->get();

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'No matching students in your section to notify.'], 422);
        }

        if ($validated['channel'] === 'email' && $validated['recipient'] === 'parent') {
            return response()->json([
                'message' => 'Parents don\'t have an email on file — choose WhatsApp to notify a parent, or Student to email.',
            ], 422);
        }

        if ($validated['channel'] === 'in_app') {
            $reached = $this->notifier->announce($recipients, trim($validated['title']), trim($validated['message']), 'coordinator-'.$coordinator->id, $coordinator);

            ActivityLog::record($coordinator, 'Section coordinator sent an in-app announcement', 'College', $coordinator->college?->name, [
                'college_id' => $coordinator->college_id,
                'section' => $coordinator->section,
                'reached' => $reached,
            ]);

            return response()->json([
                'message' => "Sent to {$reached} student(s) — it is in their notification bell now.",
                'queued_count' => $reached,
                'skipped_no_phone' => 0,
            ]);
        }

        $result = $this->notifier->send(
            $recipients,
            $validated['channel'],
            $validated['template'],
            $validated['recipient'],
            'coordinator-'.$coordinator->id
        );

        ActivityLog::record($coordinator, 'Section coordinator sent a bulk notification', 'College', $coordinator->college?->name, [
            'college_id' => $coordinator->college_id,
            'section' => $coordinator->section,
            'channel' => $validated['channel'],
            'template' => $validated['template'],
            'recipient' => $validated['recipient'],
            'queued' => $result['queued_count'],
        ]);

        $message = "Queued a notification for {$result['queued_count']} student(s).";
        if ($result['skipped_no_phone'] > 0) {
            $message .= " Skipped {$result['skipped_no_phone']} with no ".($validated['recipient'] === 'parent' ? 'parent' : '')." phone number on file.";
        }

        return response()->json([
            'message' => $message,
            'queued_count' => $result['queued_count'],
            'skipped_no_phone' => $result['skipped_no_phone'],
        ]);
    }

    /** The one query every method here is built on — see User::scopeCoordinatedBy(). */
    private function scopedStudents(User $coordinator): Builder
    {
        return $this->coordinators->studentsOf($coordinator);
    }

    /** 404 rather than 403 for an out-of-scope student — never confirms the id exists at all outside this coordinator's scope. */
    private function authorizeInScope(User $coordinator, User $student): void
    {
        abort_unless($this->coordinators->covers($coordinator, $student), 404);
    }

    /** What the dashboard says about this coordinator's remit: the section and which branches of it. */
    private function scopeSummary(User $coordinator): array
    {
        $scope = BranchAudience::normalize($coordinator->coordinator_scope);

        return ['branch_scope' => $scope, 'label' => BranchAudience::label($scope)];
    }
}
