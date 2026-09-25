<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The other half of the lead lifecycle started by
 * 2026_09_17_030000_add_assigned_marketing_id_to_users_table: once a
 * "Mellow Direct" lead buys a paid plan (see
 * SubscriptionService::subscribeIndividual + LeadAssignmentService::convertLead),
 * servicing ownership hands off from Marketing to Mellow Internal Ops.
 * `assigned_internal_id` mirrors `assigned_marketing_id` exactly (nullable,
 * nullOnDelete so a deleted staffer's customers fall back to unassigned
 * rather than vanishing). `converted_at` is a real timestamp (not just the
 * `lead_status = 'converted'` string) so reporting can answer "how many
 * converted this week" without parsing ActivityLog rows.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('converted_at')->nullable()->after('lead_status');
            $table->foreignId('assigned_internal_id')->nullable()->after('assigned_marketing_id')->constrained('users')->nullOnDelete();
            $table->index('assigned_internal_id');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('assigned_internal_id');
            $table->dropColumn('converted_at');
        });
    }
};
