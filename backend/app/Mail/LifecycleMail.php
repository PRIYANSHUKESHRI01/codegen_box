<?php

namespace App\Mail;

use App\Enums\LifecycleEmail;
use App\Models\User;
use App\Support\LifecycleCopy;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\URL;
use Symfony\Component\Mime\Email;

/**
 * One mailable for every case of App\Enums\LifecycleEmail: the wording comes from
 * App\Support\LifecycleCopy, the layout from the `emails.lifecycle` view.
 *
 * Engagement mail additionally carries the unsubscribe link in its footer and the
 * RFC 8058 List-Unsubscribe / List-Unsubscribe-Post headers, which is what makes
 * Gmail and Outlook show their own "Unsubscribe" button — and what keeps these
 * messages out of the spam folder.
 */
class LifecycleMail extends Mailable
{
    use Queueable, SerializesModels;

    /** @var array<string, mixed> */
    public array $content;

    /** @param array<string, mixed> $data */
    public function __construct(
        public User $user,
        public LifecycleEmail $type,
        public array $data = [],
    ) {
        $this->content = LifecycleCopy::build($type, $user, $data);
    }

    public function build(): self
    {
        $unsubscribeUrl = $this->type->isEngagement() ? self::unsubscribeUrl($this->user) : null;

        $this->subject($this->content['subject'])
            ->view('emails.lifecycle', ['c' => $this->content, 'user' => $this->user, 'unsubscribeUrl' => $unsubscribeUrl]);

        if ($unsubscribeUrl !== null) {
            $this->withSymfonyMessage(function (Email $message) use ($unsubscribeUrl) {
                $message->getHeaders()->addTextHeader('List-Unsubscribe', "<{$unsubscribeUrl}>");
                $message->getHeaders()->addTextHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
            });
        }

        return $this;
    }

    /** A permanent signed link — the signature, not a login, is what authorises it. */
    public static function unsubscribeUrl(User $user): string
    {
        return URL::signedRoute('email.preferences', ['user' => $user->id]);
    }
}
