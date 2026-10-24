<?php

namespace App\Services\Integrity;

use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Where proctoring stills live. Three rules:
 *   1. Private disk only — there is no URL to an evidence file. A reviewer is served the bytes by an authorised
 *      endpoint (IntegrityReviewController), after the scope check.
 *   2. Encrypted at rest (AES-256-GCM, a key derived from APP_KEY), so a copied disk or backup is just noise.
 *   3. Bounded — per-image size, image dimensions, bytes per attempt, and a retention window (integrity:prune).
 *
 * File layout: 0x01 | 12-byte IV | 16-byte tag | ciphertext.
 */
class EvidenceVault
{
    private const VERSION = "\x01";

    private const MAX_WIDTH = 1920;

    private const MAX_HEIGHT = 1200;

    /** @return IntegrityEvidence|null null when this attempt has used up its evidence allowance */
    public function store(
        IntegritySession $session,
        string $kind,
        string $bytes,
        CarbonInterface $capturedAt,
        array $meta = [],
        bool $flagged = false,
        ?string $reason = null,
    ): ?IntegrityEvidence {
        $this->assertImage($bytes);

        $cap = (int) config('integrity.evidence.max_bytes_per_session');
        $used = (int) IntegrityEvidence::where('integrity_session_id', $session->id)->sum('bytes');
        // A flagged still is the whole point of the system, so it is allowed to run slightly past the allowance.
        if ($cap > 0 && $used + strlen($bytes) > ($flagged ? (int) ($cap * 1.2) : $cap)) {
            return null;
        }

        $encrypt = (bool) config('integrity.evidence.encrypt', true);
        $disk = (string) config('integrity.evidence.disk', 'local');
        $path = sprintf(
            '%s/%s/%s/%s/%s-%s-%s.%s',
            trim((string) config('integrity.evidence.directory', 'integrity-evidence'), '/'),
            $capturedAt->format('Y'),
            $capturedAt->format('m'),
            $session->uuid,
            $kind,
            $capturedAt->format('His'),
            Str::lower(Str::random(6)),
            $encrypt ? 'jpg.enc' : 'jpg',
        );

        Storage::disk($disk)->put($path, $encrypt ? $this->encrypt($bytes) : $bytes);

        return IntegrityEvidence::create([
            'integrity_session_id' => $session->id,
            'kind' => $kind,
            'disk' => $disk,
            'path' => $path,
            'bytes' => strlen($bytes),
            'sha256' => hash('sha256', $bytes),
            'encrypted' => $encrypt,
            'captured_at' => $capturedAt,
            'meta' => $meta ?: null,
            'flagged' => $flagged,
            'reason' => $reason,
        ]);
    }

    /** The decrypted image bytes, or null when the file is gone (retention) or fails its checksum. */
    public function read(IntegrityEvidence $evidence): ?string
    {
        $disk = Storage::disk($evidence->disk);
        if (! $disk->exists($evidence->path)) {
            return null;
        }

        $raw = (string) $disk->get($evidence->path);
        $bytes = $evidence->encrypted ? $this->decrypt($raw) : $raw;

        if ($bytes === null || ! hash_equals($evidence->sha256, hash('sha256', $bytes))) {
            return null;
        }

        return $bytes;
    }

    public function delete(IntegrityEvidence $evidence): void
    {
        Storage::disk($evidence->disk)->delete($evidence->path);
        $evidence->delete();
    }

    private function assertImage(string $bytes): void
    {
        $max = (int) config('integrity.evidence.max_image_bytes');
        if ($bytes === '' || ($max > 0 && strlen($bytes) > $max)) {
            throw new RuntimeException('Evidence image is empty or too large.');
        }

        $info = @getimagesizefromstring($bytes);
        // JPEG only: it is what the browser produces, and refusing every other format keeps odd payloads out of the store.
        if ($info === false || ($info[2] ?? null) !== IMAGETYPE_JPEG || $info[0] > self::MAX_WIDTH || $info[1] > self::MAX_HEIGHT) {
            throw new RuntimeException('Evidence must be a JPEG image of ordinary size.');
        }
    }

    private function key(): string
    {
        $appKey = (string) config('app.key');
        if (str_starts_with($appKey, 'base64:')) {
            $appKey = (string) base64_decode(substr($appKey, 7), true);
        }

        return hash_hkdf('sha256', $appKey, 32, 'aptrun-integrity-evidence');
    }

    private function encrypt(string $plain): string
    {
        $iv = random_bytes(12);
        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA, $iv, $tag, '', 16);

        if ($cipher === false) {
            throw new RuntimeException('Could not encrypt evidence.');
        }

        return self::VERSION.$iv.$tag.$cipher;
    }

    private function decrypt(string $blob): ?string
    {
        if (strlen($blob) < 30 || $blob[0] !== self::VERSION) {
            return null;
        }

        $plain = openssl_decrypt(substr($blob, 29), 'aes-256-gcm', $this->key(), OPENSSL_RAW_DATA, substr($blob, 1, 12), substr($blob, 13, 16));

        return $plain === false ? null : $plain;
    }
}
