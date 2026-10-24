<?php

use App\Support\BranchCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Domain Prep (Core Prep) for the engineering branches outside CSE and the four core families — Chemical, Biotechnology,
 * Aerospace, Agricultural and Mining / Metallurgy, which share the "other" family — so that EVERY branch that has Domain Prep has
 * at least one real question to show (CSE and IT branches practise on the coding problem bank instead, as before).
 *
 * Fresh installs get all of this from the earlier migrations, whose data files now include the family. This migration brings a
 * database that already ran them up to date: it switches the capability on and re-runs the three seeders that read those files
 * (subjects and topics, starter questions, interview roles and bank), each of which is idempotent and leaves anything that exists alone.
 * Like every family, it stays invisible to students until staff pilot it or switch it live.
 */
return new class extends Migration
{
    private const SEEDERS = [
        '2026_11_02_100200_seed_domain_taxonomy_for_departments',
        '2026_11_02_100400_seed_domain_prep_starter_questions',
        '2026_11_02_100500_seed_department_interview_content',
    ];

    public function up(): void
    {
        $row = DB::table('disciplines')->where('code', 'other')->first(['capabilities']);

        if ($row !== null) {
            $capabilities = json_decode((string) $row->capabilities, true) ?: [];
            $capabilities['domain_prep'] = true;
            DB::table('disciplines')->where('code', 'other')->update(['capabilities' => json_encode($capabilities)]);
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
        $row = DB::table('disciplines')->where('code', 'other')->first(['capabilities']);

        if ($row !== null) {
            $capabilities = json_decode((string) $row->capabilities, true) ?: [];
            unset($capabilities['domain_prep']);
            DB::table('disciplines')->where('code', 'other')->update(['capabilities' => $capabilities === [] ? null : json_encode($capabilities)]);
        }
    }
};
