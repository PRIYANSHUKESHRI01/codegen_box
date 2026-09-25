<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two nullable FKs, parallel to `college_id` but for the new company hiring
 * tenant:
 *
 * - `company_id`: an admin_company account's own tenant scope, mutually
 *   exclusive with `college_id` at the application layer only — same
 *   "convention, not DB-enforced" precedent as one-admin_tpo-per-college.
 * - `invited_by_company_id`: set on a candidate account created by a
 *   company's bulk invite/import. Without this, such an account (no
 *   college_id) is indistinguishable from a "Mellow Direct" self-registered
 *   lead (see User::isMellowDirectLead()) and would be silently picked up by
 *   the marketing lead-assignment listener in AppServiceProvider::boot(). A
 *   candidate keeps this set even after later joining a college, applying to
 *   another company, etc — it only records how THIS account first came to
 *   exist, and also feeds the hiring reports' source-of-candidate breakdown.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('company_id')->nullable()->after('college_id')
                ->constrained('companies')->nullOnDelete();
            $table->foreignId('invited_by_company_id')->nullable()->after('company_id')
                ->constrained('companies')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('invited_by_company_id');
            $table->dropConstrainedForeignId('company_id');
        });
    }
};
