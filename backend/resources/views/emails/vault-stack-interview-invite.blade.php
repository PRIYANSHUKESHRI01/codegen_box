@php
    $trackLabel = $stackName ?: ($rawHeading ?: 'Technical Track');
    $barWidth = max(0, min(100, (int) $profilePercent));
    $hasSpecificTrack = !empty($stackName) || !empty($rawHeading);
    $preheader = "Your Mellow Vault profile hit {$profilePercent}%. Click once to open your {$trackLabel} Vault AI Interview on AptRun.";
    $rounds = !empty($roundTitles) ? $roundTitles : [
        'Round 1 — Core Foundations & Concepts',
        'Round 2 — Architecture & Practical Problem Solving',
        'Round 3 — Real-World Scenario & Debugging',
    ];
@endphp
@include('emails.partials.header', ['category' => 'Vault AI Interview', 'preheader' => $preheader])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                Milestone Unlocked &middot; {{ $barWidth }}% Profile
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 10px 0; color:#0F172A;">
                                @if ($hasSpecificTrack)
                                    Your {{ $trackLabel }} AI Interview is ready
                                @else
                                    Your Vault AI Interview is unlocked
                                @endif
                            </h1>
                            <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 20px 0;">
                                Hi {{ $user->name }},<br>
                                Congratulations &mdash; your Mellow Vault developer profile has reached <strong>{{ $barWidth }}%</strong> completion.
                                Take your verified <strong>{{ $trackLabel }}</strong> AI Interview now so hiring partners on Mellow Vault can shortlist you faster.
                            </p>
                        </td>
                    </tr>

                    {{-- Profile completion progress strip --}}
                    <tr>
                        <td style="padding:0 32px 16px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F8FAFC; border-radius:12px; border:1px solid #E2E8F0;">
                                <tr>
                                    <td style="padding:14px 18px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="left" class="em-box-label em-muted" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.07em; color:#64748B;">
                                                    Mellow Vault Profile Completion
                                                </td>
                                                <td align="right" style="font-size:13px; font-weight:800; color:#059669;">
                                                    {{ $barWidth }}% Verified
                                                </td>
                                            </tr>
                                        </table>
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px; background-color:#E2E8F0; border-radius:999px; overflow:hidden;">
                                            <tr>
                                                <td style="width:{{ $barWidth }}%; height:7px; line-height:7px; font-size:0; background-color:#10B981; background-image:linear-gradient(90deg,#4F46E5 0%,#10B981 100%); border-radius:999px;">&nbsp;</td>
                                                @if ($barWidth < 100)
                                                <td style="width:{{ 100 - $barWidth }}%; height:7px; line-height:7px; font-size:0;">&nbsp;</td>
                                                @endif
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Authentic AptRun Interview Card Preview --}}
                    <tr>
                        <td style="padding:0 32px 8px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#FFFFFF; border-radius:16px; border:1px solid #CBD5E1; overflow:hidden; box-shadow:0 6px 20px -12px rgba(79,70,229,0.35);">
                                <tr>
                                    <td style="height:4px; line-height:4px; font-size:0; background-color:#4F46E5; background-image:linear-gradient(90deg,#4F46E5,#7C3AED,#10B981);">&nbsp;</td>
                                </tr>
                                <tr>
                                    <td style="padding:18px 20px;">
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="left" valign="middle">
                                                    <span class="em-muted" style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:#4F46E5;">
                                                        {{ $roleTitle ?: 'AptRun Qualification Track' }}
                                                    </span>
                                                </td>
                                                <td align="right" valign="middle">
                                                    <span style="display:inline-block; background-color:#D1FAE5; color:#065F46; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.06em; padding:3px 9px; border-radius:999px;">
                                                        Open Now
                                                    </span>
                                                </td>
                                            </tr>
                                        </table>

                                        <p class="em-h" style="font-size:19px; font-weight:800; letter-spacing:-0.015em; color:#0F172A; margin:10px 0 4px 0;">
                                            {{ $trackLabel }}
                                        </p>

                                        @if ($rawHeading && $stackName && strcasecmp($rawHeading, $stackName) !== 0)
                                        <p class="em-muted" style="font-size:12px; font-weight:600; color:#64748B; margin:0 0 8px 0;">
                                            Matched from your Mellow Vault domain: {{ $rawHeading }}
                                        </p>
                                        @endif

                                        @if (!empty($stackBlurb))
                                        <p class="em-p" style="font-size:13.5px; line-height:1.55; color:#475569; margin:6px 0 14px 0;">
                                            {{ $stackBlurb }}
                                        </p>
                                        @else
                                        <p class="em-p" style="font-size:13.5px; line-height:1.55; color:#475569; margin:6px 0 14px 0;">
                                            Three structured AI-moderated voice rounds tailored specifically to your skill stack.
                                        </p>
                                        @endif

                                        {{-- 3-metric inline metadata table --}}
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-rule" style="border-top:1px solid #E2E8F0; border-bottom:1px solid #E2E8F0;">
                                            <tr>
                                                <td width="33%" style="padding:10px 6px 10px 0;">
                                                    <p class="em-muted" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748B; margin:0 0 2px 0;">Format</p>
                                                    <p class="em-h" style="font-size:12.5px; font-weight:700; color:#0F172A; margin:0;">3 Voice Sets</p>
                                                </td>
                                                <td width="33%" style="padding:10px 6px;">
                                                    <p class="em-muted" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748B; margin:0 0 2px 0;">Duration</p>
                                                    <p class="em-h" style="font-size:12.5px; font-weight:700; color:#0F172A; margin:0;">~15m / round</p>
                                                </td>
                                                <td width="34%" style="padding:10px 0 10px 6px;">
                                                    <p class="em-muted" style="font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.06em; color:#64748B; margin:0 0 2px 0;">Pass Benchmark</p>
                                                    <p class="em-h" style="font-size:12.5px; font-weight:700; color:#059669; margin:0;">60%+ Average</p>
                                                </td>
                                            </tr>
                                        </table>

                                        {{-- Round breakdown --}}
                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
                                            @foreach ($rounds as $idx => $rTitle)
                                            <tr>
                                                <td width="24" valign="top" style="padding:4px 0;">
                                                    <span style="display:inline-block; width:18px; height:18px; line-height:18px; text-align:center; border-radius:999px; background-color:#EEF2FF; color:#4F46E5; font-size:10px; font-weight:800;">
                                                        {{ $idx + 1 }}
                                                    </span>
                                                </td>
                                                <td valign="middle" class="em-p" style="padding:4px 0; font-size:12.5px; font-weight:600; color:#334155;">
                                                    {{ $rTitle }}
                                                </td>
                                            </tr>
                                            @endforeach
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Direct 1-Click CTA --}}
                    <tr>
                        <td style="padding:22px 32px 10px 32px;" align="left">
                            <a href="{{ $interviewUrl }}" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 32px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 20px -8px rgba(79,70,229,0.65);">
                                Start {{ $stackName ?: 'Vault AI' }} Interview &rarr;
                            </a>
                            <p class="em-muted" style="font-size:12px; line-height:1.6; color:#64748B; margin:12px 0 0 0;">
                                <strong>1-click direct access:</strong> Opens straight into your {{ $trackLabel }} interview track on AptRun with your active session &mdash; no extra sign-in required.
                            </p>
                        </td>
                    </tr>

                    {{-- Quick tip strip --}}
                    <tr>
                        <td style="padding:8px 32px 14px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#FFFBEB; border-radius:10px; border:1px solid #FDE68A;">
                                <tr>
                                    <td style="padding:11px 14px; font-size:12px; line-height:1.55; color:#92400E;">
                                        <strong>Before you begin:</strong> Sit in a quiet space with a working microphone. Scoring <strong>60%+ across the 3 sets</strong> earns your verified AptRun technical credential on Mellow Vault.
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
@include('emails.partials.footer', [
    'note' => "You received this email because your Mellow Vault developer profile reached {$barWidth}%. This direct interview link stays active for 14 days — please do not share it with anyone else.",
    'reason' => 'You are receiving this email as a registered developer on Mellow Vault & AptRun.',
    'unsubscribeUrl' => $unsubscribeUrl,
])
