<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContactRequest;
use App\Services\ContactRequestService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The public "Talk to Our Team" form's only entry point — unauthenticated,
 * rate-limited (see AppServiceProvider's 'contact-request' limiter). Never
 * creates a user account; see ContactRequest's own docblock for why.
 */
class ContactRequestController extends Controller
{
    public function store(Request $request, ContactRequestService $service)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'audience' => ['required', Rule::in([ContactRequest::AUDIENCE_INSTITUTION, ContactRequest::AUDIENCE_COMPANY])],
            'organization_name' => ['required', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        $service->submit($validated);

        return response()->json([
            'message' => "Thanks — we'll be in touch shortly.",
        ], 201);
    }
}
