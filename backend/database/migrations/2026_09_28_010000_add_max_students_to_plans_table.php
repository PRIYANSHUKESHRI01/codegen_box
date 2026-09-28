<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Wires up the seat caps institution plans already advertise on the pricing
 * page (frontend/src/data/pricing.ts — "Up to 500 student seats" on
 * Standard, "Up to 2,000" on Pro Campus, "Unlimited" on Academic
 * Enterprise) but that nothing has ever enforced. `null` = unlimited, same
 * convention as the *_per_day entitlement columns added alongside this one
 * — see College::studentLimit() for how it's resolved and
 * StudentImportService/ProcessStudentImportJob/TpoStudentController for
 * where it's enforced.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->unsignedInteger('max_students')->nullable()->after('drive_access');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('max_students');
        });
    }
};
