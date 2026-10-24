<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * AI interviews for core branches. A nullable `discipline` (ece | eee | mech | civil) on the things an interview is
 * built from — the question bank, the role templates, the tracks and the interviews themselves — says which branch
 * family an item is for. Null means "every branch", which is what every existing row is, so nothing that exists changes.
 *
 * Also seeds Mellow's own core role templates (no questions: the bank is filled by the content team, or generated and
 * reviewed, like the rest of the question banks). Each is three rounds — fundamentals, applied technical, and a
 * project/managerial/HR round — in the same shape every other template has. Idempotent: a template that already exists
 * by name is left alone, and down() removes only the ones this migration made.
 */
return new class extends Migration
{
    private const TABLES = ['interview_question_banks', 'interview_role_templates', 'interview_tracks', 'interviews'];

    /** @return list<array{name: string, discipline: string, description: string, tags: list<string>}> */
    private function templates(): array
    {
        return [
            ['name' => 'VLSI Design Engineer — Fresher', 'discipline' => 'ece', 'description' => 'Digital design, CMOS fundamentals, timing and verification for a fresher joining a VLSI or semiconductor team.', 'tags' => ['verilog', 'cmos', 'timing', 'verification']],
            ['name' => 'Embedded Systems Engineer — Fresher', 'discipline' => 'ece', 'description' => 'Microcontrollers, interfaces and protocols, RTOS basics and debugging for a fresher in embedded product teams.', 'tags' => ['microcontrollers', 'c', 'rtos', 'protocols']],
            ['name' => 'Telecom & RF Engineer — Fresher', 'discipline' => 'ece', 'description' => 'Communication systems, RF and antennas, and network fundamentals for a fresher in telecom and wireless roles.', 'tags' => ['communication', 'rf', 'antennas', 'networks']],
            ['name' => 'Power Systems Graduate Engineer Trainee', 'discipline' => 'eee', 'description' => 'Generation, transmission and distribution, protection and switchgear for a graduate trainee in utilities and PSUs.', 'tags' => ['power-systems', 'protection', 'switchgear', 'load-flow']],
            ['name' => 'Power Electronics & EV Engineer', 'discipline' => 'eee', 'description' => 'Converters, drives, battery and charging fundamentals for roles in power electronics and electric vehicles.', 'tags' => ['converters', 'drives', 'battery', 'ev']],
            ['name' => 'Electrical Design Engineer', 'discipline' => 'eee', 'description' => 'Load calculation, cable and equipment sizing, earthing and standards for building and plant electrical design.', 'tags' => ['design', 'earthing', 'standards', 'sizing']],
            ['name' => 'Design Engineer (GET) — Mechanical', 'discipline' => 'mech', 'description' => 'Machine design, strength of materials and CAD practice for a graduate engineer trainee in a design team.', 'tags' => ['machine-design', 'materials', 'cad', 'gdt']],
            ['name' => 'Thermal & HVAC Engineer', 'discipline' => 'mech', 'description' => 'Thermodynamics, heat transfer and refrigeration or air-conditioning fundamentals for thermal and HVAC roles.', 'tags' => ['thermodynamics', 'heat-transfer', 'hvac', 'refrigeration']],
            ['name' => 'Manufacturing & Production Engineer', 'discipline' => 'mech', 'description' => 'Manufacturing processes, quality and lean practice for production and plant engineering roles.', 'tags' => ['manufacturing', 'quality', 'lean', 'process-planning']],
            ['name' => 'Automotive & EV Engineer — Mechanical', 'discipline' => 'mech', 'description' => 'Vehicle systems, dynamics and EV powertrain fundamentals for automotive engineering roles.', 'tags' => ['automotive', 'vehicle-dynamics', 'powertrain', 'ev']],
            ['name' => 'Structural Engineer — Fresher', 'discipline' => 'civil', 'description' => 'Structural analysis and RCC or steel design for a fresher in a structural consultancy or design team.', 'tags' => ['structures', 'rcc', 'steel', 'analysis']],
            ['name' => 'Site & Construction Engineer (GET)', 'discipline' => 'civil', 'description' => 'Construction methods, quality, safety and site management for a graduate trainee on a live project.', 'tags' => ['construction', 'site', 'quality', 'safety']],
            ['name' => 'Highway & Transportation Engineer', 'discipline' => 'civil', 'description' => 'Highway design, pavements and traffic engineering for roads and infrastructure roles.', 'tags' => ['highway', 'pavement', 'traffic', 'surveying']],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function rounds(): array
    {
        return [
            ['round_number' => 1, 'round_name' => 'Core Fundamentals', 'question_count' => 6, 'difficulty' => 'easy', 'category_weights' => ['technical' => 70, 'aptitude' => 30], 'qualifying_score_percent' => 50.0],
            ['round_number' => 2, 'round_name' => 'Applied Technical', 'question_count' => 6, 'difficulty' => 'medium', 'category_weights' => ['technical' => 70, 'situational' => 30], 'qualifying_score_percent' => 55.0],
            ['round_number' => 3, 'round_name' => 'Projects, Managerial & HR', 'question_count' => 5, 'difficulty' => 'medium', 'category_weights' => ['technical' => 30, 'behavioral' => 30, 'situational' => 20, 'hr' => 20], 'qualifying_score_percent' => 50.0],
        ];
    }

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (! Schema::hasColumn($table, 'discipline')) {
                    $blueprint->string('discipline', 20)->nullable();
                    $blueprint->index('discipline', "{$table}_discipline_index");
                }
            });
        }

        $now = now();

        foreach ($this->templates() as $t) {
            $exists = DB::table('interview_role_templates')->where('name', $t['name'])->whereNull('owning_college_id')->whereNull('owning_company_id')->exists();

            if (! $exists) {
                DB::table('interview_role_templates')->insert([
                    'name' => $t['name'],
                    'description' => $t['description'],
                    'tech_stack_tags' => json_encode($t['tags']),
                    'rounds_config' => json_encode($this->rounds()),
                    'discipline' => $t['discipline'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Only the templates this migration made, and only if no track was built from them.
        $inUse = DB::table('interview_tracks')->whereNotNull('interview_role_template_id')->pluck('interview_role_template_id')->all();

        DB::table('interview_role_templates')->whereIn('name', array_column($this->templates(), 'name'))
            ->whereNull('owning_college_id')->whereNull('owning_company_id')->whereNotIn('id', $inUse)->delete();

        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                if (Schema::hasColumn($table, 'discipline')) {
                    $blueprint->dropIndex("{$table}_discipline_index");
                    $blueprint->dropColumn('discipline');
                }
            });
        }
    }
};
