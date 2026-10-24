<?php

namespace App\Models\Concerns;

use App\Models\User;
use App\Support\BranchAudience;

/**
 * Lets a model carry a branch audience (see App\Support\BranchAudience). The model's own
 * isVisibleToUser() asks audienceIncludes() — the college/ownership rules stay where they were.
 */
trait HasBranchAudience
{
    public function initializeHasBranchAudience(): void
    {
        $this->mergeCasts(['branch_audience' => 'array']);
        $this->mergeFillable(['branch_audience']);
    }

    public function audienceIncludes(User $user): bool
    {
        return BranchAudience::includes($this->branch_audience, $user);
    }

    /**
     * Whether this was made FOR the student's branch (not merely open to it): its audience names their branch or family,
     * or it carries their family as its own `discipline`. "For your branch" lists put these first. A student whose branch
     * is not known yet is never told something is theirs.
     */
    public function isForBranchOf(User $user): bool
    {
        if ($user->discipline === null && $user->branch_code === null) {
            return false;
        }

        $discipline = $this->getAttributes()['discipline'] ?? null;

        if ($discipline !== null && $discipline === $user->discipline) {
            return true;
        }

        return $this->branch_audience !== null && BranchAudience::includes($this->branch_audience, $user);
    }
}
