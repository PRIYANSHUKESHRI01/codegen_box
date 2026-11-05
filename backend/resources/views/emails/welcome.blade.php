@include('emails.partials.header', ['category' => 'Welcome', 'preheader' => 'Your account is live — start practicing, competing, and tracking your progress.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Account Created
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">Welcome to AptRun, {{ $user->name }}</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Your account is ready. Solve problems in the practice arena, enter rated contests against
                                other coders, and track your rating and streak as you build toward placement season.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-p" style="font-size:13px; color:#374151; margin:0; line-height:1.6;">
                                            Signed up with: <strong class="em-h" style="color:#111827; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</strong>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p class="em-h" style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 10px 0;">Where to start</p>
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td class="em-p" style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Solve your first problem in the Practice Arena
                                    </td>
                                </tr>
                                <tr>
                                    <td class="em-p" style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Join the next weekly rated contest to get your first rating
                                    </td>
                                </tr>
                                <tr>
                                    <td class="em-p" style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">
                                        &bull;&nbsp; Complete your profile so recruiters can find you
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Go to Dashboard
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because this email address was used to create an AptRun account. If this wasn't you, no further action is needed."])
