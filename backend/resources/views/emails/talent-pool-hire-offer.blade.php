@include('emails.partials.header', ['preheader' => $company->name.' has decided to hire you through Mellow\'s Talent Pool. Congratulations!'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Hired
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">Congratulations, {{ $user->name }}! &#127881;</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                {{ $company->name }} has decided to hire you through Mellow's Talent Pool.
                                They'll be in touch directly with next steps and onboarding details.
                            </p>
                        </td>
                    </tr>
                    @if($inquiry->ctc_offered)
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Offer (CTC)</p>
                                        <p style="font-size:14px; color:#111827; margin:0;">₹{{ number_format((float) $inquiry->ctc_offered, 2) }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View Details
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Nice work — this is exactly what the Talent Pool is for. If you weren't expecting this email, please contact support."])
