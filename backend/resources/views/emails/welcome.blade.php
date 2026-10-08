@include('emails.partials.header', ['preheader' => 'Your account is live — start practicing, competing, and tracking your progress.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Account Created
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Welcome to AptRun, {{ $user->name }}</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Your account is ready. Solve problems in the practice arena, enter rated contests against
                                other coders, and track your rating and streak as you build toward placement season.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:13px; color:#374151; margin:0; line-height:1.6;">
                                            Signed up with: <strong style="color:#111827; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 10px 0;">Where to start</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Solve your first problem in the Practice Arena
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Join the next weekly rated contest to get your first rating
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Complete your profile so recruiters can find you
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Go to Dashboard
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because this email address was used to create an AptRun account. If this wasn't you, no further action is needed."])
