@include('emails.partials.header', ['category' => 'Mellow Vault', 'preheader' => $company->name.' has decided to hire you through the AptRun Vault. Congratulations!'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Hired
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">Congratulations, {{ $user->name }}! &#127881;</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                {{ $company->name }} has decided to hire you through the AptRun Vault.
                                They'll be in touch directly with next steps and onboarding details.
                            </p>
                        </td>
                    </tr>
                    @if($inquiry->ctc_offered)
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Offer (CTC)</p>
                                        <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0;">₹{{ number_format((float) $inquiry->ctc_offered, 2) }}</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @endif
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard/vault" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                View Details
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Nice work — this is exactly what the Vault is for. If you weren't expecting this email, please contact support."])
