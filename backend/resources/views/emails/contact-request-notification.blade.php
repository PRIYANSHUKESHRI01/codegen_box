@include('emails.partials.header', ['category' => 'Enquiry', 'preheader' => !empty($forTeam) ? 'A new "Talk to Our Team" enquiry from '.$contactRequest->organization_name.'.' : 'A new "Talk to Our Team" inquiry from '.$contactRequest->organization_name.' was just assigned to you.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                {{ $contactRequest->audienceLabel() }} Inquiry
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">{{ !empty($forTeam) ? 'New enquiry received' : 'New inquiry assigned to you' }}</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                {{ $contactRequest->name }} from <strong class="em-h" style="color:#111827;">{{ $contactRequest->organization_name }}</strong> just
                                submitted the "Talk to Our Team" form on the marketing site.
                                @if (!empty($forTeam))
                                    {{ $contactRequest->assignedMarketing ? 'It has been assigned to '.$contactRequest->assignedMarketing->name.'.' : 'Nobody has picked it up yet: it is waiting in the unassigned queue.' }} Reply to this e-mail to answer them directly.
                                @else
                                    It's been assigned to you — reach out when you can. Reply to this e-mail to answer them directly.
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
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280; width:34%;">Name</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->name }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Email</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700; font-family: 'SF Mono', Consolas, monospace;">{{ $contactRequest->email }}</td>
                                            </tr>
                                            @if ($contactRequest->phone)
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Phone</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700; font-family: 'SF Mono', Consolas, monospace;">{{ $contactRequest->phone }}</td>
                                            </tr>
                                            @endif
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Organization</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->organization_name }}</td>
                                            </tr>
                                            <tr>
                                                <td class="em-muted" style="padding:6px 0; font-size:12px; color:#6B7280;">Type</td>
                                                <td class="em-h" style="padding:6px 0; font-size:12px; color:#111827; font-weight:700;">{{ $contactRequest->audienceLabel() }}</td>
                                            </tr>
                                        </table>
                                        @if ($contactRequest->message)
                                        <p class="em-muted" style="font-size:12px; color:#6B7280; margin:14px 0 4px 0; text-transform:uppercase; letter-spacing:0.05em;">Message</p>
                                        <p class="em-h" style="font-size:13px; color:#111827; margin:0; line-height:1.6; white-space:pre-wrap;">{{ $contactRequest->message }}</p>
                                        @endif
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/marketing/inquiries" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Open in Dashboard
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['reason' => 'You are receiving this email because you are on the AptRun team that handles enquiries.', 'note' => !empty($forTeam) ? "This is a copy for the team inbox: every enquiry is sent here, whoever it is assigned to." : "You're receiving this because it's assigned to you in the AptRun marketing inquiries queue."])
