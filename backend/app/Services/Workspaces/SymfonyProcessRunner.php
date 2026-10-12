<?php

namespace App\Services\Workspaces;

use Symfony\Component\Process\Exception\ProcessTimedOutException;
use Symfony\Component\Process\Process;
use Throwable;

class SymfonyProcessRunner implements ProcessRunner
{
    public function run(array $command, array $env = [], ?string $input = null, int $timeout = 60): ProcessResult
    {
        $process = new Process($command, null, $env ?: null, $input, $timeout);

        try {
            $process->run();
        } catch (ProcessTimedOutException) {
            return new ProcessResult(-1, $process->getOutput(), 'Timed out after '.$timeout.'s.', true);
        } catch (Throwable $e) {
            // Binary missing, cwd gone, pipes failed to open…: an exit code, not a stack trace.
            return new ProcessResult(127, '', $e->getMessage());
        }

        return new ProcessResult((int) $process->getExitCode(), $process->getOutput(), $process->getErrorOutput());
    }
}
