<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\ContactRequest;
use App\Models\ContactRequestNote;
use App\Models\User;
use App\Services\ContactRequestService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The marketing team's surface for "Talk to Our Team" contact requests —
 * the ContactRequest-side sibling of MarketingLeadController, same shape
 * and same permission keys (reuses PERM_LEADS: it's the same "manage leads"
 * capability, just a second lead type), since it's the same team doing the
 * same kind of work against a different table.
 */
class MarketingContactRequestController extends Controller
{
    /** A new enquiry nobody has contacted within this many hours is "overdue" on the desk. */
    private const OVERDUE_HOURS = 24;

    /**
     * The enquiry desk. `scope`: `mine` (what is assigned to me — a marketing employee's default), `unassigned` (waiting for someone, which any
     * marketing employee may read and claim) or `all` (superadmin's default). `status` and `search` (name, e-mail, phone, organisation) narrow it.
     * The numbers on top are always about the same book as the default scope, except `unassigned`, which is the whole platform's queue: an
     * employee must be able to see that there is something waiting even when none of it is theirs yet.
     */
    public function index(Request $request)
    {
        $actor = $request->user();
        $isMarketing = $actor->role === User::ROLE_ADMIN_MARKETING;
        $scope = (string) $request->query('scope', $isMarketing ? 'mine' : 'all');
        abort_unless(in_array($scope, ['mine', 'unassigned', 'all'], true), 422, 'Unknown scope.');
        // An employee has no "all": the rest of the team's book is not theirs to browse.
        abort_if($isMarketing && $scope === 'all', 403, 'You can see your own enquiries and the unassigned queue.');

        $query = ContactRequest::query();
        $this->applyScope($query, $scope, $actor);

        if ($status = $request->query('status')) {
            abort_unless(in_array($status, User::LEAD_STATUSES, true), 422, 'Unknown status.');
            $query->where('status', $status);
        }

        if (($search = trim((string) $request->query('search', ''))) !== '') {
            $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search).'%';
            $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like)->orWhere('organization_name', 'like', $like));
        }

        $requests = $query->withCount('notes')->with('assignedMarketing:id,name')->orderByDesc('created_at')->paginate(25);
        $requests->getCollection()->transform(fn (ContactRequest $r) => $this->summary($r));

        $book = ContactRequest::query();
        $this->applyScope($book, $isMarketing ? 'mine' : 'all', $actor);
        $overdueBefore = now()->subHours(self::OVERDUE_HOURS);

        return response()->json([
            'requests' => $requests,
            'scope' => $scope,
            'kpis' => [
                'total' => (clone $book)->count(),
                'new_this_week' => (clone $book)->where('created_at', '>=', now()->subDays(7))->count(),
                'unassigned' => ContactRequest::whereNull('assigned_marketing_id')->count(),
                'awaiting_first_contact' => (clone $book)->where('status', User::LEAD_STATUS_NEW)->count(),
                'overdue' => (clone $book)->where('status', User::LEAD_STATUS_NEW)->where('created_at', '<', $overdueBefore)->count(),
                'by_status' => collect(User::LEAD_STATUSES)->mapWithKeys(fn (string $status) => [$status => (clone $book)->where('status', $status)->count()]),
            ],
            'overdue_hours' => self::OVERDUE_HOURS,
        ]);
    }

    /** A marketing employee takes an enquiry nobody has picked up. First to press wins; the loser is told it is taken. */
    public function claim(Request $request, ContactRequest $contactRequest)
    {
        $actor = $request->user();
        abort_unless($actor->role === User::ROLE_ADMIN_MARKETING, 403, 'Only the marketing team claims enquiries.');
        abort_if($actor->is_blocked, 403);

        $taken = ContactRequest::whereKey($contactRequest->id)->whereNull('assigned_marketing_id')->update(['assigned_marketing_id' => $actor->id]);
        abort_if($taken === 0, 409, 'Someone else has already taken this enquiry.');

        ActivityLog::record($actor, 'Claimed an unassigned enquiry', 'ContactRequest', $contactRequest->name, ['contact_request_id' => $contactRequest->id]);

        return response()->json(['claimed' => true, 'assigned_to_name' => $actor->name]);
    }

    public function show(Request $request, ContactRequest $contactRequest)
    {
        // Readable before it is claimed, so an employee can judge whether to take it.
        $this->authorizeAccess($contactRequest, $request->user(), allowUnassigned: true);

        return response()->json([
            'request' => [
                ...$this->summary($contactRequest),
                'message' => $contactRequest->message,
                'can_edit' => $request->user()->role === User::ROLE_SUPERADMIN || $contactRequest->assigned_marketing_id === $request->user()->id,
            ],
            'notes' => $contactRequest->notes->load('author:id,name')->map(fn (ContactRequestNote $n) => [
                'id' => $n->id,
                'note' => $n->note,
                'author_name' => $n->author?->name ?? 'Deleted user',
                'created_at' => $n->created_at,
            ]),
        ]);
    }

    public function updateStatus(Request $request, ContactRequest $contactRequest, ContactRequestService $service)
    {
        $this->authorizeAccess($contactRequest, $request->user());

        $validated = $request->validate([
            'status' => ['required', Rule::in(User::LEAD_STATUSES)],
        ]);

        $contactRequest = $service->updateStatus($contactRequest, $validated['status'], $request->user());

        return response()->json(['status' => $contactRequest->status]);
    }

    public function storeNote(Request $request, ContactRequest $contactRequest, ContactRequestService $service)
    {
        $this->authorizeAccess($contactRequest, $request->user());

        $validated = $request->validate([
            'note' => ['required', 'string', 'max:2000'],
        ]);

        $note = $service->addNote($contactRequest, $validated['note'], $request->user());
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

    private function summary(ContactRequest $r): array
    {
        return [
            'id' => $r->id,
            'name' => $r->name,
            'email' => $r->email,
            'phone' => $r->phone,
            'audience' => $r->audience,
            'organization_name' => $r->organization_name,
            'status' => $r->status,
            'created_at' => $r->created_at,
            'note_count' => $r->notes_count ?? $r->notes()->count(),
            'assigned_to_name' => $r->assignedMarketing?->name,
            'assigned_to_id' => $r->assigned_marketing_id,
        ];
    }

    /** `mine` = assigned to the caller; `unassigned` = nobody yet; `all` = everything (superadmin only, enforced by the caller). */
    private function applyScope(Builder $query, string $scope, User $actor): void
    {
        match ($scope) {
            'mine' => $query->where('assigned_marketing_id', $actor->id),
            'unassigned' => $query->whereNull('assigned_marketing_id'),
            default => null,
        };
    }

    /** Server-enforced ownership check, same convention as MarketingLeadController::authorizeLeadAccess(). */
    private function authorizeAccess(ContactRequest $contactRequest, User $actor, bool $allowUnassigned = false): void
    {
        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            abort_unless($contactRequest->assigned_marketing_id === $actor->id || ($allowUnassigned && $contactRequest->assigned_marketing_id === null), 404);
        }
    }
}
