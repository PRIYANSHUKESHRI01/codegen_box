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
        preg_replace('/\*\*(.+?)\*\*/s', '<strong style="color:#111827;">$1</strong>', e($text))
    );
@endphp
@include('emails.partials.header', ['preheader' => $c['preheader'], 'width' => 520])
                    <tr>
                        <td style="padding:20px 32px 0 32px;">
                            <span style="display:inline-block; background-color:{{ $badgeBg }}; color:{{ $badgeFg }}; font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.05em; padding:4px 10px; border-radius:999px; margin-bottom:12px;">
                                {{ $c['badge'] }}
                            </span>
                            <h1 style="font-size:20px; line-height:1.3; margin:12px 0 12px 0; color:#111827;">{{ $c['title'] }}</h1>
                            @foreach ($c['paragraphs'] as $paragraph)
                                <p style="font-size:14px; line-height:1.65; color:#4B5563; margin:0 0 14px 0;">{{ $fmt($paragraph) }}</p>
                            @endforeach
                        </td>
                    </tr>
                    @if (!empty($c['facts']))
                    <tr>
                        <td style="padding:6px 32px 0 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; border-radius:10px; border:1px solid #E5E7EB; border-collapse:separate;">
                                @foreach ($c['facts'] as $label => $value)
                                    <tr>
                                        <td style="padding:10px 16px; font-size:12px; color:#6B7280; text-transform:uppercase; letter-spacing:0.04em; {{ $loop->last ? '' : 'border-bottom:1px solid #E5E7EB;' }}">{{ $label }}</td>
                                        <td align="right" style="padding:10px 16px; font-size:14px; font-weight:700; color:#111827; {{ $loop->last ? '' : 'border-bottom:1px solid #E5E7EB;' }}">{{ $value }}</td>
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
                                <p style="font-size:12px; font-weight:800; color:#111827; text-transform:uppercase; letter-spacing:0.04em; margin:0 0 8px 0;">{{ $c['list_title'] }}</p>
                            @endif
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                @foreach ($c['list'] as $item)
                                    <tr>
                                        <td width="18" valign="top" style="padding:5px 0; font-size:13px; color:#4F46E5; line-height:1.5;">&bull;</td>
                                        <td style="padding:5px 0; font-size:13px; color:#4B5563; line-height:1.5;">{{ $fmt($item) }}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    @endif
                    @if (!empty($c['cta']))
                    <tr>
                        <td style="padding:24px 32px;">
                            <a href="{{ $c['cta']['url'] }}" style="display:inline-block; background-color:#4F46E5; color:#FFFFFF; text-decoration:none; font-size:14px; font-weight:700; padding:12px 24px; border-radius:10px;">
                                {{ $c['cta']['label'] }}
                            </a>
                        </td>
                    </tr>
                    @endif
@include('emails.partials.footer', ['note' => $c['note'] ?? 'You are receiving this because you have an AptRun account.', 'unsubscribeUrl' => $unsubscribeUrl ?? null])
