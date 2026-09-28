@include('emails.partials.header', ['preheader' => ($inquiry->candidate->user->name ?? 'A candidate').' '.($decision === 'decline' ? 'declined' : 'confirmed').' your HR interview invite.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $decision === 'decline' ? '#FEE2E2' : '#D1FAE5' }}; color:{{ $decision === 'decline' ? '#991B1B' : '#065F46' }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                {{ $decision === 'decline' ? 'Declined' : 'Confirmed' }}
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">
                                {{ $inquiry->candidate->user->name ?? 'The candidate' }} {{ $decision === 'decline' ? 'declined' : 'confirmed' }} your HR interview invite
                            </h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $recruiter->name }},
                                @if($decision === 'decline')
                                    the candidate has declined the HR interview slot you scheduled through the Talent Pool. You can reach out again or move on to another candidate.
                                @else
                                    the candidate has confirmed they'll attend the HR interview slot you scheduled through the Talent Pool.
                                @endif
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/admin/company/talent-pool" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                View on CodeGen Box
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because you scheduled this interview through Mellow's Talent Pool."])
