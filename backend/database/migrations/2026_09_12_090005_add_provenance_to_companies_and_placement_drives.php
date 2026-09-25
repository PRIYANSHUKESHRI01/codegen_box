<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('companies', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('is_active')->constrained('users')->nullOnDelete();
        });

        Schema::table('placement_drives', function (Blueprint $table) {
            // 'catalog' = Mellow-staff-curated, mappable by any college's TPO.
            // 'tpo_created' = a TPO added this themselves for a company only
            // their own campus is hosting — never shown in another college's
            // "available to map" list (see TpoDriveController::available()).
            $table->enum('source', ['catalog', 'tpo_created'])->default('catalog')->after('status');
            $table->foreignId('owning_college_id')->nullable()->after('source')->constrained('colleges')->nullOnDelete();
            $table->foreignId('created_by')->nullable()->after('owning_college_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('placement_drives', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropConstrainedForeignId('owning_college_id');
            $table->dropColumn('source');
        });

        Schema::table('companies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
