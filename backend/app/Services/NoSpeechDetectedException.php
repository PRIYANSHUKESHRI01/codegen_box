<?php

namespace App\Services;

use RuntimeException;

/**
 * Thrown by GeminiSpeakingScoringService when a recording contains no usable
 * speech (muted mic, silence, noise only). Distinct from a plain
 * RuntimeException so the controller can treat it as "nothing to score — let
 * them retry for free" rather than a scoring failure.
 */
class NoSpeechDetectedException extends RuntimeException {}
