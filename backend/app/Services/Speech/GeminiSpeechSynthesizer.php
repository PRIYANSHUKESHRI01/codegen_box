<?php

namespace App\Services\Speech;

/**
 * Gemini text-to-speech: a prebuilt voice, no extra account (it uses the key AI interview scoring already has).
 *
 * The text is sent bare. Gemini reads out anything put in front of it as a style instruction ("Say warmly: ..."), so the tone comes from
 * the choice of voice and nothing else - checked against the live API: with such a prefix a seven-second question came back at twelve.
 */
class GeminiSpeechSynthesizer extends HttpSpeechSynthesizer
{
    public function name(): string
    {
        return 'gemini';
    }

    public function voiceKey(): string
    {
        return $this->config['model'].':'.$this->config['voice'];
    }

    public function synthesize(string $text): SynthesizedSpeech
    {
        $response = $this->send(fn ($http) => $http->withHeaders(['x-goog-api-key' => $this->apiKey()])->post(
            'https://generativelanguage.googleapis.com/v1beta/models/'.$this->config['model'].':generateContent',
            [
                'contents' => [['parts' => [['text' => $text]]]],
                'generationConfig' => [
                    'responseModalities' => ['AUDIO'],
                    'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $this->config['voice']]]],
                ],
            ]
        ));

        $inline = $response->json('candidates.0.content.parts.0.inlineData') ?? $response->json('candidates.0.content.parts.0.inline_data');
        $audio = is_array($inline) ? base64_decode((string) ($inline['data'] ?? ''), true) : false;

        if (! is_string($audio) || $audio === '') {
            throw new SpeechUnavailableException('Gemini returned no audio.');
        }

        $mime = (string) ($inline['mimeType'] ?? $inline['mime_type'] ?? '');

        // Already a WAV file (the usual answer) - use it as it is.
        if (str_starts_with($audio, 'RIFF')) {
            return new SynthesizedSpeech($audio, 'audio/wav', 'wav');
        }

        // Bare PCM ("audio/L16;codec=pcm;rate=24000"): give it a container.
        $rate = preg_match('/rate=(\d+)/', $mime, $m) ? (int) $m[1] : 24000;

        return SynthesizedSpeech::wavFromPcm($audio, $rate);
    }
}
