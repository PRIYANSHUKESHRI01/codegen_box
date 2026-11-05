<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\GeneratedReport;
use App\Models\User;
use App\Services\CoordinatorInsightsService;
use App\Services\Reports\PdfRenderer;
use App\Services\Reports\ReportArchive;
use App\Services\Reports\SectionReportComposer;
use App\Support\BranchAudience;
use App\Support\ReportFormat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * What a Section Coordinator's dashboard shows beyond the roster (trend, movers, the college's scheduled interviews and how much of
 * the section did them, every open follow-up, the section against the college) and the Section Performance Report as a stored PDF.
 *
 * A coordinator's students are exactly User::scopeCoordinatedBy — the one scope rule — so nothing here can reach another section,
 * another branch of the section or another college. The TPO can make the same report for any section of their own college.
 */
class SectionInsightsController extends Controller
{
    public function __construct(
        private readonly CoordinatorInsightsService $insights,
        private readonly SectionReportComposer $composer,
        private readonly PdfRenderer $pdf,
        private readonly ReportArchive $archive,
    ) {}

    /** GET /coordinator/insights */
    public function insights(Request $request): JsonResponse
    {
        $coordinator = $request->user();
        $students = User::coordinatedBy($coordinator)->orderBy('name')->get(['id', 'name', 'roll_number', 'branch', 'branch_code', 'discipline', 'department', 'section', 'college_id', 'role', 'graduation_year', 'is_blocked']);

        return response()->json($this->insights->build($coordinator, $students));
    }

    /** POST /coordinator/reports/section — the coordinator's own section (and branch scope), as a stored PDF. */
    public function storeForCoordinator(Request $request): JsonResponse
    {
        $coordinator = $request->user();
        $students = User::coordinatedBy($coordinator)->orderBy('name')->get();

        abort_if($students->isEmpty(), 422, 'There are no students in your section yet, so there is nothing to report.');

        $narrowed = BranchAudience::normalize($coordinator->coordinator_scope);
        $scope = $narrowed === null ? null : BranchAudience::label($narrowed);

        return response()->json(['report' => $this->make($coordinator, $students, (string) $coordinator->section, $scope)->present()], 201);
    }

    /** GET /coordinator/reports/section — the section reports this coordinator has made. */
    public function historyForCoordinator(Request $request): JsonResponse
    {
        $coordinator = $request->user();

        return response()->json(['reports' => GeneratedReport::query()
            ->where('kind', GeneratedReport::KIND_SECTION)
            ->where('generated_by', $coordinator->id)
            ->with('generator:id,name')
            ->latest('id')->limit(30)->get()->map->present()]);
    }

    /** POST /tpo/reports/section {section} — any section of the TPO's own college (every branch in it). */
    public function storeForTpo(Request $request): JsonResponse
    {
        $tpo = $request->user();
        abort_unless($tpo->college_id !== null, 422, 'Your account is not linked to a college.');

        $section = trim((string) $request->validate(['section' => ['required', 'string', 'max:40']])['section']);
        $none = $section === '__none__';

        $students = User::query()->where('role', User::ROLE_USER)->where('college_id', $tpo->college_id)
            ->when($none, fn ($q) => $q->where(fn ($w) => $w->whereNull('section')->orWhereRaw("TRIM(section) = ''")), fn ($q) => $q->whereRaw('LOWER(TRIM(section)) = ?', [mb_strtolower($section)]))
            ->orderBy('name')->get();

        abort_if($students->isEmpty(), 404, 'No students in that section.');

        return response()->json(['report' => $this->make($tpo, $students, $none ? 'Not in a section' : $section, null)->present()], 201);
    }

    private function make(User $actor, $students, string $sectionLabel, ?string $scope): GeneratedReport
    {
        $data = $this->composer->compose($actor, $students, $sectionLabel, $scope);

        $id = (string) Str::ulid();
        $label = 'AR-'.strtoupper(substr($id, -10));
        $rendered = $this->pdf->render('reports.section', ['data' => $data], "Report {$label}  |  Confidential: student data, Section {$sectionLabel}");

        $report = $this->archive->store($rendered['binary'], [
            'public_id' => $id,
            'kind' => GeneratedReport::KIND_SECTION,
            'title' => "Section {$sectionLabel} — performance report",
            'filename' => 'AptRun-Section-Report-'.ReportFormat::slug($sectionLabel).'-'.now()->format('Ymd').'.pdf',
            'college_id' => $actor->college_id,
            'pages' => $rendered['pages'],
            'params' => ['section' => $sectionLabel, 'scope' => $scope, 'label' => $label],
            'summary' => SectionReportComposer::snapshot($data),
        ], $actor);

        ActivityLog::record($actor, 'Generated a section report', 'Section', $sectionLabel, ['report' => $label, 'students' => $students->count()]);

        return $report->load('generator:id,name');
    }
}
