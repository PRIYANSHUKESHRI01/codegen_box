<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Hackathon;
use App\Models\HackathonAnnouncement;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\User;
use App\Services\Hackathons\HackathonPresenter;
use App\Services\Hackathons\HackathonResultsService;
use App\Services\Hackathons\HackathonRuleException;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Everything a host does to a hackathon — shared by AdminHackathonController
 * (Mellow Ops and superadmin) and CompanyHackathonController (a hiring
 * partner), the same split the Contest and Soft Skills hosts use.
 *
 * The two controllers differ in only three things, which they supply: which
 * hackathons the caller's list covers, the host columns stamped on a new one,
 * and whether the caller may feature a hackathon on the arena's front page.
 * Authority over a single hackathon is always Hackathon::isManagedBy(), so it
 * cannot drift between the two.
 *
 * A hackathon is created as a draft and only reaches students when published;
 * once students have registered it can be cancelled but not quietly pulled
 * back to a draft or deleted.
 */
trait ManagesHackathons
{
    /** The hackathons this caller's list covers. */
    abstract protected function manageableQuery(Request $request): Builder;

    /** Host columns (host_type, company_id) stamped on a hackathon this caller creates. */
    abstract protected function hostAttributesFor(Request $request): array;

    /** Whether the caller may mark a hackathon as featured on the arena's front page. */
    abstract protected function mayFeature(Request $request): bool;

    // ───────────────────────────── list / read ─────────────────────────────

    public function index(Request $request, HackathonPresenter $presenter)
    {
        $rows = $this->withHostCounts($this->manageableQuery($request)->with('company'))
            ->orderByDesc('starts_at')
            ->limit(300)
            ->get()
            ->map(fn (Hackathon $h) => $presenter->hostRow($h));

        return response()->json([
            'hackathons' => $rows->values(),
            'counts' => [
                'total' => $rows->count(),
                'draft' => $rows->where('phase', Hackathon::PHASE_DRAFT)->count(),
                'live' => $rows->where('phase', Hackathon::PHASE_LIVE)->count(),
                'judging' => $rows->where('phase', Hackathon::PHASE_JUDGING)->count(),
                // Scoring opens at the deadline; a live hackathon's drafts-in-progress are not "waiting for a judge".
                'needs_scoring' => $rows->whereIn('phase', [Hackathon::PHASE_JUDGING, Hackathon::PHASE_COMPLETED])->where('unscored_count', '>', 0)->count(),
            ],
        ]);
    }

    public function show(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon))]);
    }

    // ───────────────────────────── create / edit ─────────────────────────────

    /**
     * The colleges a host may map a hackathon to: every active college, with an honest aggregate student
     * count (never a roster). Declared before the `{hackathon}` routes so "colleges" is not read as an id.
     * There is no approval step: a college a host picks here has the hackathon in its students' Arena the
     * moment it is published.
     */
    public function colleges()
    {
        $colleges = College::where('is_active', true)
            ->withCount(['users as student_count' => fn ($q) => $q->where('role', User::ROLE_USER)])
            ->orderBy('name')
            ->get(['id', 'name', 'short_code', 'city', 'state']);

        return response()->json([
            'colleges' => $colleges,
            'totals' => [
                'students' => User::where('role', User::ROLE_USER)->count(),
                'independent_students' => User::where('role', User::ROLE_USER)->whereNull('college_id')->count(),
            ],
        ]);
    }

    public function store(Request $request, HackathonPresenter $presenter)
    {
        $data = $request->validate($this->rules());
        $this->assertCoherent($data);

        $hackathon = DB::transaction(function () use ($data, $request) {
            $hackathon = Hackathon::create(
                $this->attributes($data, $request)
                + $this->hostAttributesFor($request)
                + [
                    'slug' => Hackathon::uniqueSlug($data['title']),
                    'created_by' => $request->user()->id,
                    'status' => Hackathon::STATUS_DRAFT,
                ]
            );

            $hackathon->colleges()->sync($this->collegeIds($data));

            return $hackathon;
        });

        ActivityLog::record($request->user(), 'Created a hackathon', 'Hackathon', $hackathon->title, $this->audienceMeta($data));

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))], 201);
    }

    public function update(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $data = $request->validate($this->rules());
        $this->assertCoherent($data);

        $attributes = $this->attributes($data, $request);
        $collegeIds = $this->collegeIds($data);
        $this->assertEditable($hackathon, $attributes, $collegeIds);

        DB::transaction(function () use ($hackathon, $attributes, $collegeIds) {
            $hackathon->update($attributes);
            $hackathon->colleges()->sync($collegeIds);
        });

        ActivityLog::record($request->user(), 'Updated a hackathon', 'Hackathon', $hackathon->title, $this->audienceMeta($data));

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    public function destroy(Request $request, Hackathon $hackathon)
    {
        $hackathon = $this->resolve($request, $hackathon);

        if ($hackathon->participants()->exists()) {
            throw new HackathonRuleException('Students have registered, so this hackathon cannot be deleted.', 'has_registrations', 409);
        }

        if ($hackathon->isPublished()) {
            throw new HackathonRuleException('Unpublish or cancel a live listing before deleting it.', 'is_published', 409);
        }

        $title = $hackathon->title;

        if ($hackathon->hasStoredCover()) {
            Storage::disk('public')->delete($hackathon->cover_image);
        }

        $hackathon->delete();

        ActivityLog::record($request->user(), 'Deleted a hackathon', 'Hackathon', $title);

        return response()->json(['message' => 'Hackathon deleted.']);
    }

    public function uploadCover(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $validated = $request->validate([
            'cover' => ['required', 'image', 'mimes:jpeg,png,webp', 'max:4096', 'dimensions:min_width=600,min_height=300'],
        ]);

        $path = $validated['cover']->storeAs(
            'hackathons/covers',
            $hackathon->id.'-'.bin2hex(random_bytes(6)).'.'.$validated['cover']->extension(),
            'public'
        );

        if ($hackathon->hasStoredCover()) {
            Storage::disk('public')->delete($hackathon->cover_image);
        }

        $hackathon->update(['cover_image' => $path]);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    public function deleteCover(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        if ($hackathon->hasStoredCover()) {
            Storage::disk('public')->delete($hackathon->cover_image);
        }

        $hackathon->update(['cover_image' => null]);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    // ───────────────────────────── lifecycle ─────────────────────────────

    public function publish(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        if ($hackathon->isCancelled()) {
            throw new HackathonRuleException('A cancelled hackathon cannot be published again.', 'hackathon_cancelled', 409);
        }

        if ($hackathon->isPublished()) {
            throw new HackathonRuleException('This hackathon is already published.', 'already_published', 409);
        }

        if ($hackathon->hasEnded()) {
            throw new HackathonRuleException('The submission deadline has already passed. Move the dates forward before publishing.', 'already_over');
        }

        if ($hackathon->mode !== Hackathon::MODE_ONLINE && trim((string) $hackathon->location) === '') {
            throw new HackathonRuleException('Add a location — this hackathon is not fully online.', 'location_required');
        }

        $hackathon->update(['status' => Hackathon::STATUS_PUBLISHED, 'published_at' => $hackathon->published_at ?? now()]);

        ActivityLog::record($request->user(), 'Published a hackathon', 'Hackathon', $hackathon->title);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    public function unpublish(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        if (! $hackathon->isPublished()) {
            throw new HackathonRuleException('Only a published hackathon can be unpublished.', 'not_published', 409);
        }

        if ($hackathon->participants()->exists()) {
            throw new HackathonRuleException('Students have registered, so it cannot go back to a draft. Cancel it instead.', 'has_registrations', 409);
        }

        $hackathon->update(['status' => Hackathon::STATUS_DRAFT]);

        ActivityLog::record($request->user(), 'Unpublished a hackathon', 'Hackathon', $hackathon->title);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    public function cancel(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:300']]);

        if ($hackathon->isCancelled()) {
            throw new HackathonRuleException('This hackathon is already cancelled.', 'hackathon_cancelled', 409);
        }

        if ($hackathon->resultsArePublished()) {
            throw new HackathonRuleException('Results are out, so this hackathon can no longer be cancelled.', 'results_published', 409);
        }

        $hackathon->update([
            'status' => Hackathon::STATUS_CANCELLED,
            'cancelled_at' => now(),
            'cancelled_reason' => trim($data['reason']),
            'is_featured' => false,
        ]);

        ActivityLog::record($request->user(), 'Cancelled a hackathon', 'Hackathon', $hackathon->title, ['reason' => $data['reason']]);

        return response()->json(['hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company')))]);
    }

    // ───────────────────────────── people ─────────────────────────────

    public function registrations(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $rows = $this->registrationsQuery($hackathon, (string) $request->query('q', ''))->limit(2000)->get();

        return response()->json([
            'registrations' => $rows->map(fn (HackathonParticipant $p) => $presenter->hostRegistration($p))->values(),
            'totals' => [
                'participants' => $hackathon->participants()->count(),
                'teams' => $hackathon->teams()->count(),
            ],
        ]);
    }

    public function exportRegistrations(Request $request, Hackathon $hackathon): StreamedResponse
    {
        $hackathon = $this->resolve($request, $hackathon);

        $rows = $this->registrationsQuery($hackathon, '')->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['Name', 'Email', 'Handle', 'College', 'Branch', 'Team', 'Role', 'Registered at (UTC)']);

            foreach ($rows as $p) {
                fputcsv($out, array_map([$this, 'csvSafe'], [
                    $p->user->name,
                    $p->user->email,
                    $p->user->handle,
                    $p->user->college?->name,
                    $p->user->branch,
                    $p->team->name,
                    $p->role,
                    $p->registered_at?->toDateTimeString(),
                ]));
            }

            fclose($out);
        }, 'hackathon-'.$hackathon->slug.'-registrations.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    // ───────────────────────────── judging ─────────────────────────────

    public function submissions(Request $request, Hackathon $hackathon, HackathonPresenter $presenter, HackathonResultsService $results)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $rows = $hackathon->submissions()
            ->with('team.participants.user')
            ->orderByRaw("CASE status WHEN 'submitted' THEN 0 ELSE 1 END")
            ->bestRankFirst()
            ->orderByDesc('final_score')
            ->orderBy('submitted_at')
            ->limit(1000)
            ->get();

        return response()->json([
            'submissions' => $rows->map(fn (HackathonSubmission $s) => $presenter->hostSubmission($s))->values(),
            'criteria' => $hackathon->effectiveCriteria(),
            'judging_open' => $hackathon->hasEnded(),
            'unscored_count' => $results->unscoredCount($hackathon),
            'results_published' => $hackathon->resultsArePublished(),
        ]);
    }

    public function scoreSubmission(Request $request, Hackathon $hackathon, HackathonSubmission $submission, HackathonPresenter $presenter, HackathonResultsService $results)
    {
        $hackathon = $this->resolve($request, $hackathon);
        $this->assertBelongs($hackathon, $submission);

        $data = $request->validate([
            'scores' => ['required', 'array', 'min:1', 'max:12'],
            'scores.*.criterion' => ['required', 'string', 'max:60'],
            'scores.*.score' => ['required', 'numeric', 'min:0', 'max:10'],
            'feedback' => ['nullable', 'string', 'max:2000'],
        ]);

        $known = collect($hackathon->effectiveCriteria())->pluck('name');
        $marks = [];

        foreach ($data['scores'] as $row) {
            if (! $known->contains($row['criterion'])) {
                throw ValidationException::withMessages(['scores' => ["“{$row['criterion']}” is not one of this hackathon's judging criteria."]]);
            }

            $marks[$row['criterion']] = $row['score'];
        }

        $submission->setRelation('hackathon', $hackathon);
        $scored = $results->score($submission, $request->user(), $marks, $data['feedback'] ?? null);

        ActivityLog::record($request->user(), 'Scored a hackathon project', 'Hackathon', $hackathon->title, [
            'submission_id' => $submission->id,
            'score' => (float) $scored->final_score,
        ]);

        return response()->json([
            'submission' => $presenter->hostSubmission($scored->load('team.participants.user')),
            'unscored_count' => $results->unscoredCount($hackathon),
        ]);
    }

    public function disqualify(Request $request, Hackathon $hackathon, HackathonSubmission $submission, HackathonPresenter $presenter, HackathonResultsService $results)
    {
        $hackathon = $this->resolve($request, $hackathon);
        $this->assertBelongs($hackathon, $submission);

        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:300']]);

        $updated = $results->disqualify($submission, trim($data['reason']));

        ActivityLog::record($request->user(), 'Disqualified a hackathon project', 'Hackathon', $hackathon->title, [
            'submission_id' => $submission->id,
            'reason' => $data['reason'],
        ]);

        return response()->json([
            'submission' => $presenter->hostSubmission($updated->load('team.participants.user')),
            'unscored_count' => $results->unscoredCount($hackathon),
        ]);
    }

    public function reinstate(Request $request, Hackathon $hackathon, HackathonSubmission $submission, HackathonPresenter $presenter, HackathonResultsService $results)
    {
        $hackathon = $this->resolve($request, $hackathon);
        $this->assertBelongs($hackathon, $submission);

        $updated = $results->reinstate($submission);

        ActivityLog::record($request->user(), 'Reinstated a hackathon project', 'Hackathon', $hackathon->title, ['submission_id' => $submission->id]);

        return response()->json([
            'submission' => $presenter->hostSubmission($updated->load('team.participants.user')),
            'unscored_count' => $results->unscoredCount($hackathon),
        ]);
    }

    public function publishResults(Request $request, Hackathon $hackathon, HackathonPresenter $presenter, HackathonResultsService $results)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $outcome = $results->publish($hackathon);

        ActivityLog::record($request->user(), 'Published hackathon results', 'Hackathon', $hackathon->title, $outcome);

        return response()->json([
            'outcome' => $outcome,
            'hackathon' => $presenter->hostDetail($this->withCounts($hackathon->fresh('company'))),
        ]);
    }

    // ───────────────────────────── announcements ─────────────────────────────

    public function storeAnnouncement(Request $request, Hackathon $hackathon, HackathonPresenter $presenter)
    {
        $hackathon = $this->resolve($request, $hackathon);

        $data = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'body' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        if (! $hackathon->isPublished()) {
            throw new HackathonRuleException('Publish the hackathon before posting updates.', 'not_published', 409);
        }

        $announcement = $hackathon->announcements()->create([
            'author_id' => $request->user()->id,
            'title' => trim($data['title']),
            'body' => trim($data['body']),
        ]);

        return response()->json(['announcement' => $presenter->announcement($announcement->load('author:id,name'))], 201);
    }

    public function destroyAnnouncement(Request $request, Hackathon $hackathon, HackathonAnnouncement $announcement)
    {
        $hackathon = $this->resolve($request, $hackathon);
        abort_unless($announcement->hackathon_id === $hackathon->id, 404);

        $announcement->delete();

        return response()->json(['message' => 'Update removed.']);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** The hackathon, or a 404 — not a 403 — when this caller has no authority over it, so another host's hackathons are not even confirmed to exist. */
    protected function resolve(Request $request, Hackathon $hackathon): Hackathon
    {
        abort_unless($hackathon->isManagedBy($request->user()), 404);

        return $hackathon;
    }

    protected function assertBelongs(Hackathon $hackathon, HackathonSubmission $submission): void
    {
        abort_unless($submission->hackathon_id === $hackathon->id, 404);
    }

    /** The per-hackathon figures a host's list and judging screens need. */
    private function hostCounts(): array
    {
        return [
            'participants',
            'teams',
            'colleges',
            'submissions as submitted_count' => fn ($q) => $q->where('status', HackathonSubmission::STATUS_SUBMITTED),
            'submissions as unscored_count' => fn ($q) => $q
                ->where('status', HackathonSubmission::STATUS_SUBMITTED)
                ->where('is_disqualified', false)
                ->whereNull('final_score'),
        ];
    }

    private function withHostCounts(Builder $query): Builder
    {
        return $query->withCount($this->hostCounts());
    }

    private function withCounts(Hackathon $hackathon): Hackathon
    {
        return $hackathon->loadCount($this->hostCounts());
    }

    private function registrationsQuery(Hackathon $hackathon, string $search)
    {
        $search = trim($search);

        return HackathonParticipant::where('hackathon_id', $hackathon->id)
            ->with(['user.college', 'team'])
            ->when($search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';

                // Grouped: without the wrapper this reads `hackathon_id = ? AND user-match OR team-match`, and the OR
                // would escape the hackathon filter and match teams from other hosts' hackathons.
                $q->where(fn ($match) => $match
                    ->whereHas('user', fn ($u) => $u->where('name', 'like', $like)->orWhere('email', 'like', $like))
                    ->orWhereHas('team', fn ($t) => $t->where('name', 'like', $like)));
            })
            ->orderBy('registered_at')
            ->orderBy('id');
    }

    /** Stop a spreadsheet from running a student-typed cell as a formula. */
    private function csvSafe(mixed $value): string
    {
        $value = (string) $value;

        return $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true) ? "'".$value : $value;
    }

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'tagline' => ['required', 'string', 'min:3', 'max:200'],
            'description' => ['required', 'string', 'min:40', 'max:20000'],
            'accent' => ['required', Rule::in(Hackathon::ACCENTS)],
            'themes' => ['nullable', 'array', 'max:8'],
            'themes.*' => ['string', 'min:1', 'max:30'],
            'mode' => ['required', Rule::in(Hackathon::MODES)],
            'location' => ['nullable', 'string', 'max:160'],

            'registration_opens_at' => ['required', 'date'],
            'registration_closes_at' => ['required', 'date'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date'],
            'results_expected_at' => ['nullable', 'date'],

            'min_team_size' => ['required', 'integer', 'min:1', 'max:10'],
            'max_team_size' => ['required', 'integer', 'min:1', 'max:10', 'gte:min_team_size'],
            'max_participants' => ['nullable', 'integer', 'min:2', 'max:100000'],

            'prize_pool_amount' => ['required', 'integer', 'min:0', 'max:1000000000'],
            'currency' => ['required', Rule::in(['INR', 'USD', 'EUR', 'GBP'])],
            'prizes' => ['nullable', 'array', 'max:12'],
            'prizes.*.place' => ['required', 'integer', 'min:1', 'max:50'],
            'prizes.*.title' => ['required', 'string', 'min:1', 'max:80'],
            'prizes.*.reward' => ['nullable', 'string', 'max:80'],
            'prizes.*.perks' => ['nullable', 'array', 'max:6'],
            'prizes.*.perks.*' => ['string', 'min:1', 'max:120'],

            'tracks' => ['nullable', 'array', 'max:12'],
            'tracks.*.name' => ['required', 'string', 'min:1', 'max:80', 'distinct'],
            'tracks.*.description' => ['nullable', 'string', 'max:300'],

            'criteria' => ['nullable', 'array', 'max:8'],
            'criteria.*.name' => ['required', 'string', 'min:1', 'max:60', 'distinct'],
            'criteria.*.weight' => ['required', 'numeric', 'min:1', 'max:100'],
            'criteria.*.description' => ['nullable', 'string', 'max:200'],

            'rules' => ['nullable', 'string', 'max:20000'],
            'eligibility' => ['nullable', 'string', 'max:1000'],
            'faqs' => ['nullable', 'array', 'max:15'],
            'faqs.*.question' => ['required', 'string', 'min:1', 'max:200'],
            'faqs.*.answer' => ['required', 'string', 'min:1', 'max:1000'],
            'resources' => ['nullable', 'array', 'max:10'],
            'resources.*.label' => ['required', 'string', 'min:1', 'max:80'],
            'resources.*.url' => ['required', 'url:http,https', 'max:300'],

            'is_featured' => ['nullable', 'boolean'],

            // Who can see it. 'colleges' needs at least one active college; for 'all' the list is dropped (exclude_unless).
            'audience' => ['required', Rule::in(Hackathon::AUDIENCES)],
            'college_ids' => ['exclude_unless:audience,'.Hackathon::AUDIENCE_COLLEGES, 'required', 'array', 'min:1', 'max:500'],
            'college_ids.*' => ['integer', 'distinct', Rule::exists('colleges', 'id')->where('is_active', true)],
        ];
    }

    /** Cross-field rules a per-field validator cannot express. */
    private function assertCoherent(array $data): void
    {
        $opens = Carbon::parse($data['registration_opens_at']);
        $closes = Carbon::parse($data['registration_closes_at']);
        $starts = Carbon::parse($data['starts_at']);
        $ends = Carbon::parse($data['ends_at']);
        $errors = [];

        if ($closes->lt($opens)) {
            $errors['registration_closes_at'] = ['Registration cannot close before it opens.'];
        }

        if ($ends->lte($starts)) {
            $errors['ends_at'] = ['The submission deadline must be after the kickoff.'];
        }

        if ($closes->gt($ends)) {
            $errors['registration_closes_at'] = ['Registration cannot stay open past the submission deadline.'];
        }

        if ($opens->gte($ends)) {
            $errors['registration_opens_at'] = ['Registration must open before the submission deadline.'];
        }

        if (! empty($data['results_expected_at']) && Carbon::parse($data['results_expected_at'])->lt($ends)) {
            $errors['results_expected_at'] = ['Results cannot be expected before the submission deadline.'];
        }

        if (! empty($data['criteria'])) {
            $total = array_sum(array_map(fn (array $c) => (float) $c['weight'], $data['criteria']));

            if (abs($total - 100) > 0.01) {
                $errors['criteria'] = ['Judging weights must add up to 100 (they add up to '.rtrim(rtrim(number_format($total, 2, '.', ''), '0'), '.').').'];
            }
        }

        if (! empty($data['prizes'])) {
            $places = array_map(fn (array $p) => (int) $p['place'], $data['prizes']);

            if (count($places) !== count(array_unique($places))) {
                $errors['prizes'] = ['Each prize needs its own place — two prizes share the same one.'];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Refuse edits that would corrupt a hackathon students have already acted on.
     *
     * @param  array<string, mixed>  $attributes  the normalised columns about to be written
     */
    private function assertEditable(Hackathon $hackathon, array $attributes, array $collegeIds): void
    {
        if ($hackathon->isCancelled()) {
            throw new HackathonRuleException('A cancelled hackathon cannot be edited.', 'hackathon_cancelled', 409);
        }

        $registered = $hackathon->participants()->count();

        // Narrowing the audience must never strand a student who has already registered: they stay, so their
        // college has to stay in (or the hackathon has to be open to everyone).
        if ($attributes['audience'] === Hackathon::AUDIENCE_COLLEGES && $registered > 0) {
            $stranded = $hackathon->participants()
                ->whereHas('user', fn ($u) => $u->whereNull('college_id')->orWhereNotIn('college_id', $collegeIds))
                ->count();

            if ($stranded > 0) {
                throw new HackathonRuleException(
                    $stranded.' registered student'.($stranded === 1 ? ' is' : 's are').' outside the colleges you selected. Keep their colleges in the list, or open the hackathon to all students.',
                    'audience_excludes_registered',
                    422
                );
            }
        }

        if ($registered > 0
            && ((int) $attributes['min_team_size'] !== $hackathon->min_team_size || (int) $attributes['max_team_size'] !== $hackathon->max_team_size)) {
            throw new HackathonRuleException('Team size is locked once students have registered.', 'team_size_locked', 409);
        }

        if ($attributes['max_participants'] !== null && $attributes['max_participants'] < $registered) {
            throw new HackathonRuleException("Capacity cannot be lower than the {$registered} students already registered.", 'capacity_below_registrations');
        }

        $judgingChanged = $this->normalised($attributes['criteria']) !== $this->normalised($hackathon->criteria)
            || $this->normalised($attributes['prizes']) !== $this->normalised($hackathon->prizes);

        if ($judgingChanged && $hackathon->resultsArePublished()) {
            throw new HackathonRuleException('Results are published, so prizes and judging criteria are locked.', 'results_locked', 409);
        }

        if ($this->normalised($attributes['criteria']) !== $this->normalised($hackathon->criteria)
            && $hackathon->submissions()->whereNotNull('final_score')->exists()) {
            throw new HackathonRuleException('Judging has started, so the criteria are locked.', 'criteria_locked', 409);
        }

        if ($hackathon->isPublished()) {
            $startsChanged = $attributes['starts_at']->getTimestamp() !== $hackathon->starts_at->getTimestamp();
            $endsChanged = $attributes['ends_at']->getTimestamp() !== $hackathon->ends_at->getTimestamp();

            if ($startsChanged && now()->gte($hackathon->starts_at)) {
                throw new HackathonRuleException('The hackathon has already started, so its kickoff cannot move.', 'already_started', 409);
            }

            if ($endsChanged && $hackathon->hasEnded()) {
                throw new HackathonRuleException('The deadline has passed, so it cannot be changed.', 'already_ended', 409);
            }

            if ($endsChanged && $attributes['ends_at']->lte(now())) {
                throw new HackathonRuleException('The new deadline must be in the future.', 'deadline_in_past');
            }
        }
    }

    private function normalised(mixed $value): string
    {
        return json_encode($value ?: []);
    }

    /**
     * The model columns for validated input, normalised: strings trimmed, empty collections stored as
     * null (so the default judging criteria apply), prizes ordered by place.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function attributes(array $data, Request $request): array
    {
        $prizes = collect($data['prizes'] ?? [])
            ->map(fn (array $p) => [
                'place' => (int) $p['place'],
                'title' => trim($p['title']),
                'reward' => isset($p['reward']) && trim($p['reward']) !== '' ? trim($p['reward']) : null,
                'perks' => array_values(array_filter(array_map('trim', $p['perks'] ?? []), fn ($perk) => $perk !== '')),
            ])
            ->sortBy('place')
            ->values()
            ->all();

        $tracks = collect($data['tracks'] ?? [])
            ->map(fn (array $t) => ['name' => trim($t['name']), 'description' => isset($t['description']) ? trim($t['description']) : null])
            ->values()
            ->all();

        $criteria = collect($data['criteria'] ?? [])
            ->map(fn (array $c) => [
                'name' => trim($c['name']),
                'weight' => (float) $c['weight'] == (int) $c['weight'] ? (int) $c['weight'] : (float) $c['weight'],
                'description' => isset($c['description']) ? trim($c['description']) : null,
            ])
            ->values()
            ->all();

        return [
            'title' => trim($data['title']),
            'tagline' => trim($data['tagline']),
            'description' => trim($data['description']),
            'accent' => $data['accent'],
            'themes' => array_values(array_unique(array_filter(array_map('trim', $data['themes'] ?? [])))),
            'mode' => $data['mode'],
            'location' => isset($data['location']) && trim($data['location']) !== '' ? trim($data['location']) : null,
            'registration_opens_at' => Carbon::parse($data['registration_opens_at']),
            'registration_closes_at' => Carbon::parse($data['registration_closes_at']),
            'starts_at' => Carbon::parse($data['starts_at']),
            'ends_at' => Carbon::parse($data['ends_at']),
            'results_expected_at' => ! empty($data['results_expected_at']) ? Carbon::parse($data['results_expected_at']) : null,
            'min_team_size' => (int) $data['min_team_size'],
            'max_team_size' => (int) $data['max_team_size'],
            'max_participants' => isset($data['max_participants']) ? (int) $data['max_participants'] : null,
            'prize_pool_amount' => (int) $data['prize_pool_amount'],
            'currency' => $data['currency'],
            'prizes' => $prizes === [] ? null : $prizes,
            'tracks' => $tracks === [] ? null : $tracks,
            'criteria' => $criteria === [] ? null : $criteria,
            'audience' => $data['audience'],
            'rules' => isset($data['rules']) && trim($data['rules']) !== '' ? trim($data['rules']) : null,
            'eligibility' => isset($data['eligibility']) && trim($data['eligibility']) !== '' ? trim($data['eligibility']) : null,
            'faqs' => ($data['faqs'] ?? []) === [] ? null : array_values(array_map(fn (array $f) => ['question' => trim($f['question']), 'answer' => trim($f['answer'])], $data['faqs'])),
            'resources' => ($data['resources'] ?? []) === [] ? null : array_values(array_map(fn (array $r) => ['label' => trim($r['label']), 'url' => trim($r['url'])], $data['resources'])),
        ] + ($this->mayFeature($request) ? ['is_featured' => (bool) ($data['is_featured'] ?? false)] : []);
    }

    /** @return list<int> the colleges chosen for a 'colleges' hackathon; empty for one open to all. */
    private function collegeIds(array $data): array
    {
        return ($data['audience'] ?? Hackathon::AUDIENCE_ALL) === Hackathon::AUDIENCE_COLLEGES
            ? array_values(array_unique(array_map('intval', $data['college_ids'] ?? [])))
            : [];
    }

    /** What the audit trail records about reach. */
    private function audienceMeta(array $data): array
    {
        return ['audience' => $data['audience'], 'colleges' => count($this->collegeIds($data))];
    }
}
