@php
    $student = $session->contestParticipant->user;
    $contest = $session->contestParticipant->contest;
    $locked = $session->isLocked();
@endphp
@include('emails.partials.header', ['category' => 'Integrity', 'width' => 560, 'preheader' => 'Proctoring report for '.$student->name.' in '.$contest->title.' — '.$session->violation_count.' strike(s) recorded.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $locked ? '#FEE2E2' : '#FEF3C7' }}; color:{{ $locked ? '#991B1B' : '#92400E' }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                {{ $locked ? 'Locked Out — 3 Strikes' : 'Flagged — Under Threshold' }}
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">
                                Proctoring report — {{ $student->name }} in {{ $contest->title }}
                            </h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $recipient->name }}, this contest attempt recorded
                                {{ $session->violation_count }} strike{{ $session->violation_count === 1 ? '' : 's' }}
                                (fullscreen exit, tab switch, or a detected devtools open).
                                @if ($locked)
                                    The student was automatically locked out of the contest once the 3rd strike was recorded, and whatever code they had open was submitted for judging.
                                @else
                                    They finished the contest without reaching the 3-strike lockout, but at least one violation was recorded and is worth a look.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280; width:40%;">Student</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->name }} ({{ $student->email }})</td>
                                            </tr>
                                            @if ($student->roll_number)
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Roll Number</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->roll_number }}</td>
                                            </tr>
                                            @endif
                                            @if ($student->section)
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Section</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->section }}</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Contest</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contest->title }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Final Status</td>
                                                <td style="padding:6px 0; font-size:12px; color:{{ $locked ? '#991B1B' : '#92400E' }}; font-weight:700;">{{ $locked ? 'Locked out' : 'Completed with warnings' }}</td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <p class="em-h" style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 10px 0;">Activity Timeline</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table class="em-rule" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB; border-radius:10px; overflow:hidden;">
                                <tr style="background-color:#F9FAFB;">
                                    <td class="em-muted" style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Time</td>
                                    <td class="em-muted" style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Event</td>
                                    <td class="em-muted" style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Strike?</td>
                                </tr>
                                @foreach ($session->violations as $violation)
                                <tr>
                                    <td class="em-p em-rule" style="padding:8px 14px; font-size:12px; color:#4B5563; border-top:1px solid #E5E7EB;">{{ $violation->occurred_at->timezone('Asia/Kolkata')->format('g:i:s A') }}</td>
                                    <td class="em-h em-rule" style="padding:8px 14px; font-size:12px; color:#111827; border-top:1px solid #E5E7EB;">{{ \App\Models\ProctoringViolation::label($violation->type) }}</td>
                                    <td class="em-rule" style="padding:8px 14px; font-size:12px; border-top:1px solid #E5E7EB; color:{{ $violation->counted_toward_lock ? '#991B1B' : '#6B7280' }}; font-weight:{{ $violation->counted_toward_lock ? '700' : '400' }};">{{ $violation->counted_toward_lock ? 'Yes' : 'No' }}</td>
                                </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/admin/proctoring" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Review in Dashboard
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "No video or audio was uploaded for this session — recording happens only in the student's browser and is not stored by the platform. This report reflects the activity log only. If this looks like a false alarm, you can reinstate the student from the dashboard."])
