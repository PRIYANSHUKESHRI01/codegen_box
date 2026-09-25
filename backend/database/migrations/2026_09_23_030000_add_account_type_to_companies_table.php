<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Turns Company into a dual-purpose entity: every existing row stays a
 * passive Mellow-curated catalog entry ('catalog_only', the default), while
 * a company that signs up as a self-serve hiring tenant gets this flipped to
 * 'hiring_tenant' (only ever via AdminController::storeCompanyTenant() —
 * never through the ordinary catalog-edit form). Plain string, not an ENUM,
 * matching contests.contest_type's rationale: cheap to extend later without
 * another raw ALTER migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->string('account_type')->default('catalog_only')->after('is_active');
            $table->index('account_type');
        });
    }

    public function down(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->dropIndex(['account_type']);
            $table->dropColumn('account_type');
        });
    }
};
