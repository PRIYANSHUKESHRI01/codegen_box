<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\User;
use App\Services\SectionCoordinatorService;
use Illuminate\Http\Request;

/**
 * TPO-facing Section Coordinator management — the one place a TPO delegates
 * day-to-day roster upkeep for one section to someone else. A coordinator is
 * always TPO-provisioned (never self-registered) or Ops-provisioned on a
 * college's behalf (see AdminController's coordinator endpoints, superadmin's
 * equivalent reach), and always scoped to exactly one section of its college
 * via the same `section` column a student's own row uses — see
 * User::ROLE_SECTION_COORDINATOR's docblock. Account-creation/section-
 * uniqueness logic lives in SectionCoordinatorService, shared with that Ops
 * path so the two can never drift apart.
 */
class TpoCoordinatorController extends Controller
{
    public function __construct(private SectionCoordinatorService $coordinators)
    {
    }

    /** Every coordinator at the caller's own college, with how many students their assigned section actually contains right now. */
    public function index(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['coordinators' => []]);
        }

        $coordinators = $this->coordinators->listFor($collegeId);

        return response()->json([
            'coordinators' => $coordinators->map(fn (User $c) => $this->coordinators->payload($c, $collegeId))->all(),
        ]);
    }

    /**
     * Create a Section Coordinator for the caller's own college — same
     * server-generated-password + must_change_password + welcome-email
     * pipeline as TpoStudentController::store(), just a different role/no
     * academic fields (a coordinator has no CGPA/backlogs of their own).
     */
    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'section' => ['required', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $coordinator = $this->coordinators->create($collegeId, $validated, $request->user());

        return response()->json([
            'coordinator' => $this->coordinators->payload($coordinator, $collegeId),
        ], 201);
    }

    /** Reassign which section a coordinator covers, or fix their phone number. */
    public function update(Request $request, User $user)
    {
        $this->authorizeCoordinator($request, $user);

        $validated = $request->validate([
            'section' => ['required', 'string', 'max:20'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $coordinator = $this->coordinators->updateSection($user, $validated);

        return response()->json(['coordinator' => $this->coordinators->payload($coordinator, $coordinator->college_id)]);
    }

    public function toggleBlock(Request $request, User $user)
    {
        $this->authorizeCoordinator($request, $user);

        $user->is_blocked = ! $user->is_blocked;
        $user->blocked_at = $user->is_blocked ? now() : null;
        $user->blocked_by = $user->is_blocked ? $request->user()->id : null;
        $user->save();

        ActivityLog::record(
            $request->user(),
            $user->is_blocked ? 'Blocked a Section Coordinator' : 'Unblocked a Section Coordinator',
            'User',
            $user->name
        );

        return response()->json(['coordinator' => $this->coordinators->payload($user->fresh(), $user->college_id)]);
    }

    /** A TPO can only ever act on a section_coordinator that belongs to their own college — never guessable into another college's account. */
    private function authorizeCoordinator(Request $request, User $user): void
    {
        abort_unless(
            $user->role === User::ROLE_SECTION_COORDINATOR && $user->college_id === $request->user()->college_id,
            404
        );
    }
}
