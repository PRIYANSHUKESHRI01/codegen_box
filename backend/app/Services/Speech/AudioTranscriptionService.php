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
    private const PROMPT = <<<'PROMPT'
You are a verbatim English audio transcriber for technical and behavioral job interviews.
STRICT RULES:
1. The interview is conducted strictly in English. Transcribe all candidate speech verbatim in standard English using ONLY Latin/ASCII letters and punctuation.
2. NEVER output Urdu, Arabic, Persian, Hindi, Devanagari, or any non-Latin script under any circumstances — even if the speaker has a South Asian/Indian/Pakistani accent, pauses for breath, has background fan/static noise, or uses occasional regional filler words.
3. Candidates often pause in silence for 10-20 seconds to think before resuming their answer. Do NOT stop early on silences, do NOT skip speech after a long pause, and do NOT hallucinate filler phrases ("Thank you for watching", etc.) during quiet gaps. Transcribe ALL spoken segments from the start of the clip to the end.
4. Preserve technical terminology accurately (Python, Java, SQL, REST, OOPS, Docker, Kubernetes, Big-O, ECDIS, MARPOL, etc.).
5. If the recording contains zero intelligible human speech (only silence or static), output strictly: (No audible speech detected)
6. Return ONLY the plain English transcription text with no markdown, timestamps, or commentary.
PROMPT;

    /** Rejects Arabic, Urdu, Persian, Devanagari, and related non-Latin scripts produced by accidental multi-lingual decoding. */
    public const NON_LATIN_SCRIPT_REGEX = '/[\x{0600}-\x{06FF}\x{0750}-\x{077F}\x{08A0}-\x{08FF}\x{0900}-\x{097F}\x{FB50}-\x{FDFF}\x{FE70}-\x{FEFF}]/u';

    public function __construct(
        protected GeminiKeyRotationService $rotationService
    ) {}

    /**
     * Transcribe an uploaded file directly from an HTTP request.
     */
    public function transcribeUploadedFile(UploadedFile $file, ?string $questionContext = null): string
    {
        $mime = $file->getClientMimeType() ?: $file->getMimeType() ?: 'audio/webm';
        $contents = file_get_contents($file->getRealPath());

        if ($contents === false || strlen($contents) === 0) {
            return '';
        }

        return $this->transcribeAudioData($contents, $mime, $questionContext);
    }

    /**
     * Transcribe a file stored on the local or configured storage disk.
     */
    public function transcribeStoragePath(string $storagePath, string $disk = 'local', ?string $questionContext = null): string
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

        return $this->transcribeAudioData($contents, $mime, $questionContext);
    }

    /**
     * Core transcription logic: attempts Gemini multimodal audio transcription first,
     * falling back to OpenAI Whisper if configured, or clean default.
     */
    public function transcribeAudioData(string $audioBytes, string $mimeType, ?string $questionContext = null): string
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
            $geminiTranscript = $this->transcribeWithGemini($audioBytes, $cleanMime, $questionContext);
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
                $whisperTranscript = $this->transcribeWithWhisper($audioBytes, $cleanMime, $openAiKey, $questionContext);
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
     * Cascades through the model hierarchy: gemini-2.5-flash -> gemini-2.0-flash -> gemini-1.5-flash.
     */
    protected function transcribeWithGemini(string $audioBytes, string $mimeType, ?string $questionContext = null): string
    {
        $base64Audio = base64_encode($audioBytes);
        $configuredPrimary = env('GEMINI_TRANSCRIPTION_MODEL', config('services.gemini.model', 'gemini-2.5-flash'));
        $models = array_values(array_unique(array_filter([
            $configuredPrimary,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
        ])));
        $prompt = $this->buildPrompt($questionContext);

        foreach ($models as $model) {
            try {
                $response = $this->rotationService->runWithFallback(function (string $currentKey) use ($base64Audio, $mimeType, $model, $prompt) {
                    return Http::withHeaders(['x-goog-api-key' => $currentKey])
                        ->timeout(45)
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
                                                'text' => $prompt,
                                            ],
                                        ],
                                    ],
                                ],
                                'generationConfig' => [
                                    'temperature' => 0.0,
                                    'maxOutputTokens' => 4096,
                                ],
                            ]
                        );
                });

                if ($response->successful()) {
                    $text = (string) $response->json('candidates.0.content.parts.0.text');
                    if (self::containsDisallowedScript($text)) {
                        Log::warning("[AudioTranscriptionService] Model '{$model}' emitted non-Latin/Urdu script; discarding and trying fallback.", [
                            'sample' => mb_substr($text, 0, 80),
                        ]);
                        continue;
                    }
                    $cleaned = $this->cleanTranscript($text);
                    if ($cleaned !== '') {
                        return $cleaned;
                    }
                }

                Log::warning("[AudioTranscriptionService] Model '{$model}' returned status {$response->status()}, trying next model in hierarchy...");
            } catch (Throwable $e) {
                Log::warning("[AudioTranscriptionService] Model '{$model}' exception: {$e->getMessage()}, trying next model...");
            }
        }

        return '';
    }

    /**
     * Fallback transcriber using OpenAI Whisper endpoint.
     */
    protected function transcribeWithWhisper(string $audioBytes, string $mimeType, string $apiKey, ?string $questionContext = null): string
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
            ->timeout(45)
            ->attach('file', $audioBytes, "audio.{$ext}")
            ->post('https://api.openai.com/v1/audio/transcriptions', [
                'model' => 'whisper-1',
                'language' => 'en',
                'temperature' => '0',
                'prompt' => $this->buildWhisperPrompt($questionContext),
            ]);

        if ($response->successful()) {
            $text = (string) $response->json('text');
            if (self::containsDisallowedScript($text)) {
                return '';
            }
            return $this->cleanTranscript($text);
        }

        return '';
    }

    protected function buildPrompt(?string $questionContext): string
    {
        $cleanContext = trim((string) preg_replace('/\s+/', ' ', (string) ($questionContext ?? '')));
        if ($cleanContext === '') {
            return self::PROMPT;
        }

        $truncated = mb_substr($cleanContext, 0, 500);
        return self::PROMPT . "\n\nINTERVIEW QUESTION CONTEXT: \"{$truncated}\". Use this topic context ONLY to disambiguate phonetic homophones and technical terms accurately from the audio (e.g., DOM vs Tom, SQL vs sequel, Docker vs talker, API vs a p i, Git vs get) while keeping the transcript strictly verbatim to what the candidate spoke.";
    }

    protected function buildWhisperPrompt(?string $questionContext): string
    {
        $cleanContext = trim((string) preg_replace('/\s+/', ' ', (string) ($questionContext ?? '')));
        if ($cleanContext === '') {
            return 'English-only job interview answer with technical terminology and natural silent thinking pauses.';
        }

        $truncated = mb_substr($cleanContext, 0, 220);
        return "English technical job interview answer. Question: {$truncated}";
    }

    public static function containsDisallowedScript(string $text): bool
    {
        return $text !== '' && preg_match(self::NON_LATIN_SCRIPT_REGEX, $text) === 1;
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

        if (self::containsDisallowedScript($cleaned)) {
            return '';
        }

        if (strcasecmp($cleaned, '(No audible speech detected)') === 0
            || strcasecmp($cleaned, 'No audible speech detected.') === 0
            || strcasecmp($cleaned, '(Silence)') === 0
            || preg_match('/^(thanks?( you)? for watching\.?|subtitles by .*)$/i', $cleaned) === 1) {
            return '';
        }

        return $cleaned;
    }
}

