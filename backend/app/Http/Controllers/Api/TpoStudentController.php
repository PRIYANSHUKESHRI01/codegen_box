<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Services\IssuedCredentialVault;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use App\Services\StudentBulkNotificationService;
use App\Services\StudentCohortService;
use App\Support\AcademicYear;
use App\Support\SingleMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
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

        // ?year=3 narrows it to one year of study (0 = no year set yet, 5 = passed out); without it every year, as always.
        $year = $request->query('year');

        $students = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->inDepartment(is_string($department) ? $department : null)
            ->when(is_numeric($year) && (int) $year >= 0 && (int) $year <= AcademicYear::programmeYears() + 1, fn ($q) => $q->inStudyYear((int) $year))
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
            // The year of study they are in now (1st-4th): the vault AI interview's rules, and the TPO's year-wise view, run on it.
            'year' => ['nullable', 'integer', Rule::in(AcademicYear::selectableYears())],
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

        // Not mass-assignable (a student must not be able to set their own year): the college's staff set it, here.
        if (isset($validated['year']) && User::hasYearColumn()) {
            $student->forceFill(['graduation_year' => AcademicYear::graduationYearFor((int) $validated['year'])]);
        }

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
     * Files students under a year of study - the way to fix a roster that was imported before years existed, or to correct a
     * wrong one, without re-uploading anything. Scoped to the caller's own college like every other action here: an id from another
     * college is dropped, not reported, so nothing reveals that it exists.
     */
    public function setYear(Request $request)
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        $validated = $request->validate([
            'student_ids' => ['required', 'array', 'min:1', 'max:5000'],
            'student_ids.*' => ['integer'],
            'year' => ['required', 'integer', Rule::in(AcademicYear::selectableYears())],
        ]);

        $graduationYear = AcademicYear::graduationYearFor((int) $validated['year']);

        $updated = 0;

        // Chunked: the id list can be a whole college and every driver has a limit on bound parameters.
        DB::transaction(function () use ($validated, $collegeId, $graduationYear, &$updated) {
            foreach (array_chunk($validated['student_ids'], 500) as $ids) {
                // A query-builder update on purpose: it skips the per-student save hook (branch re-resolution), which a year cannot change.
                $updated += User::where('college_id', $collegeId)
                    ->where('role', User::ROLE_USER)
                    ->whereIn('id', $ids)
                    ->update(['graduation_year' => $graduationYear]);
            }
        });

        $label = AcademicYear::label((int) $validated['year']);

        return response()->json([
            'message' => $updated === 0
                ? 'No matching students in your cohort were updated.'
                : "Filed {$updated} student(s) under {$label}.",
            'updated' => $updated,
            'graduation_year' => $graduationYear,
            'study_year' => (int) $validated['year'],
            'year_label' => $label,
        ]);
    }

    /**
     * Changes one student's year of study and/or section - the two things a TPO corrects most often. Either may be sent on its own;
     * `year: null` takes a student back to "not set", `section: null` (or blank) to "no section". Scoped to the caller's own college:
     * a student of another college is a 404, never a 403 that would say they exist.
     *
     * Answers with the student's refreshed cohort row, so the roster can show the change at once, and the student's own screens
     * (their Vault AI Interview countdown, a section coordinator's roster) follow it on their next check (the plan-signal's `academic_signature`).
     */
    public function update(Request $request, User $student)
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');
        abort_unless($student->role === User::ROLE_USER && (int) $student->college_id === (int) $collegeId, 404);

        $validated = $request->validate([
            'year' => ['sometimes', 'nullable', 'integer', Rule::in(AcademicYear::selectableYears())],
            'section' => ['sometimes', 'nullable', 'string', 'max:20'],
        ]);

        if (! array_key_exists('year', $validated) && ! array_key_exists('section', $validated)) {
            throw ValidationException::withMessages(['year' => ['Say which year or section to change.']]);
        }

        if (array_key_exists('year', $validated)) {
            $student->forceFill(['graduation_year' => $validated['year'] === null ? null : AcademicYear::graduationYearFor((int) $validated['year'])]);
        }

        if (array_key_exists('section', $validated)) {
            $student->section = $this->cleanSection($validated['section']);
        }

        $student->save();

        return response()->json([
            'student' => $this->cohort->payload($student->refresh(), $this->cohort->activeMappingsFor($collegeId)),
        ]);
    }

    /**
     * Files a selection of students in one section - or takes them out of theirs (`section: null`). Same college scoping as
     * setYear(): ids from another college are dropped, not reported.
     */
    public function setSection(Request $request)
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        $validated = $request->validate([
            'student_ids' => ['required', 'array', 'min:1', 'max:5000'],
            'student_ids.*' => ['integer'],
            'section' => ['present', 'nullable', 'string', 'max:20'],
        ]);

        $section = $this->cleanSection($validated['section']);
        $updated = 0;

        DB::transaction(function () use ($validated, $collegeId, $section, &$updated) {
            foreach (array_chunk($validated['student_ids'], 500) as $ids) {
                $updated += User::where('college_id', $collegeId)
                    ->where('role', User::ROLE_USER)
                    ->whereIn('id', $ids)
                    ->update(['section' => $section]);
            }
        });

        return response()->json([
            'message' => $updated === 0
                ? 'No matching students in your cohort were updated.'
                : ($section === null ? "Took {$updated} student(s) out of their section." : "Moved {$updated} student(s) to section {$section}."),
            'updated' => $updated,
            'section' => $section,
        ]);
    }

    /** A section as stored: trimmed, and null when blank - "no section" has one spelling. */
    private function cleanSection(?string $section): ?string
    {
        $section = trim((string) $section);

        return $section === '' ? null : $section;
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
