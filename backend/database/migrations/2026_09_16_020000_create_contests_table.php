<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A platform-run, admin-curated rated contest — mirrors PlacementDrive's
 * draft/published lifecycle (a contest's problem set is assembled privately
 * before it's ever visible to students) rather than being live the instant
 * a row exists. `finalized_at` is the idempotency guard for
 * ContestFinalizeService — scoring/rating must only ever be computed once
 * per contest, whether triggered by the scheduled command or an admin's
 * manual override.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contests', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->dateTime('start_at');
            $table->dateTime('end_at');
            $table->boolean('is_rated')->default(true);
            $table->string('status')->default('draft'); // draft | published | cancelled — see App\Models\Contest
            $table->dateTime('finalized_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'start_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contests');
    }
};
