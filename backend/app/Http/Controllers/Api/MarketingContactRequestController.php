<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
    public function index(Request $request)
    {
        $query = ContactRequest::query();
        $this->scopeToOwnIfMarketing($query, $request->user());

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $requests = $query->withCount('notes')->with('assignedMarketing:id,name')->orderByDesc('created_at')->paginate(50);

        $requests->getCollection()->transform(fn (ContactRequest $r) => $this->summary($r));

        $all = ContactRequest::query();
        $this->scopeToOwnIfMarketing($all, $request->user());
        $total = (clone $all)->count();

        $byStatus = collect(User::LEAD_STATUSES)->mapWithKeys(
            fn (string $status) => [$status => (clone $all)->where('status', $status)->count()]
        );

        return response()->json([
            'requests' => $requests,
            'kpis' => [
                'total' => $total,
                'new_this_week' => (clone $all)->where('created_at', '>=', now()->subDays(7))->count(),
                'unassigned' => (clone $all)->whereNull('assigned_marketing_id')->count(),
                'by_status' => $byStatus,
            ],
        ]);
    }

    public function show(Request $request, ContactRequest $contactRequest)
    {
        $this->authorizeAccess($contactRequest, $request->user());

        return response()->json([
            'request' => [
                ...$this->summary($contactRequest),
                'message' => $contactRequest->message,
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
        ];
    }

    /** A marketing employee only sees their own book; superadmin (also allowed on this route group) stays unscoped. */
    private function scopeToOwnIfMarketing(Builder $query, User $actor): void
    {
        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            $query->where('assigned_marketing_id', $actor->id);
        }
    }

    /** Server-enforced ownership check, same convention as MarketingLeadController::authorizeLeadAccess(). */
    private function authorizeAccess(ContactRequest $contactRequest, User $actor): void
    {
        if ($actor->role === User::ROLE_ADMIN_MARKETING) {
            abort_unless($contactRequest->assigned_marketing_id === $actor->id, 404);
        }
    }
}
