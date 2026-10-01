<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The actual submitted source, persisted for the first time. Both
 * `submissions` and `contest_submissions` have always stored the VERDICT
 * (status, runtime, points) but never the code that produced it — `code`
 * was sent to the judge for execution and discarded the moment a result
 * came back (see JudgeOutcomePersister, unchanged until this migration's
 * companion code change). That made "a TPO/admin can review what a student
 * actually wrote" structurally impossible, not just unbuilt: there was
 * nothing in the database to show.
 *
 * Nullable, not backfilled: every row that already exists was written
 * before code was ever captured, so there is no code to recover for it —
 * StudentReportService renders those honestly as "not recorded" rather than
 * a fabricated blank. Every row written after this migration lands with
 * app/Services/Judge/JudgeOutcomePersister actually saving it.
 *
 * `longtext`, not `text`: max_code_length defaults to 65536 chars
 * (config/judge.php), which already exceeds plain TEXT's 65,535-byte cap
 * once multibyte characters are in play — LONGTEXT has no realistic ceiling
 * for this app's own submission-size limit.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->longText('code')->nullable()->after('language');
        });

        Schema::table('contest_submissions', function (Blueprint $table) {
            $table->longText('code')->nullable()->after('language');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn('code');
        });

        Schema::table('contest_submissions', function (Blueprint $table) {
            $table->dropColumn('code');
        });
    }
};
