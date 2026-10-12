<?php

namespace App\Services\Workspaces;

final readonly class ExecResult
{
    public function __construct(
        public int $exitCode,
        public string $stdout = '',
        public string $stderr = '',
    ) {}

    public function successful(): bool
    {
        return $this->exitCode === 0;
    }
}
