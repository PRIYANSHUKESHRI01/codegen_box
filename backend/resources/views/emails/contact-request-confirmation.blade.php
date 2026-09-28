@include('emails.partials.header', ['preheader' => "We got your message — someone from our team will reach out within one business day."])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Message Received
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Thanks, {{ $contactRequest->name }} — we've got it</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                We received your message about {{ $contactRequest->organization_name }} and someone from our team will reach out
                                to <strong style="color:#111827;">{{ $contactRequest->email }}</strong>{{ $contactRequest->phone ? ' or '.$contactRequest->phone : '' }}
                                within one business day.
                            </p>
                        </td>
                    </tr>
                    @if ($contactRequest->message)
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB; border-left:3px solid #4F46E5;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.05em;">What you told us</p>
                                        <p style="font-size:13px; line-height:1.6; color:#111827; margin:0; white-space:pre-wrap;">{{ $contactRequest->message }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/pricing" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Explore CodeGen Box
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "In a hurry? Write to us directly at campus@mellow.ai. If you weren't expecting this email, you can safely ignore it."])
