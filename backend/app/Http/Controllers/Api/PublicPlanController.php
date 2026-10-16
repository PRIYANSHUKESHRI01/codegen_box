<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The individual plans' live prices and what each includes — the one
 * unauthenticated read the pricing page needs, so a visitor sees exactly what
 * the superadmin has set (Superadmin → Plans & Pricing) without a redeploy.
 *
 * Nothing here is secret: the prices are already on the public page, and the
 * entitlement summary is the same list of what a plan includes. It is read
 * straight from the plans table on every request (three rows — cheaper than a
 * cache lookup on the database cache driver, and it can never be stale), and is
 * served with an ETag and `must-revalidate` so the pricing page can poll it
 * every few seconds and get a body-less 304 while nothing has changed.
 *
 * What the browser is charged is NOT decided from this response: checkout
 * re-prices on the server (PurchaseQuoteService) and refuses a price the buyer
 * did not see.
 */
class PublicPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $plans = Plan::individualBase()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        $response = response()->json([
            'currency' => config('billing.currency', 'INR'),
            'plans' => $plans->map(fn (Plan $plan) => $plan->pricing() + ['entitlements' => $plan->entitlementSummary()])->values(),
        ]);

        // Always revalidated, never served stale: this is a live price list, and a browser or proxy
        // that kept a copy for even a few seconds would show a price the superadmin already changed
        // (and would answer the "prices just changed, re-read now" refresh from its own cache). The ETag
        // is what makes revalidating cheap — an unchanged list costs an empty 304.
        $response->setEtag(md5((string) $response->getContent()));
        $response->setPublic();
        $response->setMaxAge(0);
        $response->headers->addCacheControlDirective('must-revalidate');
        $response->isNotModified($request);

        return $response;
    }
}
