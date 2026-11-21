<?php

namespace App\Mail;

use App\Models\User;
use App\Models\WeeklyRewardWinner;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

/**
 * Transactional email sent to a student who tops the weekly contest leaderboard
 * and is awarded a gift voucher (e.g. Domino's, McDonald's) by the superadmin.
 */
class WeeklyContestVoucherMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public User $user,
        public WeeklyRewardWinner $winner,
        public array $cardDef = []
    ) {}

    public function build(): self
    {
        $brand = $this->winner->brand ?: 'Domino\'s';
        $amount = $this->winner->amount ?: 299;
        $cardKey = $this->winner->card ?: ($this->cardDef['key'] ?? 'dominos');
        $cardKey = str_replace('_', '-', strtolower($cardKey));

        $cards = config('weekly_rewards.cards', []);
        $resolvedCard = !empty($this->cardDef)
            ? $this->cardDef
            : ($cards[$this->winner->card] ?? $cards[$cardKey] ?? $cards[str_replace('-', '_', $cardKey)] ?? []);

        $brandColor = $resolvedCard['color'] ?? '#006491';

        // Resolve PNG logo path from backend/public/rewards or frontend/public/rewards
        $logoPath = public_path('rewards/' . $cardKey . '.png');
        if (!file_exists($logoPath)) {
            $alt = public_path('rewards/' . str_replace('-', '_', $cardKey) . '.png');
            if (file_exists($alt)) {
                $logoPath = $alt;
            } elseif (file_exists(base_path('../frontend/public/rewards/' . $cardKey . '.png'))) {
                $logoPath = base_path('../frontend/public/rewards/' . $cardKey . '.png');
            }
        }

        $subject = "🎉 Congratulations! You topped the weekly contest — Here is your {$brand} voucher";

        return $this->subject($subject)
            ->view('emails.weekly-contest-voucher', [
                'user' => $this->user,
                'winner' => $this->winner,
                'cardDef' => $resolvedCard,
                'brand' => $brand,
                'voucherBrand' => $brand,
                'amount' => $amount,
                'brandColor' => $brandColor,
                'cardKey' => $cardKey,
                'logoPath' => file_exists($logoPath) ? $logoPath : null,
                'voucherCode' => $this->winner->makeVisible('voucher_code')->voucher_code ?: 'APTRUN-VOUCHER',
            ]);
    }
}
