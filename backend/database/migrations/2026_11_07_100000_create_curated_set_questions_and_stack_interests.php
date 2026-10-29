<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Questions staff add to a Vault AI Interview set (Admin -> Vault AI questions). The hand-written sets live in
        // config/curated_interview_sets.php; these are merged on top by App\Services\Vault\CuratedCatalog, so a
        // domain that has no questions yet becomes interview-ready purely by adding rows here.
        Schema::create('curated_set_questions', function (Blueprint $table) {
            $table->id();
            $table->string('set_id', 80)->index();            // catalog set id, e.g. data_analyst-sql-s1-set2
            $table->string('stack_key', 50)->index();
            $table->unsignedTinyInteger('series_number');
            $table->unsignedTinyInteger('set_number');
            $table->unsignedInteger('position')->default(0);
            $table->text('text');
            $table->string('category', 30)->default('technical');
            $table->unsignedSmallInteger('duration_seconds')->default(180);
            $table->text('note')->nullable();                  // what a strong answer covers — the rubric the AI scorer is given
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['set_id', 'position']);
        });

        // A student who wants a stack that is not open yet taps "Notify me". Tells staff which domain to write questions for
        // first, and who to tell when it opens (notified_at set once they have been told).
        Schema::create('vault_stack_interests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('stack_key', 50)->index();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'stack_key'], 'uniq_user_stack_interest');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vault_stack_interests');
        Schema::dropIfExists('curated_set_questions');
    }
};
