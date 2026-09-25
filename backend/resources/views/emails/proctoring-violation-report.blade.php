<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F7F8FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    @php
        $student = $session->contestParticipant->user;
        $contest = $session->contestParticipant->contest;
        $locked = $session->isLocked();
    @endphp
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E5E7EB;">
                    <tr>
                        <td style="padding:28px 32px 0 32px;">
                            <span style="font-size:20px; font-weight:800; color:#111827;">CodeGen</span> <span style="color:#4F46E5;">Box</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $locked ? '#FEE2E2' : '#FEF3C7' }}; color:{{ $locked ? '#991B1B' : '#92400E' }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                {{ $locked ? 'Locked Out — 3 Strikes' : 'Flagged — Under Threshold' }}
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">
                                Proctoring report — {{ $student->name }} in {{ $contest->title }}
                            </h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
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
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280; width:40%;">Student</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->name }} ({{ $student->email }})</td>
                                            </tr>
                                            @if ($student->roll_number)
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Roll Number</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->roll_number }}</td>
                                            </tr>
                                            @endif
                                            @if ($student->section)
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Section</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $student->section }}</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Contest</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contest->title }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Final Status</td>
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
                            <p style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 10px 0;">Activity Timeline</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB; border-radius:10px; overflow:hidden;">
                                <tr style="background-color:#F9FAFB;">
                                    <td style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Time</td>
                                    <td style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Event</td>
                                    <td style="padding:8px 14px; font-size:11px; font-weight:700; color:#6B7280;">Strike?</td>
                                </tr>
                                @foreach ($session->violations as $violation)
                                <tr>
                                    <td style="padding:8px 14px; font-size:12px; color:#4B5563; border-top:1px solid #E5E7EB;">{{ $violation->occurred_at->timezone('Asia/Kolkata')->format('g:i:s A') }}</td>
                                    <td style="padding:8px 14px; font-size:12px; color:#111827; border-top:1px solid #E5E7EB;">{{ \App\Models\ProctoringViolation::label($violation->type) }}</td>
                                    <td style="padding:8px 14px; font-size:12px; border-top:1px solid #E5E7EB; color:{{ $violation->counted_toward_lock ? '#991B1B' : '#6B7280' }}; font-weight:{{ $violation->counted_toward_lock ? '700' : '400' }};">{{ $violation->counted_toward_lock ? 'Yes' : 'No' }}</td>
                                </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/admin/proctoring" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Review in Dashboard
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                No video or audio was uploaded for this session — recording happens only in the
                                student's browser and is not stored by the platform. This report reflects the
                                activity log only. If this looks like a false alarm, you can reinstate the
                                student from the dashboard.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
