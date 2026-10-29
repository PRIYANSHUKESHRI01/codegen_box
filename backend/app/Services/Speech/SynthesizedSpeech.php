<?php

namespace App\Services\Speech;

/** One piece of synthesised speech: the audio bytes, what they are, and the file extension to cache them under. */
final class SynthesizedSpeech
{
    public function __construct(
        public readonly string $bytes,
        public readonly string $mime,
        public readonly string $extension,
    ) {}

    /**
     * Raw 16-bit little-endian mono PCM wrapped in a WAV container, so a browser can play it. Gemini normally answers with a ready WAV
     * file, but also with bare PCM in some modes.
     */
    public static function wavFromPcm(string $pcm, int $sampleRate = 24000): self
    {
        $dataSize = strlen($pcm);
        $header = 'RIFF'.pack('V', 36 + $dataSize).'WAVE'
            .'fmt '.pack('VvvVVvv', 16, 1, 1, $sampleRate, $sampleRate * 2, 2, 16)
            .'data'.pack('V', $dataSize);

        return new self($header.$pcm, 'audio/wav', 'wav');
    }
}
