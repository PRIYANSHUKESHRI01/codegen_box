@include('emails.partials.header', ['preheader' => 'Your placement eligibility needs attention — contact your placement office.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#FEE2E2; color:#991B1B; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Action Required
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Placement Drive Eligibility Notice</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
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
                            <p style="font-size:13px; line-height:1.6; color:#4B5563; margin:0 0 4px 0;">
                                Readiness is calculated from your practice activity, contest participation, and interview
                                scores — the fastest way to move it back up is to get back into the Practice Arena.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/practice" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Resume Practice
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because your placement cell added you to AptRun."])
