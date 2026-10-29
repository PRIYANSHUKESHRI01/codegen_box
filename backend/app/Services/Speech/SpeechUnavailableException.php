<?php

namespace App\Services\Speech;

use RuntimeException;

/** The interviewer's voice could not be produced right now. The browser's own voice takes over, so this is never shown to a candidate. */
class SpeechUnavailableException extends RuntimeException {}
