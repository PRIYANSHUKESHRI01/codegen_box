{{--
    Shared chrome every transactional email opens with — the outer table-based layout (email-client-safe: no flexbox/grid), the white
    card, and the wordmark. Every view in resources/views/emails/ starts with
    @include('emails.partials.header', ['preheader' => '...', 'width' => N, 'category' => '...'])
    and closes with emails.partials.footer — see that file's docblock for why the DOCTYPE/html/body tags are safely split across the two.

    $preheader: the one-line snippet an inbox shows next to the subject (Gmail/Outlook/Apple Mail all read the first visible text in the
    body — this hidden span is what lets us control it instead of it defaulting to "View this email in your browser" or the first stray
    line of markup).
    $width: card width in px — 560 by default; 520-600 for one that embeds a data table.
    $category (optional): a small label at the card's top-right ("Account", "Payments", "Placements"…) so the e-mail says what kind of
    message it is before a word of it is read.

    The class names (em-*) exist only so the dark-mode block below can re-colour the parts that carry no colour of their own. Every colour
    that matters is ALSO inline, so a client that strips <style> (some Gmail accounts, Outlook desktop) still shows the full light design.
--}}
<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <title>AptRun</title>
    <!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
    <style>
        body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
        table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
        img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
        a { text-decoration:none; }
        @media only screen and (max-width:620px) {
            .em-outer { padding:16px 10px !important; }
            .em-card { border-radius:14px !important; }
        }
        @media (prefers-color-scheme: dark) {
            .em-bg { background-color:#090D16 !important; }
            .em-card { background-color:#111827 !important; border-color:#1F2937 !important; }
            .em-h { color:#F9FAFB !important; }
            .em-p { color:#CBD5E1 !important; }
            .em-muted { color:#94A3B8 !important; }
            .em-box { background-color:#0F172A !important; border-color:#1F2937 !important; }
            .em-box-label { color:#94A3B8 !important; }
            .em-box-value { color:#F1F5F9 !important; }
            .em-footer { background-color:#0B1220 !important; border-color:#1F2937 !important; }
            .em-footer-name { color:#F9FAFB !important; }
            .em-link { color:#A5B4FC !important; }
            .em-rule { border-color:#1F2937 !important; }
        }
    </style>
</head>
<body class="em-bg" style="margin:0; padding:0; background-color:#F3F5F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing:antialiased;">
    @if (!empty($preheader))
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F3F5F9; opacity:0;">
        {{ $preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    @endif
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-bg" style="background-color:#F3F5F9;">
        <tr>
            <td align="center" class="em-outer" style="padding:36px 16px;">
                <table role="presentation" width="{{ $width ?? 560 }}" cellpadding="0" cellspacing="0" class="em-card" style="background-color:#FFFFFF; border-radius:20px; overflow:hidden; border:1px solid #E3E7EF; max-width:100%; box-shadow:0 12px 32px -16px rgba(30,41,90,0.22);">
                    <tr>
                        <td style="height:5px; line-height:5px; font-size:0; background-color:#4F46E5; background-image:linear-gradient(90deg,#4F46E5 0%,#0EA5E9 100%);">&nbsp;</td>
                    </tr>
                    <tr>
                        <td style="padding:26px 32px 4px 32px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td align="left" valign="middle">
                                        {{-- Hosted from the frontend's public/brand folder. Where images are blocked (or FRONTEND_URL is not publicly reachable, e.g. local dev) the alt text renders in the brand navy. --}}
                                        <a href="{{ rtrim((string) config('brand.site_url'), '/') }}" style="text-decoration:none;"><img src="{{ rtrim((string) config('brand.site_url'), '/') }}/brand/aptrun-logo-email.png" alt="AptRun" width="150" height="35" style="display:block; border:0; outline:none; text-decoration:none; font-size:22px; font-weight:800; color:#06235E;"></a>
                                    </td>
                                    @if (!empty($category))
                                    <td align="right" valign="middle">
                                        <span class="em-muted" style="display:inline-block; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#6B7280; border:1px solid #E3E7EF; border-radius:999px; padding:4px 11px;">{{ $category }}</span>
                                    </td>
                                    @endif
                                </tr>
                            </table>
                        </td>
                    </tr>
