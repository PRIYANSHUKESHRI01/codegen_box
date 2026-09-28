@include('emails.partials.header', ['preheader' => $user->college ? 'An update from your placement cell at '.$user->college->name.'.' : 'An update from the Mellow team.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Notification
                            </span>
                            @if ($user->college)
                                <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">An update from your Placement Cell</h1>
                                <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, your Training &amp; Placement Officer at {{ $user->college->name }}
                                    sent you a notification through CodeGen Box.
                                </p>
                            @else
                                <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">An update from the Mellow team</h1>
                                <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, the Mellow team sent you a notification through CodeGen Box.
                                </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:13px; color:#374151; margin:0; line-height:1.6;">
                                            Sign in to your CodeGen Box dashboard for the details, or contact
                                            @if ($user->college) your placement office @else Mellow support @endif
                                            directly for anything time-sensitive.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open CodeGen Box
                            </a>
                        </td>
                    </tr>
@php
    $note = $user->college
        ? "You're receiving this because your placement cell added you to CodeGen Box."
        : "You're receiving this because you have a CodeGen Box account.";
@endphp
@include('emails.partials.footer', ['note' => $note])
