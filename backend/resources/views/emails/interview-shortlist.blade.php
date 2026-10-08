@include('emails.partials.header', ['preheader' => $company->name.' invited you to a voice interview for '.$roleTitle.' — take it whenever you\'re ready.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Interview Invite
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">You've been shortlisted for an interview</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                {{ $company->name }} has invited you to a voice interview for <strong style="color:#111827;">{{ $roleTitle }}</strong>
                                on AptRun. Sign in to review the interview details and take it whenever you're ready.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Interview</p>
                                        <p style="font-size:14px; color:#111827; margin:0;">{{ $interview->title }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/interviews/{{ $interview->slug }}" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Start Your Interview
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Use your existing password to sign in — nothing about your login has changed. If you weren't expecting this email, you can safely ignore it."])
