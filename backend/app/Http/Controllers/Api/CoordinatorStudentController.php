<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StudentBulkNotificationService;
use App\Services\StudentCohortService;
use Illuminate\Http\Request;

/**
 * Section-Coordinator-facing roster management — deliberately the narrow
 * slice of TpoStudentController's capability a coordinator gets: they can
 * view every student already in their one assigned section (full academic/
 * readiness/contact profile, real per-drive eligibility, and downloadable
 * reports — see the frontend's generateTpoReports/generateCoordinatorReports),
 * block/unblock an account, and send notifications — but never edit a
 * student's profile data. Name, contact info, academic record and section
 * assignment all stay TPO-owned (the placement cell's source of truth,
 * same rule that already keeps a student from self-editing their own
 * record) — deliberately no update()/edit endpoint exists here at all,
 * not just a hidden frontend button, so this is enforced server-side.
 * There is also no create/import here — a coordinator never adds headcount,
 * only a TPO does (see TpoStudentController/StudentImportController). Every
 * method scopes to the caller's own college_id AND section, so a
 * coordinator can never reach another section's — let alone another
 * college's — students, no matter what id is guessed.
 */
class CoordinatorStudentController extends Controller
{
    public function __construct(private readonly StudentCohortService $cohort, private readonly StudentBulkNotificationService $notifier) {}

    public function index(Request $request)
    {
        $coordinator = $request->user();

        $students = $this->scopedStudents($coordinator)->orderBy('name')->get();
        $activeMappings = $this->cohort->activeMappingsFor($coordinator->college_id);

        return response()->json([
            'students' => $students->map(fn (User $student) => $this->cohort->payload($student, $activeMappings))->all(),
            'section' => $coordinator->section,
        ]);
    }

    public function toggleBlock(Request $request, User $user)
    {
        $coordinator = $request->user();
        $this->authorizeInSection($coordinator, $user);

        $user->is_blocked = ! $user->is_blocked;
        $user->blocked_at = $user->is_blocked ? now() : null;
        $user->blocked_by = $user->is_blocked ? $coordinator->id : null;
        $user->save();

        $activeMappings = $this->cohort->activeMappingsFor($coordinator->college_id);

        return response()->json(['student' => $this->cohort->payload($user->fresh(), $activeMappings)]);
    }

    /** Same shape as TpoStudentController::bulkNotify, scoped to the coordinator's own section. */
    public function bulkNotify(Request $request)
    {
        $coordinator = $request->user();

        $validated = $request->validate([
            'student_ids' => 'required|array|min:1|max:5000',
            'student_ids.*' => 'integer',
            'channel' => 'required|in:email,whatsapp',
            'template' => 'required|in:generic,termination',
            'recipient' => 'required|in:student,parent',
        ]);

        $recipients = $this->scopedStudents($coordinator)
            ->whereIn('id', $validated['student_ids'])
            ->get();

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'No matching students in your section to notify.'], 422);
        }

        if ($validated['channel'] === 'email' && $validated['recipient'] === 'parent') {
            return response()->json([
                'message' => 'Parents don\'t have an email on file — choose WhatsApp to notify a parent, or Student to email.',
            ], 422);
        }

        $result = $this->notifier->send(
            $recipients,
            $validated['channel'],
            $validated['template'],
            $validated['recipient'],
            'coordinator-'.$coordinator->id
        );

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

    /** The one query every method here is built on: this coordinator's own college, own section, students only. */
    private function scopedStudents(User $coordinator)
    {
        return User::where('college_id', $coordinator->college_id)
            ->where('role', User::ROLE_USER)
            ->where('section', $coordinator->section);
    }

    /** 404 rather than 403 for an out-of-scope student — never confirms the id exists at all outside this coordinator's section. */
    private function authorizeInSection(User $coordinator, User $student): void
    {
        abort_unless(
            $student->role === User::ROLE_USER
                && $student->college_id === $coordinator->college_id
                && $student->section === $coordinator->section,
            404
        );
    }
}
