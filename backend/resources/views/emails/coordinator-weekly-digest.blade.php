@include('emails.partials.header', ['preheader' => 'Your section this week: '.$summary['size'].' students, average readiness '.$summary['avg_readiness'].'.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Your week
                            </span>
                            <h1 style="font-size:18px; margin:0 0 8px 0; color:#111827;">Section {{ $coordinator->section }} &mdash; this week</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $coordinator->name }}, here is where your section stands at {{ $collegeName }}@if ($scopeLabel !== 'All branches') ({{ $scopeLabel }})@endif.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px; width:33%;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Students</p>
                                        <p style="font-size:26px; color:#111827; margin:0; font-weight:800;">{{ $summary['size'] }}</p>
                                    </td>
                                    <td style="padding:16px 20px; width:33%;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Avg readiness</p>
                                        <p style="font-size:26px; color:#4F46E5; margin:0; font-weight:800;">{{ $summary['avg_readiness'] }}</p>
                                    </td>
                                    <td style="padding:16px 20px; width:33%;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Below 60</p>
                                        <p style="font-size:26px; color:#DC2626; margin:0; font-weight:800;">{{ $summary['at_risk'] }}</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size:13px; line-height:1.6; color:#4B5563; margin:12px 0 0 0;">
                                {{ $summary['engagement']['active'] }} practised in the last 7 days
                                &middot; {{ $summary['engagement']['dormant'] }} {{ $summary['engagement']['dormant'] === 1 ? 'has' : 'have' }} gone quiet for 3+ weeks
                                &middot; {{ $summary['never_signed_in'] }} {{ $summary['never_signed_in'] === 1 ? 'has' : 'have' }} never signed in.
                                @if ($summary['overdue_follow_ups'] > 0)
                                    <strong style="color:#B45309;">{{ $summary['overdue_follow_ups'] }} follow-up{{ $summary['overdue_follow_ups'] === 1 ? ' is' : 's are' }} overdue.</strong>
                                @endif
                            </p>
                        </td>
                    </tr>
@if (count($attention) > 0)
                    <tr>
                        <td style="padding:24px 32px 0 32px;">
                            <h2 style="font-size:15px; margin:0 0 10px 0; color:#111827;">Worth a conversation this week</h2>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB; border-radius:10px;">
@foreach ($attention as $item)
                                <tr>
                                    <td style="padding:12px 16px; border-bottom:1px solid #F1F2F6;">
                                        <p style="font-size:14px; font-weight:700; color:#111827; margin:0;">{{ $item['name'] }}@if ($item['roll_number']) <span style="font-weight:400; color:#9CA3AF;">&middot; {{ $item['roll_number'] }}</span>@endif</p>
                                        <p style="font-size:12px; line-height:1.5; color:#6B7280; margin:3px 0 0 0;">{{ collect($item['reasons'])->pluck('label')->implode(' · ') }}</p>
                                    </td>
                                </tr>
@endforeach
                            </table>
                        </td>
                    </tr>
@endif
                    <tr>
                        <td style="padding:24px 32px 28px 32px;">
                            <a href="{{ config('app.frontend_url') }}/coordinator" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open my section
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => 'This digest is sent automatically every Monday to Section Coordinators.'])
