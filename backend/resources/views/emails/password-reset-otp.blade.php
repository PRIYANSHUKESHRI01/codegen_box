@include('emails.partials.header', ['category' => 'Security', 'preheader' => 'Use this code to reset your AptRun password. It stays valid for 7 days.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Password Reset
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">Reset your password</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $user->name }}, use the code below to reset your AptRun password. It stays valid for
                                7 days, or until you set a new password. Asking for another code just sends this same one again.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:20px; text-align:center;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Your Code</p>
                                        <p class="em-h" style="font-size:32px; font-weight:800; letter-spacing:0.15em; color:#111827; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $code }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p class="em-muted" style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                Never share this code with anyone — AptRun staff will never ask you for it.
                            </p>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "If you didn't request this, you can safely ignore this email — your password won't change unless this code is entered."])
