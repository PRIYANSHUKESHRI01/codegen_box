<?php

namespace App\Services\Speech;

/**
 * ElevenLabs text-to-speech: the most natural voices on the market, and what AI interview platforms run at scale (Apna's AI mock
 * interviews are built on it). Questions are synthesised once and cached, so the highest-quality model is used rather than the fastest.
 */
class ElevenLabsSpeechSynthesizer extends HttpSpeechSynthesizer
{
    public function name(): string
    {
        return 'elevenlabs';
    }

    public function voiceKey(): string
    {
        return implode(':', [$this->config['model'], $this->config['voice'], $this->config['stability'], $this->config['similarity_boost'], $this->config['style'], $this->config['speed']]);
    }

    public function synthesize(string $text): SynthesizedSpeech
    {
        $response = $this->send(fn ($http) => $http->withHeaders(['xi-api-key' => $this->apiKey(), 'Accept' => 'audio/mpeg'])->post(
            'https://api.elevenlabs.io/v1/text-to-speech/'.rawurlencode($this->config['voice']).'?output_format='.$this->config['output_format'],
            [
                'text' => $text,
                'model_id' => $this->config['model'],
                'voice_settings' => [
                    'stability' => $this->config['stability'],
                    'similarity_boost' => $this->config['similarity_boost'],
                    'style' => $this->config['style'],
                    'use_speaker_boost' => true,
                    'speed' => $this->config['speed'],
                ],
            ]
        ));

        if ($response->body() === '') {
            throw new SpeechUnavailableException('ElevenLabs returned no audio.');
        }

        return new SynthesizedSpeech($response->body(), 'audio/mpeg', 'mp3');
    }
}
