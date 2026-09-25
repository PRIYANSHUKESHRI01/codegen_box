<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadNote;
use App\Models\User;
use App\Services\MarketingLeadService;
use App\Services\StudentStatsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The marketing team's own surface — "Mellow Direct" leads only (see
 * User::isMellowDirectLead()). Deliberately has nothing in common with
 * AdminController/TpoStudentController's student-management endpoints:
 * marketing can't touch a college's roster, and a TPO/internal-ops account
 * has no route into this controller at all (role:admin_marketing,superadmin
 * in routes/api.php).
 */
class MarketingLeadController extends Controller
{
    public function index(Request $request, StudentStatsService $stats)
    {
        $query = User::mellowDirectLeads();
        $this->scopeToOwnLeadsIfMarketing($query, $request->user());

        if ($status = $request->query('status')) {
            $query->where('lead_status', $status);
        }

        $leads = $query->withCount('leadNotes')->with('assignedMarketing:id,name')->orderByDesc('created_at')->paginate(50);

        $leads->getCollection()->transform(fn (User $lead) => $this->leadSummary($lead, $stats));

        // Real aggregate KPIs across ALL of this actor's leads, not just the
        // current page — paginate()'s own `total` already reflects the
        // current status filter, but "new this week"/"converted" need their
        // own counts over the full, unfiltered (but still ownership-scoped)
        // lead base to mean anything as a dashboard-level summary. A
        // marketing employee's KPI strip must agree with their own table,
        // never with the platform-wide total.
        $allLeads = User::mellowDirectLeads();
        $this->scopeToOwnLeadsIfMarketing($allLeads, $request->user());
        $totalLeads = (clone $allLeads)->count();
        $convertedCount = (clone $allLeads)->where('lead_status', User::LEAD_STATUS_CONVERTED)->count();

        // Real per-status distribution across the whole ownership-scoped
        // book (not just the current page) — powers the dashboard's pipeline
        // bar and the status-tab counts. One cheap COUNT per status, same
        // bounded-query convention as the rest of this KPI block.
        $byStatus = collect(User::LEAD_STATUSES)->mapWithKeys(
            fn (string $status) => [$status => (clone $allLeads)->where('lead_status', $status)->count()]
        );

        return response()->json([
            'leads' => $leads,
            'kpis' => [
                'total_leads' => $totalLeads,
                'new_this_week' => (clone $allLeads)->where('created_at', '>=', now()->subDays(7))->count(),
                'converted_count' => $convertedCount,
                'conversion_rate' => $totalLeads > 0 ? round(($convertedCount / $totalLeads) * 100, 1) : 0,
                'by_status' => $byStatus,
            ],
        ]);
    }

    public function show(Request $request, User $lead, StudentStatsService $stats)
    {
        $this->authorizeLeadAccess($lead, $request->user());

        $subscription = $lead->effectiveSubscription();

        return response()->json([
            'lead' => [
                'id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'created_at' => $lead->created_at,
                'lead_status' => $lead->lead_status,
                'subscription' => $subscription ? [
                    'plan_name' => $subscription->plan?->name,
                    'status' => $subscription->status,
                    'current_period_end' => $subscription->current_period_end,
                ] : null,
            ],
            'stats' => [
                'solved_by_difficulty' => $stats->solvedByDifficulty($lead),
                'solved_score' => $stats->solvedScore($lead),
                'streak' => $stats->streak($lead),
                'activity' => $stats->activityHeatmap($lead),
                'recent_submissions' => $stats->recentSubmissions($lead, 10),
            ],
            'notes' => $lead->leadNotes->load('author:id,name')->map(fn (LeadNote $n) => [
                'id' => $n->id,
                'note' => $n->note,
                'author_name' => $n->author?->name ?? 'Deleted user',
                'created_at' => $n->created_at,
            ]),
        ]);
    }

    public function updateStatus(Request $request, User $lead, MarketingLeadService $service)
    {
        $this->authorizeLeadAccess($lead, $request->user());

        $validated = $request->validate([
            'status' => ['required', Rule::in(User::LEAD_STATUSES)],
        ]);

        $lead = $service->updateStatus($lead, $validated['status'], $request->user());

        return response()->json(['lead_status' => $lead->lead_status]);
    }

    public function storeNote(Request $request, User $lead, MarketingLeadService $service)
    {
        $this->authorizeLeadAccess($lead, $request->user());

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:2000'],
        ]);

        $note = $service->addNote($lead, $validated['note'], $request->user());
        $note->load('author:id,name');

        return response()->json([
            'note' => [
                'id' => $note->id,
                'note' => $note->note,
                'author_name' => $note->author?->name ?? 'Deleted user',
                'created_at' => $note->created_at,
            ],
        ], 201);
    }

    public function notify(Request $request, MarketingLeadService $service)
    {
        $validated = $request->validate([
            'lead_ids' => ['required', 'array', 'min:1', 'max:5000'],
            'lead_ids.*' => 'integer',
        ]);

        $queuedCount = $service->notifyLeads($validated['lead_ids'], $request->user());

        return response()->json([
            'message' => "Queued an email for {$queuedCount} lead(s).",
            'queued_count' => $queuedCount,
        ]);
    }

    /** Shared by index()'s list rows — the real numbers a marketing dashboard needs at a glance, nothing fabricated. */
    private function leadSummary(User $lead, StudentStatsService $stats): array
    {
        $subscription = $lead->effectiveSubscription();

        return [
            'id' => $lead->id,
            'name' => $lead->name,
            'email' => $lead->email,
            'created_at' => $lead->created_at,
            'lead_status' => $lead->lead_status,
            'is_blocked' => $lead->is_blocked,
            'plan_name' => $subscription?->plan?->name,
            'subscription_status' => $subscription?->status,
            'solved_score' => $stats->solvedScore($lead),
            'note_count' => $lead->lead_notes_count,
            'assigned_to_name' => $lead->assignedMarketing?->name,
        ];
    }

    /**
     * A marketing employee only ever queries their own book of leads —
     * superadmin (also allowed on this whole route group, for oversight)
     * stays unscoped and sees everyone. Applied to both the list query and
     * its separate KPI base query in index() so the KPI strip and table
     * never disagree.
     */
    private function scopeToOwnLeadsIfMarketing(Builder $query, User $actor): void
    {
        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            $query->where('assigned_marketing_id', $actor->id);
        }
    }

    /**
     * Server-enforced, not just a frontend filter: a marketing employee
     * hitting show/updateStatus/storeNote for a lead that isn't a real
     * Mellow Direct lead, or that's assigned to a *different* employee,
     * 404s exactly like it would for any other out-of-scope id. Superadmin
     * bypasses the ownership half of this check.
     */
    private function authorizeLeadAccess(User $lead, User $actor): void
    {
        abort_unless($lead->isMellowDirectLead(), 404);

        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            abort_unless($lead->assigned_marketing_id === $actor->id, 404);
        }
    }
}
