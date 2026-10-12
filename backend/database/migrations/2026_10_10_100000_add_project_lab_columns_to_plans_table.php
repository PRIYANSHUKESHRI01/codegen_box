<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Project Lab is sold as an ADD-ON to (or without) a base student plan, so a
 * plan now has a `kind`: 'base' (Coder / Expert / Grandmaster / every college
 * and company plan — exactly what existed before this) or 'addon'. A student
 * holds at most one active base subscription AND at most one active row per
 * add-on; see HasSubscription::activeSubscription() (base only) and
 * SubscriptionService::activate() (kind-scoped).
 *
 * The three entitlement columns follow the established convention: they are
 * defaults-off / null-means-unlimited, so every existing plan keeps behaving
 * exactly as before — nobody gains or loses anything from this migration.
 *   project_lab_access            may open Project Lab (SOW, workspace, submit)
 *   max_workspace_hours_per_month hours of running workspace per subscription period
 *   max_active_projects           projects a student can have in progress at once
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->string('kind', 16)->default('base')->after('audience'); // base | addon — see App\Models\Plan
            $table->boolean('project_lab_access')->default(false);
            $table->unsignedSmallInteger('max_workspace_hours_per_month')->nullable();
            $table->unsignedTinyInteger('max_active_projects')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['kind', 'project_lab_access', 'max_workspace_hours_per_month', 'max_active_projects']);
        });
    }
};
