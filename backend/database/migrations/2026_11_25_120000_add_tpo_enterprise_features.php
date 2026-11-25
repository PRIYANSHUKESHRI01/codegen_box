<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Additive, non-destructive schema extensions for enterprise TPO workflows:
 * - Student 10th/12th percentages, placement outcome status, and academic lock
 * - College placement policy rules (offer cap, dream multiplier, CTC floor)
 * - Drive & college-mapping year/10th/12th eligibility & drive tier
 * - Drive application post-offer joining status tracking
 * - Recruiter CRM contacts per college & company (`college_company_contacts`)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'tenth_percentage')) {
                $table->decimal('tenth_percentage', 5, 2)->nullable()->after('cgpa');
            }
            if (! Schema::hasColumn('users', 'twelfth_percentage')) {
                $table->decimal('twelfth_percentage', 5, 2)->nullable()->after('tenth_percentage');
            }
            if (! Schema::hasColumn('users', 'placement_status')) {
                $table->string('placement_status', 30)->default('seeking')->after('backlogs');
            }
            if (! Schema::hasColumn('users', 'academics_locked_at')) {
                $table->timestamp('academics_locked_at')->nullable()->after('placement_status');
            }
        });

        Schema::table('colleges', function (Blueprint $table) {
            if (! Schema::hasColumn('colleges', 'max_offers_per_student')) {
                $table->unsignedTinyInteger('max_offers_per_student')->nullable()->after('exam_networks');
            }
            if (! Schema::hasColumn('colleges', 'dream_offer_multiplier')) {
                $table->decimal('dream_offer_multiplier', 4, 2)->nullable()->after('max_offers_per_student');
            }
            if (! Schema::hasColumn('colleges', 'dream_offer_min_ctc')) {
                $table->decimal('dream_offer_min_ctc', 8, 2)->nullable()->after('dream_offer_multiplier');
            }
            if (! Schema::hasColumn('colleges', 'block_placed_from_lower_ctc')) {
                $table->boolean('block_placed_from_lower_ctc')->default(false)->after('dream_offer_min_ctc');
            }
        });

        Schema::table('placement_drives', function (Blueprint $table) {
            if (! Schema::hasColumn('placement_drives', 'min_tenth_percentage')) {
                $table->decimal('min_tenth_percentage', 5, 2)->nullable()->after('max_backlogs');
            }
            if (! Schema::hasColumn('placement_drives', 'min_twelfth_percentage')) {
                $table->decimal('min_twelfth_percentage', 5, 2)->nullable()->after('min_tenth_percentage');
            }
            if (! Schema::hasColumn('placement_drives', 'eligible_years')) {
                $table->json('eligible_years')->nullable()->after('eligible_branches');
            }
            if (! Schema::hasColumn('placement_drives', 'drive_tier')) {
                $table->string('drive_tier', 20)->default('standard')->after('source');
            }
        });

        Schema::table('drive_college_mappings', function (Blueprint $table) {
            if (! Schema::hasColumn('drive_college_mappings', 'min_tenth_override')) {
                $table->decimal('min_tenth_override', 5, 2)->nullable()->after('max_backlogs_override');
            }
            if (! Schema::hasColumn('drive_college_mappings', 'min_twelfth_override')) {
                $table->decimal('min_twelfth_override', 5, 2)->nullable()->after('min_tenth_override');
            }
            if (! Schema::hasColumn('drive_college_mappings', 'eligible_years_override')) {
                $table->json('eligible_years_override')->nullable()->after('eligible_branches_override');
            }
        });

        Schema::table('drive_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('drive_applications', 'joining_status')) {
                $table->string('joining_status', 30)->nullable()->after('notes');
            }
            if (! Schema::hasColumn('drive_applications', 'joined_at')) {
                $table->timestamp('joined_at')->nullable()->after('joining_status');
            }
        });

        if (! Schema::hasTable('college_company_contacts')) {
            Schema::create('college_company_contacts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
                $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
                $table->string('contact_name', 150);
                $table->string('designation', 150)->nullable();
                $table->string('email', 255)->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('relationship_status', 30)->default('active');
                $table->text('notes')->nullable();
                $table->timestamp('last_contacted_at')->nullable();
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['college_id', 'company_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('college_company_contacts');

        Schema::table('drive_applications', function (Blueprint $table) {
            foreach (['joined_at', 'joining_status'] as $col) {
                if (Schema::hasColumn('drive_applications', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('drive_college_mappings', function (Blueprint $table) {
            foreach (['eligible_years_override', 'min_twelfth_override', 'min_tenth_override'] as $col) {
                if (Schema::hasColumn('drive_college_mappings', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('placement_drives', function (Blueprint $table) {
            foreach (['drive_tier', 'eligible_years', 'min_twelfth_percentage', 'min_tenth_percentage'] as $col) {
                if (Schema::hasColumn('placement_drives', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('colleges', function (Blueprint $table) {
            foreach (['block_placed_from_lower_ctc', 'dream_offer_min_ctc', 'dream_offer_multiplier', 'max_offers_per_student'] as $col) {
                if (Schema::hasColumn('colleges', $col)) {
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('users', function (Blueprint $table) {
            foreach (['academics_locked_at', 'placement_status', 'twelfth_percentage', 'tenth_percentage'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
