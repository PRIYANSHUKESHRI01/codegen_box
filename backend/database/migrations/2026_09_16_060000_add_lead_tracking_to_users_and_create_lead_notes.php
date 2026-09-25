<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Meaningful only for a "Mellow Direct" lead (role=user,
            // college_id=null) — harmless/unused on every other account.
            // Defaults every existing row to a real value rather than null,
            // so nothing downstream needs a null-coalescing fallback.
            $table->string('lead_status')->default('new')->after('college_id');
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_notes');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('lead_status');
        });
    }
};
