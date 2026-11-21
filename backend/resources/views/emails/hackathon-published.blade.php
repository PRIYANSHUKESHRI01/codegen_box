@php
    $tz = config('app.display_timezone', 'Asia/Kolkata');
    $fmt = fn ($d) => $d ? $d->copy()->timezone($tz)->format('D, j M Y \a\t g:i A') : null;
    $starts = $fmt($hackathon->starts_at);
    $ends = $fmt($hackathon->ends_at);
    $regCloses = $fmt($hackathon->registration_closes_at);
    $duration = $hackathon->durationHours() ? $hackathon->durationHours().' Hours' : 'Multi-Hour';
    $host = $hackathon->isHostedByCompany() && $hackathon->company ? $hackathon->company->name : 'AptRun';
    $readingMin = $hackathon->reading_time_minutes ?? 15;
@endphp
@include('emails.partials.header', ['category' => 'Hack Arena', 'preheader' => 'New Hackathon: '.$hackathon->title.' · '.$duration.' challenge on AptRun'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#EEF2FF; color:#4338CA; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Hackathon Announced · {{ $duration }}
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">{{ $hackathon->title }}</h1>
                            @if ($hackathon->tagline)
                                <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 18px 0; font-weight:600;">
                                    {{ $hackathon->tagline }}
                                </p>
                            @endif
                            <p class="em-p" style="font-size:14.5px; line-height:1.7; color:#475569; margin:0 0 18px 0;">
                                Hi {{ $user->name }}, a new hackathon has just been scheduled on AptRun! Here are the key details to get ready and compete.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0;">
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Host & Format</p>
                                        <p class="em-h" style="font-size:14.5px; font-weight:700; color:#0F172A; margin:0 0 12px 0;">Hosted by {{ $host }} · {{ ucfirst($hackathon->mode) }}</p>

                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Hackathon Schedule</p>
                                        <p class="em-box-value em-h" style="font-size:14px; color:#0F172A; margin:0 0 4px 0;"><strong>Kickoff:</strong> {{ $starts }} IST</p>
                                        <p class="em-box-value em-h" style="font-size:14px; color:#0F172A; margin:0 0 4px 0;"><strong>Deadline:</strong> {{ $ends }} IST</p>
                                        <p class="em-box-value em-h" style="font-size:14px; color:#0F172A; margin:0 0 14px 0;"><strong>Registration Closes:</strong> {{ $regCloses }} IST</p>

                                        <div style="background-color:#FFFFFF; border:1px solid #E2E8F0; border-radius:8px; padding:14px; margin-top:8px;">
                                            <p style="font-size:12.5px; font-weight:700; color:#4338CA; margin:0 0 6px 0; text-transform:uppercase; letter-spacing:0.05em;">How The Hackathon Works</p>
                                            <ul style="margin:0; padding-left:18px; font-size:13px; line-height:1.6; color:#334155;">
                                                <li style="margin-bottom:6px;"><strong>📖 {{ $readingMin }}-Minute Reading Phase:</strong> At kickoff, the problem statement is unveiled with {{ $readingMin }} minutes reserved to read requirements, analyze constraints, and plan your architecture.</li>
                                                <li style="margin-bottom:6px;"><strong>💻 Local Laptop Development:</strong> Develop and test directly on your local machine. No remote project lab is opened.</li>
                                                <li style="margin-bottom:4px;"><strong>🚀 Submission:</strong> Push your project code to GitHub and deploy it (Vercel, Netlify, Render, AWS, etc.). Submit your <strong>GitHub Repo URL</strong> and <strong>Deployed Link</strong> within the {{ $duration }} window.</li>
                                            </ul>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url', config('app.url')), '/') }}/arena/hackathon?slug={{ urlencode($hackathon->slug) }}" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                View Hackathon & Register
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer')
