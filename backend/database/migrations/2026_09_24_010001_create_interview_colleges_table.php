<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `contest_colleges` exactly — a `company`-type interview's own
 * explicit college targeting, a subset of the underlying drive's live
 * DriveCollegeMapping rows. See Interview::isVisibleToCollege().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_colleges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->cascadeOnDelete();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['interview_id', 'college_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_colleges');
    }
};
