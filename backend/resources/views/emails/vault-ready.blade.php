@include('emails.partials.header', ['preheader' => 'Your readiness score is '.$score.'. You can now be found by employers on Mellow Vault.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                Vault
                            </span>
                            <h1 style="font-size:18px; margin:12px 0 8px 0; color:#111827;">You're ready for the Vault &#127881;</h1>
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                your AptRun readiness score has reached <strong>{{ $score }}</strong> — above the {{ $threshold }} we look for.
                                That score comes from what you've actually done on AptRun: interviews, practice, the Learning Centre,
                                soft skills, contests and more. It means you are ready to be hired.
                            </p>
                            @if($alreadyConsented)
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                You already said yes to being listed, so your profile is now live in the Vault — visible to hiring partners
                                on AptRun and to employers on Mellow Vault. You can hide it again at any time.
                            </p>
                            @else
                            <p style="font-size:14px; line-height:1.6; color:#4B5563; margin:0 0 20px 0;">
                                The Vault puts your profile in front of hiring partners on AptRun and employers on Mellow Vault, with your
                                readiness score as the proof. <strong>Nothing is shared until you say so</strong> — one click on your Vault page
                                turns it on, and you can turn it off whenever you like.
                            </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p style="font-size:12px; color:#6B7280; margin:0 0 2px 0; text-transform:uppercase; letter-spacing:0.05em;">Your readiness score</p>
                                        <p style="font-size:14px; color:#111827; margin:0;">{{ $score }} / 100</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ config('app.frontend_url') }}/dashboard/vault" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                Open My Vault
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Your phone number is never shared. If you weren't expecting this email, you can safely ignore it."])
