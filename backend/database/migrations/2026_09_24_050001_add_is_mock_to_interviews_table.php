<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a `company`/`company_hiring` interview as a practice round for
 * shortlisted candidates rather than the real evaluated one — lets a
 * hiring partner (or Ops, for `company`-type) publish both for the same
 * placement drive and have candidates/reviewers tell them apart at a
 * glance. Meaningless for `general`/`tpo_mock` (already unambiguous by
 * type alone — a tpo_mock interview IS inherently practice), so those
 * always stay false.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->boolean('is_mock')->default(false)->after('interview_type');
        });
    }

    public function down(): void
    {
        Schema::table('interviews', function (Blueprint $table) {
            $table->dropColumn('is_mock');
        });
    }
};
