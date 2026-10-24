<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionReport;
use App\Services\Core\CoreQuestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Mellow Ops → Core Prep → Questions: the authoring console's question bank (staff with the `core_prep`
 * permission, and superadmin). Every write goes through CoreQuestionService, so the rules — validation,
 * lifecycle, answer-key lock, audit trail — are the same here as in the bulk importer.
 */
class AdminCoreQuestionController extends Controller
{
    public function __construct(private readonly CoreQuestionService $service) {}

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'discipline' => ['nullable', 'string', 'max:20'],
            'subject_id' => ['nullable', 'integer'],
            'topic_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(CoreQuestion::STATUSES)],
            'difficulty' => ['nullable', Rule::in(CoreQuestion::DIFFICULTIES)],
            'usage' => ['nullable', Rule::in(CoreQuestion::USAGES)],
            'type' => ['nullable', Rule::in(CoreQuestion::TYPES)],
            'q' => ['nullable', 'string', 'max:120'],
            'reported' => ['nullable', 'boolean'],
            'flagged' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:5', 'max:100'],
        ]);

        $query = CoreQuestion::query()
            ->with(['subject:id,code,name', 'topic:id,code,name', 'creator:id,name', 'reviewer:id,name', 'stat'])
            ->withCount(['reports as open_reports_count' => fn ($q) => $q->where('status', CoreQuestionReport::STATUS_OPEN)])
            ->when($validated['discipline'] ?? null, fn ($q, $v) => $q->where('discipline_code', $v))
            ->when($validated['subject_id'] ?? null, fn ($q, $v) => $q->where('subject_id', $v))
            ->when($validated['topic_id'] ?? null, fn ($q, $v) => $q->where('topic_id', $v))
            ->when($validated['status'] ?? null, fn ($q, $v) => $q->where('status', $v))
            ->when($validated['difficulty'] ?? null, fn ($q, $v) => $q->where('difficulty', $v))
            ->when($validated['usage'] ?? null, fn ($q, $v) => $q->where('usage', $v))
            ->when($validated['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($validated['q'] ?? null, function ($q, $v) {
                $needle = str_replace(['%', '_'], ['\\%', '\\_'], $v);
                $q->where(fn ($w) => $w->where('stem', 'like', "%{$needle}%")->orWhere('external_id', 'like', "%{$needle}%"));
            })
            ->when($request->boolean('reported'), fn ($q) => $q->whereHas('reports', fn ($r) => $r->where('status', CoreQuestionReport::STATUS_OPEN)))
            ->when($request->boolean('flagged'), fn ($q) => $q->whereHas('stat', fn ($s) => $s->where('flagged', true)))
            ->orderByDesc('updated_at')->orderByDesc('id');

        $page = $query->paginate($validated['per_page'] ?? 25, ['*'], 'page', $validated['page'] ?? 1);

        return response()->json([
            'data' => $page->getCollection()->map(fn (CoreQuestion $q) => $q->toAuthoringArray())->values(),
            'meta' => ['page' => $page->currentPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'last_page' => $page->lastPage()],
        ]);
    }

    public function show(CoreQuestion $coreQuestion): JsonResponse
    {
        $coreQuestion->load(['subject:id,code,name', 'topic:id,code,name', 'creator:id,name', 'reviewer:id,name', 'stat'])
            ->loadCount(['reports as open_reports_count' => fn ($q) => $q->where('status', CoreQuestionReport::STATUS_OPEN)]);

        return response()->json([
            'question' => $coreQuestion->toAuthoringArray(),
            'audits' => $coreQuestion->audits()->with('user:id,name')->limit(50)->get()->map(fn ($a) => [
                'id' => $a->id, 'action' => $a->action, 'changes' => $a->changes, 'note' => $a->note,
                'user' => $a->user?->only(['id', 'name']), 'at' => $a->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $question = $this->service->create($this->payload($request), $request->user());

        return response()->json(['question' => $this->fresh($question)], 201);
    }

    public function update(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $question = $this->service->update($coreQuestion, $this->payload($request), $request->user());

        return response()->json(['question' => $this->fresh($question)]);
    }

    public function setStatus(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::in(CoreQuestion::STATUSES)], 'note' => ['nullable', 'string', 'max:500']]);

        $question = $this->service->transition($coreQuestion, $validated['status'], $request->user(), $validated['note'] ?? null);

        return response()->json(['question' => $this->fresh($question)]);
    }

    /** Moves several questions at once; each is checked on its own and the ones that cannot move are reported, not skipped silently. */
    public function bulkStatus(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:200'],
            'ids.*' => ['integer'],
            'status' => ['required', Rule::in(CoreQuestion::STATUSES)],
        ]);

        $moved = 0;
        $failed = [];

        foreach (CoreQuestion::whereIn('id', $validated['ids'])->get() as $question) {
            try {
                $this->service->transition($question, $validated['status'], $request->user());
                $moved++;
            } catch (ValidationException $e) {
                $failed[] = ['id' => $question->id, 'external_id' => $question->external_id, 'message' => collect($e->errors())->flatten()->first()];
            }
        }

        return response()->json(['moved' => $moved, 'failed' => $failed]);
    }

    public function fixKey(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
            'correct' => ['sometimes', 'nullable', 'array'],
            'correct.*' => ['string', 'max:2'],
            'options' => ['sometimes', 'nullable', 'array', 'max:6'],
            'options.*.id' => ['required_with:options', 'string', 'max:2'],
            'options.*.text' => ['required_with:options', 'string', 'max:2000'],
            'numeric_min' => ['sometimes', 'nullable', 'numeric'],
            'numeric_max' => ['sometimes', 'nullable', 'numeric'],
            'marks' => ['sometimes', 'numeric'],
            'negative_marks' => ['sometimes', 'numeric'],
        ]);

        $reason = $validated['reason'];
        unset($validated['reason']);

        $question = $this->service->fixKey($coreQuestion, $validated, $reason, $request->user());

        return response()->json(['question' => $this->fresh($question)]);
    }

    public function destroy(CoreQuestion $coreQuestion): JsonResponse
    {
        $this->service->delete($coreQuestion);

        return response()->json(['deleted' => true]);
    }

    public function uploadImage(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        $request->validate(['image' => ['required', 'file', 'image', 'mimes:png,jpg,jpeg,webp', 'max:'.(int) config('core_prep.import.max_image_kb', 2048)]]);

        return response()->json(['question' => $this->fresh($this->service->attachImage($coreQuestion, $request->file('image'), $request->user()))]);
    }

    public function removeImage(Request $request, CoreQuestion $coreQuestion): JsonResponse
    {
        return response()->json(['question' => $this->fresh($this->service->removeImage($coreQuestion, $request->user()))]);
    }

    // ───────────────────────────── student reports ─────────────────────────────

    public function reports(Request $request): JsonResponse
    {
        $status = $request->query('status', CoreQuestionReport::STATUS_OPEN);

        $reports = CoreQuestionReport::query()
            ->with(['question:id,external_id,stem,status,discipline_code,subject_id', 'question.subject:id,name', 'reporter:id,name,email'])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->orderByDesc('id')->limit(200)->get();

        return response()->json(['reports' => $reports->map(fn (CoreQuestionReport $r) => [
            'id' => $r->id, 'reason' => $r->reason, 'note' => $r->note, 'status' => $r->status,
            'created_at' => $r->created_at?->toIso8601String(), 'resolved_at' => $r->resolved_at?->toIso8601String(),
            'reporter' => $r->reporter?->only(['id', 'name', 'email']),
            'question' => $r->question ? [
                'id' => $r->question->id, 'external_id' => $r->question->external_id, 'status' => $r->question->status,
                'discipline_code' => $r->question->discipline_code, 'subject' => $r->question->subject?->name,
                'stem' => mb_substr($r->question->stem, 0, 240),
            ] : null,
        ])]);
    }

    public function resolveReport(Request $request, CoreQuestionReport $report): JsonResponse
    {
        $validated = $request->validate(['status' => ['required', Rule::in([CoreQuestionReport::STATUS_RESOLVED, CoreQuestionReport::STATUS_DISMISSED])]]);

        $report->forceFill(['status' => $validated['status'], 'resolved_by' => $request->user()->id, 'resolved_at' => now()])->save();

        return response()->json(['report' => $report]);
    }

    // ───────────────────────────────── helpers ─────────────────────────────────

    /** The editor's payload, with the subject/topic accepted by id OR code. @return array<string, mixed> */
    private function payload(Request $request): array
    {
        $request->validate([
            'discipline_code' => ['required', 'string', 'max:20'],
            'subject_id' => ['required', 'integer', Rule::exists('core_subjects', 'id')],
            'topic_id' => ['nullable', 'integer', Rule::exists('core_topics', 'id')],
            'type' => ['required', Rule::in(CoreQuestion::TYPES)],
            'stem' => ['required', 'string', 'max:20000'],
            'options' => ['nullable', 'array', 'max:6'],
            'correct' => ['nullable', 'array'],
            'marks' => ['nullable', 'numeric'],
            'negative_marks' => ['nullable', 'numeric'],
            'difficulty' => ['nullable', Rule::in(CoreQuestion::DIFFICULTIES)],
            'usage' => ['nullable', Rule::in(CoreQuestion::USAGES)],
            'external_id' => ['nullable', 'string', 'max:191'],
            'tags' => ['nullable', 'array', 'max:20'],
            'companies' => ['nullable', 'array', 'max:20'],
        ]);

        $input = $request->only([
            'external_id', 'discipline_code', 'subject_id', 'topic_id', 'type', 'stem', 'options', 'correct', 'numeric_min', 'numeric_max',
            'numeric_unit', 'marks', 'negative_marks', 'difficulty', 'explanation', 'tags', 'companies', 'source', 'usage',
        ]);

        // external_id is unique — a clash is a validation message, not a 500.
        if (! empty($input['external_id'])) {
            $existing = CoreQuestion::where('external_id', $input['external_id'])->first();
            $current = $request->route('coreQuestion');

            if ($existing && (! $current instanceof CoreQuestion || $existing->id !== $current->id)) {
                throw ValidationException::withMessages(['external_id' => ['Another question already uses this id.']]);
            }
        }

        return $input;
    }

    private function fresh(CoreQuestion $question): array
    {
        return $question->load(['subject:id,code,name', 'topic:id,code,name', 'creator:id,name', 'reviewer:id,name'])->toAuthoringArray();
    }

    /**
     * Optional: ask Gemini for first drafts on a subject/topic. Off unless CORE_AI_DRAFTS is set. Every draft is saved as a
     * DRAFT through the same service as a hand-written question (so it passes the same validation and leaves the same audit
     * trail), labelled "AI draft"; one that fails validation is dropped and counted, never saved half-formed.
     */
    public function aiDraft(Request $request, \App\Services\GeminiCoreQuestionDraftService $drafts, \App\Services\Core\CoreTaxonomy $taxonomy): JsonResponse
    {
        abort_unless(config('core_prep.ai_drafts.enabled'), 422, 'AI drafting is switched off. Ask a developer to set CORE_AI_DRAFTS=true.');

        $validated = $request->validate([
            'discipline_code' => ['required', Rule::in(\App\Services\Core\CoreAccess::families())],
            'subject_id' => ['required', 'integer'],
            'topic_id' => ['nullable', 'integer'],
            'difficulty' => ['required', Rule::in(CoreQuestion::DIFFICULTIES)],
            'type' => ['required', Rule::in(CoreQuestion::TYPES)],
            'count' => ['required', 'integer', 'min:1', 'max:'.(int) config('core_prep.ai_drafts.max_per_request', 10)],
        ]);

        $subject = $taxonomy->subjectById((int) $validated['subject_id']);
        abort_unless($subject !== null && $subject['discipline'] === $validated['discipline_code'], 422, 'That subject does not belong to this branch family.');

        $topic = null;
        if (! empty($validated['topic_id'])) {
            abort_unless($taxonomy->topicBelongsTo((int) $validated['topic_id'], (int) $subject['id']), 422, 'That topic is not part of the chosen subject.');
            $topic = \App\Models\CoreTopic::whereKey($validated['topic_id'])->value('name');
        }

        $avoid = CoreQuestion::query()->where('subject_id', $subject['id'])->latest('id')->limit(25)->pluck('stem')->all();

        try {
            $rows = $drafts->draft($validated['discipline_code'], $subject['name'], $topic, $validated['difficulty'], $validated['type'], (int) $validated['count'], $avoid);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $saved = [];
        $rejected = 0;

        foreach ($rows as $row) {
            try {
                $saved[] = $this->service->create($row + [
                    'discipline_code' => $validated['discipline_code'], 'subject_id' => $subject['id'], 'topic_id' => $validated['topic_id'] ?? null,
                    'usage' => CoreQuestion::USAGE_BOTH, 'status' => CoreQuestion::STATUS_DRAFT,
                ], $request->user());
            } catch (\Illuminate\Validation\ValidationException) {
                $rejected++;
            }
        }

        return response()->json([
            'questions' => collect($saved)->map(fn (CoreQuestion $q) => $this->fresh($q))->values(),
            'rejected' => $rejected + max(0, (int) $validated['count'] - count($rows)),
        ], 201);
    }

    /** Recompute the item analysis now rather than waiting for the nightly run — what Ops does after a big batch of tests. */
    public function runItemAnalysis(\App\Services\Core\CoreItemAnalysisService $analysis): JsonResponse
    {
        return response()->json($analysis->run());
    }
}
