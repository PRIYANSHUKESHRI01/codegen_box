<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\LeadNote;
use App\Models\User;
use App\Services\StudentStatsService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Mellow Internal's own surface for converted "Mellow Direct" customers —
 * the other half of MarketingLeadController's lifecycle. A lead lands here
 * the instant it converts (see LeadAssignmentService::convertLead(), fired
 * from SubscriptionService::subscribeIndividual()) and is scoped to
 * whichever admin_internal employee it was handed off to, mirroring
 * MarketingLeadController's own-book-vs-superadmin-sees-all convention
 * exactly. Deliberately has no status-changer: unlike a lead, a converted
 * customer's status doesn't cycle through this workflow again — that field
 * only ever moves here in one direction, on purchase.
 */
class InternalCustomerController extends Controller
{
    public function index(Request $request, StudentStatsService $stats)
    {
        $query = $this->baseQuery();
        $this->scopeToOwnCustomersIfInternal($query, $request->user());

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $customers = $query->withCount('leadNotes')
            ->with(['assignedInternal:id,name', 'assignedMarketing:id,name'])
            ->orderByDesc('converted_at')
            ->paginate(50);

        $customers->getCollection()->transform(fn (User $customer) => $this->customerSummary($customer, $stats));

        // Same "KPI strip must agree with the table, not the platform total"
        // convention as MarketingLeadController::index() — computed over the
        // full ownership-scoped set, not just the current page.
        $allCustomers = $this->baseQuery();
        $this->scopeToOwnCustomersIfInternal($allCustomers, $request->user());

        return response()->json([
            'customers' => $customers,
            'kpis' => [
                'total_customers' => (clone $allCustomers)->count(),
                'new_this_week' => (clone $allCustomers)->where('converted_at', '>=', now()->subDays(7))->count(),
            ],
        ]);
    }

    public function show(Request $request, User $customer, StudentStatsService $stats)
    {
        $this->authorizeCustomerAccess($customer, $request->user());

        $subscription = $customer->effectiveSubscription();

        return response()->json([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'created_at' => $customer->created_at,
                'converted_at' => $customer->converted_at,
                'assigned_marketing_name' => $customer->assignedMarketing?->name,
                'subscription' => $subscription ? [
                    'plan_name' => $subscription->plan?->name,
                    'status' => $subscription->status,
                    'current_period_end' => $subscription->current_period_end,
                ] : null,
            ],
            'stats' => [
                'solved_by_difficulty' => $stats->solvedByDifficulty($customer),
                'solved_score' => $stats->solvedScore($customer),
                'streak' => $stats->streak($customer),
                'activity' => $stats->activityHeatmap($customer),
                'recent_submissions' => $stats->recentSubmissions($customer, 10),
            ],
            'notes' => $customer->leadNotes->load('author:id,name')->map(fn (LeadNote $n) => [
                'id' => $n->id,
                'note' => $n->note,
                'author_name' => $n->author?->name ?? 'Deleted user',
                'created_at' => $n->created_at,
            ]),
        ]);
    }

    public function storeNote(Request $request, User $customer)
    {
        $this->authorizeCustomerAccess($customer, $request->user());

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:2000'],
        ]);

        $note = LeadNote::create([
            'user_id' => $customer->id,
            'author_id' => $request->user()->id,
            'note' => $validated['note'],
        ]);
        $note->load('author:id,name');

        ActivityLog::record(
            $request->user(),
            'Added a customer note',
            'User',
            $customer->name,
            ['customer_id' => $customer->id]
        );

        return response()->json([
            'note' => [
                'id' => $note->id,
                'note' => $note->note,
                'author_name' => $note->author?->name ?? 'Deleted user',
                'created_at' => $note->created_at,
            ],
        ], 201);
    }

    private function baseQuery(): Builder
    {
        return User::mellowDirectLeads()
            ->where('lead_status', User::LEAD_STATUS_CONVERTED);
    }

    /** Shared by index()'s list rows — real numbers only, same shape convention as MarketingLeadController::leadSummary(). */
    private function customerSummary(User $customer, StudentStatsService $stats): array
    {
        $subscription = $customer->effectiveSubscription();

        return [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'converted_at' => $customer->converted_at,
            'is_blocked' => $customer->is_blocked,
            'plan_name' => $subscription?->plan?->name,
            'subscription_status' => $subscription?->status,
            'solved_score' => $stats->solvedScore($customer),
            'note_count' => $customer->lead_notes_count,
            'assigned_to_name' => $customer->assignedInternal?->name,
            'converted_by_name' => $customer->assignedMarketing?->name,
        ];
    }

    /**
     * An admin_internal employee only ever queries their own book of
     * converted customers — superadmin (also allowed on this route group)
     * stays unscoped and sees every customer.
     */
    private function scopeToOwnCustomersIfInternal(Builder $query, User $actor): void
    {
        if ($actor->role === User::ROLE_ADMIN_INTERNAL) {
            $query->where('assigned_internal_id', $actor->id);
        }
    }

    /**
     * Server-enforced: an internal employee hitting show/storeNote for a
     * user that isn't actually a converted Mellow Direct customer, or that's
     * assigned to a *different* employee, 404s exactly like
     * MarketingLeadController::authorizeLeadAccess() does for leads.
     */
    private function authorizeCustomerAccess(User $customer, User $actor): void
    {
        abort_unless($customer->isConvertedCustomer(), 404);

        if ($actor->role === User::ROLE_ADMIN_INTERNAL) {
            abort_unless($customer->assigned_internal_id === $actor->id, 404);
        }
    }
}
