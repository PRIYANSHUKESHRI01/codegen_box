{{--
    The one layout behind every lifecycle e-mail (App\Enums\LifecycleEmail). It
    only lays out what App\Support\LifecycleCopy hands it in $c — change wording
    there, change structure/look here. Email-client-safe: tables and inline
    styles only.

    $c   subject, preheader, badge, tone, title, paragraphs[], facts[], list_title, list[], cta, note
    $unsubscribeUrl   present only on engagement e-mails
--}}
@php
    $tones = [
        'green' => ['#D1FAE5', '#065F46'],
        'blue' => ['#E0E7FF', '#3730A3'],
        'amber' => ['#FEF3C7', '#92400E'],
        'red' => ['#FEE2E2', '#991B1B'],
    ];
    [$badgeBg, $badgeFg] = $tones[$c['tone']] ?? $tones['blue'];

    // **bold** → <strong>, applied AFTER escaping so copy can never inject markup.
    $fmt = fn (string $text) => new \Illuminate\Support\HtmlString(
        preg_replace('/\*\*(.+?)\*\*/s', '<strong class="em-h" style="color:#111827;">$1</strong>', e($text))
    );
@endphp
@include('emails.partials.header', ['preheader' => $c['preheader'], 'width' => 560, 'category' => !empty($unsubscribeUrl) ? 'Updates' : 'Account'])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $badgeBg }}; color:{{ $badgeFg }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:5px 12px; border-radius:999px; margin-bottom:4px;">
                                {{ $c['badge'] }}
                            </span>
                            <h1 class="em-h" style="font-size:24px; line-height:1.28; font-weight:800; letter-spacing:-0.02em; margin:14px 0 12px 0; color:#0F172A;">{{ $c['title'] }}</h1>
                            @foreach ($c['paragraphs'] as $paragraph)
                                <p class="em-p" style="font-size:15px; line-height:1.7; color:#475569; margin:0 0 14px 0;">{{ $fmt($paragraph) }}</p>
                            @endforeach
                        </td>
                    </tr>
                    @if (!empty($c['facts']))
                    <tr>
                        <td style="padding:6px 32px 0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-box em-rule" style="background-color:#F6F8FC; border-radius:12px; border:1px solid #E3E7EF; border-collapse:separate;">
                                @foreach ($c['facts'] as $label => $value)
                                    <tr>
                                        <td class="em-muted em-rule" style="padding:10px 16px; font-size:12px; color:#6B7280; text-transform:uppercase; letter-spacing:0.04em; {{ $loop->last ? '' : 'border-bottom:1px solid #E5E7EB;' }}">{{ $label }}</td>
                                        <td class="em-h em-rule" align="right" style="padding:10px 16px; font-size:14px; font-weight:700; color:#111827; {{ $loop->last ? '' : 'border-bottom:1px solid #E5E7EB;' }}">{{ $value }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    @endif
                    @if (!empty($c['list']))
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            @if (!empty($c['list_title']))
                                <p class="em-h" style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 8px 0;">{{ $c['list_title'] }}</p>
                            @endif
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                @foreach ($c['list'] as $item)
                                    <tr>
                                        <td width="18" valign="top" style="padding:5px 0; font-size:13px; color:#4F46E5; line-height:1.5;">&bull;</td>
                                        <td class="em-p" style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">{{ $fmt($item) }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    @endif
                    @if (!empty($c['cta']))
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ $c['cta']['url'] }}" style="display:inline-block; background-color:#4F46E5; background-image:linear-gradient(135deg,#4F46E5,#6366F1); color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:700; letter-spacing:0.01em; padding:14px 30px; border-radius:12px; border:1px solid #4338CA; box-shadow:0 8px 18px -8px rgba(79,70,229,0.65);">
                                {{ $c['cta']['label'] }}
                            </a>
                        </td>
                    </tr>
                    @endif
@include('emails.partials.footer', ['note' => $c['note'] ?? 'You are receiving this because you have an AptRun account.', 'unsubscribeUrl' => $unsubscribeUrl ?? null])
