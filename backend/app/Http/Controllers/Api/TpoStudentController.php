<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Services\IssuedCredentialVault;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use App\Services\StudentBulkNotificationService;
use App\Services\StudentCohortService;
use App\Support\SingleMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * TPO-facing Student Cohort management: the real roster behind
 * `/admin/students` (previously 100% frontend mock data — COHORT_STUDENTS in
 * tpoAnalytics.ts). Every student here is scoped to the caller's own
 * college_id, the same isolation rule every other TPO-reachable endpoint
 * enforces.
 */
class TpoStudentController extends Controller
{
    public function __construct(
        private readonly StudentCohortService $cohort,
        private readonly StudentBulkNotificationService $notifier,
        private readonly CollegeDepartmentService $departments,
    ) {}

    /**
     * Real students + a real, computed readiness score/tier + real
     * cross-drive eligibility — never fabricated per-student data (no
     * attendance %, resume status, or "shortlisted at Google" strings,
     * since none of that has a backend table to back it).
     */
    public function index(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['students' => []]);
        }

        // ?department=commerce narrows the roster to one department; without it the whole college, as always.
        $department = $request->query('department');

        $students = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->inDepartment(is_string($department) ? $department : null)
            ->orderBy('name')
            ->get();

        $activeMappings = $this->cohort->activeMappingsFor($collegeId);

        return response()->json([
            'students' => $this->cohort->payloads($students, $activeMappings),
            'active_drive_count' => $activeMappings->count(),
        ]);
    }

    /**
     * Manually add one student — the one-at-a-time alternative to the CSV
     * bulk import (see StudentImportController/ProcessStudentImportJob) for
     * a TPO onboarding a single straggler rather than a whole batch. Reuses
     * that exact same account-creation + welcome-email pipeline: a
     * server-generated password, and SendAccountCredentialsEmail queued to
     * deliver it, never a client-supplied password.
     */
    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'roll_number' => ['nullable', 'string', 'max:50'],
            'branch' => ['nullable', 'string', 'max:100'],
            'department' => ['nullable', 'string', 'max:30'],
            'section' => ['nullable', 'string', 'max:20'],
            'cgpa' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'backlogs' => ['nullable', 'integer', 'min:0'],
            'phone' => ['nullable', 'string', 'max:20'],
            'parent_phone' => ['nullable', 'string', 'max:20'],
        ]);

        // A manual add is a one-off, deliberate action rather than a
        // possibly-repeated CSV upload, so an existing email is a hard
        // error here rather than the bulk-import path's idempotent update.
        if (User::where('email', $validated['email'])->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A student with this email already exists.'],
            ]);
        }

        $college = $request->user()->college;

        // See StudentImportService::import() for why this must come before
        // the seat-cap check: a null studentLimit() means EITHER "active
        // and unlimited" OR "no active subscription at all" — those are
        // opposite outcomes, so they can't share one null check.
        if (! $college || ! $college->hasActiveSubscription()) {
            throw ValidationException::withMessages([
                'email' => ["Your college's subscription has expired. Contact Mellow Vault to renew before adding more students."],
            ]);
        }

        $limit = $college->studentLimit();

        if ($limit !== null && $college->studentCount() >= $limit) {
            $planName = $college->activePlan()?->name ?? 'current';

            throw ValidationException::withMessages([
                'email' => ["Your college's {$planName} plan allows up to {$limit} students, and that limit has been reached. Upgrade your plan to add more."],
            ]);
        }

        // Which department the student joins. A college running one needs no answer; one running several must give it, and a
        // branch that names another department's programme is refused rather than quietly filed under the wrong one.
        $department = $this->departments->requested($college, $validated['department'] ?? null);

        if (($conflict = $this->departments->labelConflict($college, $validated['branch'] ?? null, $department)) !== null) {
            throw ValidationException::withMessages(['branch' => [$conflict]]);
        }

        $plainPassword = Str::password(12);

        $student = new User([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'handle' => $this->uniqueHandle($validated['name']),
            'password' => Hash::make($plainPassword),
            'must_change_password' => true,
            'role' => User::ROLE_USER,
            'college_id' => $collegeId,
            'roll_number' => $validated['roll_number'] ?? null,
            'branch' => $validated['branch'] ?? null,
            'section' => $validated['section'] ?? null,
            'cgpa' => $validated['cgpa'] ?? null,
            'backlogs' => $validated['backlogs'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'parent_phone' => $validated['parent_phone'] ?? null,
        ]);
        $student->departmentHint = $department;
        $student->save();

        app(IssuedCredentialVault::class)->keep($student, $plainPassword, 'created');

        SingleMail::afterResponse(new SendAccountCredentialsEmail($student->id, $plainPassword));

        // Refresh so DB-applied column defaults (e.g. is_blocked) are
        // reflected in the response instead of the in-memory nulls Eloquent
        // leaves for columns that weren't explicitly set on create().
        return response()->json([
            'student' => $this->cohort->payload($student->refresh(), $this->cohort->activeMappingsFor($collegeId)),
        ], 201);
    }

    /**
     * Same convention as ProcessStudentImportJob's handle generation
     * (slug(name) + 4 random chars), plus a uniqueness retry loop — a bulk
     * CSV row accepts an astronomically unlikely collision as-is, but a
     * one-off manual add is cheap to make airtight.
     */
    private function uniqueHandle(string $name): string
    {
        $base = Str::slug($name) ?: 'student';

        do {
            $handle = $base.'-'.Str::lower(Str::random(4));
        } while (User::where('handle', $handle)->exists());

        return $handle;
    }

    /**
     * Fans out a notification (email or WhatsApp; a generic check-in or a
     * formal termination-notice template) to a TPO-chosen subset of their
     * own cohort — checkbox selection, or "everyone currently matching my
     * filters" from the frontend. Same one-job-per-recipient, rate-limited
     * shape as the bulk-import welcome email, since this can just as
     * easily target hundreds of students at once.
     */
    public function bulkNotify(Request $request)
    {
        $collegeId = $request->user()->college_id;

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

        // Scoped to the caller's own college — a TPO id-guessing another
        // college's student ids must never reach them, silently dropped
        // rather than erroring so a stale selection just sends to fewer
        // people instead of leaking a 403 that reveals another id exists.
        $recipients = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->whereIn('id', $validated['student_ids'])
            ->get();

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'No matching students in your cohort to notify.'], 422);
        }

        // WhatsApp-only "parent" recipients aside, email always has to go to
        // the student's own inbox — colleges don't collect parent email
        // addresses today (only a parent phone number), so
        // recipient=parent+channel=email is a no-op combination rather than
        // a silent send to nobody.
        if ($validated['channel'] === 'email' && $validated['recipient'] === 'parent') {
            return response()->json([
                'message' => 'Parents don\'t have an email on file — choose WhatsApp to notify a parent, or Student to email.',
            ], 422);
        }

        if ($validated['channel'] === 'in_app') {
            $reached = $this->notifier->announce($recipients, trim($validated['title']), trim($validated['message']), 'tpo-'.$collegeId, $request->user());

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
            'tpo-'.$collegeId
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
}
