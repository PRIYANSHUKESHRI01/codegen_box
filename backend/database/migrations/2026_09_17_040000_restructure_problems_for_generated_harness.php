<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Replaces hand-authored `starter_code`/`test_harness` (a human writing 4
 * per-language code blocks per problem — see the pre-migration
 * ProblemSeeder) with a real function-signature spec that
 * App\Services\ProblemCodeGenerator generates both from at request time.
 * `examples` (the only test data that existed, and — critically — the same
 * data "Submit" graded against) is replaced by the new problem_test_cases
 * table, which finally separates public samples from a real hidden suite.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            $table->dropColumn(['examples', 'starter_code', 'test_harness']);

            $table->string('function_name')->nullable()->after('description');
            // [{"name": "nums", "type": "integer[]"}, {"name": "target", "type": "integer"}]
            // — see App\Services\ProblemCodeGenerator\ProblemType for the closed type list.
            $table->json('params')->nullable()->after('function_name');
            $table->string('return_type')->nullable()->after('params');
            // exact | unordered | float_tolerance — mirrors DMOJ's checker concept.
            $table->string('comparison_mode')->default('exact')->after('return_type');
            $table->decimal('comparison_epsilon', 10, 8)->nullable()->after('comparison_mode');
        });
    }

    public function down(): void
    {
        Schema::table('problems', function (Blueprint $table) {
            $table->dropColumn(['function_name', 'params', 'return_type', 'comparison_mode', 'comparison_epsilon']);
            $table->json('examples')->nullable();
            $table->json('starter_code')->nullable();
            $table->json('test_harness')->nullable();
        });
    }
};
