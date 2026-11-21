@php
    $appUrl = rtrim(config('app.url', config('brand.site_url', 'https://aptrun.com')), '/');
    $brandColor = $brandColor ?? ($cardDef['color'] ?? '#006491');
    $voucherBrand = $winner->brand ?? 'Domino\'s';

    // CID embed if message is available and file exists; else fall back to public web URL
    if (isset($logoPath) && file_exists($logoPath) && isset($message)) {
        $logoSrc = $message->embed($logoPath);
    } else {
        $logoSrc = $appUrl . '/rewards/' . ($cardKey ?? 'dominos') . '.png';
    }
@endphp
@include('emails.partials.header', [
    'category' => 'Contest Rewards',
    'preheader' => "Congratulations! You won a ₹{$amount} {$voucherBrand} voucher on AptRun!"
])
<tr>
    <td style="padding:24px 32px 0 32px;">
        <span style="display:inline-block; background-color:#FEF3C7; color:#92400E; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:8px;">
            🏆 Weekly Contest Winner · Rank #{{ $winner->rank }}
        </span>
        <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:10px 0 10px 0; color:#0F172A;">
            Congratulations, {{ $user->name }}! 🎉
        </h1>
        <p class="em-p" style="font-size:14.5px; line-height:1.7; color:#475569; margin:0 0 18px 0;">
            You finished at the top of the AptRun Weekly Contest Leaderboard with <strong>{{ number_format($winner->contest_score) }} points</strong>! As a reward for your top ranking, here is your <strong>₹{{ number_format($amount) }} {{ $voucherBrand }} voucher</strong>.
        </p>
    </td>
</tr>

<tr>
    <td style="padding:0 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, {{ $brandColor }}, #0F172A); border-radius:16px; color:#FFFFFF; overflow:hidden; box-shadow:0 12px 24px -10px rgba(0,0,0,0.35);">
            <tr>
                <td style="padding:24px 24px 20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                            <td valign="middle">
                                <table role="presentation" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td valign="middle" style="padding-right:16px;">
                                            <div style="background-color:#FFFFFF; border-radius:14px; padding:6px; display:inline-block; box-shadow:0 6px 14px rgba(0,0,0,0.25); text-align:center;">
                                                <img src="{{ $logoSrc }}" alt="{{ $voucherBrand }}" width="52" height="52" style="display:block; width:52px; height:52px; object-fit:contain; border-radius:8px;" />
                                            </div>
                                        </td>
                                        <td valign="middle">
                                            <div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.12em; color:rgba(255,255,255,0.85); margin-bottom:4px;">
                                                Official Gift Voucher
                                            </div>
                                            <div style="font-size:22px; font-weight:900; color:#FFFFFF; margin:0; line-height:1.2;">
                                                {{ $voucherBrand }}
                                            </div>
                                            <div style="font-size:14px; font-weight:700; color:rgba(255,255,255,0.95); margin-top:3px;">
                                                ₹{{ number_format($amount) }} Value
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                            <td align="right" valign="middle">
                                <div style="background-color:#FFFFFF; border-radius:12px; padding:8px 14px; display:inline-block; font-size:13px; font-weight:800; color:{{ $brandColor }}; box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                                    Rank #{{ $winner->rank }}
                                </div>
                            </td>
                        </tr>
                    </table>

                    <div style="margin-top:20px; background-color:#FFFFFF; border-radius:12px; padding:16px 20px; text-align:center;">
                        <div style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; color:#64748B; margin-bottom:8px;">
                            Your Voucher / Coupon Code
                        </div>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F8FAFC; border:2px dashed #CBD5E1; border-radius:10px;">
                            <tr>
                                <td align="center" valign="middle" style="padding:12px 14px;">
                                    <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:20px; font-weight:900; letter-spacing:0.12em; color:#0F172A; user-select:all; -webkit-user-select:all; display:inline-block;">
                                        {{ $voucherCode }}
                                    </span>
                                </td>
                                <td align="right" valign="middle" style="padding:12px 14px 12px 0; width:110px;">
                                    <a href="{{ $appUrl }}/dashboard/contests?reward={{ $winner->id }}&copied=1" target="_blank" style="display:inline-block; background-color:{{ $brandColor }}; color:#FFFFFF; text-decoration:none; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; font-weight:800; padding:8px 14px; border-radius:8px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.18);">
                                        📋 Copy Code
                                    </a>
                                </td>
                            </tr>
                        </table>
                        <div style="margin-top:10px; font-size:12px; color:#64748B;">
                            Apply this coupon code on the <strong>{{ $voucherBrand }}</strong> app or website at checkout.
                        </div>
                    </div>
                </td>
            </tr>
        </table>
    </td>
</tr>

<tr>
    <td style="padding:22px 32px 28px 32px; text-align:center;">
        <a href="{{ $appUrl }}/dashboard/contests?reward={{ $winner->id }}" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; letter-spacing:0.01em; padding:13px 28px; border-radius:10px; box-shadow:0 6px 16px -6px rgba(79,70,229,0.65);">
            🎁 Open Voucher on AptRun
        </a>
        <p style="margin:14px 0 0 0; font-size:12px; color:#64748B;">
            Keep competing in the daily challenge and weekly contests to climb higher and win every week!
        </p>
    </td>
</tr>
@include('emails.partials.footer', [
    'note' => 'This official voucher was awarded to your account for topping this week\'s contest leaderboard on AptRun.'
])
