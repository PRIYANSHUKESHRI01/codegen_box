<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * When an account was last in the app — the signal a TPO needs to tell "never
 * signed in" and "signed in, hasn't practised" apart from "gone quiet".
 * Stamped on login and, throttled to once every few minutes, whenever the
 * session is re-verified (see AuthController::touchLastSeen()). It is NOT
 * derived from Sanctum's token `last_used_at`: logging out deletes the token,
 * so that value vanishes exactly when someone finishes a session.
 *
 * Nullable and additive: an existing account is simply "not seen yet" until its
 * owner next opens the app.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dateTime('last_seen_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_seen_at');
        });
    }
};
