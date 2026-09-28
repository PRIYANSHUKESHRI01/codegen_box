@include('emails.partials.header', ['preheader' => $company->name.' added you to their hiring pipeline for '.$roleTitle.' on CodeGen Box.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Hiring Pipeline
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">You've been added to a hiring pipeline</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                {{ $company->name }} has added you to their pipeline for <strong style="color:#111827;">{{ $roleTitle }}</strong>
                                on CodeGen Box. Sign in with your existing account to check your status and complete any assessments sent your way.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Signed in as</p>
                                        <p style="font-size:14px; color:#111827; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/login" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Sign in to CodeGen Box
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Use your existing password to sign in — nothing about your login has changed. If you weren't expecting this email, you can safely ignore it."])
