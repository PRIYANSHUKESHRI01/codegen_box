<?php

namespace App\Services\Workspaces;

/**
 * The one seam between the workspace code and the operating system. The real
 * implementation shells out; tests substitute a recorder, which is how the
 * exact `docker run` hardening flags are asserted without a Docker daemon.
 */
interface ProcessRunner
{
    /**
     * @param  list<string>  $command  argv — never a shell string, so nothing here is ever shell-interpreted
     * @param  array<string, string>  $env  added to (not replacing) the PHP process environment
     */
    public function run(array $command, array $env = [], ?string $input = null, int $timeout = 60): ProcessResult;
}
