<?php

namespace App\Services\Speech;

use App\Services\GeminiKeyRotationService;

/**
 * Gemini text-to-speech: a prebuilt voice, no extra account (it uses the key AI interview scoring already has).
 *
 * The text is sent bare. Gemini reads out anything put in front of it as a style instruction ("Say warmly: ..."), so the tone comes from
 * the choice of voice and nothing else - checked against the live API: with such a prefix a seven-second question came back at twelve.
 */
class GeminiSpeechSynthesizer extends HttpSpeechSynthesizer
{
    private const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

    /** @var list<string> */
    private const TTS_MODEL_FALLBACKS = [
        'gemini-2.5-flash-preview-tts',
        'gemini-2.5-pro-preview-tts',
        'gemini-3.8-flash-tts',
    ];

    public function name(): string
    {
        return 'gemini';
    }

    private function resolvedModel(): string
    {
        $configured = trim((string) ($this->config['model'] ?? ''));

        return GeminiKeyRotationService::isAllowedModel($configured) ? $configured : self::DEFAULT_TTS_MODEL;
    }

    /** @return list<string> */
    private function modelCandidates(): array
    {
        return array_values(array_unique([$this->resolvedModel(), ...self::TTS_MODEL_FALLBACKS]));
    }

    public function voiceKey(): string
    {
        return $this->resolvedModel().':'.$this->config['voice'];
    }

    protected function apiKey(): string
    {
        $rotationKey = app(GeminiKeyRotationService::class)->getActiveApiKeyString();

        return ! empty($rotationKey) ? $rotationKey : parent::apiKey();
    }

    public function synthesize(string $text): SynthesizedSpeech
    {
        $rotationService = app(GeminiKeyRotationService::class);
        $lastError = null;

        foreach ($this->modelCandidates() as $model) {
            try {
                $response = $rotationService->runWithFallback(function (string $currentKey) use ($text, $model) {
                    return $this->send(fn ($http) => $http->withHeaders(['x-goog-api-key' => $currentKey])->post(
                        'https://generativelanguage.googleapis.com/v1beta/models/'.$model.':generateContent',
                        [
                            'contents' => [['parts' => [['text' => $text]]]],
                            'generationConfig' => [
                                'responseModalities' => ['AUDIO'],
                                'speechConfig' => ['voiceConfig' => ['prebuiltVoiceConfig' => ['voiceName' => $this->config['voice']]]],
                            ],
                        ]
                    ));
                });

                $inline = $response->json('candidates.0.content.parts.0.inlineData') ?? $response->json('candidates.0.content.parts.0.inline_data');
                $audio = is_array($inline) ? base64_decode((string) ($inline['data'] ?? ''), true) : false;

                if (is_string($audio) && $audio !== '') {
                    $mime = (string) ($inline['mimeType'] ?? $inline['mime_type'] ?? '');

                    if (str_starts_with($audio, 'RIFF')) {
                        return new SynthesizedSpeech($audio, 'audio/wav', 'wav');
                    }

                    $rate = preg_match('/rate=(\d+)/', $mime, $m) ? (int) $m[1] : 24000;

                    return SynthesizedSpeech::wavFromPcm($audio, $rate);
                }
            } catch (SpeechRateLimitedException $e) {
                throw $e;
            } catch (SpeechUnavailableException $e) {
                $lastError = $e;
            }
        }

        throw $lastError ?? new SpeechUnavailableException('Gemini returned no audio.');
    }
}
