<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The "recruiter-ready profile" fields for a `role === 'user'` account
 * (college-affiliated or Mellow Direct alike) — bio/LinkedIn/GitHub/skills
 * are self-edited (see StudentProfileController), resume_* and
 * profile_completion_percent are system-controlled (upload endpoint /
 * User::computeProfileCompletion(), never mass-assignable — see
 * User::$fillable). `profile_completion_percent` is STORED rather than
 * computed on read specifically so CompanyTalentPoolController can
 * `ORDER BY` it directly in SQL, ranking more-complete profiles first in
 * hiring-partner search results.
 *
 * Distinct from the existing `readinessScore()` (academic + practice
 * readiness, TPO-facing) — this is a different, self-service metric over a
 * different set of fields; keep the two concepts separate everywhere.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('bio')->nullable()->after('avatar_path');
            $table->string('linkedin_url')->nullable()->after('bio');
            $table->string('github_url')->nullable()->after('linkedin_url');
            $table->json('skills')->nullable()->after('github_url');
            $table->string('resume_path')->nullable()->after('skills');
            $table->string('resume_original_name')->nullable()->after('resume_path');
            $table->dateTime('resume_uploaded_at')->nullable()->after('resume_original_name');
            $table->unsignedTinyInteger('profile_completion_percent')->default(0)->after('resume_uploaded_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'bio',
                'linkedin_url',
                'github_url',
                'skills',
                'resume_path',
                'resume_original_name',
                'resume_uploaded_at',
                'profile_completion_percent',
            ]);
        });
    }
};
