<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoreQuestionImport;
use App\Services\Core\CoreQuestionImportService;
use App\Services\Core\CoreTaxonomy;
use App\Support\CoreImportSheets;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Mellow Ops → Core Prep → Import: bulk question upload with a dry-run first.
 *
 * POST /imports with mode=dry_run checks every row and reports what WOULD happen (nothing is written);
 * POST /imports/{id}/commit then imports that same checked file. Rows are keyed by external_id, so a
 * corrected sheet updates rather than duplicates.
 */
class AdminCoreImportController extends Controller
{
    public function __construct(
        private readonly CoreQuestionImportService $service,
        private readonly CoreTaxonomy $taxonomy,
    ) {}

    public function index(): JsonResponse
    {
        return response()->json(['imports' => CoreQuestionImport::query()->latest('id')->limit(30)->get()->map(fn ($i) => $this->present($i, withErrors: false))]);
    }

    public function show(CoreQuestionImport $import): JsonResponse
    {
        return response()->json(['import' => $this->present($import)]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:'.(int) config('core_prep.import.max_file_kb', 10240)],
            'images' => ['nullable', 'file', 'mimes:zip', 'max:102400'],
            'mode' => ['sometimes', Rule::in([CoreQuestionImport::MODE_DRY_RUN, CoreQuestionImport::MODE_COMMIT])],
            'discipline' => ['nullable', 'string', Rule::in($this->taxonomy->disciplines())],
            'status' => ['nullable', Rule::in(['draft', 'in_review', 'published'])],
        ]);

        $import = $this->service->start(
            $request->file('file'),
            $request->file('images'),
            $request->user(),
            $validated['mode'] ?? CoreQuestionImport::MODE_DRY_RUN,
            array_filter(['discipline' => $validated['discipline'] ?? null, 'status' => $validated['status'] ?? null]),
        );

        return response()->json(['import' => $this->present($import)], 201);
    }

    public function commit(Request $request, CoreQuestionImport $import): JsonResponse
    {
        return response()->json(['import' => $this->present($this->service->commitFrom($import, $request->user()))], 201);
    }

    /** The template workbook (or CSV) — optionally limited to one branch family. */
    public function template(Request $request): Response
    {
        $discipline = $request->query('discipline');
        abort_if($discipline !== null && ! $this->taxonomy->hasDiscipline((string) $discipline), 422, 'Unknown branch family.');

        if ($request->query('format') === 'csv') {
            return response(CoreImportSheets::csv($discipline), 200, [
                'Content-Type' => 'text/csv',
                'Content-Disposition' => 'attachment; filename="core-questions-template.csv"',
            ]);
        }

        return response(CoreImportSheets::template($discipline), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="core-questions-template'.($discipline ? "-{$discipline}" : '').'.xlsx"',
        ]);
    }

    /** @return array<string, mixed> */
    private function present(CoreQuestionImport $i, bool $withErrors = true): array
    {
        return [
            'id' => $i->id, 'filename' => $i->original_filename, 'mode' => $i->mode, 'status' => $i->status,
            'total_rows' => $i->total_rows, 'valid_rows' => $i->valid_rows, 'created_rows' => $i->created_rows,
            'updated_rows' => $i->updated_rows, 'failed_rows' => $i->failed_rows, 'summary' => $i->summary,
            'options' => $i->options, 'can_commit' => $i->mode === CoreQuestionImport::MODE_DRY_RUN && $i->status === CoreQuestionImport::STATUS_CHECKED && $i->valid_rows > 0,
            'has_failures' => $i->failed_rows > 0,
            'errors' => $withErrors ? ($i->errors ?? []) : [],
            'created_at' => $i->created_at?->toIso8601String(),
        ];
    }
}
