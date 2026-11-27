<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (! Schema::hasColumn('users', 'mellow_vault_dev_id')) {
                    $table->unsignedBigInteger('mellow_vault_dev_id')->nullable()->after('vault_ai_scored_at')->index();
                }
                if (! Schema::hasColumn('users', 'mellow_vault_pro_id')) {
                    $table->unsignedInteger('mellow_vault_pro_id')->nullable()->after('mellow_vault_dev_id')->index();
                }
                if (! Schema::hasColumn('users', 'mellow_vault_stack_key')) {
                    $table->string('mellow_vault_stack_key', 64)->nullable()->after('mellow_vault_pro_id')->index();
                }
                if (! Schema::hasColumn('users', 'mellow_vault_stack_name')) {
                    $table->string('mellow_vault_stack_name', 120)->nullable()->after('mellow_vault_stack_key');
                }
                if (! Schema::hasColumn('users', 'mellow_vault_profile_percent')) {
                    $table->unsignedTinyInteger('mellow_vault_profile_percent')->default(0)->after('mellow_vault_stack_name')->index();
                }
                if (! Schema::hasColumn('users', 'mellow_vault_profile_synced_at')) {
                    $table->timestamp('mellow_vault_profile_synced_at')->nullable()->after('mellow_vault_profile_percent');
                }
                if (! Schema::hasColumn('users', 'vault_ai_invite_sent_at')) {
                    $table->timestamp('vault_ai_invite_sent_at')->nullable()->after('mellow_vault_profile_synced_at')->index();
                }
                if (! Schema::hasColumn('users', 'vault_ai_invite_stack_key')) {
                    $table->string('vault_ai_invite_stack_key', 64)->nullable()->after('vault_ai_invite_sent_at');
                }
            });
        }

        if (! Schema::hasTable('mellow_vault_stack_mappings')) {
            Schema::create('mellow_vault_stack_mappings', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('pro_id')->unique();
                $table->string('higher_professional_heading', 120);
                $table->string('aptrun_stack_key', 64)->nullable()->index();
                $table->string('aptrun_role_key', 64)->nullable();
                $table->string('display_name', 120);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('vault_interview_invites')) {
            Schema::create('vault_interview_invites', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedBigInteger('dev_id')->nullable()->index();
                $table->unsignedInteger('pro_id')->nullable();
                $table->unsignedTinyInteger('profile_percent');
                $table->string('stack_key', 64)->nullable()->index();
                $table->string('stack_name', 120)->nullable();
                $table->text('invite_url')->nullable();
                $table->string('status', 32)->default('queued')->index();
                $table->text('error_message')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->timestamp('opened_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_interview_invites');
        Schema::dropIfExists('mellow_vault_stack_mappings');

        if (Schema::hasTable('users')) {
            $cols = array_values(array_filter([
                'mellow_vault_dev_id',
                'mellow_vault_pro_id',
                'mellow_vault_stack_key',
                'mellow_vault_stack_name',
                'mellow_vault_profile_percent',
                'mellow_vault_profile_synced_at',
                'vault_ai_invite_sent_at',
                'vault_ai_invite_stack_key',
            ], fn (string $c) => Schema::hasColumn('users', $c)));

            if ($cols !== []) {
                Schema::table('users', function (Blueprint $table) use ($cols) {
                    $table->dropColumn($cols);
                });
            }
        }
    }
};
