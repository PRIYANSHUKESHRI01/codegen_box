<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Superadmin login security telemetry and future-ready Laptop + IP allowlist tables.
 *
 * - `superadmin_login_logs`: Captures every superadmin login attempt (success, failed, blocked,
 *   device/IP rejected, logout, password change) with full IP, network, browser, laptop, GPU,
 *   OS, screen, timezone, client hints, and a deterministic `device_fingerprint` + `device_id`.
 *   Uses `nullOnDelete()` on `user_id` so the forensic audit trail survives account deletion.
 * - `superadmin_trusted_devices`: Pre-registered / trusted laptops & IPs per superadmin account
 *   for enforcing "login from this particular laptop and IP only".
 * - `users.enforce_trusted_login`: Opt-in per-superadmin toggle (default false = monitor only).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('superadmin_login_logs')) {
            Schema::create('superadmin_login_logs', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('email', 190)->nullable()->index();
                $table->string('event', 36)->index();
                $table->string('reason', 100)->nullable();
                $table->string('portal', 30)->nullable();
                $table->unsignedBigInteger('token_id')->nullable()->index();

                // IP & Network details
                $table->string('ip_address', 45)->nullable()->index();
                $table->string('forwarded_for', 255)->nullable();
                $table->boolean('is_private_ip')->default(false);
                $table->string('hostname', 255)->nullable();
                $table->string('isp', 150)->nullable();
                $table->string('asn', 64)->nullable();
                $table->string('network_org', 150)->nullable();
                $table->string('city', 100)->nullable();
                $table->string('region', 100)->nullable();
                $table->string('country', 100)->nullable();
                $table->string('country_code', 8)->nullable();
                $table->string('network_type', 32)->nullable();
                $table->string('effective_type', 16)->nullable();
                $table->decimal('downlink_mbps', 6, 2)->nullable();
                $table->unsignedInteger('rtt_ms')->nullable();

                // Laptop, hardware, OS, browser & device-binding identifiers
                $table->string('device_fingerprint', 128)->nullable()->index();
                $table->string('device_id', 128)->nullable()->index();
                $table->string('device_type', 24)->nullable();
                $table->string('device_label', 255)->nullable();
                $table->string('os', 64)->nullable();
                $table->string('os_version', 64)->nullable();
                $table->string('browser', 64)->nullable();
                $table->string('browser_version', 64)->nullable();
                $table->string('platform', 64)->nullable();
                $table->string('architecture', 32)->nullable();
                $table->unsignedSmallInteger('cpu_cores')->nullable();
                $table->decimal('device_memory_gb', 5, 2)->nullable();
                $table->string('gpu_vendor', 120)->nullable();
                $table->string('gpu_renderer', 255)->nullable();
                $table->string('screen_resolution', 64)->nullable();
                $table->string('timezone', 80)->nullable();
                $table->string('language', 32)->nullable();
                $table->text('user_agent')->nullable();
                $table->json('client_hints')->nullable();
                $table->json('raw_telemetry')->nullable();

                $table->dateTime('created_at')->index();

                $table->index(['user_id', 'created_at']);
                $table->index(['event', 'created_at']);
            });
        }

        if (! Schema::hasTable('superadmin_trusted_devices')) {
            Schema::create('superadmin_trusted_devices', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('label', 120);
                $table->string('device_fingerprint', 128)->nullable()->index();
                $table->string('device_id', 128)->nullable()->index();
                $table->string('ip_address', 45)->nullable()->index();
                $table->string('browser', 64)->nullable();
                $table->string('os', 64)->nullable();
                $table->string('gpu_renderer', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
                $table->dateTime('last_matched_at')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'is_active']);
            });
        }

        if (! Schema::hasColumn('users', 'enforce_trusted_login')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('enforce_trusted_login')->default(false)->after('is_blocked');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('users', 'enforce_trusted_login')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('enforce_trusted_login');
            });
        }

        Schema::dropIfExists('superadmin_trusted_devices');
        Schema::dropIfExists('superadmin_login_logs');
    }
};
