@include('emails.partials.header', ['category' => 'Mellow Vault', 'preheader' => ($inquiry->candidate->user->name ?? 'A candidate').' '.($decision === 'decline' ? 'declined' : 'confirmed').' your HR interview invite.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $decision === 'decline' ? '#FEE2E2' : '#D1FAE5' }}; color:{{ $decision === 'decline' ? '#991B1B' : '#065F46' }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                {{ $decision === 'decline' ? 'Declined' : 'Confirmed' }}
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">
                                {{ $inquiry->candidate->user->name ?? 'The candidate' }} {{ $decision === 'decline' ? 'declined' : 'confirmed' }} your HR interview invite
                            </h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $recruiter->name }},
                                @if($decision === 'decline')
                                    the candidate has declined the HR interview slot you scheduled through the Vault. You can reach out again or move on to another candidate.
                                @else
                                    the candidate has confirmed they'll attend the HR interview slot you scheduled through the Vault.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/admin/company/vault" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                View on AptRun
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because you scheduled this interview through the AptRun Vault."])
