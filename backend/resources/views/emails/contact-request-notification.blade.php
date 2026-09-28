@include('emails.partials.header', ['preheader' => 'A new "Talk to Our Team" inquiry from '.$contactRequest->organization_name.' was just assigned to you.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                {{ $contactRequest->audience === 'institution' ? 'College / TPO Inquiry' : 'Employer Inquiry' }}
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">New inquiry assigned to you</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                {{ $contactRequest->name }} from <strong style="color:#111827;">{{ $contactRequest->organization_name }}</strong> just
                                submitted the "Talk to Our Team" form on the marketing site. It's been assigned to you — reach out when you can.
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
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280; width:34%;">Name</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->name }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Email</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700; font-family: 'SF Mono', Consolas, monospace;">{{ $contactRequest->email }}</td>
                                            </tr>
                                            @if ($contactRequest->phone)
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Phone</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700; font-family: 'SF Mono', Consolas, monospace;">{{ $contactRequest->phone }}</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Organization</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->organization_name }}</td>
                                            </tr>
                                            <tr>
                                                <td style="padding:6px 0; font-size:12px; color:#6B7280;">Type</td>
                                                <td style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->audience === 'institution' ? 'College / TPO' : 'Employer' }}</td>
                                            </tr>
                                        </table>
                                        @if ($contactRequest->message)
                                        <p style="font-size:12px; color:#6B7280; margin:14px 0 4px 0; text-transform:uppercase; letter-spacing:0.05em;">Message</p>
                                        <p style="font-size:13px; color:#111827; margin:0; line-height:1.6; white-space:pre-wrap;">{{ $contactRequest->message }}</p>
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/marketing/inquiries" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open in Dashboard
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because it's assigned to you in the Mellow Marketing inquiries queue."])
