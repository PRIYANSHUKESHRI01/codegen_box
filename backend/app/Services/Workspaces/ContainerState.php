<?php

namespace App\Services\Workspaces;

/** What `docker inspect` says about a workspace container. */
final readonly class ContainerState
{
    public function __construct(
        public bool $exists,
        public bool $running,
        /** "starting" | "healthy" | "unhealthy" | null when the image has no healthcheck */
        public ?string $health = null,
        public ?int $exitCode = null,
    ) {}

    public static function missing(): self
    {
        return new self(false, false);
    }

    /** Running, and either the healthcheck passed or the image defines none. */
    public function ready(): bool
    {
        return $this->running && ($this->health === null || $this->health === 'healthy');
    }
}
