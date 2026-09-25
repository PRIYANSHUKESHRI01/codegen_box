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
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Reset your password</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }}, use the code below to reset your CodeGen Box password. It expires in
                                10 minutes and can only be used once.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:20px; text-align:center;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.05em;">Your Code</p>
                                        <p style="font-size:32px; font-weight:800; letter-spacing:0.15em; color:#111827; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $code }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px 0 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                If you didn't request this, you can safely ignore this email — your password won't change
                                unless this code is entered.
                            </p>
                        </td>
                    </tr>
                    <tr><td style="padding:20px;"></td></tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
