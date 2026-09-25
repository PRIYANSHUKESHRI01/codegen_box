<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#F7F8FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E5E7EB;">
                    <tr>
                        <td style="padding:28px 32px 0 32px;">
                            <span style="font-size:20px; font-weight:800; color:#111827;">CodeGen</span> <span style="color:#4F46E5;">Box</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $decision === 'decline' ? '#FEE2E2' : '#D1FAE5' }}; color:{{ $decision === 'decline' ? '#991B1B' : '#065F46' }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                {{ $decision === 'decline' ? 'Declined' : 'Confirmed' }}
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">
                                {{ $inquiry->candidate->user->name ?? 'The candidate' }} {{ $decision === 'decline' ? 'declined' : 'confirmed' }} your HR interview invite
                            </h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $recruiter->name }},
                                @if($decision === 'decline')
                                    the candidate has declined the HR interview slot you scheduled through the Talent Pool. You can reach out again or move on to another candidate.
                                @else
                                    the candidate has confirmed they'll attend the HR interview slot you scheduled through the Talent Pool.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/admin/company/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View on CodeGen Box
                            </a>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
