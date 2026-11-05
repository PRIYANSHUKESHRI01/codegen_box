@include('emails.partials.header', ['category' => 'Placements', 'preheader' => 'Your placement eligibility needs attention — contact your placement office.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#FEE2E2; color:#991B1B; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Action Required
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">Placement Drive Eligibility Notice</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $user->name }}, your Training &amp; Placement Officer at {{ $user->college?->name ?? 'your college' }}
                                has flagged your placement readiness as below the threshold required to remain eligible for
                                upcoming placement drives.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FEF2F2; border-radius:10px; border:1px solid #FECACA;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:13px; color:#7F1D1D; margin:0; line-height:1.6;">
                                            Please contact your placement office as soon as possible to discuss your standing and
                                            the steps needed to remain eligible for upcoming drives.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p class="em-p" style="font-size:13.5px; line-height:1.7; color:#475569; margin:0 0 4px 0;">
                                Readiness is calculated from your practice activity, contest participation, and interview
                                scores — the fastest way to move it back up is to get back into the Practice Arena.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard/practice" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Resume Practice
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because your placement cell added you to AptRun."])
