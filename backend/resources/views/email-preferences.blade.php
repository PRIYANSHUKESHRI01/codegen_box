<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>E-mail preferences &middot; AptRun</title>
    <style>
        body { margin:0; background:#F7F8FC; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827; }
        .wrap { max-width:460px; margin:0 auto; padding:48px 16px; }
        .card { background:#fff; border:1px solid #E5E7EB; border-radius:16px; padding:32px; }
        h1 { font-size:20px; margin:0 0 12px 0; }
        p { font-size:14px; line-height:1.65; color:#4B5563; margin:0 0 14px 0; }
        .brand { font-size:22px; font-weight:800; color:#06235E; margin-bottom:20px; }
        button { background:#4F46E5; color:#fff; border:0; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; }
        button.secondary { background:#fff; color:#4F46E5; border:1px solid #C7D2FE; }
        a { color:#4F46E5; }
        .small { font-size:12px; color:#9CA3AF; margin-top:18px; }
    </style>
</head>
<body>
<div class="wrap">
    <div class="card">
        <div class="brand">AptRun</div>

        @if ($changed && !$subscribed)
            <h1>You're unsubscribed</h1>
            <p>We won't send reminders or nudges to <strong>{{ $maskedEmail }}</strong> any more.</p>
            <p>You'll still get e-mails about your account itself &mdash; payment receipts, refunds, plan changes and security notices &mdash; because those are not optional.</p>
            <form method="post" action="{{ $action }}">
                <input type="hidden" name="action" value="subscribe">
                <button type="submit" class="secondary">I changed my mind &mdash; resubscribe</button>
            </form>
        @elseif ($changed && $subscribed)
            <h1>Welcome back</h1>
            <p>Reminders and nudges to <strong>{{ $maskedEmail }}</strong> are switched on again.</p>
        @elseif ($subscribed)
            <h1>Stop reminders and nudges?</h1>
            <p>This switches off the optional e-mails sent to <strong>{{ $maskedEmail }}</strong>: plan suggestions, "you're close to the Vault" updates and "come back" reminders.</p>
            <p>E-mails about your account &mdash; receipts, refunds, plan changes, password and security notices &mdash; will keep coming.</p>
            <form method="post" action="{{ $action }}">
                <input type="hidden" name="action" value="unsubscribe">
                <button type="submit">Unsubscribe</button>
            </form>
        @else
            <h1>You're unsubscribed</h1>
            <p>Reminders and nudges to <strong>{{ $maskedEmail }}</strong> are switched off.</p>
            <form method="post" action="{{ $action }}">
                <input type="hidden" name="action" value="subscribe">
                <button type="submit" class="secondary">Resubscribe</button>
            </form>
        @endif

        <p class="small"><a href="{{ $appUrl }}">Back to AptRun</a></p>
    </div>
</div>
</body>
</html>
