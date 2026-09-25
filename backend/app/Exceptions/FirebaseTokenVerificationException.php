<?php

namespace App\Exceptions;

/** Thrown by FirebasePhoneVerificationService for any reason an ID token can't be trusted — the message is always safe to show the caller directly. */
class FirebaseTokenVerificationException extends \RuntimeException {}
