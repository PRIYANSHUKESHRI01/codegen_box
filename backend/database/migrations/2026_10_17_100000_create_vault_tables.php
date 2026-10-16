<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Vault — students whose readiness score says they are ready to be hired.
 * It replaces the Talent Pool (talent_pool_* tables, which are left untouched
 * here and copied across by the next migration; drop them in a later release
 * once nobody needs the old rows).
 *
 * vault_profiles — one row per student who has ever been, or said they want to
 *   be, in the Vault. The row stores the PRIMITIVES (is the score high enough,
 *   did the student consent, did staff hide it, was the student hired) and
 *   `visibility_status`, the single derived value everything else filters on.
 *   The derivation lives in one method, VaultProfile::resolveStatus(), and is
 *   only ever written by VaultService — never set it by hand:
 *
 *     hired               hired through an AptRun partner or on Mellow Vault
 *     hidden_by_mellow    staff pulled the profile (policy / quality)
 *     not_ready           readiness below the bar (never reached it, or dropped
 *                         clearly under it) — consent, if given, is remembered
 *     pending_consent     ready, and the student has not said yes yet
 *     hidden_by_candidate ready, but the student withdrew their consent
 *     visible             ready + consented: hiring partners see it and it is
 *                         handed to Mellow Vault
 *
 * vault_inquiries / vault_messages — a hiring partner's relationship with one
 *   profile (interest → HR interview → hire, and one-off messages). The same
 *   records the Talent Pool kept, under the new name.
 *
 * vault_sync_events — the outbox of what has to be told to Mellow Vault. An
 *   event is written in the same step as the change that caused it, so a Mellow
 *   Vault outage can never lose a profile or, worse, leave a withdrawn student
 *   listed. It deliberately has NO foreign key to vault_profiles or users: when
 *   a student's account is deleted, the withdrawal must outlive the account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vault_profiles', function (Blueprint $table) {
            $table->id();
            // The id Mellow Vault knows this student by — never the auto-increment id, never the user id.
            $table->string('public_id', 26)->unique();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();

            $table->string('visibility_status', 24)->default('not_ready');

            // ── readiness, as of the last refresh (the live score is always computed; this is what we sort and sync on)
            $table->boolean('is_eligible')->default(false);
            $table->unsignedTinyInteger('readiness_score')->default(0);
            $table->unsignedTinyInteger('peak_readiness')->default(0);
            $table->string('readiness_tier', 20)->nullable();
            $table->json('readiness_components')->nullable();
            $table->unsignedSmallInteger('readiness_version')->nullable();
            $table->timestamp('readiness_computed_at')->nullable();
            $table->timestamp('qualified_at')->nullable();   // the first time the bar was reached
            $table->timestamp('eligible_since')->nullable(); // the current stretch above it
            $table->timestamp('left_at')->nullable();        // the last time the score dropped below the exit line

            // Where eligibility came from: the readiness score, or a legacy Talent Pool contest result carried over.
            $table->string('qualification_source', 20)->default('readiness');
            $table->foreignId('legacy_source_contest_id')->nullable()->constrained('contests')->nullOnDelete();
            $table->decimal('legacy_score_percent', 5, 2)->nullable();

            // ── consent: ONE standing, revocable yes, covering AptRun's hiring partners and Mellow Vault
            $table->timestamp('consent_given_at')->nullable();
            $table->timestamp('consent_withdrawn_at')->nullable();

            // ── staff override
            $table->timestamp('hidden_by_staff_at')->nullable();
            $table->foreignId('hidden_by_staff_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('hidden_reason', 300)->nullable();

            // ── hired
            $table->timestamp('hired_at')->nullable();
            $table->string('hired_via', 20)->nullable(); // aptrun_partner | mellow_vault
            $table->foreignId('hired_by_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->string('hired_employer_name', 160)->nullable();

            $table->timestamp('ready_notified_at')->nullable(); // the "you are Vault-ready" email, sent once

            // ── hand-off to Mellow Vault
            $table->string('sync_state', 12)->default('idle'); // idle | pending | delivered | failed
            $table->unsignedInteger('sync_sequence')->default(0);
            $table->string('payload_hash', 40)->nullable(); // of the last profile we queued, so an unchanged profile is never re-sent
            $table->timestamp('vault_listed_at')->nullable(); // set while Mellow Vault last acknowledged a listing
            $table->timestamp('last_synced_at')->nullable();
            $table->string('external_id', 100)->nullable();

            $table->timestamps();

            $table->index(['visibility_status', 'readiness_score']);
            $table->index('is_eligible');
            $table->index('sync_state');
        });

        Schema::create('vault_inquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vault_profile_id')->constrained('vault_profiles')->cascadeOnDelete();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('initiated_by')->constrained('users')->cascadeOnDelete();
            // interested | interview_scheduled | interview_completed | hired
            // | declined_by_company | declined_by_candidate | withdrawn
            $table->string('status')->default('interested');
            $table->timestamp('interview_scheduled_at')->nullable();
            $table->string('interview_mode')->nullable(); // online | offline
            $table->string('interview_location')->nullable(); // meeting link or physical address
            $table->text('interview_notes')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->decimal('ctc_offered', 10, 2)->nullable();
            $table->timestamp('hired_at')->nullable();
            $table->timestamps();

            $table->unique(['vault_profile_id', 'company_id']);
            $table->index('status');
        });

        Schema::create('vault_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vault_inquiry_id')->constrained('vault_inquiries')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('message');
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('vault_sync_events', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique(); // the event id AND the idempotency key Mellow Vault dedupes on
            $table->unsignedBigInteger('vault_profile_id')->nullable()->index(); // no FK — see the docblock
            $table->string('profile_public_id', 26)->index();
            $table->string('type', 24); // profile.upsert | profile.withdraw
            $table->string('reason', 40)->nullable();
            $table->unsignedInteger('sequence')->default(0);
            $table->json('payload');
            $table->string('status', 12)->default('pending'); // pending | processing | delivered | failed | dead
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('available_at')->useCurrent();
            $table->timestamp('processing_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->unsignedSmallInteger('last_status_code')->nullable();
            $table->string('last_error', 500)->nullable();
            $table->timestamps();

            $table->index(['status', 'available_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_sync_events');
        Schema::dropIfExists('vault_messages');
        Schema::dropIfExists('vault_inquiries');
        Schema::dropIfExists('vault_profiles');
    }
};
