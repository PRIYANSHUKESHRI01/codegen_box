<?php

namespace App\Console\Commands;

use App\Services\BranchAssignmentService;
use Illuminate\Console\Command;

/**
 * Re-runs branch resolution over students whose branch came from a college
 * (imports, TPO entry, superadmin edit). Run it after loading a lot of aliases
 * or if a deploy went out before the branch migrations.
 */
class ResolveBranches extends Command
{
    protected $signature = 'branches:resolve {--college= : Only this college id}';

    protected $description = 'Resolve students\' free-text branches to canonical branches and disciplines';

    public function handle(BranchAssignmentService $assignments): int
    {
        $college = $this->option('college');
        $changed = $assignments->reresolve($college === null ? null : (int) $college);

        $this->info("Branches re-resolved — {$changed} student(s) changed.");

        return self::SUCCESS;
    }
}
