<?php

namespace App\Services;

use App\Models\ContactRequest;
use App\Models\User;

/**
 * The one write path for "who owns this Mellow Direct lead" — mirrors
 * MarketingLeadService/SubscriptionService's "one small focused service per
 * concern" shape in this codebase.
 *
 * The formula is least-loaded assignment, not a stored round-robin pointer:
 * whoever currently has the fewest leads gets the next one (ties broken by
 * lowest id, for determinism). Starting from zero this produces an exact
 * even split (2 employees, 8 new leads -> 4 each) but it's also
 * self-correcting if a 3rd employee joins later — no migration step, no
 * risk of drifting uneven. Already-assigned leads are never moved by
 * anything in this service; reassigning a lead an employee has been
 * working would actively harm a real CRM workflow.
 */
class LeadAssignmentService
{
    /**
     * No-ops if `$lead` isn't a real Mellow Direct lead, already has an
     * owner, or no active marketing employee exists yet (the lead simply
     * stays unassigned until assignUnassignedLeads() next has someone to
     * give it to).
     */
    public function assignLead(User $lead): void
    {
        if (! $lead->isMellowDirectLead() || $lead->assigned_marketing_id !== null) {
            return;
        }

        $employee = $this->leastLoadedEmployee();

        if ($employee === null) {
            return;
        }

        $lead->forceFill(['assigned_marketing_id' => $employee->id])->save();
    }

    /**
     * Sweeps every currently-unassigned Mellow Direct lead (oldest first)
     * through assignLead() one at a time — recomputing the least-loaded
     * employee on each iteration keeps a whole backlog balanced across
     * however many employees exist right now, including one who just
     * joined with zero leads.
     */
    public function assignUnassignedLeads(): int
    {
        $unassigned = User::mellowDirectLeads()
            ->whereNull('assigned_marketing_id')
            ->orderBy('created_at')
            ->get();

        $assignedCount = 0;

        foreach ($unassigned as $lead) {
            $before = $lead->assigned_marketing_id;
            $this->assignLead($lead);

            if ($lead->assigned_marketing_id !== $before) {
                $assignedCount++;
            }
        }

        return $assignedCount;
    }

    private function leastLoadedEmployee(): ?User
    {
        return User::where('role', User::ROLE_ADMIN_MARKETING)
            ->where('is_blocked', false)
            ->withCount('assignedLeads')
            ->orderBy('assigned_leads_count')
            ->orderBy('id')
            ->first();
    }

    /**
     * The lead-to-customer handoff: called the moment a Mellow Direct lead
     * buys a paid plan (see SubscriptionService::subscribeIndividual).
     * Marketing keeps credit for the conversion — assigned_marketing_id is
     * never touched here — but servicing ownership now passes to Mellow
     * Internal via assignInternalOwner(). Idempotent: a plan renewal or
     * upgrade by an already-converted customer re-runs this harmlessly
     * (the lead_status write and the internal assignment are both no-ops
     * the second time).
     */
    public function convertLead(User $lead): void
    {
        if (! $lead->isMellowDirectLead()) {
            return;
        }

        if ($lead->lead_status !== User::LEAD_STATUS_CONVERTED) {
            $lead->forceFill([
                'lead_status' => User::LEAD_STATUS_CONVERTED,
                'converted_at' => now(),
            ])->save();
        }

        $this->assignInternalOwner($lead);
    }

    /**
     * No-ops if `$customer` already has an internal owner or no active
     * internal employee exists yet — same "sticky, never reassign" contract
     * as assignLead() above, for the same reason (an internal staffer
     * mid-onboarding a customer must never have it silently handed away).
     */
    public function assignInternalOwner(User $customer): void
    {
        if ($customer->assigned_internal_id !== null) {
            return;
        }

        $employee = $this->leastLoadedInternalEmployee();

        if ($employee === null) {
            return;
        }

        $customer->forceFill(['assigned_internal_id' => $employee->id])->save();
    }

    /**
     * Sweeps every converted customer with no internal owner yet (oldest
     * converted first) — the internal-team analog of assignUnassignedLeads(),
     * run when a new admin_internal hire joins (see SuperAdminController::storeUser)
     * so a backlog from before any internal employee existed gets balanced in.
     */
    public function assignUnassignedCustomers(): int
    {
        $unassigned = User::mellowDirectLeads()
            ->where('lead_status', User::LEAD_STATUS_CONVERTED)
            ->whereNull('assigned_internal_id')
            ->orderBy('converted_at')
            ->get();

        $assignedCount = 0;

        foreach ($unassigned as $customer) {
            $before = $customer->assigned_internal_id;
            $this->assignInternalOwner($customer);

            if ($customer->assigned_internal_id !== $before) {
                $assignedCount++;
            }
        }

        return $assignedCount;
    }

    private function leastLoadedInternalEmployee(): ?User
    {
        return User::where('role', User::ROLE_ADMIN_INTERNAL)
            ->where('is_blocked', false)
            ->withCount('assignedCustomers')
            ->orderBy('assigned_customers_count')
            ->orderBy('id')
            ->first();
    }

    /**
     * The "Talk to Our Team" analog of assignLead() above — same
     * least-loaded/tie-break-by-id formula, but its own independent queue
     * (assignedContactRequests, not assignedLeads). Kept separate rather
     * than counting both types together: a B2B inquiry that expects a phone
     * call is a different kind of work than nurturing a free-tier signup,
     * and a marketing employee's workload for one shouldn't be masked by
     * how many of the other they happen to have.
     */
    public function assignContactRequest(ContactRequest $request): void
    {
        if ($request->assigned_marketing_id !== null) {
            return;
        }

        $employee = $this->leastLoadedEmployeeForContactRequests();

        if ($employee === null) {
            return;
        }

        $request->forceFill(['assigned_marketing_id' => $employee->id])->save();
    }

    /** The contact-request analog of assignUnassignedLeads() above, for the same self-correcting reason. */
    public function assignUnassignedContactRequests(): int
    {
        $unassigned = ContactRequest::whereNull('assigned_marketing_id')
            ->orderBy('created_at')
            ->get();

        $assignedCount = 0;

        foreach ($unassigned as $request) {
            $before = $request->assigned_marketing_id;
            $this->assignContactRequest($request);

            if ($request->assigned_marketing_id !== $before) {
                $assignedCount++;
            }
        }

        return $assignedCount;
    }

    private function leastLoadedEmployeeForContactRequests(): ?User
    {
        return User::where('role', User::ROLE_ADMIN_MARKETING)
            ->where('is_blocked', false)
            ->withCount('assignedContactRequests')
            ->orderBy('assigned_contact_requests_count')
            ->orderBy('id')
            ->first();
    }
}
