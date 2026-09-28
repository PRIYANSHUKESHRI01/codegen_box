@include('emails.partials.header', ['preheader' => 'A recruiter at '.$company->name.' is interested in your Talent Pool profile.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Recruiter Interest
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">{{ $company->name }} is interested in you</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                a recruiter at {{ $company->name }} looked at your Talent Pool profile and marked interest in you as a candidate.
                                Sign in to see their details — they may follow up with an HR interview invite soon.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View on CodeGen Box
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "If you weren't expecting this email, you can safely ignore it."])
