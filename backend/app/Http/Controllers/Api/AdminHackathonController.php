<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesHackathons;
use App\Http\Controllers\Controller;
use App\Models\Hackathon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin; permission:
 * hackathons) — hosting and judging hackathons on the platform's behalf.
 *
 * Ops sees every hackathon on the platform: the ones AptRun itself hosts, and
 * the hiring partners' too, so it can support a partner or take down a listing
 * that breaks the rules (every such action lands in the audit log). A new
 * hackathon created here is hosted by AptRun. Only this surface can feature a
 * hackathon on the arena's front page.
 *
 * All of the behaviour is in the ManagesHackathons concern, shared with
 * CompanyHackathonController.
 */
class AdminHackathonController extends Controller
{
    use ManagesHackathons;

    protected function manageableQuery(Request $request): Builder
    {
        return Hackathon::query();
    }

    protected function hostAttributesFor(Request $request): array
    {
        return ['host_type' => Hackathon::HOST_PLATFORM, 'company_id' => null];
    }

    protected function mayFeature(Request $request): bool
    {
        return true;
    }
}
