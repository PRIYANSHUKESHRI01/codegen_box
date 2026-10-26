<?php

use App\Support\BranchCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * For now each department offers its five main branches, and nothing else — the picker a student sees, the roster template a TPO
 * downloads, the audience pickers and the department switcher all list only these:
 *
 *   Engineering   CSE · Electrical (EEE) · Electronics (ECE) · Mechanical · Civil
 *   Management    BBA · MBA (General) · MBA Marketing · MBA Finance · MBA HR
 *   Commerce      B.Com · M.Com · Chartered Accountancy · Company Secretary · Cost & Management Accountancy
 *   Arts          English · History · Political Science · Economics · Psychology
 *
 * Nothing is deleted. The other branches (and the families left with none) are only switched OFF: a student already in one keeps their
 * branch, their questions and their results; a college's older spelling ("IT", "E&TC", "Production") still resolves to the branch it always
 * did; drives that name one still match. Superadmin → Departments → Branches can switch any of them back on, and the family returns with it.
 * Idempotent: it states the full list every time.
 */
return new class extends Migration
{
    /** @var list<string> */
    private const MAIN = [
        'cse', 'eee', 'ece', 'mech', 'civil',
        'bba', 'mba', 'mba_marketing', 'mba_finance', 'mba_hr',
        'bcom', 'mcom', 'chartered_accountancy', 'company_secretary', 'cma',
        'english', 'history', 'political_science', 'economics', 'psychology',
    ];

    public function up(): void
    {
        DB::table('branches')->whereIn('code', self::MAIN)->update(['is_active' => true]);
        DB::table('branches')->whereNotIn('code', self::MAIN)->update(['is_active' => false]);

        $this->flush();
    }

    public function down(): void
    {
        DB::table('branches')->update(['is_active' => true]);

        $this->flush();
    }

    private function flush(): void
    {
        try {
            BranchCatalog::instance()->flush();
        } catch (\Throwable) {
            // A cold or unreachable cache simply expires on its own.
        }
    }
};
