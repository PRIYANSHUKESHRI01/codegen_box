<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per candidate who has ever qualified for the Talent Pool (a
 * `talent_pool` Contest score >= that assessment's qualifying_score_percent
 * — see App\Services\TalentPoolQualificationService, which is the only
 * writer of source_contest_id/score_percent/qualified_at). Unique on
 * user_id: this is a rolling "current standing" record, not a history of
 * every attempt — a later, better-qualifying assessment simply overwrites
 * the score/source here (see the service for why a worse retake never
 * overwrites a better prior one).
 *
 * `visibility_status` is the single field every other part of this feature
 * reads to decide "is this candidate real, and can a hiring partner see
 * them right now":
 *  - pending_consent: just qualified, not yet browsable — the default.
 *    Mellow deliberately never auto-publishes a candidate's profile to
 *    hiring partners without them opting in first (see
 *    TalentPoolQualifiedMail).
 *  - visible: candidate opted in — this is the ONLY status
 *    CompanyTalentPoolController::index() ever returns rows for.
 *  - hidden_by_candidate: candidate opted back out after previously
 *    consenting (their own settings toggle).
 *  - hidden_by_mellow: a Mellow Ops override (policy/quality reasons) —
 *    distinct from hidden_by_candidate so the two can never be confused
 *    about whose decision it was.
 *  - hired: a company hired them through this feature (see
 *    hired_by_company_id/hired_at) — permanently out of the browsable pool,
 *    kept as a historical record rather than deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('talent_pool_candidates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('source_contest_id')->nullable()->constrained('contests')->nullOnDelete();
            $table->decimal('score_percent', 5, 2);
            $table->timestamp('qualified_at');
            $table->string('visibility_status')->default('pending_consent');
            $table->timestamp('consent_given_at')->nullable();
            $table->foreignId('hired_by_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->timestamp('hired_at')->nullable();
            $table->timestamps();

            $table->index('visibility_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('talent_pool_candidates');
    }
};
