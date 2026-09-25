<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which Mellow Marketing employee owns this "Mellow Direct" lead (see
 * User::isMellowDirectLead()) — null until App\Services\LeadAssignmentService
 * assigns one. nullOnDelete rather than cascade: if the owning employee's
 * account is ever deleted, the lead falls back to unassigned (eligible for
 * LeadAssignmentService::assignUnassignedLeads() to pick up again) instead
 * of disappearing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('assigned_marketing_id')->nullable()->after('lead_status')->constrained('users')->nullOnDelete();
            $table->index('assigned_marketing_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_marketing_id');
        });
    }
};
