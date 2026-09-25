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
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Your account is ready</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                @if ($user->role === 'admin_tpo')
                                    Mellow has set up your Training &amp; Placement Officer account for {{ $user->college?->name ?? 'your campus' }}
                                    on CodeGen Box. Use the credentials below to sign in and start running placement drives.
                                @elseif ($user->role === 'admin_internal')
                                    Mellow has created your internal staff account on CodeGen Box. Use the credentials below to sign in.
                                @elseif ($user->role === 'section_coordinator')
                                    {{ $user->college?->name ?? 'Your college' }} has set up your Section Coordinator account for
                                    Section {{ $user->section }} on CodeGen Box. Use the credentials below to sign in and manage your section's roster.
                                @elseif ($user->role === 'admin_company')
                                    Mellow has set up your Hiring Team account for {{ $user->company?->name ?? 'your company' }}
                                    on CodeGen Box. Use the credentials below to sign in and start running your hiring pipeline.
                                @elseif ($user->college)
                                    {{ $user->college->name }} has added you to CodeGen Box to prepare for placements and sharpen your
                                    coding skills. Use the credentials below to sign in.
                                @elseif ($user->invitedByCompany)
                                    {{ $user->invitedByCompany->name }} has invited you to apply on CodeGen Box. Use the credentials below
                                    to sign in and complete your assessment.
                                @else
                                    your CodeGen Box account is ready. Use the credentials below to sign in and start practicing.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Email</p>
                                        <p style="font-size:14px; color:#111827; margin:0 0 14px 0; font-family: 'SF Mono', Consolas, monospace;">{{ $user->email }}</p>
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Temporary Password</p>
                                        <p style="font-size:14px; color:#111827; margin:0; font-family: 'SF Mono', Consolas, monospace;">{{ $plainPassword }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/login" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Sign in to CodeGen Box
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 28px 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                This is a one-time password — the first time you sign in, you'll be asked to verify this email
                                with a code and set your own permanent password before you can continue.
                                @if ($user->role === 'user' && $user->college)
                                    If you weren't expecting this email, contact your college's placement office.
                                @else
                                    If you weren't expecting this email, contact Mellow support.
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
