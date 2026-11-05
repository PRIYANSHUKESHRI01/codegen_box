<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * generated_reports — the archive of every report AptRun has produced (a student's full report, a mock AI interview
 * report, one student's interview sitting, a section report).
 *
 * A report is a point-in-time document: the numbers in it are the numbers on the day it was made, and a TPO who printed
 * a student's report in October must be able to open that exact file again in December, not a regenerated one with newer
 * figures. So the finished PDF is kept on the private `local` disk (never a public URL) and this table is its index: who it
 * is about, who made it, what it was made from, how big it is, a checksum to prove it has not been altered, and a small
 * `summary` snapshot of the headline figures so a history list can show "readiness 64, 3 interviews" without opening
 * the file.
 *
 * Rows follow the data they describe: deleting the student, the college or the interview deletes the row, and
 * App\Services\Reports\ReportArchive removes the file with it (files have no foreign key).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('generated_reports')) {
            return;
        }

        Schema::create('generated_reports', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 26)->unique();

            // student_report | interview_report | interview_session_report | section_report
            $table->string('kind', 40);
            $table->string('title');
            $table->string('filename');

            $table->foreignId('college_id')->nullable()->constrained('colleges')->cascadeOnDelete();
            // The student the report is about (null for a cohort-level report).
            $table->foreignId('subject_user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('interview_id')->nullable()->constrained('interviews')->cascadeOnDelete();
            $table->foreignId('interview_session_id')->nullable()->constrained('interview_sessions')->cascadeOnDelete();
            // Who pressed the button; the row outlives the account (nullOnDelete) and keeps the role they had.
            $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('generated_by_role', 32)->nullable();
            // Who the document is written for: staff (everything) or the student themselves (no internal notes).
            $table->string('audience', 16)->default('staff');

            $table->string('disk', 16)->default('local');
            $table->string('path');
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->char('sha256', 64)->nullable();
            $table->unsignedSmallInteger('pages')->nullable();

            // What it was made from (section filter, interview slug …) and the headline figures at that moment.
            $table->json('params')->nullable();
            $table->json('summary')->nullable();

            $table->unsignedInteger('downloads')->default(0);
            $table->dateTime('last_downloaded_at')->nullable();
            $table->timestamps();

            $table->index(['college_id', 'kind', 'created_at']);
            $table->index(['subject_user_id', 'created_at']);
            $table->index(['interview_id', 'created_at']);
            $table->index('generated_by');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('generated_reports');
    }
};
