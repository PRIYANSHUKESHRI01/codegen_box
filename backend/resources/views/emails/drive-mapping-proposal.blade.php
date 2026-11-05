@php
    $drive = $mapping->placementDrive;
    $company = $drive->company;
    $eligibility = $mapping->effectiveEligibility();
@endphp
@include('emails.partials.header', ['category' => 'Placements', 'width' => 520, 'preheader' => 'A new placement drive from '.$company->name.' is proposed for '.$mapping->college->name.'.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Pending Approval
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">A new placement drive is proposed for {{ $mapping->college->name }}</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $tpo->name }},
                                @if ($mapping->proposedByCompany())
                                    {{ $company->name }} has proposed mapping the following placement drive to
                                @else
                                    AptRun has proposed mapping the following placement drive to
                                @endif
                                {{ $mapping->college->name }}. Review the details below and approve or decline it from
                                your dashboard — it will not appear for your students until you approve it.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p class="em-h" style="font-size:16px; font-weight:800; color:#111827; margin:0 0 2px 0;">{{ $company->name }}</p>
                                        <p class="em-p" style="font-size:13px; color:#4B5563; margin:0 0 14px 0;">{{ $drive->role_title }}</p>

                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280; width:40%;">CTC Range</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $drive->ctc_range ?? 'Not disclosed' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Drive Date</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $drive->drive_date->timezone('Asia/Kolkata')->format('d M Y, g:i A') }}</td>
                                            </tr>
                                            @if ($drive->duration_minutes)
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Duration</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $drive->duration_minutes }} minutes</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Min CGPA</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $eligibility['min_cgpa'] ?? 'Open' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Max Backlogs</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $eligibility['max_backlogs'] ?? 'Open' }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Eligible Branches</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ !empty($eligibility['eligible_branches']) ? implode(', ', $eligibility['eligible_branches']) : 'All branches' }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/admin/drives?tab=pending" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Review &amp; Respond
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Sign in to your TPO dashboard to approve or decline this proposal. If you weren't expecting this email, contact AptRun support at ".config('brand.support_email')."."])
