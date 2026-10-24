<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * issued_credentials — the TEMPORARY password the platform (or a superadmin) issued to an account, kept encrypted
 * so a superadmin can look it up again until the owner replaces it.
 *
 * Deliberately NOT a copy of anyone's real password: a row only ever holds a password the platform generated or a
 * superadmin typed, it is deleted the moment the owner sets their own (and ignored if the stored value no longer matches
 * the account's hash), and it lapses on its own after `expires_at`. The column is encrypted with APP_KEY, so a leaked
 * database dump alone reveals nothing. One row per account.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('issued_credentials')) {
            return;
        }

        Schema::create('issued_credentials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->text('secret');
            $table->string('source', 24);
            $table->foreignId('issued_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('expires_at');
            $table->dateTime('last_revealed_at')->nullable();
            $table->unsignedInteger('reveal_count')->default(0);
            $table->timestamps();

            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('issued_credentials');
    }
};
