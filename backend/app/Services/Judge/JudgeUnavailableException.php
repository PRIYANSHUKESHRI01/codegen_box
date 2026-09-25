<?php

namespace App\Services\Judge;

use RuntimeException;

/**
 * The execution infrastructure failed (no node reachable, node 5xx, timeout)
 * — as opposed to the student's code failing. The distinction matters: an
 * infrastructure failure must never become a persisted verdict, or a contest
 * participant is charged a wrong-attempt penalty for OUR outage. The queued
 * job retries these; only after retries are exhausted does the student see
 * "judge unavailable" — and even then nothing is recorded against them.
 */
class JudgeUnavailableException extends RuntimeException {}
