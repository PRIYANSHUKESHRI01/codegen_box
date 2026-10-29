<?php

namespace App\Services\Speech;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/** The shared part of the HTTP-based providers: one retry on the failures that are worth retrying, and a clean exception for the rest. */
abstract class HttpSpeechSynthesizer implements SpeechSynthesizer
{
    /** @param  array<string, mixed>  $config */
    public function __construct(protected array $config) {}

    public function withVoice(string $voice): static
    {
        $copy = clone $this;
        $copy->config['voice'] = $voice;

        return $copy;
    }

    protected function apiKey(): string
    {
        return (string) ($this->config['api_key'] ?? '');
    }

    /** @param  callable(PendingRequest): Response  $send */
    protected function send(callable $send): Response
    {
        $last = null;

        for ($attempt = 1; $attempt <= 2; $attempt++) {
            try {
                $response = $send(Http::timeout(75));
            } catch (ConnectionException $e) {
                $last = $e->getMessage();
                usleep(800_000);

                continue;
            }

            if ($response->successful()) {
                return $response;
            }

            $last = "HTTP {$response->status()}: ".substr($response->body(), 0, 300);

            // Over quota: trying again in a second only digs the hole deeper. Say so, and let the caller back off.
            if ($response->status() === 429) {
                Log::warning("Speech synthesis via {$this->name()} is rate limited", ['error' => $last]);

                throw new SpeechRateLimitedException("{$this->name()} is over its rate limit.");
            }

            // A provider hiccup is worth one more try; a bad key or a bad request is not.
            if ($response->serverError()) {
                usleep(800_000);

                continue;
            }

            break;
        }

        Log::warning("Speech synthesis via {$this->name()} failed", ['error' => $last]);

        throw new SpeechUnavailableException("{$this->name()} could not synthesise speech.");
    }
}
