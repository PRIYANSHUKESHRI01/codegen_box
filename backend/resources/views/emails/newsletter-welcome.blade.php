@include('emails.partials.header', ['category' => 'Newsletter', 'preheader' => "You're subscribed — we'll email you when there's something worth reading."])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Subscribed
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">You're on the list</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Thanks for signing up. We'll email <strong class="em-h" style="color:#111827;">{{ $subscriber->email }}</strong>
                                when there's a new feature, problem set, or contest worth knowing about — nothing more often than that.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Explore AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['reason' => 'You are receiving this email because you subscribed to AptRun product updates.', 'note' => "If you weren't expecting this email, you can safely ignore it — you won't hear from us again unless you subscribe."])
