<?php

namespace App\Services\Integrity;

use App\Models\IntegrityEvent;
use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use App\Models\InterviewProctoringSession;
use App\Models\ProctoringSession;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * What a reviewer (TPO, Section Coordinator, hiring company, platform admin) sees about an attempt, and WHO may see which.
 *
 * Scope is enforced in the QUERY (scopeFor), not by hiding rows afterwards, and the same scope guards the detail and the
 * evidence endpoints — an attempt outside a reviewer's scope answers 404, never "forbidden", so its existence is not leaked.
 *   admin_internal / superadmin   everything
 *   TPO                           students of their own college
 *   Section Coordinator           exactly the students they look after (User::coordinatedBy)
 *   hiring company                attempts at THEIR contests / interviews (by ownership, never by the candidate's college)
 */
class IntegrityReport
{
    public const SURFACE_LABEL = [
        'contest' => 'Contest',
        'interview' => 'AI interview',
        'soft_skill' => 'Soft Skills test',
        'core_test' => 'Core test',
        'study' => 'Practice sitting',
    ];

    /** @return Builder<IntegritySession> */
    public function scopeFor(User $viewer, ?Builder $query = null): Builder
    {
        $query ??= IntegritySession::query();

        if (in_array($viewer->role, [User::ROLE_SUPERADMIN, User::ROLE_ADMIN_INTERNAL], true)) {
            return $query;
        }

        if ($viewer->role === User::ROLE_ADMIN_TPO) {
            return $viewer->college_id === null
                ? $query->whereRaw('1 = 0')
                : $query->whereHas('user', fn (Builder $u) => $u->where('users.college_id', $viewer->college_id));
        }

        if ($viewer->role === User::ROLE_SECTION_COORDINATOR) {
            return $query->whereHas('user', fn (Builder $u) => $u->coordinatedBy($viewer));
        }

        if ($viewer->role === User::ROLE_ADMIN_COMPANY && $viewer->company_id !== null) {
            $companyId = $viewer->company_id;

            return $query->where(function (Builder $q) use ($companyId) {
                $q->where(function (Builder $c) use ($companyId) {
                    $c->where('surface', 'contest')->whereIn('surface_id', ProctoringSession::query()
                        ->whereHas('contestParticipant.contest', fn (Builder $x) => $x->where('owning_company_id', $companyId))
                        ->select('id'));
                })->orWhere(function (Builder $i) use ($companyId) {
                    $i->where('surface', 'interview')->whereIn('surface_id', InterviewProctoringSession::query()
                        ->whereHas('interviewSession.interview', fn (Builder $x) => $x->where('owning_company_id', $companyId))
                        ->select('id'));
                });
            });
        }

        return $query->whereRaw('1 = 0');
    }

    /**
     * A page of attempts for a reviewer's list.
     *
     * @param  array{surface?: ?string, risk?: ?string, status?: ?string, search?: ?string, only_flagged?: bool}  $filters
     * @return array{data: list<array<string, mixed>>, meta: array<string, int>}
     */
    public function list(User $viewer, array $filters, int $page, int $perPage = 25): array
    {
        $query = $this->scopeFor($viewer)->with('user:id,name,email,roll_number,section,college_id');

        if (! empty($filters['surface']) && in_array($filters['surface'], IntegritySession::SURFACES, true)) {
            $query->where('surface', $filters['surface']);
        }
        if (! empty($filters['risk']) && in_array($filters['risk'], ['low', 'medium', 'high', 'critical'], true)) {
            $query->where('risk_level', $filters['risk']);
        }
        if (! empty($filters['status']) && in_array($filters['status'], [IntegritySession::STATUS_ACTIVE, IntegritySession::STATUS_LOCKED, IntegritySession::STATUS_ENDED], true)) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['only_flagged'])) {
            $query->whereIn('risk_level', ['medium', 'high', 'critical']);
        }
        if (! empty($filters['search'])) {
            $term = '%'.str_replace(['%', '_'], ['\%', '\_'], trim((string) $filters['search'])).'%';
            $query->whereHas('user', fn (Builder $u) => $u->where('name', 'like', $term)->orWhere('email', 'like', $term)->orWhere('roll_number', 'like', $term));
        }

        $total = (clone $query)->count();
        $rows = $query->orderByRaw("CASE risk_level WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")
            ->orderByDesc('started_at')
            ->forPage(max(1, $page), $perPage)
            ->get();

        $records = $this->recordsFor($rows);

        return [
            'data' => $rows->map(fn (IntegritySession $s) => $this->summary($s, $records[$s->surface][$s->surface_id] ?? null))->values()->all(),
            'meta' => ['total' => $total, 'page' => max(1, $page), 'per_page' => $perPage, 'last_page' => max(1, (int) ceil($total / $perPage))],
        ];
    }

    /** @return array<string, mixed> everything the detail screen shows */
    public function detail(IntegritySession $s): array
    {
        $s->loadMissing('user:id,name,email,roll_number,section,college_id');
        $record = Surface::for($s->surface)->find($s->surface_id);

        $events = IntegrityEvent::where('integrity_session_id', $s->id)
            ->orderBy('seq')
            ->limit(2000)
            ->get()
            ->map(fn (IntegrityEvent $e) => [
                'seq' => $e->seq,
                'source' => $e->source,
                'type' => $e->type,
                'label' => EventCatalog::label($e->type),
                'severity' => $e->severity,
                'strike' => $e->strike,
                'weight' => $e->weight,
                'occurred_at' => $e->occurred_at?->toIso8601String(),
                'data' => $e->data(),
            ])->all();

        $evidence = IntegrityEvidence::where('integrity_session_id', $s->id)
            ->orderBy('captured_at')
            ->get()
            ->map(fn (IntegrityEvidence $e) => [
                'id' => $e->id,
                'kind' => $e->kind,
                'captured_at' => $e->captured_at?->toIso8601String(),
                'flagged' => $e->flagged,
                'reason' => $e->reason,
                'meta' => $e->meta,
                'bytes' => $e->bytes,
            ])->all();

        $broken = EventLog::verify($s);

        return [
            'session' => $this->summary($s, $record),
            'timeline' => $events,
            'evidence' => $evidence,
            'network' => [
                'bound_ip' => $s->bound_ip,
                'addresses' => collect($s->ips ?? [])->map(fn ($n, $ip) => ['ip' => $ip, 'beats' => $n, 'class' => NetworkIntel::classify($ip)])->values()->all(),
                'gap_seconds' => $s->gap_seconds,
                'gap_count' => $s->gap_count,
            ],
            'guardian' => [
                'covered' => $s->guardian_first_at !== null,
                'first_at' => $s->guardian_first_at?->toIso8601String(),
                'last_at' => $s->guardian_last_at?->toIso8601String(),
                'gap_seconds' => $s->guardian_gap_seconds,
            ],
            'integrity' => [
                'chain_ok' => $broken === null,
                'chain_break' => $broken,
                'event_count' => $s->event_count,
            ],
            'flags' => collect($s->flags ?? [])->map(fn ($n, $type) => ['type' => $type, 'label' => EventCatalog::label($type), 'count' => $n, 'severity' => EventCatalog::severity($type)])->sortByDesc('count')->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function summary(IntegritySession $s, ?Model $record = null): array
    {
        $title = $record !== null ? $this->describe($s->surface, $record) : null;

        return [
            'uuid' => $s->uuid,
            'surface' => $s->surface,
            'surface_label' => self::SURFACE_LABEL[$s->surface] ?? $s->surface,
            'title' => $title,
            'profile' => $s->profile,
            'status' => $s->status,
            'assurance' => $s->assurance,
            'risk_level' => $s->risk_level,
            'risk_score' => $s->risk_score,
            'strikes' => $record !== null ? (int) $record->violation_count : null,
            'max_strikes' => (int) config('proctoring.max_violations_before_lock', 3),
            'locked' => $record !== null ? $record->status === 'locked' : $s->status === IntegritySession::STATUS_LOCKED,
            'started_at' => $s->started_at?->toIso8601String(),
            'last_beat_at' => $s->last_beat_at?->toIso8601String(),
            'ended_at' => $s->ended_at?->toIso8601String(),
            'event_count' => $s->event_count,
            'student' => $s->user ? [
                'id' => $s->user->id,
                'name' => $s->user->name,
                'email' => $s->user->email,
                'roll_number' => $s->user->roll_number,
                'section' => $s->user->section,
            ] : null,
        ];
    }

    /** One line saying WHAT the attempt was. */
    private function describe(string $surface, Model $record): ?string
    {
        try {
            return match ($surface) {
                'contest' => $record->contestParticipant?->contest?->title,
                'interview' => $record->interviewSession?->interview?->title,
                'soft_skill' => $record->softSkillSession?->assessment?->title,
                'core_test' => $record->testSession?->test?->title,
                'study' => $record->kind === 'drill' ? 'Skill Drills' : 'Core Prep practice',
                default => null,
            };
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * The surfaces' own records for a page of attempts, loaded one query per surface (not one per row).
     *
     * @param  Collection<int, IntegritySession>  $sessions
     * @return array<string, array<int, Model>>
     */
    private function recordsFor(Collection $sessions): array
    {
        $out = [];

        foreach ($sessions->groupBy('surface') as $surfaceKey => $group) {
            $surface = Surface::for((string) $surfaceKey);
            $with = match ($surfaceKey) {
                'contest' => ['contestParticipant.contest:id,title'],
                'interview' => ['interviewSession.interview:id,title'],
                'soft_skill' => ['softSkillSession.assessment:id,title'],
                'core_test' => ['testSession.test:id,title'],
                default => [],
            };

            $out[$surfaceKey] = ($surface->modelClass())::with($with)->whereIn('id', $group->pluck('surface_id'))->get()->keyBy('id')->all();
        }

        return $out;
    }
}
