<?php

namespace App\Observers;

use App\Models\VaultMessage;

/** A hiring partner's message to a student → the same Vault notification stream (see VaultInquiryObserver). */
class VaultMessageObserver
{
    public function __construct(private readonly VaultInquiryObserver $inquiries) {}

    public function created(VaultMessage $message): void
    {
        $this->inquiries->messageCreated($message);
    }
}
