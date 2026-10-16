@php
    $lines = $order->quote['lines'] ?? [];
    $hasDiscount = (int) ($order->quote['discount'] ?? 0) > 0;
    $periodEnd = $order->user?->activeSubscription()?->current_period_end;
    $money = fn (int $rupees) => '₹'.number_format($rupees, 0, '.', ',');
@endphp
@include('emails.partials.header', ['preheader' => "We received your payment of {$money($order->amountRupees())}. Your plan is active.", 'width' => 520])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Payment received
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">{{ $order->description() }} is active</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $order->payer_name }}, thanks for your payment. Everything in your plan is unlocked
                                @if ($periodEnd)
                                    until <strong style="color:#111827;">{{ $periodEnd->format('j F Y') }}</strong>.
                                @else
                                    right away.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB; border-radius:10px; border-collapse:separate; font-size:13px; color:#374151;">
                                @foreach ($lines as $line)
                                    <tr>
                                        <td style="padding:10px 14px; border-bottom:1px solid #F3F4F6;">{{ $line['name'] }}</td>
                                        <td align="right" style="padding:10px 14px; border-bottom:1px solid #F3F4F6;">{{ $money((int) $line['list_price']) }}</td>
                                    </tr>
                                @endforeach
                                @if ($hasDiscount)
                                    <tr>
                                        <td style="padding:10px 14px; border-bottom:1px solid #F3F4F6; color:#047857;">Discount</td>
                                        <td align="right" style="padding:10px 14px; border-bottom:1px solid #F3F4F6; color:#047857;">&minus;{{ $money((int) $order->quote['discount']) }}</td>
                                    </tr>
                                @endif
                                <tr>
                                    <td style="padding:12px 14px; font-weight:700; color:#111827;">Total paid</td>
                                    <td align="right" style="padding:12px 14px; font-weight:700; color:#111827;">{{ $money($order->amountRupees()) }}</td>
                                </tr>
                            </table>
                            <p style="font-size:12px; line-height:1.6; color:#6B7280; margin:12px 0 0 0;">
                                Reference <strong>{{ $order->public_id }}</strong>@if ($order->gateway_payment_id) &middot; Payment ID {{ $order->gateway_payment_id }}@endif
                                &middot; {{ ($order->paid_at ?? $order->created_at)->format('j M Y, g:i A') }}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('app.frontend_url'), '/') }}/dashboard/billing" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View your plan
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => 'Keep this email for your records. If this payment is not something you made, reply to this email and we will look into it straight away.'])
