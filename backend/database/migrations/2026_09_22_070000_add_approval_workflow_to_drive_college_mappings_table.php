<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drive_college_mappings', function (Blueprint $table) {
            $table->foreignId('approved_by')->nullable()->after('mapped_by')->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable()->after('mapped_at');
            $table->timestamp('declined_at')->nullable()->after('unmapped_at');
            // Default 'approved' — every existing row represents a TPO's own
            // deliberate self-map (or their own campus-only drive), which is
            // definitionally already consented to, so no backfill is needed.
            // Only a new Mellow-initiated proposal (see
            // AdminPlacementDriveController::mapColleges()) is ever created
            // as 'pending', gating it out of every is_active-based query
            // (student eligibility, TPO's mapped list, reports) until a TPO
            // explicitly approves it.
            $table->enum('status', ['pending', 'approved', 'declined'])->default('approved')->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('drive_college_mappings', function (Blueprint $table) {
            $table->dropColumn('status');
            $table->dropColumn('declined_at');
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn('approved_at');
        });
    }
};
