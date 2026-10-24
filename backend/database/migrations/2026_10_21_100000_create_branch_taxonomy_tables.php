<?php

use App\Support\BranchNormalizer;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The branch catalogue: disciplines (the five families the product has a
 * dashboard for, plus "other"), the specific branches inside them, and the
 * spellings colleges actually type for each.
 *
 * Until now a student's branch was free text compared with `===`, so a college
 * that imported "Mechanical" never matched a drive open to "MECH". Everything
 * that needs to know what branch somebody is in now resolves their text through
 * these tables (App\Support\BranchCatalog) and stores the answer on the user.
 *
 * `branch_aliases.college_id` is 0 for the global list and a college's id for a
 * TPO's own mapping ("Mech-A" → Mechanical). It is a plain 0, not NULL, so the
 * (college_id, alias_key) unique index actually applies to global rows too.
 *
 * The starting data ships WITH the schema (deploy runs `migrate`, not
 * `db:seed`); it is database/data/branch_taxonomy.php. Safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('disciplines', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->string('short', 30);
            $table->unsignedSmallInteger('sort')->default(0);
            // Core Prep is hidden from students of a discipline until staff switch it on.
            $table->boolean('is_live')->default(false);
            $table->dateTime('live_at')->nullable();
            $table->timestamps();
        });

        Schema::create('branches', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('discipline_code', 20)->index();
            $table->string('name', 120);
            $table->string('short', 30);
            $table->unsignedSmallInteger('sort')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('branch_aliases', function (Blueprint $table) {
            $table->id();
            $table->string('alias_key', 150);
            $table->string('branch_code', 40)->index();
            $table->unsignedBigInteger('college_id')->default(0);
            $table->string('label', 150)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();

            $table->unique(['college_id', 'alias_key']);
        });

        $this->seed();
    }

    public function down(): void
    {
        Schema::dropIfExists('branch_aliases');
        Schema::dropIfExists('branches');
        Schema::dropIfExists('disciplines');
    }

    private function seed(): void
    {
        $data = require database_path('data/branch_taxonomy.php');
        $now = now();

        foreach ($data['disciplines'] as $code => [$name, $short, $sort]) {
            DB::table('disciplines')->insertOrIgnore([
                'code' => $code, 'name' => $name, 'short' => $short, 'sort' => $sort,
                'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $taken = [];
        $sort = 0;

        foreach ($data['branches'] as $code => [$discipline, $name, $short, $aliases]) {
            DB::table('branches')->insertOrIgnore([
                'code' => $code, 'discipline_code' => $discipline, 'name' => $name, 'short' => $short,
                'sort' => ++$sort, 'created_at' => $now, 'updated_at' => $now,
            ]);

            foreach ([$code, $name, $short, ...$aliases] as $label) {
                $key = BranchNormalizer::key($label);

                // First branch to claim a spelling keeps it — the file is ordered so the common meaning wins.
                if ($key === null || isset($taken[$key])) {
                    continue;
                }

                $taken[$key] = true;

                DB::table('branch_aliases')->insertOrIgnore([
                    'alias_key' => $key, 'branch_code' => $code, 'college_id' => 0, 'label' => $label,
                    'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }
    }
};
