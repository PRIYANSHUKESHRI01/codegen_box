@include('emails.partials.header', ['preheader' => 'A message from '.$company->name.' via your Talent Pool profile.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Message
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">A message from {{ $company->name }}</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 16px 0;">
                                Hi {{ $user->name }},
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB; border-left:3px solid #4F46E5;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:14px; line-height:1.6; color:#111827; margin:0; white-space:pre-wrap;">{{ $messageText }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View on AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "This message was sent by a hiring partner through Mellow's Talent Pool. If you weren't expecting this email, you can safely ignore it."])
