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
                            <span style="display:inline-block; background-color:#FEF3C7; color:#92400E; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Placeholder Template
                            </span>
                            @if ($user->college)
                                <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">An update from your Placement Cell</h1>
                                <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, your Training & Placement Officer at {{ $user->college->name }}
                                    sent this message through CodeGen Box. A real message template will replace this placeholder shortly.
                                </p>
                            @else
                                <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">An update from the Mellow team</h1>
                                <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                    Hi {{ $user->name }}, the Mellow team sent this message through CodeGen Box. A real message
                                    template will replace this placeholder shortly.
                                </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:13px; color:#374151; margin:0; line-height:1.6;">
                                            This is a placeholder notification. Please check the CodeGen Box dashboard or contact
                                            @if ($user->college) your placement office @else Mellow support @endif directly for anything time-sensitive.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open CodeGen Box
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                @if ($user->college)
                                    You're receiving this because your placement cell added you to CodeGen Box.
                                @else
                                    You're receiving this because you have a CodeGen Box account.
                                @endif
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
