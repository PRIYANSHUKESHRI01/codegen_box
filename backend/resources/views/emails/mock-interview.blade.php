@php
    $tz = config('app.display_timezone', 'Asia/Kolkata');
    $fmt = fn ($d) => $d ? $d->copy()->timezone($tz)->format('D, j M Y \a\t g:i A') : null;
    $opens = $fmt($interview->opens_at);
    $closes = $fmt($interview->closes_at);
    $college = $user->college?->name ?? 'your college';
    [$badge, $badgeBg, $badgeFg, $headline, $lead] = match ($kind) {
        'changed' => ['Schedule updated', '#FEF3C7', '#92400E', 'The schedule changed', "Your placement cell at {$college} updated this AI mock interview. Please note the new timing below."],
        'opening_soon' => ['Starting soon', '#D1FAE5', '#065F46', 'Opens in about an hour', "Your AI mock interview from {$college} opens shortly. Find a quiet spot, check your camera and microphone, and be ready to talk."],
        'closing_soon' => ['Closing soon', '#FEE2E2', '#991B1B', 'Last call: it closes soon', 'You have not finished this AI mock interview yet, and the window is about to close. It takes about 20 minutes.'],
        default => ['Scheduled', '#E0E7FF', '#3730A3', 'An AI mock interview was scheduled for you', "Your placement cell at {$college} set up an AI mock interview. It is practice: it never affects your eligibility, but your result is shared with your placement cell."],
    };
@endphp
@include('emails.partials.header', ['category' => 'Placements', 'preheader' => $headline.': '.$interview->title.($opens ? ' · '.$opens : '')])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $badgeBg }}; color:{{ $badgeFg }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                {{ $badge }}
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">{{ $headline }}</h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 18px 0;">
                                Hi {{ $user->name }}, {{ $lead }}
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF;">
                                <tr>
                                    <td style="padding:16px 20px;">
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Interview</p>
                                        <p class="em-h" style="font-size:15px; font-weight:700; color:#111827; margin:0 0 {{ $interview->description ? '6' : '14' }}px 0;">{{ $interview->title }}</p>
                                        @if ($interview->description)
                                            <p class="em-p" style="font-size:13.5px; line-height:1.7; color:#475569; margin:0 0 14px 0;">{{ \Illuminate\Support\Str::limit($interview->description, 240) }}</p>
                                        @endif
                                        @if ($opens)
                                            <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Opens</p>
                                            <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0 0 12px 0;">{{ $opens }} IST</p>
                                        @endif
                                        @if ($closes)
                                            <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">Closes</p>
                                            <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0 0 12px 0;">{{ $closes }} IST</p>
                                        @endif
                                        @if (!$opens && !$closes)
                                            <p class="em-box-value em-h" style="font-size:14.5px; color:#0F172A; margin:0 0 12px 0;">Open now. Take it any time.</p>
                                        @endif
                                        <p class="em-box-label em-muted" style="font-size:11px; font-weight:700; color:#64748B; margin:0 0 3px 0; text-transform:uppercase; letter-spacing:0.07em;">What to expect</p>
                                        <p class="em-p" style="font-size:13px; line-height:1.5; color:#374151; margin:0;">
                                            {{ $interview->interviewQuestions()->count() }} spoken question(s), asked by an AI interviewer. Camera, microphone and a full-screen window are needed, and the session is proctored.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ rtrim(config('brand.site_url'), '/') }}/dashboard/interviews" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                Open Mock AI Interview
                            </a>
                        </td>
                    </tr>
@include('emails.partials.footer', ['note' => "You're receiving this because your placement cell at {$college} scheduled this interview for you on AptRun. If something looks wrong, contact your placement office."])
