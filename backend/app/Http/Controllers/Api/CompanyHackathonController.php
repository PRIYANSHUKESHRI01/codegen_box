<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesHackathons;
use App\Http\Controllers\Controller;
use App\Models\Hackathon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Hiring-partner-only (role: admin_company) — a company hosting its own
 * hackathon to meet students it might hire.
 *
 * Strictly scoped to the caller's own company: the list covers only
 * hackathons that company hosts, and every action on a single hackathon is
 * checked by Hackathon::isManagedBy(), which answers 404 (not 403) for anyone
 * else's so other companies' hackathons are not even confirmed to exist. A
 * hackathon created here is hosted by the caller's company. A company cannot
 * feature its own hackathon — that front-page slot stays an Ops decision.
 *
 * All of the behaviour is in the ManagesHackathons concern, shared with
 * AdminHackathonController.
 */
class CompanyHackathonController extends Controller
{
    use ManagesHackathons;

    protected function manageableQuery(Request $request): Builder
    {
        return Hackathon::query()
            ->where('host_type', Hackathon::HOST_COMPANY)
            ->where('company_id', $request->user()->company_id);
    }

    protected function hostAttributesFor(Request $request): array
    {
        // An admin_company account always belongs to a company; refuse rather than create an orphaned listing.
        abort_if($request->user()->company_id === null, 403, 'This account is not linked to a company.');

        return ['host_type' => Hackathon::HOST_COMPANY, 'company_id' => $request->user()->company_id];
    }

    protected function mayFeature(Request $request): bool
    {
        return false;
    }
}
