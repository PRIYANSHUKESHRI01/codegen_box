<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Add-on bundle pricing
    |--------------------------------------------------------------------------
    |
    | Prices themselves live on the `plans` rows (PlanSeeder), because that is
    | what a payment gateway SKU maps to. The only pricing RULE that is not a
    | plan row is the bundle discount: percent taken off an add-on's list
    | price when the buyer is (or in the same checkout becomes) a paying
    | subscriber of a PAID base plan. Project Lab at 499 therefore costs 349
    | next to Expert or Grandmaster, so Expert + Lab = 748 instead of 898.
    |
    | Rounded to whole rupees. Set to 0 to switch bundle pricing off.
    */
    'addon_bundle_discount_percent' => (int) env('BILLING_ADDON_BUNDLE_DISCOUNT_PERCENT', 30),

    'currency' => 'INR',

];
