<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Core Prep authoring: the subject / topic taxonomy a question is filed under, the question
 * bank itself (MCQ single / multi-select / numerical, with maths, explanations and a review
 * workflow), its audit trail, student issue reports, and bulk-import runs.
 *
 * Questions are NOT shown to students by anything in this migration — the student side
 * (practice, tests) arrives separately, and a branch's Core Prep stays hidden until staff
 * switch that discipline live. The taxonomy ships with the schema (deploy runs `migrate`, not
 * `db:seed`): database/data/core_taxonomy.php. Safe to re-run.
 *
 * Deliberately plain strings for `type`, `status`, `difficulty` and `usage` (constants live on
 * App\Models\CoreQuestion) — adding a type must never need a schema change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('core_subjects', function (Blueprint $table) {
            $table->id();
            $table->string('discipline_code', 20);
            $table->string('code', 60);
            $table->string('name', 150);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['discipline_code', 'code']);
        });

        Schema::create('core_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('subject_id')->constrained('core_subjects')->cascadeOnDelete();
            $table->string('code', 80);
            $table->string('name', 200);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['subject_id', 'code']);
        });

        Schema::create('core_questions', function (Blueprint $table) {
            $table->id();
            $table->string('public_id', 26)->unique();
            // The importer's idempotency key: re-importing the same sheet updates rather than duplicates.
            $table->string('external_id', 191)->nullable()->unique();
            $table->string('discipline_code', 20);
            $table->foreignId('subject_id')->constrained('core_subjects')->restrictOnDelete();
            $table->foreignId('topic_id')->nullable()->constrained('core_topics')->restrictOnDelete();

            $table->string('type', 20)->default('mcq_single');
            $table->longText('stem');
            $table->string('image_path', 255)->nullable();
            // [{id:'a', text:'…'}, …] for MCQs; null for numerical.
            $table->json('options')->nullable();
            // ['b'] / ['a','c'] for MCQs; null for numerical.
            $table->json('correct')->nullable();
            // Numerical answers are accepted inside this range (GATE style: 3.14 to 3.15).
            $table->decimal('numeric_min', 20, 6)->nullable();
            $table->decimal('numeric_max', 20, 6)->nullable();
            $table->string('numeric_unit', 30)->nullable();

            $table->decimal('marks', 5, 2)->default(1);
            $table->decimal('negative_marks', 5, 2)->default(0);
            $table->string('difficulty', 10)->default('medium');
            $table->longText('explanation')->nullable();
            $table->json('tags')->nullable();
            $table->json('companies')->nullable();
            $table->string('source', 120)->nullable();

            // practice = shown with instant feedback; test = only inside timed tests; both.
            // Keeping them apart is what stops practice from leaking a proctored test's answers.
            $table->string('usage', 10)->default('both');
            $table->string('status', 15)->default('draft');
            $table->unsignedInteger('version')->default(1);
            // How many students have answered it. Once > 0 the answer key is locked (see CoreQuestionService).
            $table->unsignedInteger('attempts_count')->default(0);
            $table->dateTime('key_fixed_at')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->dateTime('published_at')->nullable();
            // Reserved for TPO / partner authoring later; unused in v1.
            $table->unsignedBigInteger('owning_college_id')->nullable();
            $table->unsignedBigInteger('owning_company_id')->nullable();
            $table->timestamps();

            $table->index(['discipline_code', 'status']);
            $table->index(['subject_id', 'topic_id']);
            $table->index(['status', 'usage']);
        });

        Schema::create('core_question_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_question_id')->constrained('core_questions')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 30);
            $table->json('changes')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['core_question_id', 'created_at']);
        });

        Schema::create('core_question_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('core_question_id')->constrained('core_questions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('reason', 20);
            $table->text('note')->nullable();
            $table->string('status', 12)->default('open');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('resolved_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['core_question_id', 'user_id']);
        });

        Schema::create('core_question_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_filename', 255);
            $table->string('file_path', 255)->nullable();
            $table->string('images_path', 255)->nullable();
            // dry_run reports what WOULD happen and writes nothing; commit upserts.
            $table->string('mode', 10)->default('dry_run');
            $table->string('status', 24)->default('pending');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('valid_rows')->default(0);
            $table->unsignedInteger('created_rows')->default(0);
            $table->unsignedInteger('updated_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->json('errors')->nullable();
            $table->json('summary')->nullable();
            $table->json('options')->nullable();
            $table->timestamps();
        });

        $this->seedTaxonomy();
    }

    public function down(): void
    {
        Schema::dropIfExists('core_question_imports');
        Schema::dropIfExists('core_question_reports');
        Schema::dropIfExists('core_question_audits');
        Schema::dropIfExists('core_questions');
        Schema::dropIfExists('core_topics');
        Schema::dropIfExists('core_subjects');
    }

    private function seedTaxonomy(): void
    {
        $data = require database_path('data/core_taxonomy.php');
        $now = now();

        foreach ($data as $discipline => $subjects) {
            $subjectSort = 0;

            foreach ($subjects as $subjectCode => [$subjectName, $topics]) {
                DB::table('core_subjects')->insertOrIgnore([
                    'discipline_code' => $discipline, 'code' => $subjectCode, 'name' => $subjectName,
                    'sort' => ++$subjectSort, 'created_at' => $now, 'updated_at' => $now,
                ]);

                $subjectId = DB::table('core_subjects')->where('discipline_code', $discipline)->where('code', $subjectCode)->value('id');
                $topicSort = 0;

                foreach ($topics as $topicCode => $topicName) {
                    DB::table('core_topics')->insertOrIgnore([
                        'subject_id' => $subjectId, 'code' => $topicCode, 'name' => $topicName,
                        'sort' => ++$topicSort, 'created_at' => $now, 'updated_at' => $now,
                    ]);
                }
            }
        }
    }
};
