{{--
    Shared chrome every transactional email opens with — the outer
    table-based layout (email-client-safe: no flexbox/grid), the white card,
    and the wordmark. Every view in resources/views/emails/ starts with
    @include('emails.partials.header', ['preheader' => '...', 'width' => N])
    and closes with emails.partials.footer — see that file's docblock for
    why the DOCTYPE/html/body tags are safely split across the two.

    $preheader: the one-line snippet an inbox shows next to the subject
    (Gmail/Outlook/Apple Mail all read the first visible text in the body —
    this hidden span is what lets us control it instead of it defaulting to
    "View this email in your browser" or the first stray line of markup).
    $width: card width in px — 480 for a simple message, 520-560 for one
    that embeds a data table (see drive-mapping-proposal, proctoring-
    violation-report).
--}}
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AptRun</title>
</head>
<body style="margin:0; padding:0; background-color:#F7F8FC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    @if (!empty($preheader))
    <div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#F7F8FC; opacity:0;">
        {{ $preheader }}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
    </div>
    @endif
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC; padding:32px 16px;">
        <tr>
            <td align="center">
                <table role="presentation" width="{{ $width ?? 480 }}" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:16px; overflow:hidden; border:1px solid #E5E7EB;">
                    <tr>
                        <td style="padding:28px 32px 0 32px;">
                            {{-- Hosted from the frontend's public/brand folder. Where images are blocked (or FRONTEND_URL is not publicly reachable, e.g. local dev) the alt text renders in the brand navy. --}}
                            <img src="{{ rtrim(config('app.frontend_url'), '/') }}/brand/aptrun-logo-email.png" alt="AptRun" width="150" height="39" style="display:block; border:0; outline:none; text-decoration:none; font-size:22px; font-weight:800; color:#06235E;">
                        </td>
                    </tr>
