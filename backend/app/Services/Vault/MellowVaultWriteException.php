<?php

namespace App\Services\Vault;

use RuntimeException;

/**
 * Writing a listing into Mellow Vault's database failed. `permanent` says whether trying again can help: a value that cannot fit the
 * table (an email longer than its column) never will, while a database that is down comes back.
 */
class MellowVaultWriteException extends RuntimeException
{
    public function __construct(string $message, public readonly bool $permanent = false, ?\Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
    }
}
