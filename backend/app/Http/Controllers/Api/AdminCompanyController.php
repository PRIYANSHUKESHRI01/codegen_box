<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\CompanyPrepQuestion;
use App\Models\CompanyRecommendedProblem;
use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only management of the shared company catalog and
 * its prep content (overview, hiring process, previous-year questions,
 * recommended problems), plus — since every company Ops adds now
 * mandatorily gets a dashboard login — provisioning and managing that
 * company's admin_company account. TPOs and students only ever read the
 * catalog data — see TpoDriveController and StudentDriveController.
 */
class AdminCompanyController extends Controller
{
    /**
     * List every company in the catalog, for the Mellow "Placement Drives"
     * content-authoring screen — including its provisioned dashboard
     * admin(s), so Ops can see/manage login access without a second screen.
     */
    public function index()
    {
        $companies = Company::withCount(['placementDrives', 'prepQuestions', 'recommendedProblems'])
            ->with(['admins:id,name,email,company_id,is_blocked'])
            ->latest()
            ->get();

        return response()->json(['companies' => $companies]);
    }

    /**
     * Adding a company to the catalog now mandatorily provisions its
     * dashboard login in the same step — mirrors AdminController::
     * storeCollege()'s exact transaction shape (temp password, must-change
     * flag, credentials email) rather than leaving account creation as a
     * separate, easy-to-forget step.
     */
    public function store(Request $request)
    {
        $validated = $this->validateCompany($request);
        $adminValidated = $request->validate([
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
        ]);

        [$company, $admin, $temporaryPassword] = DB::transaction(function () use ($validated, $adminValidated) {
            $company = Company::create([
                ...$validated,
                'slug' => $validated['slug'] ?? Str::slug($validated['name']),
                'account_type' => Company::ACCOUNT_TYPE_HIRING_TENANT,
            ]);

            [$admin, $temporaryPassword] = $this->createAdmin($company, $adminValidated['admin_name'], $adminValidated['admin_email']);

            return [$company, $admin, $temporaryPassword];
        });

        ActivityLog::record(
            $request->user(),
            'Added a company and provisioned its dashboard login',
            'Company',
            $company->name,
            ['admin_email' => $admin->email]
        );

        SendAccountCredentialsEmail::dispatch($admin->id, $temporaryPassword);

        return response()->json(['company' => $company->fresh('admins'), 'admin' => $admin], 201);
    }

    /**
     * Editing an existing catalog company can also, optionally, provision a
     * dashboard login for it now — the path for a company that was added
     * before this account_type/admin concept existed, or one Ops simply
     * didn't provision a login for yet. A company that already has an
     * admin_company account is left untouched (no re-provisioning, no
     * accidental duplicate).
     */
    public function update(Request $request, Company $company)
    {
        $validated = $this->validateCompany($request, $company);
        $adminValidated = $request->validate([
            'admin_name' => ['nullable', 'string', 'max:255'],
            'admin_email' => ['nullable', 'string', 'email', 'max:255', 'unique:users,email'],
        ]);

        $admin = null;
        $temporaryPassword = null;

        DB::transaction(function () use (&$admin, &$temporaryPassword, $validated, $adminValidated, $company) {
            $company->update([
                ...$validated,
                'slug' => $validated['slug'] ?? $company->slug,
            ]);

            $provisionAdmin = ! empty($adminValidated['admin_name']) && ! empty($adminValidated['admin_email']);

            if ($provisionAdmin && $company->admins()->doesntExist()) {
                $company->account_type = Company::ACCOUNT_TYPE_HIRING_TENANT;
                $company->save();

                [$admin, $temporaryPassword] = $this->createAdmin($company, $adminValidated['admin_name'], $adminValidated['admin_email']);
            }
        });

        if ($admin !== null) {
            ActivityLog::record(
                $request->user(),
                'Provisioned a dashboard login for an existing company',
                'Company',
                $company->name,
                ['admin_email' => $admin->email]
            );

            SendAccountCredentialsEmail::dispatch($admin->id, $temporaryPassword);
        }

        return response()->json(['company' => $company->fresh('admins')]);
    }

    /**
     * Assign, change or renew a company hiring tenant's plan — always
     * admin-triggered, same convention as AdminController::
     * assignCollegeSubscription() (a company "buys the dashboard" through a
     * sales conversation, never a self-serve checkout). Kept as its own
     * deliberate action rather than folded into store(): unlike a college
     * (whose tier IS its plan, chosen at onboarding), a company has no
     * tier-equivalent to default a plan from.
     */
    public function assignSubscription(Request $request, Company $company, SubscriptionService $subscriptionService)
    {
        $validated = $request->validate([
            'plan_code' => ['required', 'string', 'exists:plans,code'],
        ]);

        $plan = Plan::where('code', $validated['plan_code'])->first();

        if ($plan->audience !== Plan::AUDIENCE_COMPANY) {
            return response()->json(['message' => 'That plan is not a company hiring plan.'], 422);
        }

        $subscription = $subscriptionService->assignCompanyPlan($company, $plan, $request->user());

        return response()->json([
            'company' => $company->fresh(),
            'subscription' => [
                'plan' => ['code' => $plan->code, 'name' => $plan->name],
                'days_remaining' => $subscription->daysRemaining(),
                'started_at' => $subscription->started_at,
                'current_period_end' => $subscription->current_period_end,
            ],
        ]);
    }

    /**
     * Block or unblock a company's dashboard admin account. Mirrors
     * AdminController::toggleTpoBlock()'s shape, inlined here rather than
     * shared (that controller's own toggleBlock() helper is private to it).
     */
    public function toggleAdminBlock(Request $request, User $user)
    {
        if ($user->role !== User::ROLE_ADMIN_COMPANY) {
            return response()->json(['message' => 'This endpoint only manages company hiring tenant admin accounts.'], 422);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $user->is_blocked = ! $user->is_blocked;
        $user->blocked_at = $user->is_blocked ? now() : null;
        $user->blocked_reason = $user->is_blocked ? ($validated['reason'] ?? null) : null;
        $user->blocked_by = $user->is_blocked ? $request->user()->id : null;
        $user->save();

        ActivityLog::record(
            $request->user(),
            $user->is_blocked ? 'Blocked an account' : 'Unblocked an account',
            'User',
            $user->name,
            array_filter(['role' => $user->role, 'reason' => $validated['reason'] ?? null])
        );

        return response()->json(['admin' => $user->fresh('company')]);
    }

    /** @return array{0: User, 1: string} */
    private function createAdmin(Company $company, string $name, string $email): array
    {
        $temporaryPassword = Str::password(16);

        $admin = User::create([
            'name' => $name,
            'email' => $email,
            'handle' => Str::slug($name).'-'.Str::lower(Str::random(4)),
            'password' => Hash::make($temporaryPassword),
            'must_change_password' => true,
            'role' => User::ROLE_ADMIN_COMPANY,
            'company_id' => $company->id,
        ]);

        return [$admin, $temporaryPassword];
    }

    public function prepQuestions(Company $company)
    {
        return response()->json([
            'prep_questions' => $company->prepQuestions()->orderByDesc('asked_year')->orderBy('display_order')->get(),
        ]);
    }

    public function storePrepQuestion(Request $request, Company $company)
    {
        $validated = $request->validate([
            'asked_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'category' => ['required', Rule::in(CompanyPrepQuestion::CATEGORIES)],
            'round_name' => ['nullable', 'string', 'max:255'],
            'question' => ['required', 'string'],
            'answer_notes' => ['nullable', 'string'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $prepQuestion = $company->prepQuestions()->create($validated);

        return response()->json(['prep_question' => $prepQuestion], 201);
    }

    /**
     * Prep questions are low-stakes leaf rows with no dependents, so unlike
     * companies/drives (soft state only — see PlacementDrive::status /
     * Company::is_active) a hard delete here is safe.
     */
    public function destroyPrepQuestion(CompanyPrepQuestion $prepQuestion)
    {
        $prepQuestion->delete();

        return response()->json(['message' => 'Prep question deleted.']);
    }

    public function recommendedProblems(Company $company)
    {
        return response()->json([
            'recommended_problems' => $company->recommendedProblems()->orderBy('priority')->get(),
        ]);
    }

    public function storeRecommendedProblem(Request $request, Company $company)
    {
        $validated = $request->validate([
            'problem_slug' => ['required', 'string', 'max:255'],
            'topic_tag' => ['nullable', 'string', 'max:255'],
            'priority' => ['nullable', 'integer', 'min:0'],
        ]);

        if ($company->recommendedProblems()->where('problem_slug', $validated['problem_slug'])->exists()) {
            return response()->json(['message' => 'This problem is already recommended for this company.'], 422);
        }

        $recommendedProblem = $company->recommendedProblems()->create($validated);

        return response()->json(['recommended_problem' => $recommendedProblem], 201);
    }

    public function destroyRecommendedProblem(CompanyRecommendedProblem $recommendedProblem)
    {
        $recommendedProblem->delete();

        return response()->json(['message' => 'Recommended problem removed.']);
    }

    private function validateCompany(Request $request, ?Company $company = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', Rule::unique('companies', 'slug')->ignore($company?->id)],
            'logo' => ['nullable', 'string', 'max:8'],
            'website_url' => ['nullable', 'string', 'max:255', 'url'],
            'industry' => ['nullable', 'string', 'max:255'],
            'overview' => ['nullable', 'string'],
            'hiring_process' => ['nullable', 'array'],
            'hiring_process.*.name' => ['required', 'string', 'max:255'],
            'hiring_process.*.description' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }
}
