<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\CoreSubject;
use App\Models\CoreTopic;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreCoverageService;
use App\Services\Core\CoreTaxonomy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mellow Ops → Core Prep → Taxonomy, Coverage and the go-live switch.
 *
 * The taxonomy (subjects and topics per branch family) ships seeded and staff can extend it; a subject or
 * topic that already has questions cannot be deleted (rename it instead). Coverage is read-only. Going
 * live is a business decision and is superadmin-only (see the route).
 */
class AdminCoreTaxonomyController extends Controller
{
    public function __construct(
        private readonly CoreTaxonomy $taxonomy,
        private readonly CoreCoverageService $coverage,
    ) {}

    public function index(): JsonResponse
    {
        $subjects = CoreSubject::query()->with('topics')->withCount('questions')->orderBy('discipline_code')->orderBy('sort')->get();

        return response()->json([
            'disciplines' => $subjects->groupBy('discipline_code')->map(fn ($group, $code) => [
                'code' => $code,
                'subjects' => $group->map(fn (CoreSubject $s) => [
                    'id' => $s->id, 'code' => $s->code, 'name' => $s->name, 'sort' => $s->sort, 'is_active' => $s->is_active,
                    // null = shared by every branch of the discipline; a list = a specialisation only those branches are offered.
                    'branch_codes' => $s->branch_codes,
                    'questions' => $s->questions_count,
                    'topics' => $s->topics->map(fn (CoreTopic $t) => ['id' => $t->id, 'code' => $t->code, 'name' => $t->name, 'sort' => $t->sort, 'is_active' => $t->is_active])->values(),
                ])->values(),
            ])->values(),
            // Whether the optional "Draft with AI" helper is switched on (CORE_AI_DRAFTS) — the console shows its button only then.
            'ai_drafts' => (bool) config('core_prep.ai_drafts.enabled'),
        ]);
    }

    public function storeSubject(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'discipline_code' => ['required', 'string', Rule::in($this->taxonomy->disciplines())],
            'code' => ['required', 'string', 'max:60', 'regex:/^[a-z][a-z0-9_]*$/'],
            'name' => ['required', 'string', 'max:150'],
            'branch_codes' => ['sometimes', 'nullable', 'array', 'max:40'],
            'branch_codes.*' => ['string', 'distinct', Rule::exists('branches', 'code')],
        ]);

        $validated['branch_codes'] = $this->branchCodesFor($validated['discipline_code'], $validated['branch_codes'] ?? null);

        if (CoreSubject::where('discipline_code', $validated['discipline_code'])->where('code', $validated['code'])->exists()) {
            throw ValidationException::withMessages(['code' => ['That code is already used by another subject in this branch family.']]);
        }

        $subject = CoreSubject::create($validated + ['sort' => (int) CoreSubject::where('discipline_code', $validated['discipline_code'])->max('sort') + 1]);
        $this->taxonomy->flush();
        ActivityLog::record($request->user(), 'Added a Core Prep subject', 'CoreSubject', $subject->name, ['discipline' => $subject->discipline_code]);

        return response()->json(['subject' => $subject], 201);
    }

    public function updateSubject(Request $request, CoreSubject $subject): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            'branch_codes' => ['sometimes', 'nullable', 'array', 'max:40'],
            'branch_codes.*' => ['string', 'distinct', Rule::exists('branches', 'code')],
        ]);

        if (array_key_exists('branch_codes', $validated)) {
            $validated['branch_codes'] = $this->branchCodesFor($subject->discipline_code, $validated['branch_codes']);
        }

        $subject->update($validated);
        $this->taxonomy->flush();

        return response()->json(['subject' => $subject->fresh()]);
    }

    /**
     * The branches a subject is FOR, kept to branches that really belong to its discipline; none = shared by the whole discipline.
     *
     * @param  list<string>|null  $codes
     * @return list<string>|null
     */
    private function branchCodesFor(string $discipline, ?array $codes): ?array
    {
        if ($codes === null || $codes === []) {
            return null;
        }

        $valid = \App\Models\Branch::query()->where('discipline_code', $discipline)->whereIn('code', $codes)->pluck('code')->all();

        if (count($valid) !== count(array_unique($codes))) {
            throw ValidationException::withMessages(['branch_codes' => ['A subject can only be for branches of its own discipline.']]);
        }

        return array_values($valid);
    }

    public function destroySubject(Request $request, CoreSubject $subject): JsonResponse
    {
        if ($subject->questions()->exists()) {
            throw ValidationException::withMessages(['subject' => ['This subject has questions — rename or hide it instead of deleting it.']]);
        }

        $name = $subject->name;
        $subject->delete();
        $this->taxonomy->flush();
        ActivityLog::record($request->user(), 'Deleted a Core Prep subject', 'CoreSubject', $name);

        return response()->json(['deleted' => true]);
    }

    public function storeTopic(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject_id' => ['required', 'integer', Rule::exists('core_subjects', 'id')],
            'code' => ['required', 'string', 'max:80', 'regex:/^[a-z][a-z0-9_]*$/'],
            'name' => ['required', 'string', 'max:200'],
        ]);

        if (CoreTopic::where('subject_id', $validated['subject_id'])->where('code', $validated['code'])->exists()) {
            throw ValidationException::withMessages(['code' => ['That code is already used by another topic in this subject.']]);
        }

        $topic = CoreTopic::create($validated + ['sort' => (int) CoreTopic::where('subject_id', $validated['subject_id'])->max('sort') + 1]);
        $this->taxonomy->flush();

        return response()->json(['topic' => $topic], 201);
    }

    public function updateTopic(Request $request, CoreTopic $topic): JsonResponse
    {
        $topic->update($request->validate([
            'name' => ['sometimes', 'string', 'max:200'],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
        ]));
        $this->taxonomy->flush();

        return response()->json(['topic' => $topic->fresh()]);
    }

    public function destroyTopic(CoreTopic $topic): JsonResponse
    {
        if (\App\Models\CoreQuestion::where('topic_id', $topic->id)->exists()) {
            throw ValidationException::withMessages(['topic' => ['This topic has questions — rename or hide it instead of deleting it.']]);
        }

        $topic->delete();
        $this->taxonomy->flush();

        return response()->json(['deleted' => true]);
    }

    public function coverage(Request $request): JsonResponse
    {
        $payload = ['disciplines' => $this->coverage->all()];

        // The pilot picker's options (superadmin only — only they can change pilots): every college with how many
        // students it has in each core branch family, so "Apex · 14 ECE students" is visible when choosing.
        if ($request->user()?->isSuperAdmin()) {
            $counts = User::query()->where('role', User::ROLE_USER)->whereIn('discipline', CoreAccess::families())->whereNotNull('college_id')
                ->select('college_id', 'discipline', DB::raw('count(*) as n'))->groupBy('college_id', 'discipline')->get()
                ->groupBy('college_id');

            $payload['colleges'] = College::query()->orderBy('name')->get(['id', 'name'])->map(fn (College $c) => [
                'id' => $c->id, 'name' => $c->name,
                'students' => ($counts[$c->id] ?? collect())->pluck('n', 'discipline')->map(fn ($n) => (int) $n)->all(),
            ])->values()->all();
        }

        return response()->json($payload);
    }

    /** Superadmin: choose the colleges whose students see a branch's Core Prep before it is live for everyone. */
    public function setPilots(Request $request, string $discipline): JsonResponse
    {
        abort_unless(in_array($discipline, CoreAccess::families(), true), 404);

        $validated = $request->validate([
            'college_ids' => ['present', 'array', 'max:200'],
            'college_ids.*' => ['integer', 'distinct', Rule::exists('colleges', 'id')],
        ]);

        $changes = $this->coverage->setPilots($discipline, $validated['college_ids'], $request->user());

        ActivityLog::record($request->user(), 'Changed Core Prep pilot colleges', 'Discipline', $discipline, $changes + ['discipline' => $discipline]);

        return response()->json(['discipline' => $this->coverage->forDiscipline($discipline)]);
    }

    /** Superadmin: switch a branch family's Core Prep on or off for students. */
    public function setLive(Request $request, string $discipline): JsonResponse
    {
        $validated = $request->validate(['live' => ['required', 'boolean'], 'force' => ['sometimes', 'boolean']]);

        $row = $this->coverage->setLive($discipline, (bool) $validated['live'], $request->user(), (bool) ($validated['force'] ?? false));

        ActivityLog::record($request->user(), $row->is_live ? 'Switched Core Prep on' : 'Switched Core Prep off', 'Discipline', $row->name, [
            'discipline' => $row->code, 'forced' => (bool) ($validated['force'] ?? false),
        ]);

        return response()->json(['discipline' => $this->coverage->forDiscipline($row->code)]);
    }
}
