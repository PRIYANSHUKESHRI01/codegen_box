<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The department / branch catalogue every picker (onboarding, drives, filters, roster import) reads.
 * Public and static-ish: names and codes only, nothing about any student.
 *
 * `?aliases=1` also returns every known spelling (normalised key → branch code), which the
 * drive pickers use to show an older drive's "MECH" as the Mechanical Engineering chip.
 * `?department=commerce` narrows the disciplines and branches (and the spellings) to one department.
 */
class BranchController extends Controller
{
    public function index(Request $request, BranchCatalog $catalog): JsonResponse
    {
        $department = $request->query('department');
        $department = is_string($department) && $catalog->department($department) !== null ? $department : null;

        $disciplines = $catalog->disciplines($department);
        $disciplineCodes = array_flip(array_column($disciplines, 'code'));

        $branches = array_values(array_filter($catalog->branches(), fn (array $b) => isset($disciplineCodes[$b['discipline_code']])));

        $payload = [
            'departments' => array_map(fn (array $d) => [
                'code' => $d['code'], 'name' => $d['name'], 'short' => $d['short'], 'description' => $d['description'],
                'icon' => $d['icon'], 'accent' => $d['accent'],
                'domain_prep_label' => $d['settings']['domain_prep_label'] ?? config('departments.defaults.domain_prep_label'),
                // What the department's students see at all (the TPO screens hide columns that mean nothing for a department).
                'capabilities' => DepartmentCapabilities::resolve($d['code']),
            ], $catalog->departments()),
            'disciplines' => array_map(fn (array $d) => [
                'code' => $d['code'], 'name' => $d['name'], 'short' => $d['short'], 'is_live' => $d['is_live'],
                'department' => $d['department_code'],
                // Whether this family has Domain Prep at all (Core Prep, Management Prep …) — the Ops console only lists those.
                'domain_prep' => DepartmentCapabilities::resolve($d['department_code'], $d['code'])['domain_prep'],
            ], $disciplines),
            'branches' => array_map(fn (array $b) => [
                'code' => $b['code'], 'discipline' => $b['discipline_code'], 'name' => $b['name'], 'short' => $b['short'],
            ], $branches),
        ];

        if ($request->boolean('aliases')) {
            $codes = array_flip(array_column($branches, 'code'));
            $payload['aliases'] = (object) array_filter($catalog->aliases(), fn (string $code) => isset($codes[$code]));
        }

        return response()->json($payload);
    }
}
