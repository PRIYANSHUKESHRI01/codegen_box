<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendVaultHireOfferEmail;
use App\Jobs\SendVaultInterestEmail;
use App\Jobs\SendVaultInterviewInviteEmail;
use App\Jobs\SendVaultOutreachEmail;
use App\Models\VaultInquiry;
use App\Models\VaultMessage;
use App\Models\VaultProfile;
use App\Services\Vault\VaultService;
use App\Support\BranchCatalog;
use App\Support\SingleMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * A hiring partner's (role: admin_company) window into the Vault — the students
 * whose AptRun readiness score says they are ready to be hired and who agreed to
 * be found, independent of any job opening the company created itself. Distinct
 * from CompanyCandidateController (that's a company's own invited/applied
 * pipeline for one of THEIR openings): a Vault engagement is its own
 * self-contained relationship (VaultInquiry), never forced through DriveApplication.
 *
 * What a company sees is readiness first — the score and what it is made of —
 * because that is the point of the Vault: the student has already shown, across
 * interviews, practice, the Learning Centre, soft skills and contests, that they
 * are ready. Profile completeness only breaks ties.
 *
 * Deliberately never returns a student's email or phone in any response here —
 * they consented to being *discoverable*, not to having contact details handed to
 * every company that looks them up. Every outreach action (interest / interview /
 * hire / message) sends the email itself, server-side.
 */
class CompanyVaultController extends Controller
{
    /** Columns of a profile row that are the student's, Mellow's or the integration's business, not a hiring partner's. */
    private const HIDDEN_FROM_COMPANIES = [
        'public_id',
        'consent_given_at',
        'consent_withdrawn_at',
        'hidden_by_staff_at',
        'hired_via',
        'hired_by_company_id',
        'hired_employer_name',
        'ready_notified_at',
        'sync_state',
        'vault_listed_at',
        'last_synced_at',
        'qualification_source',
        'legacy_source_contest_id',
        'legacy_score_percent',
    ];

    private const USER_LIST_COLUMNS = 'user:id,name,college_id,branch,branch_code,discipline,department,cgpa,current_rating,rated_contests_count,bio,linkedin_url,github_url,skills,resume_path,profile_completion_percent';

    public function index(Request $request)
    {
        $companyId = $request->user()->company_id;

        $query = VaultProfile::query()
            ->browsable()
            ->join('users', 'users.id', '=', 'vault_profiles.user_id')
            ->select('vault_profiles.*')
            ->with([self::USER_LIST_COLUMNS, 'user.college:id,name,short_code']);

        if ($request->filled('min_readiness')) {
            $query->where('vault_profiles.readiness_score', '>=', (int) $request->input('min_readiness'));
        }

        if ($request->filled('college_id')) {
            $query->where('users.college_id', $request->integer('college_id'));
        }

        // A discipline ("mech") covers every branch in that family; a branch matches the canonical
        // code when the text is one we know ("Mechanical", "ECE") and the college's own wording otherwise.
        if ($request->filled('discipline')) {
            $query->where('users.discipline', (string) $request->string('discipline'));
        }

        // A department (Engineering, Commerce, Arts …) covers every family and branch inside it. A student never classified counts as
        // engineering, like everywhere else.
        if ($request->filled('department')) {
            $department = (string) $request->string('department');

            $query->where(function ($q) use ($department) {
                $q->where('users.department', $department);

                if ($department === (string) config('departments.fallback', 'engineering')) {
                    $q->orWhereNull('users.department');
                }
            });
        }

        if ($request->filled('branch')) {
            $branch = trim((string) $request->string('branch'));
            $code = BranchCatalog::instance()->canonical($branch);

            $code !== null
                ? $query->where('users.branch_code', $code)
                : $query->where('users.branch', $branch);
        }

        if ($request->filled('search')) {
            $search = strtolower($request->string('search'));
            $query->where(function ($q) use ($search) {
                $q->where('users.name', 'like', "%{$search}%")
                    // Skills are stored as a JSON array of strings — a plain
                    // substring match over the column's raw text
                    // representation is a pragmatic tag search without
                    // needing JSON_SEARCH path expressions or a separate
                    // full-text index for what's a modest-sized marketplace.
                    ->orWhereRaw('LOWER(users.skills) LIKE ?', ["%{$search}%"]);
            });
        }

        // Readiness leads; a fuller profile (resume, links, skills) breaks ties, and
        // whoever qualified most recently breaks any that remain. `sort=complete`
        // flips the first two for a company that cares more about a rich profile.
        $order = $request->input('sort') === 'complete'
            ? [['users.profile_completion_percent', 'desc'], ['vault_profiles.readiness_score', 'desc']]
            : [['vault_profiles.readiness_score', 'desc'], ['users.profile_completion_percent', 'desc']];

        foreach ($order as [$column, $direction]) {
            $query->orderBy($column, $direction);
        }

        $profiles = $query->orderBy('vault_profiles.qualified_at', 'desc')->paginate(24);

        // Annotate each row with this company's own inquiry status (if any)
        // so the browse grid can show "Already Interested" instead of a
        // blank action set — a single query rather than N+1 per card.
        $inquiryStatusByProfileId = VaultInquiry::where('company_id', $companyId)
            ->whereIn('vault_profile_id', $profiles->pluck('id'))
            ->pluck('status', 'vault_profile_id');

        $profiles->getCollection()->transform(function (VaultProfile $p) use ($inquiryStatusByProfileId) {
            $p->makeHidden(self::HIDDEN_FROM_COMPANIES);
            $p->setAttribute('my_inquiry_status', $inquiryStatusByProfileId[$p->id] ?? null);

            return $p;
        });

        return response()->json(['profiles' => $profiles]);
    }

    public function show(Request $request, VaultProfile $profile)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        $profile->load([
            'user:id,name,college_id,branch,branch_code,discipline,department,cgpa,backlogs,current_rating,rated_contests_count,bio,linkedin_url,github_url,skills,resume_path,profile_completion_percent',
            'user.college:id,name,short_code,city,state',
        ]);

        $inquiry = VaultInquiry::where('vault_profile_id', $profile->id)
            ->where('company_id', $companyId)
            ->with('messages')
            ->first();

        // Live, not the stored snapshot: a hiring partner deciding on one person is looking at the one
        // place where an extra few queries buy the freshest possible evidence.
        $readiness = $profile->user->readinessBreakdown();

        return response()->json([
            'profile' => $profile->makeHidden(self::HIDDEN_FROM_COMPANIES),
            'readiness' => [
                'score' => $readiness['score'],
                'tier' => $readiness['tier'],
                'components' => $readiness['components'],
            ],
            'display_rating' => $profile->user->displayRating(),
            'inquiry' => $inquiry,
        ]);
    }

    /** Streams a browsable-or-already-engaged student's resume — same authorizeVisible() gate as every other action here, same private-disk-response pattern InterviewController's audio route already uses. 404s (not a blank/empty response) if the student never uploaded one. */
    public function resume(Request $request, VaultProfile $profile)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        $profile->loadMissing('user:id,resume_path,resume_original_name');
        abort_unless($profile->user?->resume_path, 404);

        return Storage::disk('local')->response($profile->user->resume_path, $profile->user->resume_original_name ?? 'resume.pdf');
    }

    public function myInquiries(Request $request)
    {
        $inquiries = VaultInquiry::where('company_id', $request->user()->company_id)
            ->with(['profile:id,user_id,readiness_score,readiness_tier', 'profile.user:id,name,college_id,branch,branch_code,discipline,department', 'profile.user.college:id,name,short_code'])
            ->latest('updated_at')
            ->get();

        return response()->json(['inquiries' => $inquiries]);
    }

    public function expressInterest(Request $request, VaultProfile $profile)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        $inquiry = $this->firstOrCreateInquiry($profile, $companyId, $request->user()->id);

        if ($inquiry->wasRecentlyCreated) {
            SingleMail::afterResponse(new SendVaultInterestEmail($profile->user_id, $companyId, $inquiry->id));
        }

        return response()->json(['inquiry' => $inquiry], $inquiry->wasRecentlyCreated ? 201 : 200);
    }

    public function scheduleInterview(Request $request, VaultProfile $profile)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
            'mode' => ['required', Rule::in(VaultInquiry::MODES)],
            'location' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($profile, $companyId, $request->user()->id);

        abort_if($inquiry->isTerminal(), 422, 'This engagement is already closed ('.VaultInquiry::statusLabel($inquiry->status).').');

        $inquiry->update([
            'status' => VaultInquiry::STATUS_INTERVIEW_SCHEDULED,
            'interview_scheduled_at' => $validated['scheduled_at'],
            'interview_mode' => $validated['mode'],
            'interview_location' => $validated['location'],
            'interview_notes' => $validated['notes'] ?? null,
            'responded_at' => null,
        ]);

        SingleMail::afterResponse(new SendVaultInterviewInviteEmail($profile->user_id, $companyId, $inquiry->id));

        return response()->json(['inquiry' => $inquiry->fresh()]);
    }

    /**
     * Directly hires a student — no separate "offer accepted" step, unlike
     * DriveApplication's multi-stage offer_extended/offer_accepted (the Vault's
     * pitch is "already vetted, ready now": a company clicking Hire here is a
     * final decision, not the start of a negotiation). Takes the student out of
     * every other company's browse listing, and off Mellow Vault, permanently
     * (status -> hired) — kept as a historical record, not deleted.
     */
    public function hire(Request $request, VaultProfile $profile, VaultService $vault)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        abort_if($profile->isHired(), 422, 'This candidate has already been hired.');

        $validated = $request->validate([
            'ctc_offered' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($profile, $companyId, $request->user()->id);

        $inquiry->update([
            'status' => VaultInquiry::STATUS_HIRED,
            'ctc_offered' => $validated['ctc_offered'] ?? null,
            'interview_notes' => $validated['notes'] ?? $inquiry->interview_notes,
            'hired_at' => now(),
        ]);

        $profile = $vault->markHired($profile, VaultProfile::HIRED_VIA_PARTNER, $companyId);

        SingleMail::afterResponse(new SendVaultHireOfferEmail($profile->user_id, $companyId, $inquiry->id));

        return response()->json(['inquiry' => $inquiry->fresh(), 'profile' => $profile->makeHidden(self::HIDDEN_FROM_COMPANIES)]);
    }

    public function notify(Request $request, VaultProfile $profile)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($profile, $companyId);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($profile, $companyId, $request->user()->id);

        $message = VaultMessage::create([
            'vault_inquiry_id' => $inquiry->id,
            'sender_id' => $request->user()->id,
            'message' => $validated['message'],
        ]);

        SingleMail::afterResponse(new SendVaultOutreachEmail($profile->user_id, $companyId, $message->id));

        return response()->json(['message_sent' => $message], 201);
    }

    private function firstOrCreateInquiry(VaultProfile $profile, int $companyId, int $initiatedBy): VaultInquiry
    {
        return VaultInquiry::firstOrCreate(
            ['vault_profile_id' => $profile->id, 'company_id' => $companyId],
            ['initiated_by' => $initiatedBy, 'status' => VaultInquiry::STATUS_INTERESTED]
        );
    }

    /**
     * A company may view/act on a profile that's currently browsable, OR one it
     * already has a standing relationship with (so an existing engagement never
     * disappears just because the student later hid their profile or their score
     * moved) — but never a profile it has no relationship with that isn't listed.
     */
    private function authorizeVisible(VaultProfile $profile, ?int $companyId): void
    {
        if ($profile->isBrowsable()) {
            return;
        }

        $hasExistingRelationship = $companyId !== null && VaultInquiry::where('vault_profile_id', $profile->id)
            ->where('company_id', $companyId)
            ->exists();

        abort_unless($hasExistingRelationship, 404);
    }
}
