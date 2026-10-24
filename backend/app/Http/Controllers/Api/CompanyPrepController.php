<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Problem;
use Illuminate\Http\Request;

class CompanyPrepController extends Controller
{
    /**
     * List all companies that have previous year questions and prep material.
     * Accessible to all authenticated students and staff.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $collegeId = $user?->college_id;

        $companies = Company::where('is_active', true)
            ->withCount(['prepQuestions', 'recommendedProblems'])
            ->get()
            ->filter(fn (Company $c) => $c->prep_questions_count > 0 || $c->recommended_problems_count > 0)
            ->map(function (Company $company) use ($collegeId) {
                $years = $company->prepQuestions()
                    ->distinct()
                    ->pluck('asked_year')
                    ->sortDesc()
                    ->values()
                    ->all();

                $rounds = $company->prepQuestions()
                    ->whereNotNull('round_name')
                    ->distinct()
                    ->pluck('round_name')
                    ->values()
                    ->all();

                $categories = $company->prepQuestions()
                    ->distinct()
                    ->pluck('category')
                    ->values()
                    ->all();

                $hasLiveDrive = false;
                $liveDriveId = null;

                if ($collegeId) {
                    $mapping = DriveCollegeMapping::where('college_id', $collegeId)
                        ->where('is_active', true)
                        ->whereHas('placementDrive', function ($q) use ($company) {
                            $q->where('company_id', $company->id)
                                ->where('status', PlacementDrive::STATUS_PUBLISHED);
                        })
                        ->first();

                    if ($mapping) {
                        $hasLiveDrive = true;
                        $liveDriveId = $mapping->placement_drive_id;
                    }
                }

                return [
                    'id' => $company->id,
                    'name' => $company->name,
                    'slug' => $company->slug,
                    'logo' => $company->logo,
                    'industry' => $company->industry,
                    'overview' => $company->overview,
                    'hiring_process' => $company->hiring_process ?? [],
                    'prep_questions_count' => $company->prep_questions_count,
                    'recommended_problems_count' => $company->recommended_problems_count,
                    'years' => $years,
                    'rounds' => $rounds,
                    'categories' => $categories,
                    'has_live_drive' => $hasLiveDrive,
                    'live_drive_id' => $liveDriveId,
                ];
            })
            ->sortByDesc('prep_questions_count')
            ->values();

        return response()->json(['companies' => $companies]);
    }

    /**
     * Show full PYQ question bank and practice pack for a specific company by slug.
     */
    public function show(Request $request, Company $company)
    {
        $user = $request->user();
        $collegeId = $user?->college_id;

        $prepQuestions = $company->prepQuestions()
            ->orderByDesc('asked_year')
            ->orderBy('display_order')
            ->get(['id', 'asked_year', 'category', 'round_name', 'question', 'answer_notes']);

        $recommended = $company->recommendedProblems()
            ->orderBy('priority')
            ->get(['problem_slug', 'topic_tag', 'priority']);

        $realProblems = Problem::whereIn('slug', $recommended->pluck('problem_slug'))
            ->get(['slug', 'title', 'difficulty'])
            ->keyBy('slug');

        $recommendedProblems = $recommended->map(function ($rec) use ($realProblems) {
            $problem = $realProblems->get($rec->problem_slug);

            return [
                'problem_slug' => $rec->problem_slug,
                'topic_tag' => $rec->topic_tag,
                'priority' => $rec->priority,
                'title' => $problem?->title,
                'difficulty' => $problem?->difficulty,
                'available' => $problem !== null,
            ];
        })->all();

        $liveDrive = null;
        if ($collegeId) {
            $mapping = DriveCollegeMapping::with('placementDrive')
                ->where('college_id', $collegeId)
                ->where('is_active', true)
                ->whereHas('placementDrive', fn ($q) => $q->where('company_id', $company->id)->where('status', PlacementDrive::STATUS_PUBLISHED))
                ->first();

            if ($mapping) {
                $liveDrive = [
                    'id' => $mapping->placementDrive->id,
                    'title' => $mapping->placementDrive->title,
                    'role_title' => $mapping->placementDrive->role_title,
                    'ctc_range' => $mapping->placementDrive->ctc_range,
                    'drive_date' => $mapping->placementDrive->drive_date,
                ];
            }
        }

        return response()->json([
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
                'logo' => $company->logo,
                'website_url' => $company->website_url,
                'industry' => $company->industry,
                'overview' => $company->overview,
                'hiring_process' => $company->hiring_process ?? [],
            ],
            'prep_questions' => $prepQuestions,
            'recommended_problems' => $recommendedProblems,
            'live_drive' => $liveDrive,
        ]);
    }
}

