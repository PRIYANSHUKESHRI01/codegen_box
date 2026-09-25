<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\HiringReportService;
use Illuminate\Http\Request;

/**
 * Everything the company Hiring Reports page (and the Hiring Command
 * Center's stat cards/action items) needs, in one call — mirrors
 * TpoReportsController::data() structurally, section logic entirely
 * omitted (see HiringReportService's docblock).
 */
class CompanyReportsController extends Controller
{
    public function data(Request $request, HiringReportService $hiringReportService)
    {
        $company = Company::findOrFail($request->user()->company_id);

        return response()->json([
            'company' => [
                'name' => $company->name,
                'industry' => $company->industry,
                'logo' => $company->logo,
            ],
            'hiring' => $hiringReportService->forCompany($company),
        ]);
    }
}
