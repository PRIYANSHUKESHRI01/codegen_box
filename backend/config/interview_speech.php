<?php

/*
|--------------------------------------------------------------------------
| The interviewer's voice
|--------------------------------------------------------------------------
|
| Every AI interview question is read aloud. The browser's built-in voice is the fallback; the real voice is a neural text-to-speech
| model, called from the server (the API key never reaches the browser) and cached on disk by the exact words spoken, so a question is
| synthesised once however many candidates hear it. See App\Services\Speech\* and docs/ai-interview-room.md.
|
| Which provider speaks (INTERVIEW_SPEECH_DRIVER=auto picks the best one that has a key, in this order):
|   elevenlabs  the most natural voices available and what large interview platforms use at scale - needs ELEVENLABS_API_KEY
|   openai      gpt-4o-mini-tts - needs OPENAI_API_KEY
|   gemini      Gemini TTS - already works with the GEMINI_API_KEY the AI interview scoring uses, so it is the voice out of the box
| No key for any of them = the browser's own voice, exactly as before. Nothing breaks.
|
*/

return [

    'enabled' => env('INTERVIEW_SPEECH_ENABLED', true),

    'driver' => env('INTERVIEW_SPEECH_DRIVER', 'auto'),

    /** Filesystem disk the synthesised audio is cached on (private; served only through the authenticated endpoints). */
    'disk' => env('INTERVIEW_SPEECH_DISK', 'local'),

    /** A question longer than this is not sent to a paid API (a bank question is a few sentences). */
    'max_characters' => 1200,

    'drivers' => [

        'elevenlabs' => [
            'api_key' => env('ELEVENLABS_API_KEY'),
            // A calm, confident, reassuring female voice ("Sarah"); any voice id from the ElevenLabs voice library works.
            'voice' => env('ELEVENLABS_VOICE_ID', 'EXAVITQu4vr4xnSDxMaL'),
            // Questions are synthesised once and cached, so latency does not matter: use the highest-quality model.
            'model' => env('ELEVENLABS_TTS_MODEL', 'eleven_multilingual_v2'),
            // Steady and warm rather than theatrical: an interviewer, not an audiobook.
            'stability' => (float) env('ELEVENLABS_STABILITY', 0.55),
            'similarity_boost' => (float) env('ELEVENLABS_SIMILARITY', 0.75),
            'style' => (float) env('ELEVENLABS_STYLE', 0.1),
            'speed' => (float) env('ELEVENLABS_SPEED', 0.97),
            'output_format' => env('ELEVENLABS_OUTPUT_FORMAT', 'mp3_44100_128'),
        ],

        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'voice' => env('OPENAI_TTS_VOICE', 'marin'),
            'model' => env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts'),
            // OpenAI takes delivery instructions as a separate field (unlike Gemini, where text added to the prompt is read out loud).
            'instructions' => env('OPENAI_TTS_INSTRUCTIONS', 'Speak as a warm, professional interviewer: calm, clear and unhurried, friendly but not chatty. Natural pauses between sentences.'),
        ],

        'gemini' => [
            // The same key as AI interview scoring (config/services.php).
            'api_key' => env('GEMINI_API_KEY'),
            // Prebuilt voice names and how Google describes them: Sulafat (warm), Achird (friendly), Kore (firm), Vindemiatrix (gentle),
            // Sadaltager (knowledgeable), Schedar (even), Erinome / Iapetus (clear). `php artisan interview:speech-sample` writes one
            // clip per voice so the choice can be made by ear.
            'voice' => env('GEMINI_TTS_VOICE', 'Sulafat'),
            'model' => env('GEMINI_TTS_MODEL', 'gemini-3.8-flash-tts'),
        ],
    ],

    /*
    | Lines the interviewer says that are not a question. Spoken text is generic on purpose (no names) so each is synthesised once for
    | everybody, and it is also what the candidate sees written out in the transcript - one source for both.
    */
    'lines' => [
        'greeting' => "Hi, I'm your AptRun interviewer. I'll ask one question at a time — take your time, and answer in your own words.",
        'welcome_back' => "Welcome back. Let's pick up right where we left off.",
    ],
];
