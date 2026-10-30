<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ConfirmsSuperadminPassword;
use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ContactRequest;
use App\Models\User;
use App\Services\IssuedCredentialVault;
use App\Services\MarketingTeamService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin -> Marketing Team: the people who answer "Talk to Our Team" enquiries and chase leads, with what each of them is carrying,
 * and the two things the generic account tools could not do safely - hand their work to someone else, and delete one of them.
 *
 * Adding a member, editing their sections, blocking, resetting their password and signing them out all reuse the existing account
 * endpoints (POST /superadmin/users, .../permissions, .../toggle-block, .../reset-password); only team-specific rules live here.
 *
 * Deleting is the one that needs care: a marketing employee owns a book of leads and enquiries, so the request must say what happens
 * to that work (hand it over / share it out / leave it unassigned) before the account goes - nothing a prospect asked for is dropped by accident.
 */
class SuperAdminMarketingTeamController extends Controller
{
    use ConfirmsSuperadminPassword;

    public function __construct(private readonly MarketingTeamService $team) {}

    public function index(): JsonResponse
    {
        $open = fn ($column) => fn ($q) => $q->where(fn ($w) => $w->whereIn($column, MarketingTeamService::OPEN_STATUSES)->orWhereNull($column));

        $employees = User::where('role', User::ROLE_ADMIN_MARKETING)
            ->withCount([
                'assignedLeads as leads_total',
                'assignedLeads as leads_open' => $open('lead_status'),
                'assignedLeads as leads_converted' => fn ($q) => $q->where('lead_status', User::LEAD_STATUS_CONVERTED),
                'assignedContactRequests as enquiries_total',
                'assignedContactRequests as enquiries_open' => $open('status'),
            ])
            ->orderBy('is_blocked')
            ->orderBy('name')
            ->get();

        return response()->json([
            'employees' => $employees->map(fn (User $e) => [
                'id' => $e->id,
                'name' => $e->name,
                'email' => $e->email,
                'handle' => $e->handle,
                'is_blocked' => (bool) $e->is_blocked,
                'blocked_reason' => $e->blocked_reason,
                'permissions' => $e->permissions ?? [],
                'must_change_password' => (bool) $e->must_change_password,
                'created_at' => $e->created_at,
                'leads' => ['open' => $e->leads_open, 'converted' => $e->leads_converted, 'total' => $e->leads_total],
                'enquiries' => ['open' => $e->enquiries_open, 'total' => $e->enquiries_total],
            ])->values(),
            'totals' => [
                'employees' => $employees->count(),
                'active' => $employees->where('is_blocked', false)->count(),
                'open_leads' => (int) $employees->sum('leads_open'),
                'open_enquiries' => (int) $employees->sum('enquiries_open'),
                // Work nobody is holding. With no active employee this is where every new enquiry lands.
                'unassigned_leads' => User::mellowDirectLeads()->whereNull('assigned_marketing_id')->count(),
                'unassigned_enquiries' => ContactRequest::whereNull('assigned_marketing_id')->count(),
            ],
        ]);
    }

    /** What would move, so the dialog can say "12 leads and 3 enquiries" before anything happens. */
    public function workload(User $user): JsonResponse
    {
        $this->assertMarketing($user);

        return response()->json(['workload' => $this->team->workload($user), 'colleagues' => $this->team->activeColleagues($user)->map(fn (User $c) => ['id' => $c->id, 'name' => $c->name, 'email' => $c->email])->values()]);
    }

    public function reassign(Request $request, User $user): JsonResponse
    {
        $this->assertMarketing($user);

        $validated = $request->validate([
            'reassign_mode' => ['required', Rule::in([MarketingTeamService::MODE_TO, MarketingTeamService::MODE_DISTRIBUTE, MarketingTeamService::MODE_LEAVE])],
            'reassign_to' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'include_closed' => ['sometimes', 'boolean'],
        ]);

        $result = $this->team->reassign($user, $validated['reassign_mode'], isset($validated['reassign_to']) ? User::find($validated['reassign_to']) : null, $request->boolean('include_closed'), $request->user());

        ActivityLog::record($request->user(), "Reassigned a marketing employee's work", 'User', $user->name, ['user_id' => $user->id, 'mode' => $validated['reassign_mode']] + $result);

        return response()->json($result);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $this->assertMarketing($user);

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'confirm_email' => ['required', 'string'],
            'reassign_mode' => ['required', Rule::in([MarketingTeamService::MODE_TO, MarketingTeamService::MODE_DISTRIBUTE, MarketingTeamService::MODE_LEAVE])],
            'reassign_to' => ['nullable', 'integer', Rule::exists('users', 'id')],
        ]);

        $this->confirmSuperadminPassword($request, $validated['password']);

        if (! hash_equals(mb_strtolower($user->email), mb_strtolower(trim($validated['confirm_email'])))) {
            throw ValidationException::withMessages(['confirm_email' => ['The email you typed does not match this account. Type it exactly.']]);
        }

        $snapshot = ['name' => $user->name, 'email' => $user->email, 'id' => $user->id];
        $avatar = $user->getRawOriginal('avatar_path');

        try {
            $moved = DB::transaction(function () use ($request, $user, $validated) {
                // All of it goes - their own rows are about to disappear, and a closed lead left behind would only fall back into the unassigned pile.
                $moved = $this->team->reassign($user, $validated['reassign_mode'], isset($validated['reassign_to']) ? User::find($validated['reassign_to']) : null, true, $request->user());

                $user->tokens()->delete();
                app(IssuedCredentialVault::class)->forget($user);
                $user->delete();

                return $moved;
            });
        } catch (QueryException $e) {
            report($e);

            return response()->json(['message' => 'The account could not be deleted because some of its records are still in use elsewhere. Nothing was deleted. Block it instead.'], 409);
        }

        if ($avatar) {
            Storage::disk('public')->delete($avatar);
        }

        ActivityLog::record($request->user(), 'Deleted a marketing employee', 'User', $snapshot['name'], [
            'user_id' => $snapshot['id'],
            'email' => $snapshot['email'],
            'mode' => $validated['reassign_mode'],
            'leads_moved' => $moved['leads'],
            'enquiries_moved' => $moved['enquiries'],
        ]);

        return response()->json(['deleted' => true] + $moved);
    }

    private function assertMarketing(User $user): void
    {
        abort_unless($user->role === User::ROLE_ADMIN_MARKETING, 404, 'That is not a marketing employee.');
    }
}
