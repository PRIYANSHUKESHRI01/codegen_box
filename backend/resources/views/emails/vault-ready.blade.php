@include('emails.partials.header', ['category' => 'Mellow Vault', 'preheader' => 'Your readiness score is '.$score.'. You can now be found by employers on Mellow Vault.'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Vault
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">You're ready for the Vault &#127881;</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $user->name }},
                                your AptRun readiness score has reached <strong>{{ $score }}</strong> — above the {{ $threshold }} we look for.
                                That score comes from what you've actually done on AptRun: interviews, practice, the Learning Centre,
                                soft skills, contests and more. It means you are ready to be hired.
                            </p>
                            @if($alreadyConsented)
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                You already said yes to being listed, so your profile is now live in the Vault — visible to hiring partners
                                on AptRun and to employers on Mellow Vault. You can hide it again at any time.
                            </p>
                            @else
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                The Vault puts your profile in front of hiring partners on AptRun and employers on Mellow Vault, with your
                                readiness score as the proof. <strong>Nothing is shared until you say so</strong> — one click on your Vault page
                                turns it on, and you can turn it off whenever you like.
                            </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Your readiness score</p>
                                        <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0;">{{ $score }} / 100</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard/vault" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Open My Vault
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "Your phone number is never shared. If you weren't expecting this email, you can safely ignore it."])
