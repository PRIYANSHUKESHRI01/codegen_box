@include('emails.partials.header', ['preheader' => 'Use this code to reset your CodeGen Box password. It expires in 10 minutes.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Password Reset
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
                        <td style="padding:20px 32px 0 32px;">
                            <p style="font-size:12px; line-height:1.6; color:#9CA3AF; margin:0;">
                                Never share this code with anyone — Mellow staff will never ask you for it.
                            </p>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "If you didn't request this, you can safely ignore this email — your password won't change unless this code is entered."])
