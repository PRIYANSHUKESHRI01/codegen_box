<?php

namespace App\Events;

use App\Models\CoreQuestion;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Fired after staff change an answered question's key ("Fix key & regrade"). Whatever has graded
 * answers against the old key listens and rescoring happens there — authoring does not know about
 * test sessions.
 */
class CoreQuestionKeyFixed
{
    use Dispatchable;

    public function __construct(public readonly CoreQuestion $question) {}
}
