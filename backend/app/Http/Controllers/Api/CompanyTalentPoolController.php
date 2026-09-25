<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendTalentPoolHireOfferEmail;
use App\Jobs\SendTalentPoolInterestEmail;
use App\Jobs\SendTalentPoolInterviewInviteEmail;
use App\Jobs\SendTalentPoolOutreachEmail;
use App\Models\TalentPoolCandidate;
use App\Models\TalentPoolInquiry;
use App\Models\TalentPoolMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * A hiring partner's (role: admin_company) window into the shared Talent
 * Pool marketplace — candidates Mellow itself already tested (score >= that
 * assessment's qualifying_score_percent — see TalentPoolQualificationService)
 * and who opted in to being discoverable, independent of any job opening the
 * company created themselves. Distinct from CompanyCandidateController
 * (that's a company's own invited/applied pipeline for one of THEIR
 * openings); a Talent Pool engagement is its own self-contained relationship
 * (TalentPoolInquiry), never forced through DriveApplication.
 *
 * Deliberately never returns a candidate's raw email/phone in any response
 * here — a Talent Pool candidate consented to being *discoverable*, not to
 * having their contact details handed to every company that looks them up.
 * Every outreach action (interest/interview/hire/notify) sends the email
 * itself, server-side, the same way every other transactional email in this
 * app works.
 */
class CompanyTalentPoolController extends Controller
{
    public function index(Request $request)
    {
        $companyId = $request->user()->company_id;

        $query = TalentPoolCandidate::query()
            ->join('users', 'users.id', '=', 'talent_pool_candidates.user_id')
            ->select('talent_pool_candidates.*')
            ->where('visibility_status', TalentPoolCandidate::STATUS_VISIBLE)
            ->with([
                'user:id,name,college_id,branch,cgpa,current_rating,rated_contests_count,bio,linkedin_url,github_url,skills,resume_path,profile_completion_percent',
                'user.college:id,name,short_code',
            ]);

        if ($request->filled('min_score')) {
            $query->where('score_percent', '>=', (float) $request->input('min_score'));
        }

        if ($request->filled('college_id')) {
            $query->whereHas('user', fn ($q) => $q->where('college_id', $request->integer('college_id')));
        }

        if ($request->filled('branch')) {
            $query->whereHas('user', fn ($q) => $q->where('branch', $request->string('branch')));
        }

        if ($request->filled('search')) {
            $search = strtolower($request->string('search'));
            $query->whereHas('user', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    // Skills are stored as a JSON array of strings — a plain
                    // substring match over the column's raw text
                    // representation is a pragmatic tag search without
                    // needing JSON_SEARCH path expressions or a separate
                    // full-text index for what's a modest-sized marketplace.
                    ->orWhereRaw('LOWER(skills) LIKE ?', ["%{$search}%"]);
            });
        }

        // More-complete profiles rank first within any filter/search — the
        // actual mechanism behind "a 100%-complete profile shows up before
        // a same-named or same-skill-matching one that isn't" (see
        // User::computeProfileCompletion()). Recency is only the tiebreaker.
        $candidates = $query
            ->orderBy('users.profile_completion_percent', 'desc')
            ->orderBy('talent_pool_candidates.qualified_at', 'desc')
            ->paginate(24);

        // Annotate each row with this company's own inquiry status (if any)
        // so the browse grid can show "Already Interested" instead of a
        // blank action set — a single query rather than N+1 per card.
        $inquiryStatusByCandidateId = TalentPoolInquiry::where('company_id', $companyId)
            ->whereIn('talent_pool_candidate_id', $candidates->pluck('id'))
            ->pluck('status', 'talent_pool_candidate_id');

        $candidates->getCollection()->transform(function (TalentPoolCandidate $c) use ($inquiryStatusByCandidateId) {
            $c->setAttribute('my_inquiry_status', $inquiryStatusByCandidateId[$c->id] ?? null);

            return $c;
        });

        return response()->json(['candidates' => $candidates]);
    }

    public function show(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        $candidate->load([
            'user:id,name,college_id,branch,cgpa,backlogs,current_rating,rated_contests_count,bio,linkedin_url,github_url,skills,resume_path,profile_completion_percent',
            'user.college:id,name,short_code,city,state',
            'sourceContest:id,title,slug,start_at',
        ]);

        $inquiry = TalentPoolInquiry::where('talent_pool_candidate_id', $candidate->id)
            ->where('company_id', $companyId)
            ->with('messages')
            ->first();

        return response()->json([
            'candidate' => $candidate,
            'readiness_score' => $candidate->user?->readinessScore(),
            'display_rating' => $candidate->user?->displayRating(),
            'inquiry' => $inquiry,
        ]);
    }

    /** Streams a browsable-or-already-engaged candidate's resume — same authorizeVisible() gate as every other action here, same private-disk-response pattern InterviewController's audio route already uses. 404s (not a blank/empty response) if the candidate never uploaded one. */
    public function resume(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        $candidate->loadMissing('user:id,resume_path,resume_original_name');
        abort_unless($candidate->user?->resume_path, 404);

        return Storage::disk('local')->response($candidate->user->resume_path, $candidate->user->resume_original_name ?? 'resume.pdf');
    }

    public function myInquiries(Request $request)
    {
        $inquiries = TalentPoolInquiry::where('company_id', $request->user()->company_id)
            ->with(['candidate.user:id,name,college_id,branch', 'candidate.user.college:id,name,short_code'])
            ->latest('updated_at')
            ->get();

        return response()->json(['inquiries' => $inquiries]);
    }

    public function expressInterest(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        $inquiry = $this->firstOrCreateInquiry($candidate, $companyId, $request->user()->id);

        if ($inquiry->wasRecentlyCreated) {
            SendTalentPoolInterestEmail::dispatch($candidate->user_id, $companyId, $inquiry->id);
        }

        return response()->json(['inquiry' => $inquiry], $inquiry->wasRecentlyCreated ? 201 : 200);
    }

    public function scheduleInterview(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
            'mode' => ['required', Rule::in(TalentPoolInquiry::MODES)],
            'location' => ['required', 'string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($candidate, $companyId, $request->user()->id);

        abort_if($inquiry->isTerminal(), 422, 'This engagement is already closed ('.TalentPoolInquiry::statusLabel($inquiry->status).').');

        $inquiry->update([
            'status' => TalentPoolInquiry::STATUS_INTERVIEW_SCHEDULED,
            'interview_scheduled_at' => $validated['scheduled_at'],
            'interview_mode' => $validated['mode'],
            'interview_location' => $validated['location'],
            'interview_notes' => $validated['notes'] ?? null,
            'responded_at' => null,
        ]);

        SendTalentPoolInterviewInviteEmail::dispatch($candidate->user_id, $companyId, $inquiry->id);

        return response()->json(['inquiry' => $inquiry->fresh()]);
    }

    /**
     * Directly hires a candidate — no separate "offer accepted" step, unlike
     * DriveApplication's multi-stage offer_extended/offer_accepted (this is
     * Mellow's own "already vetted, ready now" pitch: a company clicking
     * Hire here is a final decision, not the start of a negotiation).
     * Removes the candidate from every other company's browse listing
     * permanently (visibility_status -> hired) — kept as a historical
     * record, not deleted.
     */
    public function hire(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        abort_if($candidate->isHired(), 422, 'This candidate has already been hired.');

        $validated = $request->validate([
            'ctc_offered' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($candidate, $companyId, $request->user()->id);

        $inquiry->update([
            'status' => TalentPoolInquiry::STATUS_HIRED,
            'ctc_offered' => $validated['ctc_offered'] ?? null,
            'interview_notes' => $validated['notes'] ?? $inquiry->interview_notes,
            'hired_at' => now(),
        ]);

        $candidate->update([
            'visibility_status' => TalentPoolCandidate::STATUS_HIRED,
            'hired_by_company_id' => $companyId,
            'hired_at' => now(),
        ]);

        SendTalentPoolHireOfferEmail::dispatch($candidate->user_id, $companyId, $inquiry->id);

        return response()->json(['inquiry' => $inquiry->fresh(), 'candidate' => $candidate->fresh()]);
    }

    public function notify(Request $request, TalentPoolCandidate $candidate)
    {
        $companyId = $request->user()->company_id;
        $this->authorizeVisible($candidate, $companyId);

        $validated = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $inquiry = $this->firstOrCreateInquiry($candidate, $companyId, $request->user()->id);

        $message = TalentPoolMessage::create([
            'talent_pool_inquiry_id' => $inquiry->id,
            'sender_id' => $request->user()->id,
            'message' => $validated['message'],
        ]);

        SendTalentPoolOutreachEmail::dispatch($candidate->user_id, $companyId, $message->id);

        return response()->json(['message_sent' => $message], 201);
    }

    private function firstOrCreateInquiry(TalentPoolCandidate $candidate, int $companyId, int $initiatedBy): TalentPoolInquiry
    {
        return TalentPoolInquiry::firstOrCreate(
            ['talent_pool_candidate_id' => $candidate->id, 'company_id' => $companyId],
            ['initiated_by' => $initiatedBy, 'status' => TalentPoolInquiry::STATUS_INTERESTED]
        );
    }

    /**
     * A company may view/act on a candidate that's currently browsable, OR
     * one it already has a standing relationship with (so an existing
     * engagement never disappears just because the candidate later opted
     * out of new discovery) — but never a candidate it has no relationship
     * with and who never opted in.
     */
    private function authorizeVisible(TalentPoolCandidate $candidate, ?int $companyId): void
    {
        if ($candidate->isBrowsable()) {
            return;
        }

        $hasExistingRelationship = $companyId !== null && TalentPoolInquiry::where('talent_pool_candidate_id', $candidate->id)
            ->where('company_id', $companyId)
            ->exists();

        abort_unless($hasExistingRelationship, 404);
    }
}
