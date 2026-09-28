<?php

use App\Http\Controllers\Api\AdminArticleController;
use App\Http\Controllers\Api\AdminArticleTopicController;
use App\Http\Controllers\Api\AdminCompanyController;
use App\Http\Controllers\Api\AdminContestController;
use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AdminInterviewController;
use App\Http\Controllers\Api\AdminInterviewQuestionBankController;
use App\Http\Controllers\Api\AdminInterviewRoleTemplateController;
use App\Http\Controllers\Api\AdminInterviewTrackController;
use App\Http\Controllers\Api\AdminPlacementDriveController;
use App\Http\Controllers\Api\AdminProblemController;
use App\Http\Controllers\Api\AdminTalentPoolController;
use App\Http\Controllers\Api\ArticleController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContestController;
use App\Http\Controllers\Api\ContestProctoringController;
use App\Http\Controllers\Api\ContestSubmissionController;
use App\Http\Controllers\Api\CompanyCandidateController;
use App\Http\Controllers\Api\CompanyCollegeController;
use App\Http\Controllers\Api\CompanyContestController;
use App\Http\Controllers\Api\CompanyDriveController;
use App\Http\Controllers\Api\CompanyInterviewController;
use App\Http\Controllers\Api\CompanyInterviewRoleTemplateController;
use App\Http\Controllers\Api\CompanyInterviewTrackController;
use App\Http\Controllers\Api\CompanyProctoringController;
use App\Http\Controllers\Api\CompanyReportsController;
use App\Http\Controllers\Api\CompanyTalentPoolController;
use App\Http\Controllers\Api\ContactRequestController;
use App\Http\Controllers\Api\CoordinatorProctoringController;
use App\Http\Controllers\Api\CoordinatorStudentController;
use App\Http\Controllers\Api\InterviewController;
use App\Http\Controllers\Api\InterviewProctoringController;
use App\Http\Controllers\Api\InterviewQuestionBankController;
use App\Http\Controllers\Api\InterviewQuestionGenerationController;
use App\Http\Controllers\Api\InterviewTrackController;
use App\Http\Controllers\Api\InternalCustomerController;
use App\Http\Controllers\Api\JudgeResultController;
use App\Http\Controllers\Api\LeaderboardController;
use App\Http\Controllers\Api\MarketingContactRequestController;
use App\Http\Controllers\Api\MarketingLeadController;
use App\Http\Controllers\Api\NewsletterController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PhoneVerificationController;
use App\Http\Controllers\Api\ProblemController;
use App\Http\Controllers\Api\PublicController;
use App\Http\Controllers\Api\StudentDriveController;
use App\Http\Controllers\Api\StudentImportController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\StudentStatsController;
use App\Http\Controllers\Api\StudentTalentPoolController;
use App\Http\Controllers\Api\SubmissionController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SuperAdminController;
use App\Http\Controllers\Api\TpoContestController;
use App\Http\Controllers\Api\TpoCoordinatorController;
use App\Http\Controllers\Api\TpoInterviewController;
use App\Http\Controllers\Api\TpoInterviewRoleTemplateController;
use App\Http\Controllers\Api\TpoInterviewTrackController;
use App\Http\Controllers\Api\TpoDriveApplicationController;
use App\Http\Controllers\Api\TpoDriveController;
use App\Http\Controllers\Api\TpoProctoringController;
use App\Http\Controllers\Api\TpoReportsController;
use App\Http\Controllers\Api\TpoStudentController;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// The public marketing site's "Talk to Our Team" form — unauthenticated,
// never creates a user account (see ContactRequest's own docblock for why).
Route::post('/contact-requests', [ContactRequestController::class, 'store'])
    ->middleware('throttle:contact-request');

// The public footer's newsletter signup — unauthenticated, its own tiny surface.
Route::post('/newsletter/subscribe', [NewsletterController::class, 'subscribe'])
    ->middleware('throttle:newsletter-subscribe');

// The only unauthenticated data reads in this API — the public marketing
// landing page's real-numbers Stats section and Problem Explorer/navbar
// search preview. See PublicController's own docblock for exactly what's
// safe to expose here (aggregate counts + non-sensitive problem fields
// only, never a hidden test case).
Route::prefix('public')->middleware('throttle:60,1')->group(function () {
    Route::get('/stats', [PublicController::class, 'stats']);
    Route::get('/problems/sample', [PublicController::class, 'sampleProblems']);
});

Route::prefix('password')->group(function () {
    Route::post('/forgot', [PasswordResetController::class, 'forgot'])
        ->middleware('throttle:password-reset-request');
    Route::post('/otp/verify', [PasswordResetController::class, 'verifyOtp'])
        ->middleware('throttle:password-reset-verify');
    Route::post('/reset', [PasswordResetController::class, 'reset'])
        ->middleware('throttle:password-reset-verify');
});

Route::middleware('auth:sanctum')->group(function () {
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

    // Settings → Billing, and the /pricing page when signed in. mine()
    // branches internally per role (student's own/college coverage, TPO's
    // college, or "internal" for staff) — subscribe() further restricts
    // itself to role:user, so no route-level role middleware is needed here.
    Route::get('/me/subscription', [SubscriptionController::class, 'mine']);
    Route::post('/me/subscription', [SubscriptionController::class, 'subscribe']);

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

                // White-glove path: Mellow staff run the same bulk student
                // import on a college's behalf (e.g. they emailed us their
                // spreadsheet instead of uploading it themselves) — part of
                // the same college-management workflow, same permission.
                Route::get('/students/import-template', [StudentImportController::class, 'template']);
                Route::post('/colleges/{college}/students/import', [StudentImportController::class, 'storeForCollege']);
                Route::get('/colleges/{college}/students/imports', [StudentImportController::class, 'indexForCollege']);
                Route::get('/colleges/{college}/students/imports/{studentImport}', [StudentImportController::class, 'showForCollege']);
            });

            Route::middleware('permission:'.User::PERM_PLATFORM_USERS)->group(function () {
                Route::get('/users', [AdminController::class, 'users']);
                Route::post('/users', [AdminController::class, 'storeUser']);
                Route::post('/users/{user}/toggle-block', [AdminController::class, 'toggleUserBlock']);
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

            Route::middleware('permission:'.User::PERM_TALENT_POOL)->group(function () {
                // Marketplace oversight only — authoring the sourcing
                // assessment itself (the `talent_pool` contest/interview
                // that qualifies a candidate) reuses the Contests/AI
                // Interviews sections above (permission:contests /
                // permission:interviews), same "one source of truth per
                // concept" pattern as every other contest/interview type.
                Route::get('/talent-pool/colleges', [AdminTalentPoolController::class, 'colleges']);
                Route::get('/talent-pool/candidates', [AdminTalentPoolController::class, 'index']);
                Route::post('/talent-pool/candidates/{candidate}/visibility', [AdminTalentPoolController::class, 'updateVisibility']);
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
            Route::get('/marketing-performance', [SuperAdminController::class, 'marketingPerformance']);
            Route::get('/audit-logs', [SuperAdminController::class, 'auditLogs']);
            Route::get('/judge-nodes', [SuperAdminController::class, 'judgeNodes']);
            Route::get('/feature-flags', [SuperAdminController::class, 'featureFlags']);
            Route::post('/feature-flags/{flag}/toggle', [SuperAdminController::class, 'toggleFeatureFlag']);
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
            Route::get('/students/import-template', [StudentImportController::class, 'template']);
            Route::post('/students/import', [StudentImportController::class, 'storeMine']);
            Route::get('/students/imports', [StudentImportController::class, 'indexMine']);
            Route::get('/students/imports/{studentImport}', [StudentImportController::class, 'showMine']);

            // Student Cohort page: real roster + readiness scoring + bulk
            // placeholder-template notification emails, plus adding one
            // student by hand (the same account+welcome-email pipeline as
            // the CSV import above, for a single straggler).
            Route::get('/students/cohort', [TpoStudentController::class, 'index']);
            Route::post('/students', [TpoStudentController::class, 'store']);
            Route::post('/students/bulk-notify', [TpoStudentController::class, 'bulkNotify']);

            // Section Coordinators: TPO-provisioned accounts, each scoped to
            // exactly one section of this college, that can view/lightly
            // manage (never create/import) the students already in it.
            Route::get('/coordinators', [TpoCoordinatorController::class, 'index']);
            Route::post('/coordinators', [TpoCoordinatorController::class, 'store']);
            Route::put('/coordinators/{user}', [TpoCoordinatorController::class, 'update']);
            Route::post('/coordinators/{user}/toggle-block', [TpoCoordinatorController::class, 'toggleBlock']);

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

            // The shared Talent Pool marketplace — candidates Mellow itself
            // already tested (see CompanyTalentPoolController's docblock),
            // independent of any job opening this company created. Every
            // action here is mediated by the platform (no candidate email/
            // phone is ever returned directly).
            Route::get('/talent-pool', [CompanyTalentPoolController::class, 'index']);
            Route::get('/talent-pool/inquiries', [CompanyTalentPoolController::class, 'myInquiries']);
            Route::get('/talent-pool/{candidate}', [CompanyTalentPoolController::class, 'show']);
            Route::get('/talent-pool/{candidate}/resume', [CompanyTalentPoolController::class, 'resume']);
            Route::post('/talent-pool/{candidate}/interest', [CompanyTalentPoolController::class, 'expressInterest']);
            Route::post('/talent-pool/{candidate}/interview', [CompanyTalentPoolController::class, 'scheduleInterview']);
            Route::post('/talent-pool/{candidate}/hire', [CompanyTalentPoolController::class, 'hire']);
            Route::post('/talent-pool/{candidate}/notify', [CompanyTalentPoolController::class, 'notify']);
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
            Route::get('/students', [CoordinatorStudentController::class, 'index']);
            Route::post('/students/{user}/toggle-block', [CoordinatorStudentController::class, 'toggleBlock']);
            Route::post('/students/bulk-notify', [CoordinatorStudentController::class, 'bulkNotify']);

            // Same proctoring review as the TPO's, but scoped to exactly
            // this coordinator's own section — see CoordinatorProctoringController.
            Route::get('/proctoring', [CoordinatorProctoringController::class, 'index']);
            Route::get('/proctoring/{proctoringSession}', [CoordinatorProctoringController::class, 'show']);
            Route::post('/proctoring/{proctoringSession}/reinstate', [CoordinatorProctoringController::class, 'reinstate']);
        });

    // Read-only problem catalog (title/difficulty/tags — never the hidden
    // judging internals show() below returns) — not student-only, unlike
    // everything else in the role:user group beneath it. Every role that
    // curates a contest's problem set needs to browse it: Mellow Ops
    // building general/company contests, a TPO building their own mock
    // contest, and superadmin. ProblemController::index()'s per-user
    // `solved` flag is harmless for a staff caller — it's just always false.
    Route::middleware('role:'.User::ROLE_USER.','.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->get('/problems', [ProblemController::class, 'index']);

    // Read-only interview question bank browse — shared by every authoring
    // role (Ops/TPO/Company) to pick questions to attach to their own
    // interview. Same multi-role shape as /problems above.
    Route::middleware('role:'.User::ROLE_ADMIN_INTERNAL.','.User::ROLE_ADMIN_TPO.','.User::ROLE_SUPERADMIN.','.User::ROLE_ADMIN_COMPANY)
        ->get('/interview-question-bank/browse', [InterviewQuestionBankController::class, 'index']);

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
            Route::get('/drives', [StudentDriveController::class, 'index']);
            Route::get('/drives/{placementDrive}', [StudentDriveController::class, 'show']);

            Route::get('/problems/{problem}', [ProblemController::class, 'show']);
            // Run/Submit only enqueue (202 + token) — the verdict is collected
            // from /judge/{token} below. Per-user throttles, never per-IP.
            Route::post('/problems/{problem}/run', [SubmissionController::class, 'run'])->middleware('throttle:judge-run');
            Route::post('/problems/{problem}/submit', [SubmissionController::class, 'submit'])->middleware('throttle:judge-submit');
            Route::get('/judge/{token}', [JudgeResultController::class, 'show'])->middleware('throttle:judge-poll');

            // Real solved-count/streak/topic-mastery/etc — powers the
            // dashboard, performance report, and practice pages.
            Route::get('/me/stats', [StudentStatsController::class, 'mine']);
            Route::get('/me/rating-history', [StudentStatsController::class, 'ratingHistory']);

            // Global leaderboard, ranked by real solved-score (or real
            // contest rating once a student has one — see User::displayRating()).
            Route::get('/leaderboard', [LeaderboardController::class, 'index']);

            Route::get('/contests', [ContestController::class, 'index']);
            Route::get('/contests/{contest}', [ContestController::class, 'show']);
            Route::post('/contests/{contest}/register', [ContestController::class, 'register']);
            Route::delete('/contests/{contest}/register', [ContestController::class, 'unregister']);
            Route::get('/contests/{contest}/leaderboard', [ContestController::class, 'leaderboard']);
            Route::get('/contests/{contest}/problems/{contestProblem}', [ContestSubmissionController::class, 'show']);
            Route::post('/contests/{contest}/problems/{contestProblem}/run', [ContestSubmissionController::class, 'run'])->middleware('throttle:judge-run');
            Route::post('/contests/{contest}/problems/{contestProblem}/submit', [ContestSubmissionController::class, 'submit'])->middleware('throttle:judge-submit');

            // AI Interviews — see InterviewController's docblock. No
            // judge-* throttle needed (no judge involved), plain default.
            Route::get('/interviews', [InterviewController::class, 'index']);
            Route::get('/interviews/{interview}', [InterviewController::class, 'show']);
            Route::post('/interviews/{interview}/start', [InterviewController::class, 'start']);
            Route::post('/interviews/{interview}/answer', [InterviewController::class, 'answer']);
            Route::post('/interviews/{interview}/complete', [InterviewController::class, 'complete']);
            Route::get('/interviews/{interview}/result', [InterviewController::class, 'result']);

            // Camera/mic proctoring for the interview attempt — mirrors the
            // contest proctoring routes above (start() is idempotent, resumes
            // an existing session on refresh; reportViolation() is what the
            // frontend's tab-switch/fullscreen/devtools detectors call).
            Route::post('/interviews/{interview}/proctoring/start', [InterviewProctoringController::class, 'start']);
            Route::post('/interviews/{interview}/proctoring/violations', [InterviewProctoringController::class, 'reportViolation'])->middleware('throttle:proctoring-event');

            // The "Final Interview" 3-round pipeline — index() is where a
            // candidate discovers a track exists at all (standalone
            // /interviews above excludes track rounds); show() is the
            // locked/unlocked/scored state per round. Taking a round itself
            // reuses the plain /interviews/{interview}/... routes above
            // unchanged.
            Route::get('/interview-tracks', [InterviewTrackController::class, 'index']);
            Route::get('/interview-tracks/{interviewTrack}', [InterviewTrackController::class, 'show']);

            // Articles — read-only, whatever Mellow Ops has published (see
            // AdminArticleController). Every student sees the same catalog.
            Route::get('/articles/topics', [ArticleController::class, 'topics']);
            Route::get('/articles/topics/{articleTopic}', [ArticleController::class, 'topicShow']);
            Route::get('/articles/{article}', [ArticleController::class, 'show']);
            Route::post('/articles/{article}/read', [ArticleController::class, 'markRead']);

            // Proctoring — contest problem-solving only, never practice (see
            // ContestProctoringController's docblock). start() is idempotent
            // (resumes an existing session's real state on page refresh);
            // reportViolation() is what the frontend's tab-switch/fullscreen/
            // devtools detectors call as they fire.
            Route::post('/contests/{contest}/problems/{contestProblem}/proctoring/start', [ContestProctoringController::class, 'start']);
            Route::post('/contests/{contest}/problems/{contestProblem}/proctoring/violations', [ContestProctoringController::class, 'reportViolation'])->middleware('throttle:proctoring-event');

            // A student's own Talent Pool standing — see
            // StudentTalentPoolController's docblock. Qualification itself
            // happens server-side (TalentPoolQualificationService), never
            // here; this is consent (opt in/out of being discoverable) and
            // responding to a hiring partner's HR interview invite.
            Route::get('/me/talent-pool', [StudentTalentPoolController::class, 'mine']);
            Route::post('/me/talent-pool/opt-in', [StudentTalentPoolController::class, 'optIn']);
            Route::post('/me/talent-pool/opt-out', [StudentTalentPoolController::class, 'optOut']);
            Route::post('/me/talent-pool/inquiries/{inquiry}/respond', [StudentTalentPoolController::class, 'respondToInterview']);
        });
});
