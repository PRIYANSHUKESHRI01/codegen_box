<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who a hackathon is for.
 *
 *   audience = 'all'       every student on the platform, including those with no college
 *   audience = 'colleges'  only students of the colleges listed in hackathon_colleges
 *
 * Publishing is immediate in both cases — there is deliberately no approval step: a host who maps a
 * hackathon to a college puts it straight into that college's students' Arena. Every existing
 * hackathon keeps its current reach (the default is 'all').
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hackathons', function (Blueprint $table) {
            $table->string('audience', 12)->default('all')->after('status'); // all | colleges
            $table->index(['status', 'audience']);
        });

        Schema::create('hackathon_colleges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hackathon_id')->constrained()->cascadeOnDelete();
            $table->foreignId('college_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['hackathon_id', 'college_id']);
            $table->index('college_id'); // "which hackathons can this college's students see"
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hackathon_colleges');

        Schema::table('hackathons', function (Blueprint $table) {
            $table->dropIndex(['status', 'audience']);
            $table->dropColumn('audience');
        });
    }
};
