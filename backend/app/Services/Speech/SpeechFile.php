<?php

namespace App\Services\Speech;

use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** A cached clip of the interviewer's voice, and how to send it. */
final class SpeechFile
{
    public function __construct(
        public readonly string $disk,
        public readonly string $path,
        public readonly string $mime,
    ) {}

    public function response(): Response|StreamedResponse
    {
        return Storage::disk($this->disk)->response($this->path, null, [
            'Content-Type' => $this->mime,
            // Private (it sits behind a login) but safe to keep: the same question always sounds the same.
            'Cache-Control' => 'private, max-age=604800',
        ]);
    }
}
