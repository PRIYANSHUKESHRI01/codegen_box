<?php

namespace App\Services\Speech;

/** OpenAI text-to-speech (gpt-4o-mini-tts): a steerable voice - the delivery is described in a separate `instructions` field, not spoken. */
class OpenAiSpeechSynthesizer extends HttpSpeechSynthesizer
{
    public function name(): string
    {
        return 'openai';
    }

    public function voiceKey(): string
    {
        return $this->config['model'].':'.$this->config['voice'].':'.substr(sha1((string) $this->config['instructions']), 0, 8);
    }

    public function synthesize(string $text): SynthesizedSpeech
    {
        $response = $this->send(fn ($http) => $http->withToken($this->apiKey())->post('https://api.openai.com/v1/audio/speech', [
            'model' => $this->config['model'],
            'voice' => $this->config['voice'],
            'input' => $text,
            'instructions' => $this->config['instructions'],
            'response_format' => 'mp3',
        ]));

        if ($response->body() === '') {
            throw new SpeechUnavailableException('OpenAI returned no audio.');
        }

        return new SynthesizedSpeech($response->body(), 'audio/mpeg', 'mp3');
    }
}
