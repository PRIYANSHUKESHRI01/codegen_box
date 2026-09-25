<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Rounds out the single-college, single-student dataset the earlier seeders
 * leave behind into something that actually demonstrates the platform's
 * multi-tenant shape and the drive-eligibility feature's three real states
 * (eligible / not_eligible / unknown — see StudentDriveController). Without
 * this, the only seeded student (alex.chen) has no academic profile at all,
 * so eligibility can only ever render "unknown" — nothing here proves the
 * other two states actually work end to end.
 *
 * Two new colleges are added deliberately in different states:
 *  - Meridian also gets the Infosys drive mapped, proving the same catalog
 *    drive can be independently mapped to more than one college.
 *  - Silverline is left with zero mapped drives, so the student dashboard's
 *    real "no placement drives yet" empty state has a real account to view
 *    it from, not just a hypothetical.
 *
 * All values here are placeholder content per this project's standing
 * "real schema, dummy rows" convention — re-run this seeder with updated
 * values, or replace rows via the admin UI, once real roster data exists.
 */
class CampusRosterSeeder extends Seeder
{
    /** Every account this seeder creates shares this password for convenience — these are demo accounts only. */
    private const DEMO_PASSWORD = 'campus_demo_2026';

    public function run(): void
    {
        $this->completeApexRoster();
        $meridian = $this->seedMeridian();
        $this->seedSilverline();

        $infosys = Company::where('slug', 'infosys')->first();
        $infosysDrive = $infosys?->placementDrives()->first();
        $meridianTpo = User::where('email', 'tpo@meridian.edu.in')->first();

        if ($infosysDrive && $meridianTpo) {
            DriveCollegeMapping::updateOrCreate(
                ['placement_drive_id' => $infosysDrive->id, 'college_id' => $meridian->id],
                ['mapped_by' => $meridianTpo->id, 'mapped_at' => now(), 'unmapped_at' => null, 'is_active' => true]
            );
        }
    }

    /**
     * The flagship demo student (used by every "Quick Demo Login" button and
     * every walkthrough in this project) had no academic profile, so the
     * eligibility feature could never show anything but "unknown" through
     * it. Gives it a complete, Infosys-eligible profile, then adds two more
     * Apex students covering the other two eligibility states.
     */
    private function completeApexRoster(): void
    {
        $apex = College::where('short_code', 'APEX')->first();
        if (! $apex) {
            return;
        }

        $alex = User::where('email', 'alex.chen@student.apex.edu')->first();
        $alex->update([
            'roll_number' => 'APX2026CS014',
            'branch' => 'Computer Science',
            'cgpa' => 8.20,
            'backlogs' => 0,
            'phone' => '9876543210',
            'parent_phone' => '9876500099',
        ]);

        $this->seedPracticeStreak($alex);

        // Fails on both CGPA and backlog count — exercises the multi-reason
        // "not_eligible" path (StudentDriveController::evaluateStudentEligibility).
        User::updateOrCreate(
            ['email' => 'priya.desai@student.apex.edu'],
            [
                'name' => 'Priya Desai',
                'handle' => 'priya_desai',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_USER,
                'college_id' => $apex->id,
                'roll_number' => 'APX2026EC021',
                'branch' => 'Electronics & Communication',
                'cgpa' => 5.40,
                'backlogs' => 2,
                'phone' => '9876543211',
            ]
        );

        // Enrolled at Apex but no academic record on file yet (e.g. added
        // individually rather than through a roster import) — the real
        // "unknown" case, not a fabricated failure.
        User::updateOrCreate(
            ['email' => 'rohan.kapoor@student.apex.edu'],
            [
                'name' => 'Rohan Kapoor',
                'handle' => 'rohan_kapoor',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_USER,
                'college_id' => $apex->id,
            ]
        );
    }

    /**
     * Backdates a full 7-day, 3-distinct-problems-a-day Accepted streak for
     * the flagship demo student — without this, User::readinessScore()'s
     * 40%-weighted practice component is 0 for every fresh seed (no real
     * submissions exist yet), so the platform's single most-used demo
     * account could never actually demonstrate the "Placement Ready" tier
     * out of the box. Cycles through whatever problems ProblemSeeder
     * created (currently 5) so a day needing 3 distinct problems still
     * works even though there are fewer than 7×3 unique problems total.
     */
    private function seedPracticeStreak(User $student): void
    {
        $problems = Problem::orderBy('id')->get();
        if ($problems->isEmpty()) {
            return;
        }

        for ($day = 0; $day < 7; $day++) {
            $date = now()->subDays($day)->toDateString();
            for ($i = 0; $i < 3; $i++) {
                $problem = $problems[$i % $problems->count()];
                Submission::updateOrCreate(
                    ['user_id' => $student->id, 'problem_id' => $problem->id, 'submitted_on' => $date],
                    ['language' => 'javascript', 'status' => Submission::STATUS_ACCEPTED]
                );
            }
        }
    }

    private function seedMeridian(): College
    {
        $meridian = College::firstOrCreate(
            ['short_code' => 'MERI'],
            [
                'name' => 'Meridian Institute of Technology',
                'city' => 'Pune',
                'state' => 'Maharashtra',
                'tier' => 'Pro Campus',
                'placement_rate' => 81.30,
            ]
        );

        User::updateOrCreate(
            ['email' => 'tpo@meridian.edu.in'],
            [
                'name' => 'Dr. Kavita Rao',
                'handle' => 'kavita_rao_tpo',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_ADMIN_TPO,
                'college_id' => $meridian->id,
            ]
        );

        // Comfortably eligible for Infosys.
        User::updateOrCreate(
            ['email' => 'ananya.iyer@student.meridian.edu.in'],
            [
                'name' => 'Ananya Iyer',
                'handle' => 'ananya_iyer',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_USER,
                'college_id' => $meridian->id,
                'roll_number' => 'MER2026IT009',
                'branch' => 'Information Technology',
                'cgpa' => 7.80,
                'backlogs' => 0,
                'phone' => '9876543220',
            ]
        );

        // A narrow miss — 0.1 under Infosys's 6.0 CGPA cutoff, otherwise clean.
        User::updateOrCreate(
            ['email' => 'vikram.singh@student.meridian.edu.in'],
            [
                'name' => 'Vikram Singh',
                'handle' => 'vikram_singh',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_USER,
                'college_id' => $meridian->id,
                'roll_number' => 'MER2026ME014',
                'branch' => 'Mechanical Engineering',
                'cgpa' => 5.90,
                'backlogs' => 0,
                'phone' => '9876543221',
            ]
        );

        return $meridian;
    }

    private function seedSilverline(): College
    {
        $silverline = College::firstOrCreate(
            ['short_code' => 'SLVR'],
            [
                'name' => 'Silverline College of Engineering',
                'city' => 'Coimbatore',
                'state' => 'Tamil Nadu',
                'tier' => 'Standard',
                'placement_rate' => 68.00,
            ]
        );

        User::updateOrCreate(
            ['email' => 'tpo@silverline.edu.in'],
            [
                'name' => 'Suresh Iyer',
                'handle' => 'suresh_iyer_tpo',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_ADMIN_TPO,
                'college_id' => $silverline->id,
            ]
        );

        // Deliberately left with zero mapped drives — see class docblock.
        User::updateOrCreate(
            ['email' => 'meera.pillai@student.silverline.edu.in'],
            [
                'name' => 'Meera Pillai',
                'handle' => 'meera_pillai',
                'password' => Hash::make(self::DEMO_PASSWORD),
                'role' => User::ROLE_USER,
                'college_id' => $silverline->id,
                'roll_number' => 'SLV2026CS003',
                'branch' => 'Computer Science',
                'cgpa' => 7.10,
                'backlogs' => 0,
                'phone' => '9876543230',
            ]
        );

        return $silverline;
    }
}
