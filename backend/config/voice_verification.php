<?php

return [
    /*
    |--------------------------------------------------------------------------
    | One-Time 5-Minute Voice Baseline Verification
    |--------------------------------------------------------------------------
    | When enabled, students must complete the one-time 5-minute AI voice
    | verification interview before taking any Vault AI or Mock AI interview.
    | Every spoken answer during subsequent interviews is matched against this
    | baseline; a detected speaker mismatch blocks interview access.
    */
    'required' => env('VOICE_VERIFICATION_REQUIRED', true),

    'total_duration_seconds' => (int) env('VOICE_VERIFICATION_DURATION_SECONDS', 300),

    // Minimum cumulative speech seconds required across the 5 prompts to finalize baseline.
    'min_enroll_duration_seconds' => (int) env('VOICE_VERIFICATION_MIN_SPEECH_SECONDS', 100),

    // Minimum words per prompt so silent/empty clips cannot enroll a fake baseline.
    'min_words_per_prompt' => 8,

    // Keep voice matching 100% local & zero-cost (no paid Gemini/OpenAI API calls required).
    'use_ai_api' => env('VOICE_VERIFICATION_USE_AI_API', false),

    // Minimum similarity (0-100) required to pass live voice matching cleanly.
    'match_threshold' => (float) env('VOICE_VERIFICATION_MATCH_THRESHOLD', 60.0),

    // Severe mismatch floor (0-100): immediately blocks on clear speaker mismatch.
    'hard_block_threshold' => (float) env('VOICE_VERIFICATION_HARD_BLOCK_THRESHOLD', 44.0),

    // Borderline mismatches (between hard_block_threshold and match_threshold) allowed before blocking.
    'max_borderline_strikes' => (int) env('VOICE_VERIFICATION_MAX_BORDERLINE_STRIKES', 2),

    // Total proctoring-locked retries allowed during the 5-minute enrollment before admin intervention is required.
    'max_enrollment_attempts' => (int) env('VOICE_VERIFICATION_MAX_ENROLLMENT_ATTEMPTS', 3),
];
