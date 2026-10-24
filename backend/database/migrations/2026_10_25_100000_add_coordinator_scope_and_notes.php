<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Section Coordinator v2.
 *
 *  • users.coordinator_scope — which BRANCHES of its section a coordinator looks after: the same `{disciplines, branches}`
 *    audience shape content targeting uses. Null (every existing coordinator) means the whole section, exactly as before.
 *    A college whose "Section A" mixes CSE and ECE can now give each branch its own coordinator.
 *
 *  • coordinator_notes — the follow-up log a coordinator keeps on the students in their section ("called the parent,
 *    promised to retake the test by Friday"), with an optional due date. Seen by the coordinators who cover the student
 *    and by the college's TPO; never by the student, never across colleges. A student leaving cascades their notes away;
 *    a coordinator leaving keeps theirs (author becomes null) so a successor inherits the history.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'coordinator_scope')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('coordinator_scope')->nullable();
            });
        }

        if (! Schema::hasTable('coordinator_notes')) {
            Schema::create('coordinator_notes', function (Blueprint $table) {
                $table->id();
                $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
                $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('author_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('kind', 12)->default('note');
                $table->text('body');
                $table->date('follow_up_on')->nullable();
                $table->dateTime('resolved_at')->nullable();
                $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['student_id', 'created_at']);
                $table->index(['college_id', 'resolved_at', 'follow_up_on'], 'coordinator_notes_open_due_index');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('coordinator_notes');

        if (Schema::hasColumn('users', 'coordinator_scope')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('coordinator_scope');
            });
        }
    }
};
