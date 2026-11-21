<?php

namespace App\Services\Speech;

use App\Services\GeminiKeyRotationService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * High-performance, high-concurrency audio transcription service for Mock AI and Vault AI interviews.
 * Designed to handle 2,000+ concurrent interview sessions:
 * 1. Primary: Google Gemini Flash Multimodal Audio (via GeminiKeyRotationService with multi-key pooling and automatic 429 failover).
 * 2. Secondary: OpenAI Whisper-1 (if OPENAI_API_KEY configured in environment).
 * 3. Graceful degradation: never throws fatal 500s or drops student submissions.
 */
class AudioTranscriptionService
{
    private const PROMPT = 'You are an accurate verbatim audio transcriber for job candidate technical and behavioral interviews. Transcribe the candidate speech verbatim and accurately. Preserve all technical terminology, programming concepts, algorithms, frameworks, and syntax names (e.g., Python, Java, SQL, REST, OOPS, Docker, Kubernetes, Big-O). If the audio is completely silent or contains only static/inaudible noise, output "(No audible speech detected)". Return ONLY the plain transcription text without any greetings, commentary, markdown quotes, or timestamps.';

    public function __construct(
        protected GeminiKeyRotationService $rotationService
    ) {}

    /**
     * Transcribe an uploaded file directly from an HTTP request.
     */
    public function transcribeUploadedFile(UploadedFile $file): string
    {
        $mime = $file->getClientMimeType() ?: $file->getMimeType() ?: 'audio/webm';
        $contents = file_get_contents($file->getRealPath());

        if ($contents === false || strlen($contents) === 0) {
            return '';
        }

        return $this->transcribeAudioData($contents, $mime);
    }

    /**
     * Transcribe a file stored on the local or configured storage disk.
     */
    public function transcribeStoragePath(string $storagePath, string $disk = 'local'): string
    {
        if (!Storage::disk($disk)->exists($storagePath)) {
            Log::warning('[AudioTranscriptionService] File does not exist in storage', ['path' => $storagePath, 'disk' => $disk]);
            return '';
        }

        $contents = Storage::disk($disk)->get($storagePath);
        if ($contents === null || strlen($contents) === 0) {
            return '';
        }

        $extension = strtolower(pathinfo($storagePath, PATHINFO_EXTENSION));
        $mime = match ($extension) {
            'wav' => 'audio/wav',
            'mp3' => 'audio/mp3',
            'ogg', 'oga' => 'audio/ogg',
            'mp4', 'm4a' => 'audio/mp4',
            default => 'audio/webm',
        };

        return $this->transcribeAudioData($contents, $mime);
    }

    /**
     * Core transcription logic: attempts Gemini multimodal audio transcription first,
     * falling back to OpenAI Whisper if configured, or clean default.
     */
    public function transcribeAudioData(string $audioBytes, string $mimeType): string
    {
        if (strlen($audioBytes) < 200) {
            // Audio too small to contain voiced speech (<0.1s)
            return '';
        }

        // Clean up MIME type (strip parameters like codecs=opus)
        $cleanMime = strtolower(explode(';', $mimeType)[0]);
        if (!in_array($cleanMime, ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'])) {
            $cleanMime = 'audio/webm';
        }

        // 1. Try Gemini Multimodal Speech Transcription (Flagship high-accuracy & key-rotated)
        try {
            $geminiTranscript = $this->transcribeWithGemini($audioBytes, $cleanMime);
            if (!empty($geminiTranscript)) {
                return $geminiTranscript;
            }
        } catch (Throwable $e) {
            Log::warning('[AudioTranscriptionService] Gemini transcription attempt failed', [
                'error' => $e->getMessage(),
            ]);
        }

        // 2. Fallback to OpenAI Whisper if OPENAI_API_KEY is configured
        $openAiKey = env('OPENAI_API_KEY');
        if (!empty($openAiKey)) {
            try {
                $whisperTranscript = $this->transcribeWithWhisper($audioBytes, $cleanMime, $openAiKey);
                if (!empty($whisperTranscript)) {
                    return $whisperTranscript;
                }
            } catch (Throwable $e) {
                Log::warning('[AudioTranscriptionService] OpenAI Whisper fallback failed', [
                    'error' => $e->getMessage(),
                ]);
            }
        }

        return '';
    }

    /**
     * Transcribe using Google Gemini Multimodal Audio via GeminiKeyRotationService.
     */
    protected function transcribeWithGemini(string $audioBytes, string $mimeType): string
    {
        $base64Audio = base64_encode($audioBytes);
        $model = env('GEMINI_TRANSCRIPTION_MODEL', 'gemini-1.5-flash');

        $response = $this->rotationService->runWithFallback(function (string $currentKey) use ($base64Audio, $mimeType, $model) {
            return Http::withHeaders(['x-goog-api-key' => $currentKey])
                ->timeout(25)
                ->retry(2, 500, fn ($exception) => $exception instanceof \Illuminate\Http\Client\ConnectionException)
                ->post(
                    "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent",
                    [
                        'contents' => [
                            [
                                'role' => 'user',
                                'parts' => [
                                    [
                                        'inline_data' => [
                                            'mime_type' => $mimeType,
                                            'data' => $base64Audio,
                                        ],
                                    ],
                                    [
                                        'text' => self::PROMPT,
                                    ],
                                ],
                            ],
                        ],
                        'generationConfig' => [
                            'temperature' => 0.0,
                            'maxOutputTokens' => 2048,
                        ],
                    ]
                );
        });

        if ($response->failed()) {
            // If model was 1.5-flash and returned 404/not supported, attempt with fallback model
            $fallbackModel = config('services.gemini.model', 'gemini-2.0-flash');
            if ($fallbackModel !== $model) {
                $retryRes = $this->rotationService->runWithFallback(function (string $currentKey) use ($base64Audio, $mimeType, $fallbackModel) {
                    return Http::withHeaders(['x-goog-api-key' => $currentKey])
                        ->timeout(25)
                        ->post(
                            "https://generativelanguage.googleapis.com/v1beta/models/{$fallbackModel}:generateContent",
                            [
                                'contents' => [
                                    [
                                        'role' => 'user',
                                        'parts' => [
                                            [
                                                'inline_data' => [
                                                    'mime_type' => $mimeType,
                                                    'data' => $base64Audio,
                                                ],
                                            ],
                                            [
                                                'text' => self::PROMPT,
                                            ],
                                        ],
                                    ],
                                ],
                                'generationConfig' => [
                                    'temperature' => 0.0,
                                    'maxOutputTokens' => 2048,
                                ],
                            ]
                        );
                });

                if ($retryRes->successful()) {
                    $text = (string) $retryRes->json('candidates.0.content.parts.0.text');
                    return $this->cleanTranscript($text);
                }
            }

            Log::warning('[AudioTranscriptionService] Gemini API non-200 response', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 500),
            ]);
            return '';
        }

        $text = (string) $response->json('candidates.0.content.parts.0.text');
        return $this->cleanTranscript($text);
    }

    /**
     * Fallback transcriber using OpenAI Whisper endpoint.
     */
    protected function transcribeWithWhisper(string $audioBytes, string $mimeType, string $apiKey): string
    {
        $ext = match ($mimeType) {
            'audio/wav' => 'wav',
            'audio/mp3' => 'mp3',
            'audio/ogg' => 'ogg',
            'audio/mp4', 'audio/x-m4a' => 'm4a',
            default => 'webm',
        };

        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . trim($apiKey),
        ])
            ->timeout(25)
            ->attach('file', $audioBytes, "audio.{$ext}")
            ->post('https://api.openai.com/v1/audio/transcriptions', [
                'model' => 'whisper-1',
                'language' => 'en',
                'prompt' => 'Job interview technical and behavioral answers.',
            ]);

        if ($response->successful()) {
            $text = (string) $response->json('text');
            return $this->cleanTranscript($text);
        }

        return '';
    }

    /**
     * Cleans up raw transcription output.
     */
    protected function cleanTranscript(string $text): string
    {
        $cleaned = trim($text);

        // Strip surrounding markdown code blocks or quotes if generated
        if (str_starts_with($cleaned, '```') && str_ends_with($cleaned, '```')) {
            $cleaned = preg_replace('/^```(?:text)?\s*|\s*```$/', '', $cleaned);
            $cleaned = trim((string) $cleaned);
        }

        $cleaned = trim($cleaned, "\"'\n\r\t ");

        if (strcasecmp($cleaned, '(No audible speech detected)') === 0
            || strcasecmp($cleaned, 'No audible speech detected.') === 0
            || strcasecmp($cleaned, '(Silence)') === 0) {
            return '';
        }

        return $cleaned;
    }
}
