@include('emails.partials.header', ['preheader' => 'You scored '.$scorePercent.'% on '.$contest->title.' — you now qualify for the Mellow Talent Pool.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Talent Pool
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">You qualified for the Mellow Talent Pool &#127881;</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                you scored <strong>{{ $scorePercent }}%</strong> on "{{ $contest->title }}" — well above our qualifying bar.
                                That means you're now eligible to be listed in Mellow's Talent Pool: a curated shortlist we show to our hiring
                                partners, with a message that's rare to hear as a job-seeker — "we already tested this candidate, they scored
                                {{ $scorePercent }}%, and they're available to hire."
                            </p>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Nothing is shared with any company until you say so. Turn on visibility from your dashboard whenever you're ready.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Your score</p>
                                        <p style="font-size:14px; color:#111827; margin:0;">{{ $scorePercent }}% on {{ $contest->title }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Review My Talent Pool Profile
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You control your visibility at all times — turn it off from the same page whenever you like. If you weren't expecting this email, you can safely ignore it."])
