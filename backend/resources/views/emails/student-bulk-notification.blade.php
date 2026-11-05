@include('emails.partials.header', ['category' => 'Announcement', 'preheader' => $user->college ? 'An update from your placement cell at '.$user->college->name.'.' : 'An update from the AptRun team.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Notification
                            </span>
                            @if ($user->college)
                                <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">An update from your Placement Cell</h1>
                                <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, your Training &amp; Placement Officer at {{ $user->college->name }}
                                    sent you a notification through AptRun.
                                </p>
                            @else
                                <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">An update from the AptRun team</h1>
                                <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, the AptRun team sent you a notification.
                                </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-p" style="font-size:13px; color:#374151; margin:0; line-height:1.6;">
                                            Sign in to your AptRun dashboard for the details, or contact
                                            @if ($user->college) your placement office @else AptRun support at {{ config('brand.support_email') }} @endif
                                            directly for anything time-sensitive.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Open AptRun
                            </a>
                        </td>
                    </tr>
@php
    $note = $user->college
        ? "You're receiving this because your placement cell added you to AptRun."
        : "You're receiving this because you have an AptRun account.";
@endphp
@include('emails.partials.footer', ['note' => $note])
