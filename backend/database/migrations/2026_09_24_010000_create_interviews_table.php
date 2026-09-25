<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI Interview — structural sibling of `contests` (see that migration's
 * docblock), but async/self-paced rather than a timed live event: no
 * start_at/end_at, no is_rated/finalized_at, no daily_key. A candidate
 * starts it whenever they're invited/eligible and works through it at their
 * own pace (see interview_sessions). `interview_type` mirrors Contest's
 * `contest_type` — general | company | tpo_mock | company_hiring — see
 * App\Models\Interview.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interviews', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('status')->default('draft'); // draft | published | cancelled
            $table->string('interview_type')->default('general'); // general | company | tpo_mock | company_hiring
            $table->foreignId('company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignId('placement_drive_id')->nullable()->constrained('placement_drives')->nullOnDelete();
            $table->foreignId('owning_college_id')->nullable()->constrained('colleges')->nullOnDelete();
            $table->foreignId('owning_company_id')->nullable()->constrained('companies')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('interview_type');
            $table->index('owning_college_id');
            $table->index('owning_company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interviews');
    }
};
