<?php

namespace App\Jobs;

use App\Models\CoreQuestionImport;
use App\Services\Core\CoreQuestionImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Runs one Core Prep question import (dry-run report or commit). Small files are run inline with
 * dispatchSync() by the service, so an import never sits "pending" waiting for a queue worker that
 * may not be running; only large files are queued.
 */
class ProcessCoreQuestionImportJob implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $timeout = 900;

    public int $tries = 1;

    public function __construct(public readonly int $importId) {}

    public function handle(CoreQuestionImportService $service): void
    {
        $import = CoreQuestionImport::find($this->importId);

        if ($import !== null) {
            $service->process($import);
        }
    }
}
