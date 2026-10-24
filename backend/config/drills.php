<?php

/*
|--------------------------------------------------------------------------
| Skill Drills — unlimited, generated practice with instant feedback
|--------------------------------------------------------------------------
|
| The questions themselves are generated in the browser (frontend/src/lib/drills), so there is no question bank to maintain. The server keeps
| what the student did — one row per answered question — for streaks, mastery and (later) their college's reports.
|
| THIS FILE is the canonical list of skill ids: the API accepts attempts only for these, and a frontend test fails if the browser's catalog
| and this list ever drift apart. `audience` = the branch families a pack is built for; it only decides ordering and the "recommended" label —
| every student can open every pack.
|
*/

return [

    'packs' => [
        'digital' => [
            'audience' => ['ece', 'eee', 'cse', 'other'],
            'skills' => [
                'number_conversion', 'ones_complement', 'twos_complement', 'signed_range', 'binary_arithmetic',
                'gate_output', 'circuit_output', 'truth_table', 'identify_gate', 'boolean_equivalence',
                'minterms', 'gray_code', 'parity_hamming', 'flipflop_next', 'counter_division',
            ],
        ],
        'circuits' => [
            'audience' => ['ece', 'eee'],
            'skills' => [
                'ohms_law', 'series_parallel', 'voltage_divider', 'current_divider', 'power_energy',
                'rc_time_constant', 'lc_resonance', 'ac_rms_frequency', 'kcl_node', 'decibels',
            ],
        ],
        'quickcalcs' => [
            'audience' => ['mech', 'civil'],
            'skills' => [
                'unit_conversion', 'stress_strain', 'beam_reactions', 'beam_moment', 'section_properties',
                'ideal_gas', 'thermal_efficiency', 'reynolds_continuity', 'hydrostatic_pressure', 'gear_ratios',
                'soil_phase_relations',
            ],
        ],
    ],

    'limits' => [
        // Answers accepted per request, and per student per day (past it the rest are quietly dropped: practice must never error out).
        'batch' => 25,
        'attempts_per_day' => 1500,
    ],

    // How many of a skill's most recent answers the summary returns (mastery is computed from them).
    'recent_window' => 12,
];
