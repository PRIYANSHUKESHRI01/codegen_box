@include('emails.partials.header', ['category' => 'Mellow Vault', 'preheader' => 'A message from '.$company->name.' via your Vault profile.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#E0E7FF; color:#3730A3; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Message
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">A message from {{ $company->name }}</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 16px 0;">
                                Hi {{ $user->name }},
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF; border-left:3px solid #4F46E5;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-h" style="font-size:14px; line-height:1.6; color:#111827; margin:0; white-space:pre-wrap;">{{ $messageText }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard/vault" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                View on AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "This message was sent by a hiring partner through the AptRun Vault. If you weren't expecting this email, you can safely ignore it."])
