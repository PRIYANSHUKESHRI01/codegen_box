<?php

namespace App\Services\Speech;

/**
 * Picks the provider that speaks. `auto` takes the best one that has an API key; an explicit INTERVIEW_SPEECH_DRIVER takes that one if it
 * has a key. Returns null when nothing is configured, which is a normal state (the browser's own voice is used).
 */
class SpeechManager
{
    /** Best first. */
    private const PRIORITY = ['elevenlabs', 'openai', 'gemini'];

    private const CLASSES = [
        'elevenlabs' => ElevenLabsSpeechSynthesizer::class,
        'openai' => OpenAiSpeechSynthesizer::class,
        'gemini' => GeminiSpeechSynthesizer::class,
    ];

    public function driver(?string $name = null): ?SpeechSynthesizer
    {
        if (! config('interview_speech.enabled')) {
            return null;
        }

        $wanted = $name ?? (string) config('interview_speech.driver', 'auto');
        $candidates = $wanted === 'auto' ? self::PRIORITY : [$wanted];

        foreach ($candidates as $candidate) {
            $class = self::CLASSES[$candidate] ?? null;
            $config = config("interview_speech.drivers.{$candidate}");

            if ($class === null || ! is_array($config) || empty($config['api_key'])) {
                continue;
            }

            return new $class($config);
        }

        return null;
    }

    public function available(): bool
    {
        return $this->driver() !== null;
    }
}
