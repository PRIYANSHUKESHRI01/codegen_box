<?php

use App\Support\BranchCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Domain Prep (the questions side of Core Prep) for CSE and IT students: DBMS, Operating Systems, Computer Networks, OOP, Data
 * Structures, Algorithms, Computer Organization, Theory of Computation, Software Engineering and Discrete Mathematics, with 160
 * original questions (database/data/domain_questions/cse.json; built by content/core-prep/cse/build_cse.py).
 *
 * Until now CSE and IT branches had NO Domain Prep "by design": they practised on the coding problem bank only, so a CSE student
 * who wanted to revise DBMS or networks had nothing to practise on. This switches the capability on for the `cse` family and loads
 * the subjects and questions through the same idempotent seeders every other family used (they key by (discipline, code) and by
 * external_id, so a re-run and a database that already has some of it are both safe).
 *
 * Like every family it stays invisible to students until staff switch it live: Superadmin -> Core Prep -> Coverage -> CSE. The
 * go-live guard passes as shipped (160 published, 5 subjects with 15+). Nothing here switches it on.
 *
 * A CSE student is never asked the "core first or IT first?" question (User::needsBranchConfirmation), and their readiness score is
 * unchanged (no track means the software weights, and Core Prep stays out of the score while READINESS_CORE_COUNTS is off).
 */
return new class extends Migration
{
    private const SEEDERS = [
        '2026_11_02_100200_seed_domain_taxonomy_for_departments',
        '2026_11_02_100400_seed_domain_prep_starter_questions',
    ];

    public function up(): void
    {
        $row = DB::table('disciplines')->where('code', 'cse')->first(['capabilities']);

        if ($row !== null) {
            $capabilities = json_decode((string) $row->capabilities, true) ?: [];
            $capabilities['domain_prep'] = true;
            DB::table('disciplines')->where('code', 'cse')->update(['capabilities' => json_encode($capabilities)]);
        }

        foreach (self::SEEDERS as $name) {
            (require database_path("migrations/{$name}.php"))->up();
        }

        try {
            BranchCatalog::instance()->flush();
        } catch (\Throwable) {
            // A cold or unreachable cache simply expires on its own.
        }
    }

    public function down(): void
    {
        $row = DB::table('disciplines')->where('code', 'cse')->first(['capabilities']);

        if ($row !== null) {
            $capabilities = json_decode((string) $row->capabilities, true) ?: [];
            unset($capabilities['domain_prep']);
            DB::table('disciplines')->where('code', 'cse')->update(['capabilities' => $capabilities === [] ? null : json_encode($capabilities)]);
        }

        // Questions nobody has answered go; anything a student has answered stays (their history points at it).
        $ids = array_column(json_decode((string) file_get_contents(database_path('data/domain_questions/cse.json')), true) ?: [], 'external_id');
        DB::table('core_questions')->whereIn('external_id', $ids)->where('attempts_count', 0)->delete();
    }
};
