@include('emails.partials.header', ['category' => 'Enquiry', 'preheader' => "We got your message — someone from our team will reach out within one business day."])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Message Received
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">Thanks, {{ $contactRequest->name }} — we've got it</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                We received your message about {{ $contactRequest->audience === 'academy' ? 'Mellow Academy' : $contactRequest->organization_name }} and someone from our team will reach out
                                to <strong class="em-h" style="color:#111827;">{{ $contactRequest->email }}</strong>{{ $contactRequest->phone ? ' or '.$contactRequest->phone : '' }}
                                within one business day.
                            </p>
                        </td>
                    </tr>
                    @if ($contactRequest->message)
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF; border-left:3px solid #4F46E5;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">What you told us</p>
                                        <p class="em-h" style="font-size:13px; line-height:1.6; color:#111827; margin:0; white-space:pre-wrap;">{{ $contactRequest->message }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/pricing" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Explore AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['reason' => 'You are receiving this email because you contacted AptRun through our website.', 'note' => "In a hurry? Write to us directly at ".config('brand.support_email').". If you weren't expecting this email, you can safely ignore it."])
