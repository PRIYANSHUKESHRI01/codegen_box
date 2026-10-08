@include('emails.partials.header', ['preheader' => $atRiskCount.' student(s) below 60% readiness this week at '.$college->name.'.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Weekly Report
                            </span>
                            <h1 style="font-size:18px; margin:0 0 8px 0; color:#111827;">Weekly Readiness Report</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $tpo->name }}, here is this week's automated readiness digest for {{ $college->name }}.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Students Below 60% Readiness</p>
                                        <p style="font-size:28px; color:#DC2626; margin:0; font-weight:800;">{{ $atRiskCount }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p style="font-size:13px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                The full list — CGPA, backlogs, and how consistently each student has been practicing on
                                AptRun over the last 7 days — is attached as an Excel sheet. Use the Student Cohort page
                                to send a notification (email or WhatsApp) to any of them directly.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <a href="{{ config('app.frontend_url') }}/admin/students" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open Student Cohort
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => 'This report is generated automatically every 7 days.'])
