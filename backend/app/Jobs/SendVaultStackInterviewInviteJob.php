<?php

namespace App\Jobs;

use App\Enums\NotificationType;
use App\Mail\VaultStackInterviewInviteMail;
use App\Models\VaultInterviewInvite;
use App\Services\NotificationService;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Delivers one personalized Vault AI Interview invitation email when a Mellow Vault
 * developer hits 90%+ profile completion (`developer_details_tb.profile_complete`).
 */
class SendVaultStackInterviewInviteJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $inviteId) {}

    public function backoff(): array
    {
        return [10, 30, 60];
    }

    public function middleware(): array
    {
        return [new RateLimited('transactional-emails')];
    }

    public function handle(NotificationService $notifications, CuratedCatalog $catalog): void
    {
        $invite = VaultInterviewInvite::with('user')->find($this->inviteId);
        $user = $invite?->user;

        if (! $invite || ! $user) {
            return;
        }

        if ($invite->status === VaultInterviewInvite::STATUS_SENT || $invite->status === VaultInterviewInvite::STATUS_OPENED) {
            return;
        }

        if ($user->is_blocked || $user->email_nudges_opt_out_at !== null || ! filter_var($user->email, FILTER_VALIDATE_EMAIL)) {
            $invite->update([
                'status' => VaultInterviewInvite::STATUS_FAILED,
                'error_message' => 'Skipped: account is blocked, opted out of emails, or has an invalid email.',
            ]);

            return;
        }

        try {
            $unsubscribeUrl = URL::signedRoute('email.preferences', ['user' => $user->id]);
            $rawHeading = $user->mellow_vault_stack_name ?: $invite->stack_name;

            $roleTitle = null;
            $stackBlurb = null;
            $roundTitles = [];
            if ($invite->stack_key && ($entry = $catalog->stack($invite->stack_key))) {
                $roleTitle = $entry['role']['title'] ?? null;
                $stackBlurb = $entry['stack']['blurb'] ?? null;
                $series1Sets = $entry['stack']['series'][0]['sets'] ?? ($entry['stack']['sets'] ?? []);
                foreach (array_slice($series1Sets, 0, 3) as $set) {
                    if (! empty($set['title'])) {
                        $roundTitles[] = (string) $set['title'];
                    }
                }
            }

            Mail::to($user->email)->send(new VaultStackInterviewInviteMail(
                user: $user,
                profilePercent: (int) $invite->profile_percent,
                stackName: $invite->stack_name,
                rawHeading: $rawHeading,
                interviewUrl: (string) $invite->invite_url,
                unsubscribeUrl: $unsubscribeUrl,
                roleTitle: $roleTitle,
                stackBlurb: $stackBlurb,
                roundTitles: $roundTitles,
            ));

            $now = now();
            $invite->update([
                'status' => VaultInterviewInvite::STATUS_SENT,
                'sent_at' => $now,
                'error_message' => null,
            ]);

            if ($user->vault_ai_invite_sent_at === null) {
                $user->forceFill([
                    'vault_ai_invite_sent_at' => $now,
                    'vault_ai_invite_stack_key' => $invite->stack_key,
                ])->save();
            }

            $frontendTarget = $invite->stack_key
                ? '/dashboard/vault-interviews?stack='.urlencode($invite->stack_key)
                : '/dashboard/vault-interviews';

            $stackLabel = $invite->stack_name ?: 'Vault AI';
            $notifications->notify(
                $user->id,
                NotificationType::VaultActivity,
                "Your {$stackLabel} Vault AI Interview is unlocked!",
                "Your Mellow Vault profile hit {$invite->profile_percent}%. Complete 3 short voice rounds (60%+ avg) to boost your visibility.",
                [
                    'url' => $frontendTarget,
                    'severity' => 'success',
                    'group_key' => 'vault.profile_90_invite',
                ]
            );
        } catch (Throwable $e) {
            $invite->update([
                'status' => VaultInterviewInvite::STATUS_FAILED,
                'error_message' => mb_substr($e->getMessage(), 0, 500),
            ]);
            throw $e;
        }
    }
}
