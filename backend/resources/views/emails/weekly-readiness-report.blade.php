@include('emails.partials.header', ['category' => 'Progress', 'preheader' => $atRiskCount.' student(s) below 60% readiness this week at '.$college->name.'.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Weekly Report
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:0 0 10px 0; color:#0F172A;">Weekly Readiness Report</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $tpo->name }}, here is this week's automated readiness digest for {{ $college->name }}.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Students Below 60% Readiness</p>
                                        <p style="font-size:28px; color:#DC2626; margin:0; font-weight:800;">{{ $atRiskCount }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p class="em-p" style="font-size:13.5px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                The full list — CGPA, backlogs, and how consistently each student has been practicing on
                                AptRun over the last 7 days — is attached as an Excel sheet. Use the Student Cohort page
                                to send a notification (email or WhatsApp) to any of them directly.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/admin/students" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Open Student Cohort
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => 'This report is generated automatically every 7 days.'])
