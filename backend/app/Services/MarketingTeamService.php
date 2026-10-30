<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\ContactRequest;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Hands a marketing employee's book of work (their leads and their "Talk to Our Team" enquiries) to somebody else.
 *
 * Used when the superadmin moves work across ("Reassign") and, before an employee is deleted, so nothing a prospect asked for is lost
 * with the account. Three ways to place it:
 *   - `to`          one named colleague takes all of it;
 *   - `distribute`  spread evenly over every active colleague (least-loaded first, leads and enquiries balanced separately,
 *                   the same rule new work is dealt by - LeadAssignmentService);
 *   - `leave`       nobody; it waits unassigned until the next hire / unblock sweeps it up.
 *
 * "Open" work is a lead or enquiry still being chased (new, contacted, engaged). A plain reassign moves only that, so a colleague's
 * conversion history stays theirs; deleting the employee moves everything, because their own rows are going away.
 */
class MarketingTeamService
{
    public const OPEN_STATUSES = [User::LEAD_STATUS_NEW, User::LEAD_STATUS_CONTACTED, User::LEAD_STATUS_ENGAGED];

    public const MODE_TO = 'to';

    public const MODE_DISTRIBUTE = 'distribute';

    public const MODE_LEAVE = 'leave';

    /** Marketing employees who may be handed work: not blocked. */
    public function activeColleagues(User $except): Collection
    {
        return User::where('role', User::ROLE_ADMIN_MARKETING)
            ->where('is_blocked', false)
            ->whereKeyNot($except->id)
            ->orderBy('id')
            ->get();
    }

    /** @return array{leads_open: int, leads_closed: int, enquiries_open: int, enquiries_closed: int} */
    public function workload(User $employee): array
    {
        $leads = User::where('assigned_marketing_id', $employee->id);
        $enquiries = ContactRequest::where('assigned_marketing_id', $employee->id);

        $leadsOpen = (clone $leads)->where(fn ($q) => $q->whereIn('lead_status', self::OPEN_STATUSES)->orWhereNull('lead_status'))->count();
        $enquiriesOpen = (clone $enquiries)->where(fn ($q) => $q->whereIn('status', self::OPEN_STATUSES)->orWhereNull('status'))->count();

        return [
            'leads_open' => $leadsOpen,
            'leads_closed' => $leads->count() - $leadsOpen,
            'enquiries_open' => $enquiriesOpen,
            'enquiries_closed' => $enquiries->count() - $enquiriesOpen,
        ];
    }

    /**
     * @return array{leads: int, enquiries: int, to: list<array{id: int, name: string, leads: int, enquiries: int}>}
     */
    public function reassign(User $from, string $mode, ?User $to, bool $includeClosed, User $actor): array
    {
        $recipients = match ($mode) {
            self::MODE_TO => $this->single($from, $to),
            self::MODE_DISTRIBUTE => $this->colleaguesOrFail($from),
            default => collect(),
        };

        $result = DB::transaction(function () use ($from, $recipients, $includeClosed) {
            $leadIds = User::where('assigned_marketing_id', $from->id)
                ->when(! $includeClosed, fn ($q) => $q->where(fn ($w) => $w->whereIn('lead_status', self::OPEN_STATUSES)->orWhereNull('lead_status')))
                ->orderBy('created_at')
                ->pluck('id')
                ->all();

            $enquiryIds = ContactRequest::where('assigned_marketing_id', $from->id)
                ->when(! $includeClosed, fn ($q) => $q->where(fn ($w) => $w->whereIn('status', self::OPEN_STATUSES)->orWhereNull('status')))
                ->orderBy('created_at')
                ->pluck('id')
                ->all();

            $placed = [];

            foreach ([['leads', $leadIds, fn (int $id) => User::where('assigned_marketing_id', $id)->count(), fn (array $ids, ?int $to) => User::whereIn('id', $ids)->update(['assigned_marketing_id' => $to])],
                ['enquiries', $enquiryIds, fn (int $id) => ContactRequest::where('assigned_marketing_id', $id)->count(), fn (array $ids, ?int $to) => ContactRequest::whereIn('id', $ids)->update(['assigned_marketing_id' => $to])]] as [$kind, $ids, $countOf, $write]) {
                if ($recipients->isEmpty()) {
                    foreach (array_chunk($ids, 500) as $chunk) {
                        $write($chunk, null);
                    }

                    continue;
                }

                // Deal one at a time to whoever holds the least, so a long list ends up level, not dumped on one person.
                $load = $recipients->mapWithKeys(fn (User $r) => [$r->id => $countOf($r->id)])->all();
                $bucket = [];

                foreach ($ids as $id) {
                    $target = array_search(min($load), $load, true);
                    $bucket[$target][] = $id;
                    $load[$target]++;
                }

                foreach ($bucket as $recipientId => $recipientIds) {
                    foreach (array_chunk($recipientIds, 500) as $chunk) {
                        $write($chunk, (int) $recipientId);
                    }

                    $placed[$recipientId][$kind] = count($recipientIds);
                }
            }

            return ['leads' => count($leadIds), 'enquiries' => count($enquiryIds), 'placed' => $placed];
        });

        $summary = [];

        foreach ($recipients as $recipient) {
            $got = $result['placed'][$recipient->id] ?? [];
            $leads = (int) ($got['leads'] ?? 0);
            $enquiries = (int) ($got['enquiries'] ?? 0);

            if ($leads + $enquiries === 0) {
                continue;
            }

            $summary[] = ['id' => $recipient->id, 'name' => $recipient->name, 'leads' => $leads, 'enquiries' => $enquiries];

            app(NotificationService::class)->notify($recipient, NotificationType::LeadNew, 'Work handed over to you', "{$leads} lead(s) and {$enquiries} enquiry(ies) from {$from->name} were reassigned to you.", [
                'url' => '/marketing',
                'group_key' => 'marketing.handover:'.$from->id.':'.$recipient->id.':'.now()->format('YmdHis'),
                'actor' => $actor,
            ]);
        }

        return ['leads' => $result['leads'], 'enquiries' => $result['enquiries'], 'to' => $summary];
    }

    /** @return Collection<int, User> */
    private function single(User $from, ?User $to): Collection
    {
        if ($to === null || $to->role !== User::ROLE_ADMIN_MARKETING || $to->id === $from->id) {
            throw ValidationException::withMessages(['reassign_to' => ['Choose another marketing employee to take the work.']]);
        }

        if ($to->is_blocked) {
            throw ValidationException::withMessages(['reassign_to' => ["{$to->name} is blocked. Choose someone who is active, or unblock them first."]]);
        }

        return collect([$to]);
    }

    /** @return Collection<int, User> */
    private function colleaguesOrFail(User $from): Collection
    {
        $colleagues = $this->activeColleagues($from);

        if ($colleagues->isEmpty()) {
            throw ValidationException::withMessages(['reassign_mode' => ['There is no other active marketing employee to share the work with. Add or unblock one first, or choose "leave unassigned".']]);
        }

        return $colleagues;
    }
}
