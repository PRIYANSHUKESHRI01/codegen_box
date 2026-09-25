<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A free-text message log on a talent_pool_inquiries thread — backs the
 * "Notify via Email" action (CompanyTalentPoolController::notify()), which
 * unlike Interest/Interview/Hire doesn't change `status` at all, just sends
 * the candidate a one-off note from the company. Mirrors LeadNote's exact
 * shape (staff-authored note attached to a record), just on the company side.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('talent_pool_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('talent_pool_inquiry_id')->constrained('talent_pool_inquiries')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('message');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('talent_pool_messages');
    }
};
