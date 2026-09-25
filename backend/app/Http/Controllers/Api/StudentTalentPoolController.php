<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendTalentPoolInterviewResponseEmail;
use App\Models\TalentPoolCandidate;
use App\Models\TalentPoolInquiry;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A student's own Talent Pool standing — self-scoped to $request->user(),
 * same "no role middleware beyond role:user needed" shape as
 * StudentStatsController. Covers both halves of the consent boundary this
 * feature is built around: opting in/out of being discoverable at all
 * (visibility), and responding to a specific company's HR interview invite
 * once they are.
 */
class StudentTalentPoolController extends Controller
{
    public function mine(Request $request)
    {
        $candidate = TalentPoolCandidate::where('user_id', $request->user()->id)
            ->with(['sourceContest:id,title,slug', 'hiredByCompany:id,name,logo'])
            ->first();

        if ($candidate === null) {
            return response()->json(['candidate' => null, 'inquiries' => []]);
        }

        $inquiries = TalentPoolInquiry::where('talent_pool_candidate_id', $candidate->id)
            ->with(['company:id,name,logo,industry'])
            ->latest('updated_at')
            ->get();

        return response()->json(['candidate' => $candidate, 'inquiries' => $inquiries]);
    }

    /** Opt in to being discoverable by hiring partners — from pending_consent OR a prior self opt-out. */
    public function optIn(Request $request)
    {
        $candidate = TalentPoolCandidate::where('user_id', $request->user()->id)->firstOrFail();

        abort_if($candidate->isHired(), 422, 'You have already been hired through the Talent Pool.');
        abort_if($candidate->visibility_status === TalentPoolCandidate::STATUS_HIDDEN_BY_MELLOW, 422, 'Your profile is currently under Mellow review — contact support.');

        $candidate->update([
            'visibility_status' => TalentPoolCandidate::STATUS_VISIBLE,
            'consent_given_at' => $candidate->consent_given_at ?? now(),
        ]);

        return response()->json(['candidate' => $candidate->fresh()]);
    }

    /** Opt back out — hiring partners immediately stop seeing this profile in new searches (existing engagements are untouched). */
    public function optOut(Request $request)
    {
        $candidate = TalentPoolCandidate::where('user_id', $request->user()->id)->firstOrFail();

        abort_if($candidate->isHired(), 422, 'You have already been hired through the Talent Pool.');

        $candidate->update(['visibility_status' => TalentPoolCandidate::STATUS_HIDDEN_BY_CANDIDATE]);

        return response()->json(['candidate' => $candidate->fresh()]);
    }

    /** Accept or decline a company's scheduled HR interview slot. */
    public function respondToInterview(Request $request, TalentPoolInquiry $inquiry)
    {
        $candidate = TalentPoolCandidate::where('user_id', $request->user()->id)->firstOrFail();
        abort_unless($inquiry->talent_pool_candidate_id === $candidate->id, 404);
        abort_unless($inquiry->status === TalentPoolInquiry::STATUS_INTERVIEW_SCHEDULED, 422, 'No pending interview invite to respond to.');

        $validated = $request->validate([
            'decision' => ['required', Rule::in(['accept', 'decline'])],
        ]);

        $inquiry->update([
            'status' => $validated['decision'] === 'decline'
                ? TalentPoolInquiry::STATUS_DECLINED_BY_CANDIDATE
                : TalentPoolInquiry::STATUS_INTERVIEW_SCHEDULED,
            'responded_at' => now(),
        ]);

        SendTalentPoolInterviewResponseEmail::dispatch($inquiry->id, $validated['decision']);

        return response()->json(['inquiry' => $inquiry->fresh()]);
    }
}
