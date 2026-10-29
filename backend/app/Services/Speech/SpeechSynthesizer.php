<?php

namespace App\Services\Speech;

/** A text-to-speech provider. Implementations only turn text into audio; caching, authorisation and fallbacks live around them. */
interface SpeechSynthesizer
{
    /** The provider's short name ("gemini", "elevenlabs", "openai"). */
    public function name(): string;

    /** Everything that changes how the audio sounds (voice, model, settings), so a cached clip is never served for a different voice. */
    public function voiceKey(): string;

    /** The same provider speaking with another voice - for auditioning voices (the id or name is the provider's own). */
    public function withVoice(string $voice): static;

    /** @throws SpeechUnavailableException when the provider could not produce audio */
    public function synthesize(string $text): SynthesizedSpeech;
}
