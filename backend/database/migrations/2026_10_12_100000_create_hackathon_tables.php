<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hack Arena: hackathons hosted by AptRun (Mellow Ops) or by a hiring partner,
 * and the students who compete in them.
 *
 *   hackathons                 the event: schedule, prizes, tracks, judging criteria
 *   hackathon_teams            a team inside one hackathon (a solo entrant is a team of one)
 *   hackathon_participants     one registration per (hackathon, student), always attached to a team
 *   hackathon_submissions      a team's project: links, write-up, and the judges' scores
 *   hackathon_announcements    organiser updates shown on the hackathon page
 *
 * The phase a hackathon is in (upcoming, live, judging…) is never stored: it is
 * derived from the timestamps, so it cannot drift out of step with the clock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hackathons', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title', 160);
            $table->string('tagline', 200);
            $table->longText('description'); // Markdown
            $table->string('cover_image')->nullable(); // storage path, absolute URL, or a "/…" asset shipped with the frontend
            $table->string('accent', 16)->default('indigo'); // colour family for cards without a cover, and for tinting the page
            $table->json('themes')->nullable(); // ["AI", "Open Innovation"]
            $table->string('mode', 12)->default('online'); // online | in_person | hybrid
            $table->string('location', 160)->nullable();

            $table->string('host_type', 12)->default('platform'); // platform | company
            // A company that hosted a hackathon cannot be deleted out from under it.
            $table->foreignId('company_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('status', 12)->default('draft'); // draft | published | cancelled
            // dateTime, not timestamp: MySQL gives a NOT NULL TIMESTAMP without a default an invalid one (error 1067
            // when two such columns share a table) and TIMESTAMP stops at 2038. All times are stored in UTC.
            $table->dateTime('registration_opens_at');
            $table->dateTime('registration_closes_at');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at'); // the submission deadline
            $table->timestamp('results_expected_at')->nullable(); // informational only
            $table->timestamp('results_published_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancelled_reason', 300)->nullable();

            $table->unsignedTinyInteger('min_team_size')->default(1);
            $table->unsignedTinyInteger('max_team_size')->default(4);
            $table->unsignedInteger('max_participants')->nullable(); // individual students, not teams

            $table->unsignedBigInteger('prize_pool_amount')->default(0);
            $table->string('currency', 3)->default('INR');
            $table->json('prizes')->nullable(); // [{place, title, reward, perks[]}]
            $table->json('tracks')->nullable(); // [{name, description}]
            $table->json('criteria')->nullable(); // [{name, weight, description}] — weights sum to 100
            $table->longText('rules')->nullable(); // Markdown
            $table->text('eligibility')->nullable();
            $table->json('faqs')->nullable(); // [{question, answer}]
            $table->json('resources')->nullable(); // [{label, url}]

            $table->boolean('is_featured')->default(false);
            $table->timestamps();

            $table->index(['status', 'starts_at']);
            $table->index(['status', 'ends_at']);
            $table->index('company_id');
        });

        Schema::create('hackathon_teams', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hackathon_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('invite_code', 12);
            $table->foreignId('leader_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['hackathon_id', 'invite_code']);
            $table->unique(['hackathon_id', 'name']);
        });

        Schema::create('hackathon_participants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hackathon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hackathon_team_id')->constrained()->cascadeOnDelete();
            $table->string('role', 8)->default('member'); // leader | member
            $table->timestamp('registered_at')->useCurrent();
            $table->timestamps();

            // The one rule everything else leans on: a student competes in a hackathon once.
            $table->unique(['hackathon_id', 'user_id']);
            $table->index('hackathon_team_id');
            $table->index('user_id');
        });

        Schema::create('hackathon_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hackathon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hackathon_team_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('title', 120);
            $table->string('tagline', 200)->nullable();
            $table->text('description')->nullable();
            $table->string('track', 80)->nullable();
            $table->string('repo_url', 300)->nullable();
            $table->string('demo_url', 300)->nullable();
            $table->string('video_url', 300)->nullable();
            $table->json('tech_stack')->nullable();
            $table->string('status', 12)->default('draft'); // draft | submitted
            $table->timestamp('submitted_at')->nullable();

            // Judging.
            $table->json('scores')->nullable(); // {criterion name: 0–10}
            $table->decimal('final_score', 5, 2)->nullable(); // weighted, 0–100
            $table->unsignedInteger('rank')->nullable();
            $table->string('award_label', 80)->nullable();
            $table->text('feedback')->nullable();
            $table->foreignId('scored_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('scored_at')->nullable();
            $table->boolean('is_disqualified')->default(false);
            $table->string('disqualified_reason', 300)->nullable();
            $table->timestamps();

            // One project per team.
            $table->unique('hackathon_team_id');
            $table->index(['hackathon_id', 'status']);
            $table->index(['hackathon_id', 'rank']);
        });

        Schema::create('hackathon_announcements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hackathon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('title', 160);
            $table->text('body');
            $table->timestamps();

            $table->index(['hackathon_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hackathon_announcements');
        Schema::dropIfExists('hackathon_submissions');
        Schema::dropIfExists('hackathon_participants');
        Schema::dropIfExists('hackathon_teams');
        Schema::dropIfExists('hackathons');
    }
};
