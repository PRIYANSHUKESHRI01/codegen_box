<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LeadNote;
use App\Models\Plan;
use App\Models\Subscription;
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
    /**
     * The lead book. `status`, `search` (name or email) and `assigned=unassigned` narrow the LIST; `page` walks it (50 a
     * page). `kpis` describe the whole ownership-scoped book and never move with a filter. `facets` are the numbers a
     * filter bar needs to be honest: how many leads each status chip would show (under the current search / owner
     * filter) and how many unassigned ones there are (under the current search / status) — exactly what picking that
     * chip then lists.
     */
    public function index(Request $request, StudentStatsService $stats)
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'assigned' => ['nullable', Rule::in(['unassigned'])],
        ]);

        $status = $request->query('status');
        $status = is_string($status) && $status !== '' ? $status : null;
        $search = trim((string) $request->query('search', ''));
        $unassigned = $request->query('assigned') === 'unassigned';

        $scoped = fn () => tap(User::mellowDirectLeads(), fn (Builder $q) => $this->scopeToOwnLeadsIfMarketing($q, $request->user()));
        $narrowed = function (Builder $q, bool $byOwner = true) use ($search, $unassigned) {
            if ($search !== '') {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like));
            }
            if ($byOwner && $unassigned) {
                $q->whereNull('assigned_marketing_id');
            }

            return $q;
        };

        $query = $narrowed($scoped());
        if ($status !== null) {
            $query->where('lead_status', $status);
        }

        $leads = $query->withCount('leadNotes')->with('assignedMarketing:id,name')->orderByDesc('created_at')->orderByDesc('id')->paginate(50);

        $this->enrich($leads->getCollection(), $stats);

        // The whole book, one grouped query: the headline numbers and the pipeline bar both come from it.
        $book = $scoped()->selectRaw('lead_status, COUNT(*) as aggregate')->groupBy('lead_status')->pluck('aggregate', 'lead_status');
        $totalLeads = (int) $book->sum();
        $convertedCount = (int) ($book[User::LEAD_STATUS_CONVERTED] ?? 0);
        $byStatus = collect(User::LEAD_STATUSES)->mapWithKeys(fn (string $s) => [$s => (int) ($book[$s] ?? 0)]);

        // What each status chip would list under the current search / owner filter (the chip's own status is what it adds).
        $chips = $narrowed($scoped())->selectRaw('lead_status, COUNT(*) as aggregate')->groupBy('lead_status')->pluck('aggregate', 'lead_status');

        // How many unassigned leads the "unassigned only" switch would list under the current search / status.
        $unassignedQuery = $narrowed($scoped(), false)->whereNull('assigned_marketing_id');
        if ($status !== null) {
            $unassignedQuery->where('lead_status', $status);
        }

        return response()->json([
            'leads' => $leads,
            'kpis' => [
                'total_leads' => $totalLeads,
                'new_this_week' => $scoped()->where('created_at', '>=', now()->subDays(7))->count(),
                'converted_count' => $convertedCount,
                'conversion_rate' => $totalLeads > 0 ? round(($convertedCount / $totalLeads) * 100, 1) : 0,
                'by_status' => $byStatus,
            ],
            'facets' => [
                'total' => (int) $chips->sum(),
                'by_status' => collect(User::LEAD_STATUSES)->mapWithKeys(fn (string $s) => [$s => (int) ($chips[$s] ?? 0)]),
                'unassigned' => $unassignedQuery->count(),
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

    /**
     * Turns a page of lead models into the rows the dashboards show — the real numbers a marketing dashboard needs at a
     * glance, nothing fabricated. The two per-person lookups (plan, solved score) are done for the whole page at once:
     * done per row they were ~5 queries a lead plus a full read of the problem catalogue each time.
     *
     * @param  \Illuminate\Support\Collection<int, User>  $page
     */
    private function enrich($page, StudentStatsService $stats): void
    {
        $subscriptions = $this->activeSubscriptionsFor($page);
        $scores = $stats->solvedScoresFor($page);

        $page->transform(function (User $lead) use ($subscriptions, $scores) {
            $subscription = $subscriptions[$lead->id] ?? null;

            return [
                'id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'created_at' => $lead->created_at,
                'lead_status' => $lead->lead_status,
                'is_blocked' => $lead->is_blocked,
                'plan_name' => $subscription?->plan?->name,
                'subscription_status' => $subscription?->status,
                'solved_score' => $scores[$lead->id] ?? 0,
                'note_count' => $lead->lead_notes_count,
                'assigned_to_name' => $lead->assignedMarketing?->name,
            ];
        });
    }

    /**
     * The plan each lead holds, as User::activeSubscription() decides it (newest active BASE plan), for a whole page in
     * one query. A Mellow Direct lead has no college, so this is also what effectiveSubscription() would answer.
     *
     * @param  \Illuminate\Support\Collection<int, User>  $leads
     * @return array<int, Subscription>
     */
    private function activeSubscriptionsFor($leads): array
    {
        $ids = $leads->pluck('id')->all();

        if ($ids === []) {
            return [];
        }

        return Subscription::query()
            ->where('subscriber_type', User::class)
            ->whereIn('subscriber_id', $ids)
            ->where('status', Subscription::STATUS_ACTIVE)
            ->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_BASE))
            ->with('plan')
            ->latest('started_at')
            ->latest('id')
            ->get()
            ->unique('subscriber_id')
            ->keyBy('subscriber_id')
            ->all();
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
