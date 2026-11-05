{{--
    Closes the card/table/body/html opened by emails.partials.header.

    $note:           the per-email disclaimer line ("if you weren't expecting this…") — sits on the white card.
    $reason:         why this person is getting the e-mail, in the footer panel. Defaults to "…regarding your registered AptRun account";
                     say something else for a message to someone who has no account yet (a contact request, a newsletter signup).
    $unsubscribeUrl: (optional) adds the unsubscribe line every engagement email must carry.

    Under the note, the footer panel — the same shape as Mellow Vault's own e-mails: the product name, who makes it, why you are
    receiving this, the four links a reader may want, and a "need help" line. Below that, the small print: support details, the rest
    of the site, social links and the legal line (config/brand.php is the one source for e-mails, PDFs and the landing page's footer).
    Email clients ignore most modern CSS, so this is nested tables with inline styles and no images: a blocked-image inbox still shows
    the whole footer.
--}}
@php
    $brand = config('brand');
    $site = rtrim((string) config('brand.site_url'), '/');
    $reason = $reason ?? 'You are receiving this transactional email regarding your registered '.$brand['name'].' account.';
    $dot = '<span style="color:#CBD5E1;">&nbsp;&nbsp;&bull;&nbsp;&nbsp;</span>';
@endphp
                    <tr>
                        <td style="padding:6px 32px 28px 32px;">
                            <p class="em-muted" style="font-size:12px; line-height:1.7; color:#6B7280; margin:0;">
                                {{ $note }}
                            </p>
                            @if (!empty($unsubscribeUrl))
                            <p class="em-muted" style="font-size:12px; line-height:1.7; color:#6B7280; margin:10px 0 0 0;">
                                Don't want these reminders? <a href="{{ $unsubscribeUrl }}" class="em-link" style="color:#4F46E5; text-decoration:underline;">Unsubscribe</a> &mdash; we'll still email you about your account, payments and security.
                            </p>
                            @endif
                        </td>
                    </tr>
                    <tr>
                        <td align="center" class="em-footer" style="background-color:#F8FAFC; border-top:1px solid #E3E7EF; padding:32px 32px 28px 32px; text-align:center;">
                            <p class="em-footer-name" style="font-size:17px; font-weight:800; letter-spacing:-0.01em; color:#0F172A; margin:0 0 4px 0;">{{ $brand['name'] }}</p>
                            <p class="em-muted" style="font-size:13px; line-height:1.6; color:#64748B; margin:0 0 16px 0;">
                                {{ $brand['name'] }} is a product of <a href="{{ $brand['parent_url'] }}" class="em-link" style="color:#4F46E5; font-weight:700; text-decoration:none;">{{ $brand['parent'] }}</a>.
                            </p>
                            <p class="em-muted" style="font-size:14px; line-height:1.7; color:#64748B; margin:0 0 16px 0;">
                                {{ $reason }}
                            </p>
                            <p style="font-size:14px; line-height:2; font-weight:600; margin:0 0 16px 0;">
                                @foreach ($brand['email_links'] as $link)<a href="{{ $site.$link['path'] }}" class="em-link" style="color:#4F46E5; text-decoration:none;">{{ $link['label'] }}</a>@if (!$loop->last){!! $dot !!}@endif @endforeach
                            </p>
                            <p class="em-muted" style="font-size:13px; line-height:1.7; color:#94A3B8; margin:0;">
                                Need help? Contact us anytime at <a href="mailto:{{ $brand['support_email'] }}" class="em-link" style="color:#4F46E5; text-decoration:none; font-weight:600;">{{ $brand['support_email'] }}</a>.
                            </p>
                            <p class="em-muted" style="font-size:12.5px; line-height:1.7; color:#94A3B8; margin:2px 0 0 0;">
                                <a href="{{ $brand['support_phone_href'] }}" class="em-muted" style="color:#94A3B8; text-decoration:none;">{{ $brand['support_phone'] }}</a>
                                &nbsp;&middot;&nbsp; {{ $brand['location'] }}
                            </p>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;">
                                <tr>
                                    <td class="em-rule" style="border-top:1px solid #E3E7EF; padding:18px 0 0 0; text-align:center; font-size:12px; line-height:2;">
                                        @foreach ($brand['footer_links'] as $link)<a href="{{ $site.$link['path'] }}" class="em-muted" style="color:#64748B; text-decoration:none;">{{ $link['label'] }}</a>@if (!$loop->last){!! $dot !!}@endif @endforeach
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center" style="padding:16px 0 0 0; text-align:center; font-size:0; line-height:0;">
                                        {{-- The platform marks as images (hosted in the site's public/brand/email), each with its name as alt text so a blocked-image inbox still shows the four links. --}}
                                        @foreach ($brand['socials'] as $social)<a href="{{ $social['url'] }}" title="{{ $social['label'] }}" style="display:inline-block; margin:0 5px; text-decoration:none; font-size:12px; line-height:32px; color:#64748B;"><img src="{{ $site }}/brand/email/{{ strtolower($social['label']) }}.png" alt="{{ $social['label'] }}" width="32" height="32" style="display:block; width:32px; height:32px; border:0; border-radius:50%;"></a>@endforeach
                                    </td>
                                </tr>
                                <tr>
                                    <td class="em-muted" style="padding:14px 0 0 0; text-align:center; font-size:11.5px; line-height:1.75; color:#94A3B8;">
                                        &copy; {{ date('Y') }} {{ $brand['name'] }}. All Rights Reserved.<br>
                                        {{ $brand['legal_entity'] }} &middot; CIN {{ $brand['cin'] }}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
