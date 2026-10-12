<?php

namespace App\Services\Workspaces;

use RuntimeException;

/**
 * A refusal or failure in the workspace control plane, carrying the stable
 * machine `code` the frontend switches on (never parse the message) and the
 * HTTP status to answer with. Laravel renders it as JSON by itself.
 *
 * Messages are written for students. Operator detail (the Docker error, the
 * host name) goes to `$detail`, which is logged and stored on the workspace
 * row but never put in a response.
 */
class WorkspaceException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status = 422,
        public readonly ?string $detail = null,
    ) {
        parent::__construct($message);
    }

    /** Plan doesn't include Project Lab (or it lapsed): the upgrade prompt. */
    public static function projectLabRequired(): self
    {
        return new self('Project Lab is not part of your plan yet. Add it to start building.', 'project_lab_required', 402);
    }

    public static function hoursExhausted(int $limit): self
    {
        return new self("You've used all {$limit} workspace hours included in this period. They reset when you renew Project Lab.", 'workspace_hours_exhausted', 402);
    }

    public static function activeProjectsFull(int $limit): self
    {
        return new self("You can have {$limit} projects in progress at once. Finish or abandon one to start another.", 'active_projects_full', 409);
    }

    public static function capacity(): self
    {
        return new self('All workspaces are busy right now. Please try again in a few minutes.', 'workspace_capacity', 503);
    }

    public static function hostError(string $detail): self
    {
        return new self('Your workspace could not be started. Please try again; if it keeps happening, contact support.', 'workspace_host_error', 503, $detail);
    }

    public static function notRunning(): self
    {
        return new self('Open your workspace first, then submit from there.', 'workspace_not_running', 409);
    }

    public function render()
    {
        return response()->json(['message' => $this->getMessage(), 'code' => $this->errorCode], $this->status);
    }

    /**
     * Returning true tells Laravel this exception is already dealt with and
     * skips its default reporting. Student-facing refusals (402/409/422) are
     * normal traffic, not errors worth a log line; real host failures (5xx)
     * fall through to the default reporter.
     */
    public function report(): bool
    {
        return $this->status < 500;
    }
}
