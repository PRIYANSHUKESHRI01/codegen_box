<?php

use App\Http\Controllers\Api\AdminArticleController;
use App\Http\Controllers\Api\AdminArticleTopicController;
use App\Http\Controllers\Api\AdminCompanyController;
use App\Http\Controllers\Api\AdminContestController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminHackathonController;
use App\Http\Controllers\Api\AdminStudentReportController;
use App\Http\Controllers\Api\AdminInterviewController;
use App\Http\Controllers\Api\AdminInterviewQuestionBankController;
use App\Http\Controllers\Api\AdminInterviewRoleTemplateController;
use App\Http\Controllers\Api\AdminInterviewTrackController;
use App\Http\Controllers\Api\AdminPlacementDriveController;
use App\Http\Controllers\Api\AdminProblemController;
use App\Http\Controllers\Api\AdminSoftSkillController;
use App\Http\Controllers\Api\AdminSoftSkillQuestionBankController;
use App\Http\Controllers\Api\AdminVaultController;
use App\Http\Controllers\Api\AdminMockInterviewQuestionController;
use App\Http\Controllers\Api\AdminVaultQuestionController;
use App\Http\Controllers\Api\ArticleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CheckoutController;
use App\Http\Controllers\Api\ContestController;
use App\Http\Controllers\Api\ContestProctoringController;
use App\Http\Controllers\Api\GuardianController;
use App\Http\Controllers\Api\IntegrityController;
use App\Http\Controllers\Api\IntegrityReviewController;
use App\Http\Controllers\Api\ContestSubmissionController;
use App\Http\Controllers\Api\CompanyCandidateController;
use App\Http\Controllers\Api\CompanyCollegeController;
use App\Http\Controllers\Api\CompanyContestController;
use App\Http\Controllers\Api\CompanyDriveController;
use App\Http\Controllers\Api\CompanyHackathonController;
use App\Http\Controllers\Api\CompanyInterviewController;
use App\Http\Controllers\Api\CompanyInterviewRoleTemplateController;
use App\Http\Controllers\Api\CompanyInterviewTrackController;
use App\Http\Controllers\Api\CompanyPrepController;
use App\Http\Controllers\Api\CompanyProctoringController;
use App\Http\Controllers\Api\CompanyReportsController;
use App\Http\Controllers\Api\CompanySoftSkillController;
use App\Http\Controllers\Api\CompanyVaultController;
use App\Http\Controllers\Api\ContactRequestController;
use App\Http\Controllers\Api\CoordinatorNoteController;
use App\Http\Controllers\Api\CoordinatorProctoringController;
use App\Http\Controllers\Api\CoordinatorStudentController;
use App\Http\Controllers\Api\CoordinatorStudentReportController;
use App\Http\Controllers\Api\HackathonArenaController;
use App\Http\Controllers\Api\InterviewController;
use App\Http\Controllers\Api\InterviewSpeechController;
use App\Http\Controllers\Api\InterviewProctoringController;
use App\Http\Controllers\Api\InterviewQuestionBankController;
use App\Http\Controllers\Api\DrillController;
use App\Http\Controllers\Api\StudySittingController;
use App\Http\Controllers\Api\PracticeInterviewController;
use App\Http\Controllers\Api\CuratedInterviewSetController;
use App\Http\Controllers\Api\MockInterviewController;
use App\Http\Controllers\Api\VaultInterviewQualificationController;
use App\Http\Controllers\Api\InterviewQuestionGenerationController;
use App\Http\Controllers\Api\InterviewTrackController;
use App\Http\Controllers\Api\InternalCustomerController;
use App\Http\Controllers\Api\JudgeResultController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\LearningCentreController;
use App\Http\Controllers\Api\ListeningLabController;
use App\Http\Controllers\Api\MarketingContactRequestController;
use App\Http\Controllers\Api\MarketingLeadController;
use App\Http\Controllers\Api\MySubmissionsController;
use App\Http\Controllers\Api\EmailPreferenceController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PhoneVerificationController;
use App\Http\Controllers\Api\ProblemController;
use App\Http\Controllers\Api\AdminProjectLabController;
use App\Http\Controllers\Api\ProjectLabController;
use App\Http\Controllers\Api\ProjectWorkspaceController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\AdminCoreImportController;
use App\Http\Controllers\Api\AdminCoreTestController;
use App\Http\Controllers\Api\CoreTestProctoringController;
use App\Http\Controllers\Api\StudentCoreController;
use App\Http\Controllers\Api\TpoCoreInsightsController;
use App\Http\Controllers\Api\TpoCoreTestController;
use App\Http\Controllers\Api\AdminCoreQuestionController;
use App\Http\Controllers\Api\AdminCoreTaxonomyController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CollegeDepartmentController;
use App\Http\Controllers\Api\PublicPlanController;
use App\Http\Controllers\Api\SuperAdminBranchController;
use App\Http\Controllers\Api\SuperAdminDepartmentController;
use App\Http\Controllers\Api\TpoBranchController;
use App\Http\Controllers\Api\PayuReturnController;
use App\Http\Controllers\Api\PayuWebhookController;
use App\Http\Controllers\Api\RazorpayWebhookController;
use App\Http\Controllers\Api\SoftSkillController;
use App\Http\Controllers\Api\SoftSkillProctoringController;
use App\Http\Controllers\Api\SpeakingPracticeController;
use App\Http\Controllers\Api\StudentDriveController;
use App\Http\Controllers\Api\StudentImportController;
use App\Http\Controllers\Api\StudentPreferencesController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\StudentStatsController;
use App\Http\Controllers\Api\StudentVaultController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SuperAdminAccountController;
use App\Http\Controllers\Api\SuperAdminCollegeController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\SuperAdminMarketingTeamController;
use App\Http\Controllers\Api\SuperAdminPlatformModuleController;
use App\Http\Controllers\Api\SuperAdminCredentialController;
use App\Http\Controllers\Api\SuperAdminPaymentController;
use App\Http\Controllers\Api\SuperAdminReadinessController;
use App\Http\Controllers\Api\SuperAdminVaultAiController;
use App\Http\Controllers\Api\SuperAdminPlanController;
use App\Http\Controllers\Api\SuperAdminSubscriptionController;
use App\Http\Controllers\Api\TpoContestController;
use App\Http\Controllers\Api\TpoCoordinatorController;
use App\Http\Controllers\Api\TpoInterviewController;
use App\Http\Controllers\Api\TpoInterviewRoleTemplateController;
use App\Http\Controllers\Api\TpoInterviewTrackController;
use App\Http\Controllers\Api\TpoDriveApplicationController;
use App\Http\Controllers\Api\TpoDriveController;
use App\Http\Controllers\Api\TpoProctoringController;
use App\Http\Controllers\Api\TpoExamNetworkController;
use App\Http\Controllers\Api\TpoReportsController;
use App\Http\Controllers\Api\TpoSoftSkillController;
use App\Http\Controllers\Api\TpoStudentController;
use App\Http\Controllers\Api\TpoStudentNoteController;
use App\Http\Controllers\Api\TpoStudentReportController;
use App\Http\Controllers\Api\VaultIntegrationController;
use App\Http\Controllers\Api\VocabularyController;
use App\Http\Controllers\Api\VocabularyProgressController;
use App\Http\Controllers\Api\SSOController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// MellowVault 1-Click Single Sign-On (SSO)
Route::get('/sso/login', [SSOController::class, 'handleSSOLogin'])->name('sso.login');

// The AptRun Guardian (the Windows desktop agent that watches the operating system during a proctored attempt). It is a
// separate program with its own credentials, so these sit outside the student login: pairing redeems a one-time code, and
// every report after that carries a bearer token AND an Ed25519 signature. See App\Services\Integrity\GuardianService.
Route::get('/guardian/download', [GuardianController::class, 'download'])->middleware('throttle:guardian-download');
Route::post('/guardian/pair', [GuardianController::class, 'pair'])->middleware('throttle:guardian-pair');
Route::post('/guardian/beat', [GuardianController::class, 'beat'])->middleware('throttle:guardian-beat');
Route::post('/guardian/unpair', [GuardianController::class, 'unpair'])->middleware('throttle:guardian-beat');

// The public marketing site's "Talk to Our Team" form — unauthenticated,
// never creates a user account (see ContactRequest's own docblock for why).
Route::post('/contact-requests', [ContactRequestController::class, 'store'])
    ->middleware('throttle:contact-request');

// The public footer's newsletter signup — unauthenticated, its own tiny surface.
Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe'])
    ->middleware('throttle:newsletter-subscribe');

// The unsubscribe page behind the link in every nudge e-mail (and its List-Unsubscribe header). Signed, not
// authenticated: the person is reading an e-mail, not using the app. GET only shows the state; POST changes it.
Route::middleware(['signed', 'throttle:30,1'])->group(function () {
    Route::get('/email/preferences/{user}', [EmailPreferenceController::class, 'show'])->name('email.preferences');
    Route::post('/email/preferences/{user}', [EmailPreferenceController::class, 'update']);
});

// The only unauthenticated data reads in this API — the public marketing
// landing page's real-numbers Stats section and Problem Explorer/navbar
// search preview. See PublicController's own docblock for exactly what's
// safe to expose here (aggregate counts + non-sensitive problem fields
// only, never a hidden test case).
Route::prefix('public')->middleware('throttle:60,1')->group(function () {
    Route::get('/stats', [PublicController::class, 'stats']);
    Route::get('/problems/sample', [PublicController::class, 'sampleProblems']);
    // The branch catalogue (names/codes only) every branch picker reads.
    Route::get('/branches', [BranchController::class, 'index']);
});

// The pricing page's live price list. Its own named limiter, not the 60/min group above: the
// page polls it every few seconds, and a campus lab shares one IP across a whole class.
Route::get('/public/plans', [PublicPlanController::class, 'index'])->middleware('throttle:public-plans');

// Razorpay → us: payments, failures and refunds, whether or not the student's browser is still open.
// Unauthenticated by design; the HMAC signature over the raw body is the credential (see
// RazorpayWebhookController). Outside the throttled `public` group: a bursty sender must not be
// 429'd into a retry storm, so it has its own generous per-IP limiter.
Route::post('/webhooks/razorpay', RazorpayWebhookController::class)->middleware('throttle:payment-webhook');

// PayU → us, same idea: payment events carry PayU's response hash, refund/dispute events are unsigned
// (the optional ?token= secret + PayU's own API are what vet those — see PayuWebhookController).
Route::post('/webhooks/payu', PayuWebhookController::class)->middleware('throttle:payment-webhook');

// PayU's hosted page sending the STUDENT'S BROWSER back after paying / failing / cancelling (a form POST,
// so no login token — the signed transaction is the credential). Always answers with a redirect into the
// app; see PayuReturnController. GET is accepted only to bounce a stray visit to the billing page.
Route::match(['get', 'post'], '/payu/return', PayuReturnController::class)->middleware('throttle:payment-return');

// Mellow Vault → us: the pull API a Mellow Vault can reconcile against, the resume download for a listed
// student, and the "this student was hired" callback. Not a user's session: a shared bearer key (VAULT_API_KEY)
// is the credential, and with none configured every route here answers 503 (see AuthenticateVaultIntegration).
// The other direction — AptRun pushing profile.upsert / profile.withdraw — is the `vault:sync` command.
Route::prefix('vault/v1')
    ->middleware(['vault.integration', 'throttle:vault-integration'])
    ->group(function () {
        Route::get('/ping', [VaultIntegrationController::class, 'ping']);
        Route::get('/profiles', [VaultIntegrationController::class, 'index']);
        Route::get('/profiles/{profile:public_id}', [VaultIntegrationController::class, 'show']);
        Route::get('/profiles/{profile:public_id}/resume', [VaultIntegrationController::class, 'resume']);
        Route::post('/profiles/{profile:public_id}/status', [VaultIntegrationController::class, 'status']);
    });

Route::prefix('password')->group(function () {
    Route::post('/forgot', [PasswordResetController::class, 'forgot'])
        ->middleware('throttle:password-reset-request');
    Route::post('/otp/verify', [PasswordResetController::class, 'verifyOtp'])
        ->middleware('throttle:password-reset-verify');
    Route::post('/reset', [PasswordResetController::class, 'reset'])
        ->middleware('throttle:password-reset-verify');
});

// Every signed-in request also passes two guards that read the account itself: a blocked
// account is refused at once (not just at its next login), and a superadmin's "view as"
// session may only read. See each middleware for the reasoning.
Route::middleware(['auth:sanctum', 'account.active', 'not.impersonating'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Self-service account management — every role's shared Settings page.
    // Scoped entirely to $request->user(), so no role middleware is needed.
    Route::put('/me/profile', [AuthController::class, 'updateProfile']);
    Route::put('/me/password', [AuthController::class, 'updatePassword']);
    Route::post('/me/phone/verify', [PhoneVerificationController::class, 'verify'])->middleware('throttle:phone-verify');
    Route::post('/me/avatar', [AuthController::class, 'updateAvatar']);
    Route::delete('/me/avatar', [AuthController::class, 'deleteAvatar']);
    Route::get('/me/sessions', [AuthController::class, 'sessions']);
    Route::delete('/me/sessions/{tokenId}', [AuthController::class, 'revokeSession']);

    // The recruiter-ready profile extension (bio/links/skills/resume) —
    // student-only, see StudentProfileController's docblock on why this is
    // a separate controller from AuthController::updateProfile() above.
    Route::put('/me/student-profile', [StudentProfileController::class, 'update']);
    Route::post('/me/resume', [StudentProfileController::class, 'uploadResume']);
    Route::delete('/me/resume', [StudentProfileController::class, 'deleteResume']);
    Route::get('/me/resume', [StudentProfileController::class, 'downloadOwnResume']);

    // First-login onboarding + the preferences it collects (primary language,
    // skill level, goal, focus, pace) — student-only; see
    // StudentPreferencesController. The same answers are edited later from
    // Settings via PUT /me/preferences.
    Route::post('/me/onboarding', [StudentPreferencesController::class, 'complete']);
    Route::post('/me/onboarding/skip', [StudentPreferencesController::class, 'skip']);
    Route::put('/me/preferences', [StudentPreferencesController::class, 'update']);
    // The branch question: state your branch + what to lead with, ask later, or flag the college's label as wrong.
    Route::put('/me/branch', [StudentPreferencesController::class, 'branch']);
    Route::post('/me/branch/skip', [StudentPreferencesController::class, 'skipBranch']);
    Route::post('/me/branch/dispute', [StudentPreferencesController::class, 'disputeBranch']);
    Route::get('/me/language-insights', [StudentPreferencesController::class, 'languageInsights']);

    // Settings → Billing, and the /pricing page when signed in. mine()
    // branches internally per role (student's own/college coverage, TPO's
    // college, or "internal" for staff) — subscribe() further restricts
    // itself to role:user, so no route-level role middleware is needed here.
    Route::get('/me/subscription', [SubscriptionController::class, 'mine']);
    // A few bytes saying whether the plan changed, polled by every open dashboard — so a plan a
    // superadmin grants or cancels shows up on the student's screen within seconds. Deliberately
    // far cheaper than /me/subscription (no usage counts, no gateway call).
    Route::get('/me/plan-signal', [SubscriptionController::class, 'signal'])->middleware('throttle:plan-signal');
    // Live price of a cart — the same service prices the real checkout below.
    Route::get('/me/purchase-quote', [SubscriptionController::class, 'quote']);

    // In-app notifications (the bell) — every role, scoped to the caller. `signal` is what open tabs poll every
    // ~15 s: unread count + newest id, one aggregate query. See NotificationController.
    Route::prefix('notifications')->group(function () {
        Route::get('/signal', [NotificationController::class, 'signal'])->middleware('throttle:notification-signal');
        Route::get('/', [NotificationController::class, 'index'])->middleware('throttle:notifications');
        Route::get('/preferences', [NotificationController::class, 'preferences'])->middleware('throttle:notifications');
        Route::put('/preferences', [NotificationController::class, 'updatePreferences'])->middleware('throttle:notifications');
        Route::post('/read-all', [NotificationController::class, 'markAllRead'])->middleware('throttle:notifications');
        Route::delete('/read', [NotificationController::class, 'clearRead'])->middleware('throttle:notifications');
        Route::post('/{id}/read', [NotificationController::class, 'markRead'])->whereNumber('id')->middleware('throttle:notifications');
        Route::delete('/{id}', [NotificationController::class, 'destroy'])->whereNumber('id')->middleware('throttle:notifications');
    });

    // Paying for a plan (PayU hosted checkout — docs/payments-payu.md — or Razorpay Standard Checkout —
    // docs/payments-razorpay.md; config billing.gateway picks). There is no route that activates a paid plan
    // without a verified payment: /me/checkout opens an order on the active gateway, PayU's browser return
    // (/payu/return) or Razorpay's signed /me/checkout/verify callback reports the result, and the webhooks +
    // reconcile job are the safety nets behind them. Student-only (CheckoutController refuses everyone else).
    Route::post('/me/checkout', [CheckoutController::class, 'create'])->middleware('throttle:checkout-create');
    // A plan the superadmin has discounted by 100% is claimed here instead — no gateway, no payment (OfferRedemptionService).
    Route::post('/me/checkout/redeem', [CheckoutController::class, 'redeem'])->middleware('throttle:checkout-redeem');
    Route::post('/me/checkout/verify', [CheckoutController::class, 'verify'])->middleware('throttle:checkout-verify');
    Route::get('/me/payments', [CheckoutController::class, 'index']);
    Route::get('/me/payments/{publicId}', [CheckoutController::class, 'show'])->middleware('throttle:checkout-status');

    // Mellow-internal-staff-only: manage partner colleges and their TPO
    // accounts. A logged-in admin_tpo user gets a 403 from every route in
    // this group, so the Mellow dashboard is unreachable to them server-side.
    Route::middleware('role:'.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_SUPERADMIN)
        ->prefix('admin')
        ->group(function () {
            // Real, harmless aggregate counts — every admin_internal account
            // sees this regardless of granular permissions (superadmin
            // decides *management* access per section below, not whether an
            // employee can see the platform-wide pulse at all).
            Route::get('/overview', [AdminController::class, 'overview']);

            // Each sub-group below requires the matching granular
            // permission (see User::hasPermission / EnsureUserHasPermission)
            // on top of the role check above — a superadmin always passes
            // every one of these regardless of their own `permissions`
            // column, which is only ever populated for admin_internal/
            // admin_marketing accounts.
            Route::middleware('permission:'.User::PERM_COLLEGES)->group(function () {
                Route::get('/colleges', [AdminController::class, 'colleges']);
                Route::post('/colleges', [AdminController::class, 'storeCollege']);
                Route::get('/colleges/{college}/tpos', [AdminController::class, 'collegeTpos']);
                Route::post('/tpos/{user}/toggle-block', [AdminController::class, 'toggleTpoBlock']);

                // Section Coordinator management on any college's behalf —
                // the support/onboarding escape hatch TpoCoordinatorController's
                // own admin_tpo-only routes can't provide to staff accounts
                // (they have no college_id of their own to scope by).
                Route::get('/colleges/{college}/coordinators', [AdminController::class, 'collegeCoordinators']);
                Route::post('/colleges/{college}/coordinators', [AdminController::class, 'storeCoordinatorForCollege']);
                Route::put('/coordinators/{user}', [AdminController::class, 'updateCoordinatorSection']);
                Route::post('/coordinators/{user}/toggle-block', [AdminController::class, 'toggleCoordinatorBlock']);

                // Institutional plans are admin-assigned (a college "buys the
                // whole sandbox" through a sales conversation) rather than
                // self-serve — see SubscriptionService::assignInstitutionPlan.
                Route::post('/colleges/{college}/subscription', [AdminController::class, 'assignCollegeSubscription']);

                // Real-time seat-count tweak, distinct from the full
                // subscription (re)assignment above — see
                // SubscriptionService::adjustSeatLimit() for why this never
                // resets a renewal date or a demo countdown.
                Route::put('/colleges/{college}/seats', [AdminController::class, 'adjustCollegeSeats']);

                // White-glove path: Mellow staff run the same bulk student
                // import on a college's behalf (e.g. they emailed us their
                // spreadsheet instead of uploading it themselves) — part of
                // the same college-management workflow, same permission.
                // Which departments (Engineering, Management, Commerce, Arts …) the college runs.
                Route::get('/colleges/{college}/departments', [CollegeDepartmentController::class, 'showForCollege']);
                Route::put('/colleges/{college}/departments', [CollegeDepartmentController::class, 'updateForCollege']);

                Route::get('/students/import-template', [StudentImportController::class, 'template']);
                Route::post('/colleges/{college}/students/import', [StudentImportController::class, 'storeForCollege']);
                Route::get('/colleges/{college}/students/imports', [StudentImportController::class, 'indexForCollege']);
                Route::get('/colleges/{college}/students/imports/{studentImport}', [StudentImportController::class, 'showForCollege']);
            });

            Route::middleware('permission:'.User::PERM_PLATFORM_USERS)->group(function () {
                Route::get('/users', [AdminController::class, 'users']);
                Route::post('/users', [AdminController::class, 'storeUser']);
                Route::post('/users/{user}/toggle-block', [AdminController::class, 'toggleUserBlock']);

                // Same student report TpoStudentReportController exposes to a
                // student's own college TPO, reachable here for any student
                // platform-wide — Platform Users' own "View Report" action.
                Route::get('/students/{student}/report', [AdminStudentReportController::class, 'show']);
                Route::get('/students/{student}/submissions/{submission}', [AdminStudentReportController::class, 'submission']);
                Route::get('/students/{student}/contest-submissions/{contestSubmission}', [AdminStudentReportController::class, 'contestSubmission']);
            });

            Route::middleware('permission:'.User::PERM_PLACEMENTS)->group(function () {
                // Shared placement catalog: companies + their prep content, and
                // the drives scheduled against them. TPOs map into this catalog
                // (see the tpo/ group below) rather than authoring it themselves.
                Route::get('/companies', [AdminCompanyController::class, 'index']);
                Route::post('/companies', [AdminCompanyController::class, 'store']);
                Route::post('/companies/{company}', [AdminCompanyController::class, 'update']);
                Route::get('/companies/{company}/prep-questions', [AdminCompanyController::class, 'prepQuestions']);
                Route::post('/companies/{company}/prep-questions', [AdminCompanyController::class, 'storePrepQuestion']);
                Route::delete('/prep-questions/{prepQuestion}', [AdminCompanyController::class, 'destroyPrepQuestion']);
                Route::get('/companies/{company}/recommended-problems', [AdminCompanyController::class, 'recommendedProblems']);
                Route::post('/companies/{company}/recommended-problems', [AdminCompanyController::class, 'storeRecommendedProblem']);
                Route::delete('/recommended-problems/{recommendedProblem}', [AdminCompanyController::class, 'destroyRecommendedProblem']);

                // Every company Ops adds now mandatorily provisions its own
                // admin_company dashboard login (see AdminCompanyController::
                // store()) — this replaced a separate storeCompanyTenant()
                // onboarding flow that used to live under its own permission.
                Route::post('/companies/{company}/subscription', [AdminCompanyController::class, 'assignSubscription']);
                Route::post('/companies/admins/{user}/toggle-block', [AdminCompanyController::class, 'toggleAdminBlock']);

                Route::get('/placement-drives', [AdminPlacementDriveController::class, 'index']);
                Route::post('/placement-drives', [AdminPlacementDriveController::class, 'store']);
                Route::post('/placement-drives/{placementDrive}', [AdminPlacementDriveController::class, 'update']);

                // Mellow proactively proposing a drive to specific colleges —
                // distinct from the tpo/ group's self-service map(), since a
                // push like this needs the receiving college's consent first
                // (see TpoDriveController::pending()/respond()).
                Route::get('/partner-colleges', [AdminPlacementDriveController::class, 'partnerColleges']);
                Route::get('/placement-drives/{placementDrive}/mappings', [AdminPlacementDriveController::class, 'mappings']);
                Route::post('/placement-drives/{placementDrive}/map-colleges', [AdminPlacementDriveController::class, 'mapColleges']);
            });

            Route::middleware('permission:'.User::PERM_CONTESTS)->group(function () {

                // Exam integrity review: risk, the tamper-evident timeline, network and the encrypted evidence stills. What a
                // caller can see is decided by IntegrityReport::scopeFor() from their role (404, never 403, outside it).
                Route::get('/integrity', [IntegrityReviewController::class, 'index']);
                Route::get('/integrity/{uuid}', [IntegrityReviewController::class, 'show']);
                Route::get('/integrity/{uuid}/evidence/{evidence}', [IntegrityReviewController::class, 'evidence'])->whereNumber('evidence');
                // Contests are platform-run and centrally curated by Mellow
                // staff — never auto-generated, same as companies/drives above.
                Route::get('/contests', [AdminContestController::class, 'index']);
                Route::post('/contests', [AdminContestController::class, 'store']);
                Route::post('/contests/{contest}', [AdminContestController::class, 'update']);
                Route::get('/contests/{contest}/problems', [AdminContestController::class, 'problems']);
                Route::post('/contests/{contest}/problems', [AdminContestController::class, 'storeProblem']);
                Route::delete('/contests/{contest}/problems/{contestProblem}', [AdminContestController::class, 'destroyProblem']);
                Route::post('/contests/{contest}/colleges', [AdminContestController::class, 'updateColleges']);
                Route::post('/contests/{contest}/finalize', [AdminContestController::class, 'finalize']);

                // Contest report — see TpoContestController's mirror for the
                // full rationale. Platform-wide here, including oversight of
                // a college's own tpo_mock contest.
                Route::get('/contests/{contest}/participants', [AdminContestController::class, 'participants']);
                Route::get('/contests/{contest}/participants/{student}/submissions', [AdminContestController::class, 'participantSubmissions']);
            });

            Route::middleware('permission:'.User::PERM_INTERVIEWS)->group(function () {
                // AI Interviews — Mellow-curated general/company types only.
                // TPO/company each own their own types via their respective
                // controllers below (see AdminInterviewController's docblock).
                Route::get('/interviews', [AdminInterviewController::class, 'index']);
                Route::post('/interviews', [AdminInterviewController::class, 'store']);
                Route::post('/interviews/{interview}', [AdminInterviewController::class, 'update']);
                Route::delete('/interviews/{interview}', [AdminInterviewController::class, 'destroy']);
                Route::get('/interviews/{interview}/questions', [AdminInterviewController::class, 'questions']);
                Route::post('/interviews/{interview}/questions', [AdminInterviewController::class, 'storeQuestion']);
                Route::delete('/interviews/{interview}/questions/{interviewQuestion}', [AdminInterviewController::class, 'destroyQuestion']);
                Route::post('/interviews/{interview}/colleges', [AdminInterviewController::class, 'updateColleges']);

                // The Mock AI Interview question bank (domain -> stack -> 3 rounds): which stacks have questions, and the tools to fill them.
                Route::get('/mock-interview-bank/coverage', [AdminMockInterviewQuestionController::class, 'coverage']);
                Route::get('/mock-interview-bank/stacks/{stack}', [AdminMockInterviewQuestionController::class, 'show']);
                Route::post('/mock-interview-bank/rounds/{roundId}/questions', [AdminMockInterviewQuestionController::class, 'store']);
                Route::put('/mock-interview-bank/questions/{question}', [AdminMockInterviewQuestionController::class, 'update']);
                Route::delete('/mock-interview-bank/questions/{question}', [AdminMockInterviewQuestionController::class, 'destroy']);
                Route::get('/mock-interview-bank/template', [AdminMockInterviewQuestionController::class, 'template']);
                Route::post('/mock-interview-bank/import', [AdminMockInterviewQuestionController::class, 'import'])->middleware('throttle:20,1');

                Route::get('/interview-question-bank', [AdminInterviewQuestionBankController::class, 'index']);
                Route::post('/interview-question-bank', [AdminInterviewQuestionBankController::class, 'store']);
                Route::post('/interview-question-bank/{interviewQuestionBank}', [AdminInterviewQuestionBankController::class, 'update']);

                // Ops's own candidate-review queue for general/company
                // interviews — previously unneeded (nothing here was ever
                // reviewed candidate-by-candidate) until track rounds needed
                // it. A reviewer's per-response score + the finalize action
                // that computes a session's weighted composite and, if it
                // clears the round's threshold, auto-invites the candidate
                // into the next round — see InterviewTrackAdvancementService.
                Route::get('/interviews/{interview}/sessions', [AdminInterviewController::class, 'sessions']);
                Route::get('/interviews/{interview}/sessions/{interviewSession}/responses', [AdminInterviewController::class, 'responses']);
                Route::get('/interviews/{interview}/responses/{interviewResponse}/audio', [AdminInterviewController::class, 'responseAudio']);
                Route::post('/interviews/{interview}/sessions/{interviewSession}/reinstate', [AdminInterviewController::class, 'reinstateProctoring']);
                Route::post('/interviews/{interview}/responses/{interviewResponse}/score', [AdminInterviewController::class, 'scoreResponse']);
                Route::post('/interviews/{interview}/sessions/{interviewSession}/finalize', [AdminInterviewController::class, 'finalizeSession']);

                // Reusable role definitions (e.g. "Backend Developer —
                // Laravel & Next.js") driving consistent AI question
                // generation + scoring weights across an Interview Track's 3
                // rounds — see App\Models\InterviewRoleTemplate.
                Route::get('/interview-role-templates', [AdminInterviewRoleTemplateController::class, 'index']);
                Route::post('/interview-role-templates', [AdminInterviewRoleTemplateController::class, 'store']);
                Route::post('/interview-role-templates/{interviewRoleTemplate}', [AdminInterviewRoleTemplateController::class, 'update']);

                // The "Final Interview" 3-round pipeline container — see
                // AdminInterviewTrackController's docblock. Each round itself
                // is managed through the plain /interviews routes above.
                Route::get('/interview-tracks', [AdminInterviewTrackController::class, 'index']);
                Route::post('/interview-tracks', [AdminInterviewTrackController::class, 'store']);
                Route::post('/interview-tracks/{interviewTrack}', [AdminInterviewTrackController::class, 'update']);
                Route::delete('/interview-tracks/{interviewTrack}', [AdminInterviewTrackController::class, 'destroy']);
                Route::post('/interview-tracks/{interviewTrack}/colleges', [AdminInterviewTrackController::class, 'updateColleges']);
            });

            Route::middleware('permission:'.User::PERM_PROJECT_LAB)->group(function () {
                // Project Lab authoring (topics, hand-written SOWs, milestones)
                // and the submission review queue — see AdminProjectLabController.
                Route::get('/project-lab/topics', [AdminProjectLabController::class, 'topics']);
                Route::post('/project-lab/topics', [AdminProjectLabController::class, 'storeTopic']);
                Route::get('/project-lab/topics/{projectTopic}', [AdminProjectLabController::class, 'showTopic']);
                Route::put('/project-lab/topics/{projectTopic}', [AdminProjectLabController::class, 'updateTopic']);
                Route::delete('/project-lab/topics/{projectTopic}', [AdminProjectLabController::class, 'destroyTopic']);

                Route::get('/project-lab/submissions', [AdminProjectLabController::class, 'submissions']);
                Route::get('/project-lab/submissions/{submission}', [AdminProjectLabController::class, 'showSubmission']);
                Route::get('/project-lab/submissions/{submission}/snapshot', [AdminProjectLabController::class, 'downloadSnapshot']);
                Route::post('/project-lab/submissions/{submission}/review', [AdminProjectLabController::class, 'review']);
            });

            Route::middleware('permission:'.User::PERM_HACKATHONS)->group(function () {
                // Hack Arena hosting: Mellow Ops hosts the platform's own hackathons and
                // moderates partners'. See AdminHackathonController and the ManagesHackathons
                // concern it shares with the hiring-partner controller. A college TPO has no
                // route into any of this.
                Route::middleware('throttle:arena-host')->group(function () {
                    Route::get('/hackathons', [AdminHackathonController::class, 'index']);
                    Route::post('/hackathons', [AdminHackathonController::class, 'store']);
                    // Declared before {hackathon} so "colleges" is not mistaken for an id.
                    Route::get('/hackathons/colleges', [AdminHackathonController::class, 'colleges']);
                    Route::get('/hackathons/{hackathon}', [AdminHackathonController::class, 'show']);
                    Route::put('/hackathons/{hackathon}', [AdminHackathonController::class, 'update']);
                    Route::delete('/hackathons/{hackathon}', [AdminHackathonController::class, 'destroy']);
                    Route::post('/hackathons/{hackathon}/cover', [AdminHackathonController::class, 'uploadCover']);
                    Route::delete('/hackathons/{hackathon}/cover', [AdminHackathonController::class, 'deleteCover']);
                    Route::post('/hackathons/{hackathon}/publish', [AdminHackathonController::class, 'publish']);
                    Route::post('/hackathons/{hackathon}/unpublish', [AdminHackathonController::class, 'unpublish']);
                    Route::post('/hackathons/{hackathon}/cancel', [AdminHackathonController::class, 'cancel']);
                    Route::get('/hackathons/{hackathon}/registrations', [AdminHackathonController::class, 'registrations']);
                    Route::get('/hackathons/{hackathon}/registrations/export', [AdminHackathonController::class, 'exportRegistrations']);
                    Route::get('/hackathons/{hackathon}/submissions', [AdminHackathonController::class, 'submissions']);
                    Route::post('/hackathons/{hackathon}/submissions/{submission}/score', [AdminHackathonController::class, 'scoreSubmission']);
                    Route::post('/hackathons/{hackathon}/submissions/{submission}/disqualify', [AdminHackathonController::class, 'disqualify']);
                    Route::post('/hackathons/{hackathon}/submissions/{submission}/reinstate', [AdminHackathonController::class, 'reinstate']);
                    Route::post('/hackathons/{hackathon}/publish-results', [AdminHackathonController::class, 'publishResults']);
                    Route::post('/hackathons/{hackathon}/announcements', [AdminHackathonController::class, 'storeAnnouncement']);
                    Route::delete('/hackathons/{hackathon}/announcements/{announcement}', [AdminHackathonController::class, 'destroyAnnouncement']);
                });
            });

            // Core Prep authoring (ECE / EEE / Mech / Civil technical questions): the question bank with its
            // review workflow, bulk import with a dry-run, taxonomy, coverage and student issue reports. Going
            // live to students is superadmin-only (see /superadmin/core/…).
            Route::middleware('permission:'.User::PERM_CORE_PREP)->prefix('core')->group(function () {
                Route::get('/taxonomy', [AdminCoreTaxonomyController::class, 'index']);
                Route::post('/subjects', [AdminCoreTaxonomyController::class, 'storeSubject']);
                Route::put('/subjects/{subject}', [AdminCoreTaxonomyController::class, 'updateSubject']);
                Route::delete('/subjects/{subject}', [AdminCoreTaxonomyController::class, 'destroySubject']);
                Route::post('/topics', [AdminCoreTaxonomyController::class, 'storeTopic']);
                Route::put('/topics/{topic}', [AdminCoreTaxonomyController::class, 'updateTopic']);
                Route::delete('/topics/{topic}', [AdminCoreTaxonomyController::class, 'destroyTopic']);
                Route::get('/coverage', [AdminCoreTaxonomyController::class, 'coverage']);

                Route::get('/questions', [AdminCoreQuestionController::class, 'index']);
                Route::post('/questions', [AdminCoreQuestionController::class, 'store']);
                Route::post('/questions/bulk-status', [AdminCoreQuestionController::class, 'bulkStatus']);
                Route::post('/questions/ai-draft', [AdminCoreQuestionController::class, 'aiDraft']);
                Route::get('/questions/{coreQuestion}', [AdminCoreQuestionController::class, 'show']);
                Route::put('/questions/{coreQuestion}', [AdminCoreQuestionController::class, 'update']);
                Route::post('/questions/{coreQuestion}/status', [AdminCoreQuestionController::class, 'setStatus']);
                Route::post('/questions/{coreQuestion}/fix-key', [AdminCoreQuestionController::class, 'fixKey']);
                Route::post('/questions/{coreQuestion}/image', [AdminCoreQuestionController::class, 'uploadImage']);
                Route::delete('/questions/{coreQuestion}/image', [AdminCoreQuestionController::class, 'removeImage']);
                Route::delete('/questions/{coreQuestion}', [AdminCoreQuestionController::class, 'destroy']);

                // Item analysis: recompute now (it also runs nightly); the flags themselves ride on /questions (?flagged=1).
                Route::post('/item-analysis/run', [AdminCoreQuestionController::class, 'runItemAnalysis']);

                Route::get('/reports', [AdminCoreQuestionController::class, 'reports']);
                Route::post('/reports/{report}/resolve', [AdminCoreQuestionController::class, 'resolveReport']);

                // The platform's own timed Core tests ("papers"): build from a blueprint or hand-pick, then publish.
                Route::get('/tests', [AdminCoreTestController::class, 'index']);
                Route::post('/tests', [AdminCoreTestController::class, 'store']);
                Route::get('/tests/pool', [AdminCoreTestController::class, 'pool']);
                Route::get('/tests/candidates', [AdminCoreTestController::class, 'candidates']);
                Route::get('/tests/{coreTest}', [AdminCoreTestController::class, 'show']);
                Route::put('/tests/{coreTest}', [AdminCoreTestController::class, 'update']);
                Route::delete('/tests/{coreTest}', [AdminCoreTestController::class, 'destroy']);
                Route::get('/tests/{coreTest}/questions', [AdminCoreTestController::class, 'questions']);
                Route::put('/tests/{coreTest}/questions', [AdminCoreTestController::class, 'setQuestions']);
                Route::post('/tests/{coreTest}/blueprint', [AdminCoreTestController::class, 'blueprint']);

                Route::get('/import-template', [AdminCoreImportController::class, 'template']);
                Route::get('/imports', [AdminCoreImportController::class, 'index']);
                Route::post('/imports', [AdminCoreImportController::class, 'store'])->middleware('throttle:20,1');
                Route::get('/imports/{import}', [AdminCoreImportController::class, 'show']);
                Route::post('/imports/{import}/commit', [AdminCoreImportController::class, 'commit'])->middleware('throttle:20,1');
            });

            Route::middleware('permission:'.User::PERM_SOFT_SKILLS)->group(function () {
                // Soft Skills — the third pillar alongside Contests/AI
                // Interviews (see SoftSkillAssessment's docblock). Only
                // ever creates/edits `general`-type assessments — tpo_mock/
                // company belong entirely to their owning college/company
                // (see AdminSoftSkillController::guardManagedElsewhere()).
                Route::get('/soft-skills', [AdminSoftSkillController::class, 'index']);
                Route::post('/soft-skills', [AdminSoftSkillController::class, 'store']);
                Route::post('/soft-skills/{softSkillAssessment}', [AdminSoftSkillController::class, 'update']);
                Route::delete('/soft-skills/{softSkillAssessment}', [AdminSoftSkillController::class, 'destroy']);
                Route::get('/soft-skills/{softSkillAssessment}/questions', [AdminSoftSkillController::class, 'questions']);
                Route::post('/soft-skills/{softSkillAssessment}/questions', [AdminSoftSkillController::class, 'storeQuestion']);
                Route::delete('/soft-skills/{softSkillAssessment}/questions/{assessmentQuestion}', [AdminSoftSkillController::class, 'destroyQuestion']);
                Route::post('/soft-skills/{softSkillAssessment}/questions/auto-fill', [AdminSoftSkillController::class, 'autoFillQuestions']);
                // The AptRun question-set library (with this caller's own "already used" markers), and building a test from one set.
                Route::get('/soft-skill-question-sets', [AdminSoftSkillController::class, 'questionSets']);
                Route::post('/soft-skills/{softSkillAssessment}/question-sets', [AdminSoftSkillController::class, 'attachQuestionSet']);

                // The shared question bank — reachable by every authoring
                // role (see routes below), registered here too since
                // Mellow Ops manages it directly. `generate` MUST be
                // declared before the `{softSkillQuestion}` wildcard route
                // below — same method, same segment count, so Laravel
                // matches whichever is declared first; wildcard-first would
                // swallow "generate" as an id and 404 on the lookup.
                Route::get('/soft-skill-question-bank', [AdminSoftSkillQuestionBankController::class, 'index']);
                Route::post('/soft-skill-question-bank', [AdminSoftSkillQuestionBankController::class, 'store']);
                Route::post('/soft-skill-question-bank/generate', [AdminSoftSkillQuestionBankController::class, 'generate'])
                    ->middleware('throttle:ai-generation');
                Route::post('/soft-skill-question-bank/{softSkillQuestion}', [AdminSoftSkillQuestionBankController::class, 'update']);
            });

            Route::middleware('permission:'.User::PERM_VAULT)->group(function () {
                // The Vault — students whose readiness score says they are ready to
                // be hired. Nothing is authored here (the score is what gets a
                // student in); this is oversight: the roster, a policy override to
                // hide a profile, and the state of the hand-off to Mellow Vault.
                Route::get('/vault/summary', [AdminVaultController::class, 'summary']);
                Route::get('/vault/profiles', [AdminVaultController::class, 'index']);
                Route::get('/vault/ai-interview-qualifiers', [AdminVaultController::class, 'aiInterviewQualifiers']);
                Route::post('/vault/profiles/{profile}/visibility', [AdminVaultController::class, 'updateVisibility']);
                Route::post('/vault/profiles/{profile}/resync', [AdminVaultController::class, 'resync']);
                Route::get('/vault/sync-events', [AdminVaultController::class, 'syncEvents']);
                Route::post('/vault/sync-events/retry', [AdminVaultController::class, 'retrySync']);

                // The Vault AI Interview question bank: which stacks are open to students and which are empty, and the tools
                // to fill them (one question at a time, or a spreadsheet). See CuratedQuestionAdmin.
                Route::get('/vault-ai/coverage', [AdminVaultQuestionController::class, 'coverage']);
                Route::get('/vault-ai/stacks/{stack}', [AdminVaultQuestionController::class, 'show']);
                Route::post('/vault-ai/sets/{setId}/questions', [AdminVaultQuestionController::class, 'store']);
                Route::put('/vault-ai/questions/{question}', [AdminVaultQuestionController::class, 'update']);
                Route::delete('/vault-ai/questions/{question}', [AdminVaultQuestionController::class, 'destroy']);
                Route::get('/vault-ai/template', [AdminVaultQuestionController::class, 'template']);
                Route::post('/vault-ai/import', [AdminVaultQuestionController::class, 'import'])->middleware('throttle:20,1');
            });

            Route::middleware('permission:'.User::PERM_ARTICLES)->group(function () {
                // Articles — Mellow's own knowledge-base content, organized
                // into topics (see ArticleTopic's docblock). Single-tier:
                // Ops authors, every student reads — no college/company
                // ownership split like Contest/Interview.
                Route::get('/article-topics', [AdminArticleTopicController::class, 'index']);
                Route::post('/article-topics', [AdminArticleTopicController::class, 'store']);
                Route::post('/article-topics/{articleTopic}', [AdminArticleTopicController::class, 'update']);
                Route::delete('/article-topics/{articleTopic}', [AdminArticleTopicController::class, 'destroy']);

                Route::get('/articles', [AdminArticleController::class, 'index']);
                Route::post('/articles', [AdminArticleController::class, 'store']);
                Route::get('/articles/{article}', [AdminArticleController::class, 'show']);
                Route::post('/articles/{article}', [AdminArticleController::class, 'update']);
                Route::delete('/articles/{article}', [AdminArticleController::class, 'destroy']);
            });

            Route::middleware('permission:'.User::PERM_PROBLEM_BANK)->group(function () {
                // Problems are created from a structured function-signature +
                // test-case spec (see App\Services\ProblemCodeGenerator), not
                // hand-authored PHP — this is the real path for adding the
                // catalog's content going forward.
                Route::get('/problems', [AdminProblemController::class, 'index']);
                Route::post('/problems', [AdminProblemController::class, 'store']);
                Route::put('/problems/{problem}', [AdminProblemController::class, 'update']);
            });

            Route::middleware('permission:'.User::PERM_CUSTOMERS)->group(function () {
                // Mellow Internal's own "My Customers" surface — converted
                // Mellow Direct leads handed off from Marketing on purchase (see
                // LeadAssignmentService::convertLead). Scoped to
                // assigned_internal_id for an admin_internal actor, unscoped for
                // superadmin, exactly like the marketing/ group below scopes to
                // assigned_marketing_id.
                Route::get('/customers', [InternalCustomerController::class, 'index']);
                Route::get('/customers/{customer}', [InternalCustomerController::class, 'show']);
                Route::post('/customers/{customer}/notes', [InternalCustomerController::class, 'storeNote']);
            });
        });

    // Superadmin-only: a trust tier above admin_internal — the only role
    // that can see/manage OTHER staff and superadmin accounts, and read the
    // platform's real audit trail. admin_internal is excluded from this
    // group entirely (not just its own routes above), unlike the "colleges"
    // endpoints which superadmin reuses from the admin_internal group below.
    Route::middleware('role:'.User::ROLE_SUPERADMIN)
        ->prefix('superadmin')
        ->group(function () {
            Route::get('/overview', [SuperAdminController::class, 'overview']);
            Route::get('/users', [SuperAdminController::class, 'users']);
            Route::post('/users', [SuperAdminController::class, 'storeUser']);
            Route::get('/users/{user}/detail', [SuperAdminController::class, 'showUser']);
            Route::post('/users/{user}/toggle-block', [SuperAdminController::class, 'toggleBlock']);
            Route::post('/users/{user}/permissions', [SuperAdminController::class, 'updatePermissions']);
            // Both re-check the caller's own password, so they share a tight per-user limiter (see AppServiceProvider).
            Route::post('/users/{user}/reset-password', [SuperAdminController::class, 'resetPassword'])
                ->middleware('throttle:superadmin-sensitive');
            // Filter-bar facets for the account directory: accounts per role and per university under the current filters.
            Route::get('/users/facets', [SuperAdminController::class, 'directoryFacets']);
            // The temporary login an account was issued, until its owner replaces it. Unlock = re-enter your own password
            // (10 minutes, this session only); both are limited and audited, and nothing here is ever cached.
            Route::get('/credentials/status', [SuperAdminCredentialController::class, 'status']);
            Route::post('/credentials/unlock', [SuperAdminCredentialController::class, 'unlock'])
                ->middleware('throttle:superadmin-sensitive');
            Route::post('/credentials/lock', [SuperAdminCredentialController::class, 'lock']);
            Route::post('/users/{user}/credentials', [SuperAdminCredentialController::class, 'reveal'])
                ->middleware('throttle:superadmin-credentials');
            // Rename a partner college, change its code / location, or correct its TPO's name and login email. Open TPO and
            // student screens pick it up on their next plan-signal check (profile_signature). A new TPO email re-asks for the caller's password.
            Route::put('/colleges/{college}', [SuperAdminCollegeController::class, 'update'])
                ->middleware('throttle:superadmin-sensitive');
            Route::get('/colleges/{college}/deletion-preview', [SuperAdminController::class, 'collegeDeletionPreview']);
            Route::delete('/colleges/{college}', [SuperAdminController::class, 'destroyCollege'])
                ->middleware('throttle:superadmin-sensitive');
            Route::get('/marketing-performance', [SuperAdminController::class, 'marketingPerformance']);
            // The marketing team: who is on it, what each is carrying, hand their work over, delete one (re-asks for the caller's password).
            Route::get('/marketing-team', [SuperAdminMarketingTeamController::class, 'index']);
            Route::get('/marketing-team/{user}/workload', [SuperAdminMarketingTeamController::class, 'workload']);
            Route::post('/marketing-team/{user}/reassign', [SuperAdminMarketingTeamController::class, 'reassign'])
                ->middleware('throttle:superadmin-sensitive');
            Route::delete('/marketing-team/{user}', [SuperAdminMarketingTeamController::class, 'destroy'])
                ->middleware('throttle:superadmin-sensitive');
            Route::get('/audit-logs', [SuperAdminController::class, 'auditLogs']);
            Route::get('/judge-nodes', [SuperAdminController::class, 'judgeNodes']);
            // Whole sections switched on/off for every student (Merchant Navy). The switch is explicit and audited.
            Route::get('/platform-modules', [SuperAdminPlatformModuleController::class, 'index']);
            Route::put('/platform-modules/{key}', [SuperAdminPlatformModuleController::class, 'update'])
                ->middleware('throttle:superadmin-sensitive');
            Route::get('/feature-flags', [SuperAdminController::class, 'featureFlags']);
            Route::post('/feature-flags/{flag}/toggle', [SuperAdminController::class, 'toggleFeatureFlag']);

            // One account, any role: the 360° "Manage" drawer and its hand tools. Everything that
            // can lock someone out, impersonate or destroy re-asks for the caller's own password.
            Route::get('/users/{user}/manage', [SuperAdminAccountController::class, 'show']);
            Route::put('/users/{user}', [SuperAdminAccountController::class, 'update']);
            Route::post('/users/{user}/revoke-sessions', [SuperAdminAccountController::class, 'revokeSessions'])
                ->middleware('throttle:superadmin-sensitive');
            Route::post('/users/{user}/impersonate', [SuperAdminAccountController::class, 'impersonate'])
                ->middleware('throttle:superadmin-sensitive');
            Route::get('/users/{user}/deletion-preview', [SuperAdminAccountController::class, 'deletionPreview']);
            Route::delete('/users/{user}', [SuperAdminAccountController::class, 'destroy'])
                ->middleware('throttle:superadmin-sensitive');

            // Subscriptions: every plan anyone holds, and the hand tools to give, extend and end them.
            // A change is live on the holder's next request (see SuperAdminSubscriptionController).
            Route::get('/subscriptions', [SuperAdminSubscriptionController::class, 'index']);
            Route::get('/students/search', [SuperAdminSubscriptionController::class, 'searchStudents']);
            Route::post('/users/{user}/subscription', [SuperAdminSubscriptionController::class, 'grant'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::post('/subscriptions/{subscription}/extend', [SuperAdminSubscriptionController::class, 'extend'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::post('/subscriptions/{subscription}/cancel', [SuperAdminSubscriptionController::class, 'cancel'])
                ->middleware('throttle:superadmin-sensitive');
            // Plans & Pricing: the live price and discount of the individual plans. A change is
            // visible on the public pricing page at once, so it shares the sensitive-action limiter.
            Route::get('/plans', [SuperAdminPlanController::class, 'index']);
            Route::put('/plans/{plan:code}', [SuperAdminPlanController::class, 'update'])
                ->middleware('throttle:superadmin-sensitive');
            // What a plan INCLUDES (daily limits, free tries, Arena / Pool / Project Lab access) — live too.
            Route::put('/plans/{plan:code}/entitlements', [SuperAdminPlanController::class, 'updateEntitlements'])
                ->middleware('throttle:superadmin-sensitive');

            // Branches: the catalogue (disciplines, branches, spellings) behind every branch picker and
            // eligibility check. Adding a spelling re-resolves every student with that label at once.
            // Departments (Engineering, Management, Commerce, Arts …): their modules, disciplines, and per-branch Domain Prep coverage.
            Route::get('/departments', [SuperAdminDepartmentController::class, 'index']);
            Route::post('/departments', [SuperAdminDepartmentController::class, 'store']);
            Route::put('/departments/{department:code}', [SuperAdminDepartmentController::class, 'update']);
            Route::delete('/departments/{department:code}', [SuperAdminDepartmentController::class, 'destroy']);
            Route::post('/disciplines', [SuperAdminDepartmentController::class, 'storeDiscipline']);
            Route::put('/disciplines/{discipline:code}', [SuperAdminDepartmentController::class, 'updateDiscipline']);

            Route::get('/branches', [SuperAdminBranchController::class, 'index']);
            Route::post('/branches', [SuperAdminBranchController::class, 'storeBranch']);
            Route::put('/branches/{branch:code}', [SuperAdminBranchController::class, 'updateBranch']);
            Route::post('/branch-aliases', [SuperAdminBranchController::class, 'storeAlias']);
            Route::delete('/branch-aliases/{alias}', [SuperAdminBranchController::class, 'destroyAlias']);
            // Core Prep go-live: a business decision (it changes what every student of a branch sees), so superadmin only.
            Route::post('/core/disciplines/{discipline}/live', [AdminCoreTaxonomyController::class, 'setLive'])
                ->middleware('throttle:superadmin-sensitive');
            // Staged rollout: show a branch's Core Prep to chosen pilot colleges before it is live for everyone.
            Route::put('/core/disciplines/{discipline}/pilots', [AdminCoreTaxonomyController::class, 'setPilots'])
                ->middleware('throttle:superadmin-sensitive');
            Route::post('/branches/re-resolve', [SuperAdminBranchController::class, 'reresolveAll'])
                ->middleware('throttle:superadmin-sensitive');

            // Payments: every plan purchase and what it is worth; "re-check" asks the order's gateway again for one order.
            Route::get('/payments', [SuperAdminPaymentController::class, 'index']);
            Route::post('/payments/{payment:public_id}/reconcile', [SuperAdminPaymentController::class, 'reconcile'])
                ->middleware('throttle:superadmin-sensitive');

            // Vault AI Interview: every student's qualification, and the hand tools to give a blocked student their attempts back,
            // correct marks, qualify someone outright or take a qualification back. Changes are live on the student's next request.
            Route::get('/vault-ai/students/{user}', [SuperAdminVaultAiController::class, 'show']);
            Route::post('/vault-ai/students/{user}/stacks/{stackKey}/reset', [SuperAdminVaultAiController::class, 'reset'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::put('/vault-ai/students/{user}/stacks/{stackKey}/scores', [SuperAdminVaultAiController::class, 'scores'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::post('/vault-ai/students/{user}/stacks/{stackKey}/qualify', [SuperAdminVaultAiController::class, 'qualify'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::post('/vault-ai/students/{user}/unlock-access', [SuperAdminVaultAiController::class, 'unlockAccess'])
                ->middleware('throttle:superadmin-subscriptions');

            // Readiness: every student's score, and the hand tool to set it. A hand-set score replaces the calculated one everywhere.
            Route::get('/readiness/{user}', [SuperAdminReadinessController::class, 'show']);
            Route::put('/readiness/{user}', [SuperAdminReadinessController::class, 'update'])
                ->middleware('throttle:superadmin-subscriptions');
            Route::delete('/readiness/{user}', [SuperAdminReadinessController::class, 'destroy'])
                ->middleware('throttle:superadmin-subscriptions');
        });

    // Mellow Marketing team's own surface — "Mellow Direct" leads only (see
    // User::isMellowDirectLead()). Superadmin included for oversight, same
    // convention every other role group already follows; admin_internal is
    // deliberately excluded — Ops staff have no route into this controller,
    // matching how marketing has none into the admin_internal group above.
    Route::middleware('role:'.User::ROLE_ADMIN_MARKETING.','.User::ROLE_SUPERADMIN)
        ->prefix('marketing')
        ->group(function () {
            Route::middleware('permission:'.User::PERM_LEADS)->group(function () {
                Route::get('/leads', [MarketingLeadController::class, 'index']);
                Route::get('/leads/{lead}', [MarketingLeadController::class, 'show']);
                Route::post('/leads/{lead}/status', [MarketingLeadController::class, 'updateStatus']);
                Route::post('/leads/{lead}/notes', [MarketingLeadController::class, 'storeNote']);

                // "Talk to Our Team" contact requests — the ContactRequest
                // sibling of the leads routes above, same permission (it's
                // the same "manage leads" capability, a second lead type).
                Route::get('/contact-requests', [MarketingContactRequestController::class, 'index']);
                Route::get('/contact-requests/{contactRequest}', [MarketingContactRequestController::class, 'show']);
                Route::post('/contact-requests/{contactRequest}/status', [MarketingContactRequestController::class, 'updateStatus']);
                Route::post('/contact-requests/{contactRequest}/notes', [MarketingContactRequestController::class, 'storeNote']);
            });

            Route::middleware('permission:'.User::PERM_LEAD_OUTREACH)
                ->post('/leads/notify', [MarketingLeadController::class, 'notify']);
        });

    // College-TPO-only: map/unmap already-published drives to their own
    // college. No TPO-reachable route existed before this — admin_tpo
    // accounts are 403'd from every route above. Deliberately scoped to
    // role:admin_tpo alone (never combined with admin_internal/superadmin):
    // every method here derives its college scope from
    // $request->user()->college_id, which is null for staff accounts.
    Route::middleware('role:'.User::ROLE_ADMIN_TPO)
        ->prefix('tpo')
        ->group(function () {
            // The college's exam network: the address ranges its students must be on to START a proctored attempt.
            Route::get('/exam-network', [TpoExamNetworkController::class, 'show']);
            Route::put('/exam-network', [TpoExamNetworkController::class, 'update'])->middleware('throttle:30,1');
            // Exam integrity review: risk, the tamper-evident timeline, network and the encrypted evidence stills. What a
            // caller can see is decided by IntegrityReport::scopeFor() from their role (404, never 403, outside it).
            Route::get('/integrity', [IntegrityReviewController::class, 'index']);
            Route::get('/integrity/{uuid}', [IntegrityReviewController::class, 'show']);
            Route::get('/integrity/{uuid}/evidence/{evidence}', [IntegrityReviewController::class, 'evidence'])->whereNumber('evidence');
            Route::get('/drives/mapped', [TpoDriveController::class, 'mapped']);
            Route::get('/drives/available', [TpoDriveController::class, 'available']);
            Route::get('/drives/pending', [TpoDriveController::class, 'pending']);
            Route::post('/drives', [TpoDriveController::class, 'store']);
            Route::post('/drives/{placementDrive}/map', [TpoDriveController::class, 'map']);
            Route::post('/drives/{placementDrive}/mapping', [TpoDriveController::class, 'updateMapping']);
            Route::post('/drives/{placementDrive}/unmap', [TpoDriveController::class, 'unmap']);
            Route::post('/drives/{placementDrive}/respond', [TpoDriveController::class, 'respond']);
            Route::get('/companies/search', [TpoDriveController::class, 'searchCompanies']);

            // Self-serve bulk roster import — the primary path for a college
            // onboarding their whole batch at once.
            // The departments this college runs (the switcher on every TPO screen reads them).
            Route::get('/departments', [CollegeDepartmentController::class, 'showMine']);
            Route::put('/departments', [CollegeDepartmentController::class, 'updateMine']);

            Route::get('/students/import-template', [StudentImportController::class, 'template']);
            Route::post('/students/import', [StudentImportController::class, 'storeMine']);
            Route::get('/students/imports', [StudentImportController::class, 'indexMine']);
            Route::get('/students/imports/{studentImport}', [StudentImportController::class, 'showMine']);

            // Student Cohort page: real roster + readiness scoring + bulk
            // placeholder-template notification emails, plus adding one
            // student by hand (the same account+welcome-email pipeline as
            // the CSV import above, for a single straggler).
            // Branch mapping: what the branch labels in this college's roster mean. A mapping is
            // this college's alone and re-resolves every matching student in one query.
            Route::get('/branches', [TpoBranchController::class, 'index']);
            Route::post('/branches/map', [TpoBranchController::class, 'map']);
            Route::post('/branches/unmap', [TpoBranchController::class, 'unmap']);

            // Mock Core tests: a college's own timed technical tests, from a blueprint or a copy of one of Mellow's papers.
            Route::get('/core-tests', [TpoCoreTestController::class, 'index']);
            Route::post('/core-tests', [TpoCoreTestController::class, 'store']);
            Route::get('/core-tests/pool', [TpoCoreTestController::class, 'pool']);
            Route::get('/core-tests/library', [TpoCoreTestController::class, 'library']);
            Route::post('/core-tests/library/{paper}/copy', [TpoCoreTestController::class, 'copy']);
            Route::get('/core-tests/{coreTest}', [TpoCoreTestController::class, 'show']);
            Route::put('/core-tests/{coreTest}', [TpoCoreTestController::class, 'update']);
            Route::delete('/core-tests/{coreTest}', [TpoCoreTestController::class, 'destroy']);
            Route::post('/core-tests/{coreTest}/blueprint', [TpoCoreTestController::class, 'blueprint']);

            // Core Prep across this college's ECE/EEE/Mech/Civil students: branch × subject strengths, and the per-student report data.
            Route::get('/core-insights/heatmap', [TpoCoreInsightsController::class, 'heatmap']);
            Route::get('/core-insights/proficiency', [TpoCoreInsightsController::class, 'proficiency']);

            Route::get('/students/cohort', [TpoStudentController::class, 'index']);
            Route::post('/students', [TpoStudentController::class, 'store']);
            Route::post('/students/bulk-notify', [TpoStudentController::class, 'bulkNotify']);
            Route::post('/students/year', [TpoStudentController::class, 'setYear']);
            Route::post('/students/section', [TpoStudentController::class, 'setSection']);
            Route::patch('/students/{student}', [TpoStudentController::class, 'update'])->whereNumber('student');

            // The Cohort table's "View Report" drill-down: one student's
            // full contest/interview/drive history, activity calendar, and
            // (new) the actual code behind any of their submissions.
            Route::get('/students/{student}/notes', [TpoStudentNoteController::class, 'index']);
            Route::get('/students/{student}/report', [TpoStudentReportController::class, 'show']);
            Route::get('/students/{student}/submissions/{submission}', [TpoStudentReportController::class, 'submission']);
            Route::get('/students/{student}/contest-submissions/{contestSubmission}', [TpoStudentReportController::class, 'contestSubmission']);

            // Section Coordinators: TPO-provisioned accounts, each scoped to
            // exactly one section of this college, that can view/lightly
            // manage (never create/import) the students already in it.
            Route::get('/coordinators', [TpoCoordinatorController::class, 'index']);
            Route::post('/coordinators', [TpoCoordinatorController::class, 'store']);
            Route::put('/coordinators/{user}', [TpoCoordinatorController::class, 'update']);
            Route::post('/coordinators/{user}/toggle-block', [TpoCoordinatorController::class, 'toggleBlock']);

            // Soft Skills — this college's own private practice tests, for
            // their own students only (assessment_type=tpo_mock). See
            // AdminSoftSkillController's routes above for the Mellow-Ops
            // equivalent; the shared question bank is read/browsed via the
            // same soft-skill-question-bank routes, scoped read-only here.
            Route::get('/soft-skills', [TpoSoftSkillController::class, 'index']);
            Route::post('/soft-skills', [TpoSoftSkillController::class, 'store']);
            Route::post('/soft-skills/{softSkillAssessment}', [TpoSoftSkillController::class, 'update']);
            Route::delete('/soft-skills/{softSkillAssessment}', [TpoSoftSkillController::class, 'destroy']);
            Route::get('/soft-skills/{softSkillAssessment}/questions', [TpoSoftSkillController::class, 'questions']);
            Route::post('/soft-skills/{softSkillAssessment}/questions', [TpoSoftSkillController::class, 'storeQuestion']);
            Route::delete('/soft-skills/{softSkillAssessment}/questions/{assessmentQuestion}', [TpoSoftSkillController::class, 'destroyQuestion']);
            Route::post('/soft-skills/{softSkillAssessment}/questions/auto-fill', [TpoSoftSkillController::class, 'autoFillQuestions']);
            // The AptRun question-set library (with this caller's own "already used" markers), and building a test from one set.
            Route::get('/soft-skill-question-sets', [TpoSoftSkillController::class, 'questionSets']);
            Route::post('/soft-skills/{softSkillAssessment}/question-sets', [TpoSoftSkillController::class, 'attachQuestionSet']);
            Route::get('/soft-skill-question-bank', [AdminSoftSkillQuestionBankController::class, 'index']);
            Route::post('/soft-skill-question-bank/generate', [AdminSoftSkillQuestionBankController::class, 'generate'])
                ->middleware('throttle:ai-generation');

            Route::get('/reports/data', [TpoReportsController::class, 'data']);
            Route::post('/placement-target', [TpoReportsController::class, 'updateTarget']);

            // Review flagged proctoring activity across the whole college
            // (every section) — reinstate() is the false-positive override
            // for a locked student. See CoordinatorProctoringController for
            // the section-scoped equivalent.
            Route::get('/proctoring', [TpoProctoringController::class, 'index']);
            Route::get('/proctoring/{proctoringSession}', [TpoProctoringController::class, 'show']);
            Route::post('/proctoring/{proctoringSession}/reinstate', [TpoProctoringController::class, 'reinstate']);

            // Real placement pipeline — a TPO manually records each
            // student's progress through a drive (no automated signal
            // exists anywhere to infer interview/offer outcomes), the
            // structured replacement for tracking this in a spreadsheet.
            Route::get('/drives/{placementDrive}/applications', [TpoDriveApplicationController::class, 'index']);
            Route::post('/drives/{placementDrive}/applications', [TpoDriveApplicationController::class, 'store']);
            Route::post('/drives/{placementDrive}/applications/bulk-register', [TpoDriveApplicationController::class, 'bulkRegister']);
            Route::post('/drives/{placementDrive}/applications/{application}/stage', [TpoDriveApplicationController::class, 'updateStage']);

            // A TPO's own private "mock" contests for their own college's
            // students only — entirely separate from Mellow's platform-run
            // contests above (see TpoContestController's docblock). Never
            // rated, never visible to any other college.
            Route::get('/contests', [TpoContestController::class, 'index']);
            Route::post('/contests', [TpoContestController::class, 'store']);
            Route::post('/contests/{contest}', [TpoContestController::class, 'update']);
            Route::get('/contests/{contest}/problems', [TpoContestController::class, 'problems']);
            Route::post('/contests/{contest}/problems', [TpoContestController::class, 'storeProblem']);
            Route::delete('/contests/{contest}/problems/{contestProblem}', [TpoContestController::class, 'destroyProblem']);
            Route::post('/contests/{contest}/finalize', [TpoContestController::class, 'finalize']);

            // Contest report: who registered, how they ranked/scored, and
            // (drilling into one participant) their actual per-problem
            // submissions including the code they wrote.
            Route::get('/contests/{contest}/participants', [TpoContestController::class, 'participants']);
            Route::get('/contests/{contest}/participants/{student}/submissions', [TpoContestController::class, 'participantSubmissions']);

            // A TPO's own private "mock" AI interviews — same pattern as
            // Mock Contests above (see TpoInterviewController's docblock).
            Route::get('/interviews', [TpoInterviewController::class, 'index']);
            Route::post('/interviews', [TpoInterviewController::class, 'store']);
            Route::post('/interviews/{interview}', [TpoInterviewController::class, 'update']);
            Route::delete('/interviews/{interview}', [TpoInterviewController::class, 'destroy']);
            Route::get('/interviews/{interview}/questions', [TpoInterviewController::class, 'questions']);
            Route::post('/interviews/{interview}/questions', [TpoInterviewController::class, 'storeQuestion']);
            Route::delete('/interviews/{interview}/questions/{interviewQuestion}', [TpoInterviewController::class, 'destroyQuestion']);
            Route::get('/interviews/{interview}/sessions', [TpoInterviewController::class, 'sessions']);
            Route::get('/interviews/{interview}/sessions/{interviewSession}/responses', [TpoInterviewController::class, 'responses']);
            Route::get('/interviews/{interview}/responses/{interviewResponse}/audio', [TpoInterviewController::class, 'responseAudio']);
            Route::post('/interviews/{interview}/sessions/{interviewSession}/reinstate', [TpoInterviewController::class, 'reinstateProctoring']);
            Route::post('/interviews/{interview}/responses/{interviewResponse}/score', [TpoInterviewController::class, 'scoreResponse']);
            Route::post('/interviews/{interview}/sessions/{interviewSession}/finalize', [TpoInterviewController::class, 'finalizeSession']);

            // Role templates + the "Final Interview" 3-round pipeline
            // container for the TPO's own tpo_mock tracks — see
            // TpoInterviewTrackController's docblock.
            Route::get('/interview-role-templates', [TpoInterviewRoleTemplateController::class, 'index']);
            Route::post('/interview-role-templates', [TpoInterviewRoleTemplateController::class, 'store']);
            Route::post('/interview-role-templates/{interviewRoleTemplate}', [TpoInterviewRoleTemplateController::class, 'update']);

            Route::get('/interview-tracks', [TpoInterviewTrackController::class, 'index']);
            Route::post('/interview-tracks', [TpoInterviewTrackController::class, 'store']);
            Route::post('/interview-tracks/{interviewTrack}', [TpoInterviewTrackController::class, 'update']);
            Route::delete('/interview-tracks/{interviewTrack}', [TpoInterviewTrackController::class, 'destroy']);
        });

    // Company-hiring-tenant-only: a company's own admin_company account,
    // scoped to their own company_id — the same isolation rule admin_tpo
    // enforces via college_id above. Reuses PlacementDrive/DriveApplication
    // (source=company_direct) rather than a parallel schema; see
    // CompanyDriveController/CompanyCandidateController docblocks.
    Route::middleware('role:'.User::ROLE_ADMIN_COMPANY)
        ->prefix('company')
        ->group(function () {
            // Exam integrity review: risk, the tamper-evident timeline, network and the encrypted evidence stills. What a
            // caller can see is decided by IntegrityReport::scopeFor() from their role (404, never 403, outside it).
            Route::get('/integrity', [IntegrityReviewController::class, 'index']);
            Route::get('/integrity/{uuid}', [IntegrityReviewController::class, 'show']);
            Route::get('/integrity/{uuid}/evidence/{evidence}', [IntegrityReviewController::class, 'evidence'])->whereNumber('evidence');
            Route::get('/colleges', [CompanyCollegeController::class, 'index']);

            Route::get('/drives', [CompanyDriveController::class, 'index']);
            Route::post('/drives', [CompanyDriveController::class, 'store']);
            Route::get('/drives/{placementDrive}', [CompanyDriveController::class, 'show']);
            Route::post('/drives/{placementDrive}', [CompanyDriveController::class, 'update']);

            // Propose one of the company's own openings to a specific
            // college — reuses the exact pending-mapping-and-approval
            // mechanism Mellow Ops uses for catalog drives (see
            // DriveCollegeProposalService); the receiving college's TPO
            // approves it from their own, unmodified Pending Approvals tab.
            Route::post('/drives/{placementDrive}/propose', [CompanyDriveController::class, 'proposeToColleges']);
            Route::get('/drives/{placementDrive}/mappings', [CompanyDriveController::class, 'mappings']);

            Route::get('/drives/{placementDrive}/candidates', [CompanyCandidateController::class, 'index']);
            Route::post('/drives/{placementDrive}/candidates', [CompanyCandidateController::class, 'store']);
            Route::post('/drives/{placementDrive}/candidates/{application}/stage', [CompanyCandidateController::class, 'updateStage']);
            Route::get('/candidates/import-template', [CompanyCandidateController::class, 'template']);
            Route::post('/drives/{placementDrive}/candidates/import', [CompanyCandidateController::class, 'import']);
            Route::get('/drives/{placementDrive}/candidates/imports', [CompanyCandidateController::class, 'indexImports']);
            Route::get('/drives/{placementDrive}/candidates/imports/{candidateImport}', [CompanyCandidateController::class, 'showImport']);

            // A company's own proctored hiring assessments — see
            // CompanyContestController's docblock. Always tied to one job
            // opening; candidates only ever see one once explicitly invited.
            Route::get('/contests', [CompanyContestController::class, 'index']);
            Route::post('/contests', [CompanyContestController::class, 'store']);
            Route::post('/contests/{contest}', [CompanyContestController::class, 'update']);
            Route::get('/contests/{contest}/problems', [CompanyContestController::class, 'problems']);
            Route::post('/contests/{contest}/problems', [CompanyContestController::class, 'storeProblem']);
            Route::delete('/contests/{contest}/problems/{contestProblem}', [CompanyContestController::class, 'destroyProblem']);
            Route::post('/contests/{contest}/finalize', [CompanyContestController::class, 'finalize']);
            Route::post('/contests/{contest}/invite', [CompanyContestController::class, 'inviteCandidates']);
            Route::get('/contests/{contest}/invited', [CompanyContestController::class, 'invited']);

            // Score-ranked participant results for a college-approved or
            // invite-based assessment, and pulling qualifying candidates
            // into the drive's own DriveApplication pipeline (see
            // CompanyCandidateController::updateStage() for what happens
            // next — no separate "hire" endpoint needed).
            Route::get('/contests/{contest}/results', [CompanyContestController::class, 'results']);
            Route::post('/contests/{contest}/results/import', [CompanyContestController::class, 'importResults']);

            // A company's own AI interviews — always tied to one job opening
            // and always invite-only (see CompanyInterviewController's
            // docblock). The usual flow: run a contest above, filter
            // results/import qualifiers into the pipeline, then create an
            // interview here and invite that same shortlist.
            Route::get('/interviews', [CompanyInterviewController::class, 'index']);
            Route::post('/interviews', [CompanyInterviewController::class, 'store']);
            Route::post('/interviews/{interview}', [CompanyInterviewController::class, 'update']);
            Route::delete('/interviews/{interview}', [CompanyInterviewController::class, 'destroy']);
            Route::get('/interviews/{interview}/questions', [CompanyInterviewController::class, 'questions']);
            Route::post('/interviews/{interview}/questions', [CompanyInterviewController::class, 'storeQuestion']);
            Route::delete('/interviews/{interview}/questions/{interviewQuestion}', [CompanyInterviewController::class, 'destroyQuestion']);
            Route::post('/interviews/{interview}/invite', [CompanyInterviewController::class, 'inviteCandidates']);
            Route::get('/interviews/{interview}/invited', [CompanyInterviewController::class, 'invited']);
            Route::get('/interviews/{interview}/sessions/{interviewSession}/responses', [CompanyInterviewController::class, 'responses']);
            Route::get('/interviews/{interview}/responses/{interviewResponse}/audio', [CompanyInterviewController::class, 'responseAudio']);
            Route::post('/interviews/{interview}/sessions/{interviewSession}/reinstate', [CompanyInterviewController::class, 'reinstateProctoring']);
            Route::post('/interviews/{interview}/responses/{interviewResponse}/score', [CompanyInterviewController::class, 'scoreResponse']);
            Route::post('/interviews/{interview}/sessions/{interviewSession}/finalize', [CompanyInterviewController::class, 'finalizeSession']);

            // Role templates + the "Final Interview" 3-round pipeline
            // container for the company's own company_hiring tracks — see
            // CompanyInterviewTrackController's docblock. Round 1 invites
            // reuse the existing /interviews/{interview}/invite route above,
            // pointed at round 1's own slug.
            Route::get('/interview-role-templates', [CompanyInterviewRoleTemplateController::class, 'index']);
            Route::post('/interview-role-templates', [CompanyInterviewRoleTemplateController::class, 'store']);
            Route::post('/interview-role-templates/{interviewRoleTemplate}', [CompanyInterviewRoleTemplateController::class, 'update']);

            Route::get('/interview-tracks', [CompanyInterviewTrackController::class, 'index']);
            Route::post('/interview-tracks', [CompanyInterviewTrackController::class, 'store']);
            Route::post('/interview-tracks/{interviewTrack}', [CompanyInterviewTrackController::class, 'update']);
            Route::delete('/interview-tracks/{interviewTrack}', [CompanyInterviewTrackController::class, 'destroy']);

            Route::get('/proctoring', [CompanyProctoringController::class, 'index']);
            Route::get('/proctoring/{proctoringSession}', [CompanyProctoringController::class, 'show']);
            Route::post('/proctoring/{proctoringSession}/reinstate', [CompanyProctoringController::class, 'reinstate']);

            Route::get('/reports/data', [CompanyReportsController::class, 'data']);

            // The Vault — students whose AptRun readiness score says they are
            // ready to be hired, and who agreed to be found (see
            // CompanyVaultController's docblock), independent of any job opening
            // this company created. Every action here is mediated by the platform
            // (no student email/phone is ever returned directly).
            Route::get('/vault', [CompanyVaultController::class, 'index']);
            Route::get('/vault/inquiries', [CompanyVaultController::class, 'myInquiries']);
            Route::get('/vault/{profile}', [CompanyVaultController::class, 'show']);
            Route::get('/vault/{profile}/resume', [CompanyVaultController::class, 'resume']);
            Route::post('/vault/{profile}/interest', [CompanyVaultController::class, 'expressInterest']);
            Route::post('/vault/{profile}/interview', [CompanyVaultController::class, 'scheduleInterview']);
            Route::post('/vault/{profile}/hire', [CompanyVaultController::class, 'hire']);
            Route::post('/vault/{profile}/notify', [CompanyVaultController::class, 'notify']);

            // Soft Skills — this hiring partner's own tests
            // (assessment_type=company), visible to students at any college
            // with an approved drive mapping to this company (see
            // SoftSkillAssessment::isVisibleToUser()) — deliberately named
            // "Soft Skills" everywhere, never "Assessments" (that already
            // means Contests — see CompanyContestController/AssessmentsPage).
            Route::get('/soft-skills', [CompanySoftSkillController::class, 'index']);
            Route::post('/soft-skills', [CompanySoftSkillController::class, 'store']);
            Route::post('/soft-skills/{softSkillAssessment}', [CompanySoftSkillController::class, 'update']);
            Route::delete('/soft-skills/{softSkillAssessment}', [CompanySoftSkillController::class, 'destroy']);
            Route::get('/soft-skills/{softSkillAssessment}/questions', [CompanySoftSkillController::class, 'questions']);
            Route::post('/soft-skills/{softSkillAssessment}/questions', [CompanySoftSkillController::class, 'storeQuestion']);
            Route::delete('/soft-skills/{softSkillAssessment}/questions/{assessmentQuestion}', [CompanySoftSkillController::class, 'destroyQuestion']);
            Route::post('/soft-skills/{softSkillAssessment}/questions/auto-fill', [CompanySoftSkillController::class, 'autoFillQuestions']);
            // The AptRun question-set library (with this caller's own "already used" markers), and building a test from one set.
            Route::get('/soft-skill-question-sets', [CompanySoftSkillController::class, 'questionSets']);
            Route::post('/soft-skills/{softSkillAssessment}/question-sets', [CompanySoftSkillController::class, 'attachQuestionSet']);
            Route::get('/soft-skill-question-bank', [AdminSoftSkillQuestionBankController::class, 'index']);
            Route::post('/soft-skill-question-bank/generate', [AdminSoftSkillQuestionBankController::class, 'generate'])
                ->middleware('throttle:ai-generation');

            // A company hosting its own hackathon, strictly its own (see CompanyHackathonController).
            Route::middleware('throttle:arena-host')->group(function () {
                Route::get('/hackathons', [CompanyHackathonController::class, 'index']);
                Route::post('/hackathons', [CompanyHackathonController::class, 'store']);
                // Declared before {hackathon} so "colleges" is not mistaken for an id.
                Route::get('/hackathons/colleges', [CompanyHackathonController::class, 'colleges']);
                Route::get('/hackathons/{hackathon}', [CompanyHackathonController::class, 'show']);
                Route::put('/hackathons/{hackathon}', [CompanyHackathonController::class, 'update']);
                Route::delete('/hackathons/{hackathon}', [CompanyHackathonController::class, 'destroy']);
                Route::post('/hackathons/{hackathon}/cover', [CompanyHackathonController::class, 'uploadCover']);
                Route::delete('/hackathons/{hackathon}/cover', [CompanyHackathonController::class, 'deleteCover']);
                Route::post('/hackathons/{hackathon}/publish', [CompanyHackathonController::class, 'publish']);
                Route::post('/hackathons/{hackathon}/unpublish', [CompanyHackathonController::class, 'unpublish']);
                Route::post('/hackathons/{hackathon}/cancel', [CompanyHackathonController::class, 'cancel']);
                Route::get('/hackathons/{hackathon}/registrations', [CompanyHackathonController::class, 'registrations']);
                Route::get('/hackathons/{hackathon}/registrations/export', [CompanyHackathonController::class, 'exportRegistrations']);
                Route::get('/hackathons/{hackathon}/submissions', [CompanyHackathonController::class, 'submissions']);
                Route::post('/hackathons/{hackathon}/submissions/{submission}/score', [CompanyHackathonController::class, 'scoreSubmission']);
                Route::post('/hackathons/{hackathon}/submissions/{submission}/disqualify', [CompanyHackathonController::class, 'disqualify']);
                Route::post('/hackathons/{hackathon}/submissions/{submission}/reinstate', [CompanyHackathonController::class, 'reinstate']);
                Route::post('/hackathons/{hackathon}/publish-results', [CompanyHackathonController::class, 'publishResults']);
                Route::post('/hackathons/{hackathon}/announcements', [CompanyHackathonController::class, 'storeAnnouncement']);
                Route::delete('/hackathons/{hackathon}/announcements/{announcement}', [CompanyHackathonController::class, 'destroyAnnouncement']);
            });
        });

    // Section-Coordinator-only: a TPO-provisioned account scoped to exactly
    // one section of their own college. Every method here further scopes to
    // that section server-side (see CoordinatorStudentController) — the
    // role check alone isn't the whole story the way it is for admin_tpo,
    // since two coordinators at the very same college must still never see
    // each other's students.
    Route::middleware('role:'.User::ROLE_SECTION_COORDINATOR)
        ->prefix('coordinator')
        ->group(function () {
            // Exam integrity review: risk, the tamper-evident timeline, network and the encrypted evidence stills. What a
            // caller can see is decided by IntegrityReport::scopeFor() from their role (404, never 403, outside it).
            Route::get('/integrity', [IntegrityReviewController::class, 'index']);
            Route::get('/integrity/{uuid}', [IntegrityReviewController::class, 'show']);
            Route::get('/integrity/{uuid}/evidence/{evidence}', [IntegrityReviewController::class, 'evidence'])->whereNumber('evidence');
            Route::get('/students', [CoordinatorStudentController::class, 'index']);
            Route::post('/students/{user}/toggle-block', [CoordinatorStudentController::class, 'toggleBlock']);
            Route::post('/students/bulk-notify', [CoordinatorStudentController::class, 'bulkNotify'])->middleware('throttle:coordinator-notify');

            // The coordinator's follow-up log on the students they look after (see CoordinatorNoteController).
            Route::get('/students/{student}/notes', [CoordinatorNoteController::class, 'index']);
            Route::post('/students/{student}/notes', [CoordinatorNoteController::class, 'store']);
            Route::put('/notes/{note}', [CoordinatorNoteController::class, 'update']);
            Route::delete('/notes/{note}', [CoordinatorNoteController::class, 'destroy']);

            // Same full activity report TpoStudentReportController exposes
            // to a student's own college TPO — contest/interview/drive
            // history, activity calendar, unified submission history, and
            // the actual code behind any submission — narrowed to this
            // coordinator's own section by CoordinatorStudentReportController.
            Route::get('/students/{student}/report', [CoordinatorStudentReportController::class, 'show']);
            Route::get('/students/{student}/submissions/{submission}', [CoordinatorStudentReportController::class, 'submission']);
            Route::get('/students/{student}/contest-submissions/{contestSubmission}', [CoordinatorStudentReportController::class, 'contestSubmission']);

            // Same proctoring review as the TPO's, but scoped to exactly
            // this coordinator's own section — see CoordinatorProctoringController.
            Route::get('/proctoring', [CoordinatorProctoringController::class, 'index']);
            Route::get('/proctoring/{proctoringSession}', [CoordinatorProctoringController::class, 'show']);
            Route::post('/proctoring/{proctoringSession}/reinstate', [CoordinatorProctoringController::class, 'reinstate']);
        });

    // Hack Arena: the students' hackathon world (see HackathonArenaController). Reads are
    // open to students and, as a read-only preview, to the hosting roles; a college TPO and
    // every other role get a 403. Writes are student-only, each with its own per-user limiter.
    Route::middleware('role:'.User::ROLE_USER.','.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_COMPANY.','.User::ROLE_SUPERADMIN, 'capability:hackathons')
        ->prefix('arena')
        ->group(function () {
            Route::get('/home', [HackathonArenaController::class, 'home']);
            Route::get('/hackathons', [HackathonArenaController::class, 'index']);
            Route::get('/hackathons/{hackathon:slug}', [HackathonArenaController::class, 'show']);
            Route::get('/hackathons/{hackathon:slug}/gallery', [HackathonArenaController::class, 'gallery']);
            Route::get('/hackathons/{hackathon:slug}/results', [HackathonArenaController::class, 'results']);
        });

    Route::middleware('role:'.User::ROLE_USER, 'capability:hackathons')
        ->prefix('arena')
        ->group(function () {
            Route::get('/mine', [HackathonArenaController::class, 'mine']);

            Route::middleware('throttle:arena-action')->group(function () {
                Route::post('/hackathons/{hackathon:slug}/register', [HackathonArenaController::class, 'register']);
                Route::post('/hackathons/{hackathon:slug}/withdraw', [HackathonArenaController::class, 'withdraw']);
                Route::post('/hackathons/{hackathon:slug}/team/members/{user}/remove', [HackathonArenaController::class, 'removeMember']);
            });

            Route::put('/hackathons/{hackathon:slug}/submission', [HackathonArenaController::class, 'saveSubmission'])->middleware('throttle:arena-submit');
        });

    // Read-only problem catalog (title/difficulty/tags — never the hidden
    // judging internals show() below returns) — not student-only, unlike
    // everything else in the role:user group beneath it. Every role that
    // curates a contest's problem set needs to browse it: Mellow Ops
    // building general/company contests, a TPO building their own mock
    // contest, and superadmin. ProblemController::index()'s per-user
    // `solved` flag is harmless for a staff caller — it's just always false.
    Route::middleware('role:'.User::ROLE_USER.','.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->get('/problems', [ProblemController::class, 'index'])->middleware('capability:coding_practice');

    // Read-only interview question bank browse — shared by every authoring
    // role (Ops/TPO/Company) to pick questions to attach to their own
    // interview. Same multi-role shape as /problems above.
    Route::middleware('role:'.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->get('/interview-question-bank/browse', [InterviewQuestionBankController::class, 'index']);

    // Company-wise previous year questions (PYQs) & interview prep catalog —
    // open to students and all staff roles so students can practice company questions anytime.
    Route::middleware('role:'.User::ROLE_USER.','.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->group(function () {
            Route::get('/company-prep', [CompanyPrepController::class, 'index'])->middleware('capability:company_prep');
            Route::get('/company-prep/{company:slug}', [CompanyPrepController::class, 'show'])->middleware('capability:company_prep');
        });

    // AI-generated interview questions (Gemini) — shared across every
    // authoring role exactly like the browse route above. A write action
    // (persists real bank rows), so it's rate-limited per user.
    Route::middleware('role:'.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->post('/interview-question-bank/generate', [InterviewQuestionGenerationController::class, 'generate'])
        ->middleware('throttle:ai-generation');

    // Student-only: read-only access to drives mapped to their own college,
    // and the Practice Arena's DSA problem catalog.
    Route::middleware('role:'.User::ROLE_USER)
        ->group(function () {
            // Exam integrity: telemetry, evidence stills and the Guardian's pairing for a proctored attempt. The attempt
            // itself is created by each surface's proctoring/start. See IntegrityController.
            Route::get('/integrity/policy', [IntegrityController::class, 'policy'])->middleware('throttle:integrity-beat');
            Route::post('/integrity/{uuid}/events', [IntegrityController::class, 'events'])->middleware('throttle:integrity-beat');
            Route::post('/integrity/{uuid}/evidence', [IntegrityController::class, 'evidence'])->middleware('throttle:integrity-evidence');
            Route::post('/integrity/{uuid}/end', [IntegrityController::class, 'end'])->middleware('throttle:integrity-beat');
            Route::get('/integrity/guardian', [IntegrityController::class, 'guardianStatus'])->middleware('throttle:integrity-beat');
            Route::post('/integrity/guardian/code', [IntegrityController::class, 'guardianCode'])->middleware('throttle:guardian-pair');

            Route::get('/drives', [StudentDriveController::class, 'index']);
            Route::get('/drives/{placementDrive}', [StudentDriveController::class, 'show']);

            Route::get('/problems/{problem}', [ProblemController::class, 'show'])->middleware('capability:coding_practice');
            // Run/Submit only enqueue (202 + token) — the verdict is collected
            // from /judge/{token} below. Per-user throttles, never per-IP.
            Route::post('/problems/{problem}/run', [SubmissionController::class, 'run'])->middleware('capability:coding_practice')->middleware('throttle:judge-run');
            Route::post('/problems/{problem}/submit', [SubmissionController::class, 'submit'])->middleware('capability:coding_practice')->middleware('throttle:judge-submit');
            Route::get('/judge/{token}', [JudgeResultController::class, 'show'])->middleware('capability:coding_practice,contests')->middleware('throttle:judge-poll');

            // A student's own submission history (practice + contest, unified)
            // and the code behind any of it — self-service mirror of
            // TpoStudentReportController/CoordinatorStudentReportController/
            // AdminStudentReportController, which expose the exact same thing
            // about someone ELSE'S submissions.
            Route::get('/submissions', [MySubmissionsController::class, 'index'])->middleware('capability:coding_practice');
            Route::get('/submissions/{submission}', [MySubmissionsController::class, 'show'])->middleware('capability:coding_practice');
            Route::get('/contest-submissions/{contestSubmission}', [MySubmissionsController::class, 'contestSubmission'])->middleware('capability:contests');

            // Real solved-count/streak/topic-mastery/etc — powers the
            // dashboard, performance report, and practice pages.
            Route::get('/me/stats', [StudentStatsController::class, 'mine']);
            Route::get('/me/rating-history', [StudentStatsController::class, 'ratingHistory']);
            // The student's readiness, day by day (the chart, "you crossed 60 on…", what missed days cost) — see ReadinessHistoryService.
            Route::get('/me/readiness/history', [StudentStatsController::class, 'readinessHistory']);
            // Own interview performance (with scores) — see InterviewController::history()'s docblock for why this is separate from /interviews below.
            Route::get('/me/interviews', [InterviewController::class, 'history'])->middleware('capability:ai_interviews');
            // Own Soft Skills performance — powers the Reports page's "Soft Skills Performance" card, same shape as /me/interviews above.
            Route::get('/me/soft-skills', [SoftSkillController::class, 'history'])->middleware('capability:soft_skills');

            // Practice interview studio: build your own AI mock interview for a branch role (see PracticeInterviewService). Creating one
            // can spend an AI call when the question bank is short for the role, hence the same per-user limiter as the other AI generators.
            Route::get('/me/practice-interviews/options', [PracticeInterviewController::class, 'options'])->middleware('capability:ai_interviews');
            Route::get('/curated-interview-sets', [CuratedInterviewSetController::class, 'index'])->middleware('capability:ai_interviews');
            Route::get('/curated-interview-sets/{setId}', [CuratedInterviewSetController::class, 'show'])->middleware('capability:ai_interviews');
            Route::post('/curated-interview-sets/{setId}/start', [CuratedInterviewSetController::class, 'start'])->middleware('capability:ai_interviews');
            Route::get('/vault-qualification/access', [VaultInterviewQualificationController::class, 'access'])->middleware('capability:ai_interviews');
            Route::get('/vault-qualification/status', [VaultInterviewQualificationController::class, 'status'])->middleware('capability:ai_interviews');
            Route::post('/vault-qualification/start-set', [VaultInterviewQualificationController::class, 'startSet'])->middleware('capability:ai_interviews');
            // "Tell me when this stack opens" for a stack that has no questions yet (and taking it back).
            Route::post('/vault-qualification/interest', [VaultInterviewQualificationController::class, 'interest'])->middleware(['capability:ai_interviews', 'throttle:30,1']);
            Route::delete('/vault-qualification/interest', [VaultInterviewQualificationController::class, 'withdrawInterest'])->middleware(['capability:ai_interviews', 'throttle:30,1']);
            // Mock AI Interview: practise by domain -> tech stack -> round (questions come from the Mock bank; see MockInterviewService).
            Route::get('/mock-interviews/catalog', [MockInterviewController::class, 'catalog'])->middleware('capability:ai_interviews');
            Route::post('/mock-interviews/rounds/{roundId}/start', [MockInterviewController::class, 'start'])->middleware(['capability:ai_interviews', 'throttle:30,1']);
            Route::post('/me/practice-interviews', [PracticeInterviewController::class, 'store'])->middleware('capability:ai_interviews')->middleware('throttle:ai-generation');

            // Skill Drills: the questions are generated in the browser; the server keeps the answers (streak, mastery). See config/drills.php.
            // Drills belong to a programme that codes or has them (engineering), not to Commerce / Management / Arts — the same rule the home shelf uses.
            Route::get('/me/drills', [DrillController::class, 'summary'])->middleware('capability:coding_practice,skill_drills');
            Route::get('/me/practice-shelf', [DrillController::class, 'shelf']);
            Route::post('/me/drills/attempts', [DrillController::class, 'record'])->middleware('capability:coding_practice,skill_drills')->middleware('throttle:drill-attempts');

            // Proctored sittings for Core Prep practice and Skill Drills (camera + fullscreen + strikes). See StudySittingService.
            Route::post('/me/sittings', [StudySittingController::class, 'store'])->middleware('throttle:60,1');
            Route::post('/me/sittings/{sitting}/proctoring/start', [StudySittingController::class, 'start']);
            Route::post('/me/sittings/{sitting}/proctoring/violations', [StudySittingController::class, 'reportViolation'])->middleware('throttle:120,1');
            Route::post('/me/sittings/{sitting}/complete', [StudySittingController::class, 'complete']);

            // Global leaderboard, ranked by real solved-score (or real
            // contest rating once a student has one — see User::displayRating()).
            Route::get('/leaderboard', [LeaderboardController::class, 'index'])->middleware('capability:coding_practice');

            Route::get('/contests', [ContestController::class, 'index'])->middleware('capability:contests');
            Route::get('/contests/{contest}', [ContestController::class, 'show'])->middleware('capability:contests');
            Route::post('/contests/{contest}/register', [ContestController::class, 'register'])->middleware('capability:contests');
            Route::delete('/contests/{contest}/register', [ContestController::class, 'unregister'])->middleware('capability:contests');
            Route::get('/contests/{contest}/leaderboard', [ContestController::class, 'leaderboard'])->middleware('capability:contests');
            Route::get('/contests/{contest}/problems/{contestProblem}', [ContestSubmissionController::class, 'show'])->middleware('capability:contests');
            Route::post('/contests/{contest}/problems/{contestProblem}/run', [ContestSubmissionController::class, 'run'])->middleware('capability:contests')->middleware('throttle:judge-run');
            Route::post('/contests/{contest}/problems/{contestProblem}/submit', [ContestSubmissionController::class, 'submit'])->middleware('capability:contests')->middleware('throttle:judge-submit');

            // AI Interviews — see InterviewController's docblock. No
            // judge-* throttle needed (no judge involved), plain default.
            Route::get('/interviews', [InterviewController::class, 'index'])->middleware('capability:ai_interviews');
            Route::get('/interviews/{interview}', [InterviewController::class, 'show'])->middleware('capability:ai_interviews');
            Route::post('/interviews/{interview}/start', [InterviewController::class, 'start'])->middleware('capability:ai_interviews');
            Route::post('/interviews/{interview}/answer', [InterviewController::class, 'answer'])->middleware('capability:ai_interviews');
            Route::post('/interviews/{interview}/complete', [InterviewController::class, 'complete'])->middleware('capability:ai_interviews');
            Route::post('/interviews/{interview}/reattempt', [InterviewController::class, 'reattempt'])->middleware('capability:ai_interviews');
            Route::get('/interviews/{interview}/result', [InterviewController::class, 'result'])->middleware('capability:ai_interviews');

            // The student's own study history (Merchant Navy): the score of every set they have sat, and a full report of any sitting to download.
            Route::get('/study-attempts', [\App\Http\Controllers\Api\StudyAttemptController::class, 'index'])->middleware('capability:ai_interviews');
            Route::get('/study-attempts/{attempt}', [\App\Http\Controllers\Api\StudyAttemptController::class, 'show'])->middleware('capability:ai_interviews');
            // The interviewer's voice (neural text-to-speech, cached). 503 speech_unavailable = use the browser's own voice.
            Route::get('/interviews/{interview}/questions/{interviewQuestion}/speech', [InterviewSpeechController::class, 'question'])->middleware(['capability:ai_interviews', 'throttle:120,1']);
            Route::get('/interviews-speech/lines/{line}', [InterviewSpeechController::class, 'line'])->middleware(['capability:ai_interviews', 'throttle:120,1']);
            Route::get('/interviews/{interview}/responses/{interviewResponse}/audio', [InterviewController::class, 'responseAudio'])->middleware('capability:ai_interviews');

            // Camera/mic proctoring for the interview attempt — mirrors the
            // contest proctoring routes above (start() is idempotent, resumes
            // an existing session on refresh; reportViolation() is what the
            // frontend's tab-switch/fullscreen/devtools detectors call).
            Route::post('/interviews/{interview}/proctoring/start', [InterviewProctoringController::class, 'start'])->middleware('capability:ai_interviews');
            Route::post('/interviews/{interview}/proctoring/violations', [InterviewProctoringController::class, 'reportViolation'])->middleware('capability:ai_interviews')->middleware('throttle:proctoring-event');

            // Soft Skills — the option-based third pillar alongside
            // Contests/AI Interviews above (see SoftSkillAssessment's
            // docblock). answer() autosaves one response at a time by its
            // own id (not gated on a "current expected question" like
            // interviews/answer — a student can navigate this test freely,
            // like a real exam), submit() is the one moment everything gets
            // graded. No judge-*/ai-generation throttle needed — grading is
            // exact-match, no Gemini call in the student-facing path at all.
            Route::get('/soft-skills', [SoftSkillController::class, 'index'])->middleware('capability:soft_skills');
            Route::get('/soft-skills/{softSkillAssessment}', [SoftSkillController::class, 'show'])->middleware('capability:soft_skills');
            Route::post('/soft-skills/{softSkillAssessment}/start', [SoftSkillController::class, 'start'])->middleware('capability:soft_skills');
            Route::post('/soft-skills/sessions/{softSkillSession}/answer', [SoftSkillController::class, 'answer'])->middleware('capability:soft_skills');
            Route::post('/soft-skills/sessions/{softSkillSession}/submit', [SoftSkillController::class, 'submit'])->middleware('capability:soft_skills');
            Route::get('/soft-skills/sessions/{softSkillSession}', [SoftSkillController::class, 'viewSession'])->middleware('capability:soft_skills');

            // Camera/mic proctoring for a Soft Skills attempt — same shape as
            // the interview/contest proctoring routes above (start() is
            // idempotent and resumes on refresh; reportViolation() is what the
            // frontend's tab-switch/fullscreen/devtools detectors call).
            Route::post('/soft-skills/sessions/{softSkillSession}/proctoring/start', [SoftSkillProctoringController::class, 'start'])->middleware('capability:soft_skills');
            Route::post('/soft-skills/sessions/{softSkillSession}/proctoring/violations', [SoftSkillProctoringController::class, 'reportViolation'])->middleware('capability:soft_skills')->middleware('throttle:proctoring-event');

            // The "Final Interview" 3-round pipeline — index() is where a
            // candidate discovers a track exists at all (standalone
            // /interviews above excludes track rounds); show() is the
            // locked/unlocked/scored state per round. Taking a round itself
            // reuses the plain /interviews/{interview}/... routes above
            // unchanged.
            Route::get('/interview-tracks', [InterviewTrackController::class, 'index'])->middleware('capability:ai_interviews');
            Route::get('/interview-tracks/{interviewTrack}', [InterviewTrackController::class, 'show'])->middleware('capability:ai_interviews');

            // Articles — read-only, whatever Mellow Ops has published (see
            // AdminArticleController). Every student sees the same catalog.
            Route::get('/articles/topics', [ArticleController::class, 'topics'])->middleware('capability:learning_centre');
            Route::get('/articles/topics/{articleTopic}', [ArticleController::class, 'topicShow'])->middleware('capability:learning_centre');
            Route::get('/articles/{article}', [ArticleController::class, 'show'])->middleware('capability:learning_centre');
            Route::post('/articles/{article}/read', [ArticleController::class, 'markRead'])->middleware('capability:learning_centre');

            // Learning Centre — the Articles nav item's new home (Reading Hub
            // links back to /articles/* above unchanged) plus three practice
            // modules: Speaking (Gemini-scored, synchronous), Listening
            // (deterministic grading, no Gemini call), Vocabulary (Gemini
            // generates a fresh quiz per attempt). See LearningCentreController's
            // docblock for the hub stats this overview route powers.
            // Core Prep — branch technical practice and timed proctored tests for ECE / EEE / Mech / Civil students. It only
            // exists for a student once staff have switched their branch live (CoreAccess); until then these answer 404 and
            // /core answers {available: false}. /me/core-stats is the same home, for the dashboard.
            Route::get('/core', [StudentCoreController::class, 'home']);
            Route::get('/me/core-stats', [StudentCoreController::class, 'home']);
            Route::post('/core/practice/next', [StudentCoreController::class, 'practiceNext']);
            Route::post('/core/practice/{coreQuestion}/answer', [StudentCoreController::class, 'practiceAnswer']);
            Route::post('/core/questions/{coreQuestion}/report', [StudentCoreController::class, 'report']);
            Route::get('/core/tests', [StudentCoreController::class, 'tests']);
            Route::post('/core/tests/{test}/start', [StudentCoreController::class, 'startTest']);
            Route::get('/core/sessions/{session}', [StudentCoreController::class, 'session']);
            Route::put('/core/sessions/{session}/answers/{coreQuestion}', [StudentCoreController::class, 'answer']);
            Route::post('/core/sessions/{session}/submit', [StudentCoreController::class, 'submit']);
            Route::get('/core/sessions/{session}/result', [StudentCoreController::class, 'result']);
            Route::post('/core/sessions/{session}/proctoring/start', [CoreTestProctoringController::class, 'start']);
            Route::post('/core/sessions/{session}/proctoring/violations', [CoreTestProctoringController::class, 'reportViolation'])->middleware('throttle:proctoring-event');

            Route::get('/learning-centre/overview', [LearningCentreController::class, 'overview'])->middleware('capability:learning_centre');

            Route::get('/learning-centre/speaking/prompts', [SpeakingPracticeController::class, 'index'])->middleware('capability:learning_centre');
            Route::post('/learning-centre/speaking/prompts/generate', [SpeakingPracticeController::class, 'generate'])->middleware('capability:learning_centre')
                ->middleware('throttle:ai-generation');
            Route::get('/learning-centre/speaking/prompts/{speakingPrompt}', [SpeakingPracticeController::class, 'show'])->middleware('capability:learning_centre');
            Route::post('/learning-centre/speaking/prompts/{speakingPrompt}/attempts', [SpeakingPracticeController::class, 'submit'])->middleware('capability:learning_centre')
                ->middleware('throttle:ai-generation');

            Route::get('/learning-centre/listening/lessons', [ListeningLabController::class, 'index'])->middleware('capability:learning_centre');
            // Writing a lesson around the student's own topic is the one Listening Lab call that costs a Gemini request.
            Route::post('/learning-centre/listening/lessons/generate', [ListeningLabController::class, 'generate'])->middleware('capability:learning_centre')
                ->middleware('throttle:ai-generation');
            Route::get('/learning-centre/listening/lessons/{listeningLesson}', [ListeningLabController::class, 'show'])->middleware('capability:learning_centre');
            Route::post('/learning-centre/listening/lessons/{listeningLesson}/attempts', [ListeningLabController::class, 'submit'])->middleware('capability:learning_centre');

            // Vocabulary Sprint: a curated word bank with spaced repetition. Sessions
            // (daily / deck / weak words) are built from the bank with no Gemini call;
            // only /generate (quick quiz on any topic) costs one. Answers are graded
            // one question at a time — see VocabularyController's docblock.
            Route::get('/learning-centre/vocabulary/overview', [VocabularyProgressController::class, 'overview'])->middleware('capability:learning_centre');
            Route::get('/learning-centre/vocabulary/words', [VocabularyProgressController::class, 'words'])->middleware('capability:learning_centre');
            Route::post('/learning-centre/vocabulary/sessions', [VocabularyController::class, 'start'])->middleware('capability:learning_centre')
                ->middleware('throttle:60,1');
            Route::get('/learning-centre/vocabulary/attempts/{vocabularyAttempt}', [VocabularyController::class, 'show'])->middleware('capability:learning_centre');
            Route::post('/learning-centre/vocabulary/attempts/{vocabularyAttempt}/answer', [VocabularyController::class, 'answer'])->middleware('capability:learning_centre')
                ->middleware('throttle:240,1');
            Route::post('/learning-centre/vocabulary/generate', [VocabularyController::class, 'generate'])->middleware('capability:learning_centre')
                ->middleware('throttle:ai-generation');
            // Original all-at-once grading, kept for a frontend deployed before the upgrade.
            Route::post('/learning-centre/vocabulary/attempts/{vocabularyAttempt}/submit', [VocabularyController::class, 'submit'])->middleware('capability:learning_centre');

            // Project Lab — SOW-guided, full-stack projects built in a browser
            // VS Code workspace. Browsing the catalog is open to every student;
            // the SOW body, PDF, milestone detail and workspace need the Project
            // Lab add-on (402 `project_lab_required` otherwise) — see
            // ProjectLabController's docblock. Throttles are per user.
            Route::get('/project-lab/topics', [ProjectLabController::class, 'index'])->middleware('capability:project_lab');
            Route::get('/project-lab/topics/{projectTopic:slug}', [ProjectLabController::class, 'show'])->middleware('capability:project_lab');
            Route::post('/project-lab/topics/{projectTopic:slug}/start', [ProjectLabController::class, 'start'])->middleware('capability:project_lab')->middleware('throttle:lab-topic-start');
            Route::get('/project-lab/topics/{projectTopic:slug}/sow.pdf', [ProjectLabController::class, 'downloadSow'])->middleware('capability:project_lab')->middleware('throttle:lab-sow');
            Route::get('/project-lab/projects', [ProjectLabController::class, 'mine'])->middleware('capability:project_lab');
            Route::get('/project-lab/enrollments/{enrollment}', [ProjectLabController::class, 'showEnrollment'])->middleware('capability:project_lab');
            Route::post('/project-lab/enrollments/{enrollment}/milestones/{milestone}/toggle', [ProjectLabController::class, 'toggleMilestone'])->middleware('capability:project_lab')->middleware('throttle:lab-milestone');
            Route::post('/project-lab/enrollments/{enrollment}/abandon', [ProjectLabController::class, 'abandon'])->middleware('capability:project_lab');

            // The workspace (browser VS Code). show() is the boot poll; heartbeat()
            // runs every minute while the workspace page is open and is the idle
            // detector and the hours meter — see WorkspaceManager.
            Route::post('/project-lab/enrollments/{enrollment}/workspace/start', [ProjectWorkspaceController::class, 'start'])->middleware('capability:project_lab')->middleware('throttle:lab-workspace-start');
            Route::get('/project-lab/enrollments/{enrollment}/workspace', [ProjectWorkspaceController::class, 'show'])->middleware('capability:project_lab')->middleware('throttle:lab-workspace-poll');
            Route::post('/project-lab/enrollments/{enrollment}/workspace/heartbeat', [ProjectWorkspaceController::class, 'heartbeat'])->middleware('capability:project_lab')->middleware('throttle:lab-workspace-heartbeat');
            Route::post('/project-lab/enrollments/{enrollment}/workspace/integrity', [ProjectWorkspaceController::class, 'integrity'])->middleware('capability:project_lab')->middleware('throttle:lab-integrity');
            Route::post('/project-lab/enrollments/{enrollment}/workspace/stop', [ProjectWorkspaceController::class, 'stop'])->middleware('capability:project_lab')->middleware('throttle:lab-workspace-stop');
            Route::post('/project-lab/enrollments/{enrollment}/submit', [ProjectWorkspaceController::class, 'submit'])->middleware('capability:project_lab')->middleware('throttle:lab-submit');

            // Proctoring — contest problem-solving only, never practice (see
            // ContestProctoringController's docblock). start() is idempotent
            // (resumes an existing session's real state on page refresh);
            // reportViolation() is what the frontend's tab-switch/fullscreen/
            // devtools detectors call as they fire.
            Route::post('/contests/{contest}/problems/{contestProblem}/proctoring/start', [ContestProctoringController::class, 'start'])->middleware('capability:contests');
            Route::post('/contests/{contest}/problems/{contestProblem}/proctoring/violations', [ContestProctoringController::class, 'reportViolation'])->middleware('capability:contests')->middleware('throttle:proctoring-event');

            // A student's own place in the Vault — see StudentVaultController's
            // docblock. Getting in is the readiness score's doing (refreshed
            // server-side, never here); this is the student's half: where they
            // stand, the one standing consent to be listed (and to take it back),
            // and responding to a hiring partner's HR interview invite.
            Route::get('/me/vault', [StudentVaultController::class, 'show']);
            Route::post('/me/vault/consent', [StudentVaultController::class, 'consent']);
            Route::delete('/me/vault/consent', [StudentVaultController::class, 'withdraw']);
            Route::post('/me/vault/inquiries/{inquiry}/respond', [StudentVaultController::class, 'respondToInterview']);
        });
});
