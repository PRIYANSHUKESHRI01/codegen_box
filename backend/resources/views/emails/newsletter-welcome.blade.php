@include('emails.partials.header', ['preheader' => "You're subscribed — we'll email you when there's something worth reading."])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Subscribed
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">You're on the list</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Thanks for signing up. We'll email <strong style="color:#111827;">{{ $subscriber->email }}</strong>
                                when there's a new feature, problem set, or contest worth knowing about — nothing more often than that.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Explore AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "If you weren't expecting this email, you can safely ignore it — you won't hear from us again unless you subscribe."])
