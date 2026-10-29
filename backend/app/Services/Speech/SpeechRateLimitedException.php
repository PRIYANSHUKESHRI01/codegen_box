<?php

namespace App\Services\Speech;

/** The provider said "slow down" (HTTP 429 / quota). Retrying within seconds only makes it worse; the voice backs off for a minute instead. */
class SpeechRateLimitedException extends SpeechUnavailableException {}
