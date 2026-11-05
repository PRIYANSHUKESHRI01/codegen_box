<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Scheduling for a college's own mock AI interviews.
 *
 * A TPO's mock interview used to be "published or not": visible to the whole college (or the branches it named) the moment it
 * went live, with no start, no deadline and no way to say "only Section A" or "these twelve students". This adds:
 *
 *   opens_at / closes_at   the window in which students may START it (a sitting already begun may be finished after close)
 *   audience_filter        who, beyond branch: {years: [3], sections: ["CSE_A"], student_ids: [12, 40]}. Combined with the
 *                          existing branch_audience; any list left out means "no restriction on that"
 *   announced_at           when students were told it exists / was rescheduled
 *   open_reminder_sent_at  the "opens in about an hour" reminder has gone out (once per schedule)
 *   close_reminder_sent_at the "closes soon" reminder has gone out to those who have not finished (once per schedule)
 *
 * Every column is nullable: an interview with none of them set behaves exactly as it always did, so nothing already published changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            if (! Schema::hasColumn('interviews', 'opens_at')) {
                $table->dateTime('opens_at')->nullable()->after('qualifying_score_percent');
            }
            if (! Schema::hasColumn('interviews', 'closes_at')) {
                $table->dateTime('closes_at')->nullable()->after('opens_at');
            }
            if (! Schema::hasColumn('interviews', 'audience_filter')) {
                $table->json('audience_filter')->nullable()->after('closes_at');
            }
            if (! Schema::hasColumn('interviews', 'announced_at')) {
                $table->dateTime('announced_at')->nullable()->after('audience_filter');
            }
            if (! Schema::hasColumn('interviews', 'open_reminder_sent_at')) {
                $table->dateTime('open_reminder_sent_at')->nullable()->after('announced_at');
            }
            if (! Schema::hasColumn('interviews', 'close_reminder_sent_at')) {
                $table->dateTime('close_reminder_sent_at')->nullable()->after('open_reminder_sent_at');
            }
        });

        // The reminder sweep looks for published college mocks by window; a plain index on the window keeps it cheap.
        try {
            Schema::table('interviews', function (Blueprint $table) {
                $table->index(['interview_type', 'opens_at'], 'interviews_type_opens_index');
            });
        } catch (\Throwable) {
            // already there (re-run after a partial failure)
        }
    }

    public function down(): void
    {
        try {
            Schema::table('interviews', function (Blueprint $table) {
                $table->dropIndex('interviews_type_opens_index');
            });
        } catch (\Throwable) {
        }

        Schema::table('interviews', function (Blueprint $table) {
            foreach (['close_reminder_sent_at', 'open_reminder_sent_at', 'announced_at', 'audience_filter', 'closes_at', 'opens_at'] as $column) {
                if (Schema::hasColumn('interviews', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
