{{--
    Shared page for every PDF report. Dompdf renders CSS 2.1, so this is tables, floats and plain boxes — no flexbox or grid.
    $reportTitle / $reportSubtitle: the running header; $logo: a data: URI (the renderer may not fetch anything);
    $confidential: optional line under the title. The page footer (report id, "AptRun is a product of Mellow Vault", page x of y)
    is drawn by PdfRenderer on every page, not here.
--}}
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $reportTitle ?? 'AptRun report' }}</title>
<style>
    @page { margin: 84px 36px 64px 36px; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 9px; line-height: 1.45; color: #1F2937; margin: 0; }
    #hdr { position: fixed; top: -66px; left: 0; right: 0; height: 52px; border-bottom: 2px solid #4F46E5; }
    #hdr table { width: 100%; border-collapse: collapse; }
    #hdr td { vertical-align: middle; padding: 0 0 6px 0; }
    #hdr .logo { width: 120px; }
    #hdr .logo img { height: 26px; }
    #hdr .title { text-align: right; }
    #hdr .title b { font-size: 12px; color: #06235E; }
    #hdr .title span { display: block; font-size: 8px; color: #6B7280; margin-top: 2px; }

    h1 { font-size: 17px; color: #06235E; margin: 0 0 2px 0; }
    h2 { font-size: 11px; color: #06235E; margin: 18px 0 7px 0; padding: 0 0 4px 8px; border-left: 3px solid #4F46E5; border-bottom: 1px solid #E5E7EB; page-break-after: avoid; }
    h3 { font-size: 9.5px; color: #374151; margin: 10px 0 4px 0; page-break-after: avoid; }
    p { margin: 0 0 5px 0; }
    .muted { color: #6B7280; }
    .small { font-size: 8px; }
    .right { text-align: right; }
    .center { text-align: center; }
    .nowrap { white-space: nowrap; }

    table.grid { width: 100%; border-collapse: collapse; margin: 0 0 4px 0; }
    table.grid th { background: #F3F4F6; color: #374151; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; padding: 5px 6px; border-bottom: 1px solid #D1D5DB; }
    table.grid td { padding: 5px 6px; border-bottom: 1px solid #EEF0F4; vertical-align: top; }
    table.grid tr { page-break-inside: avoid; }
    table.grid tr.alt td { background: #FAFAFC; }

    .card { border: 1px solid #E5E7EB; border-radius: 6px; padding: 9px 11px; background: #FFFFFF; }
    .card.soft { background: #F8F9FC; }
    .kpis { width: 100%; border-collapse: separate; border-spacing: 5px 0; margin: 0 -5px 4px -5px; }
    .kpis td { width: 16.66%; border: 1px solid #E5E7EB; border-radius: 6px; padding: 8px 9px; background: #FFFFFF; vertical-align: top; }
    .kpi-label { font-size: 7px; text-transform: uppercase; letter-spacing: 0.06em; color: #6B7280; }
    .kpi-value { font-size: 16px; font-weight: bold; color: #111827; margin-top: 2px; }
    .kpi-sub { font-size: 7.5px; color: #6B7280; margin-top: 1px; }

    .good { color: #047857; } .warn { color: #B45309; } .bad { color: #B91C1C; } .info { color: #4338CA; } .mutedc { color: #6B7280; }
    .badge { display: inline-block; padding: 1px 7px; border-radius: 9px; font-size: 7.5px; font-weight: bold; }
    .badge.good { background: #D1FAE5; color: #065F46; } .badge.warn { background: #FEF3C7; color: #92400E; }
    .badge.bad { background: #FEE2E2; color: #991B1B; } .badge.info { background: #E0E7FF; color: #3730A3; }
    .badge.muted { background: #F3F4F6; color: #4B5563; }

    .bar { background: #EEF0F4; height: 7px; border-radius: 4px; width: 100%; }
    .bar .fill { height: 7px; border-radius: 4px; }
    .fill.good { background: #10B981; } .fill.warn { background: #F59E0B; } .fill.bad { background: #EF4444; } .fill.info { background: #6366F1; } .fill.muted { background: #9CA3AF; }

    ul.tight { margin: 0; padding: 0 0 0 13px; }
    ul.tight li { margin: 0 0 3px 0; }
    .two { width: 100%; border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px; }
    .two > tbody > tr > td { width: 50%; vertical-align: top; }
    .callout { border-left: 3px solid #4F46E5; background: #EEF2FF; padding: 8px 11px; border-radius: 0 6px 6px 0; }
    .callout.warn { border-left-color: #F59E0B; background: #FFFBEB; }
    .callout.good { border-left-color: #10B981; background: #ECFDF5; }
    .callout.bad { border-left-color: #EF4444; background: #FEF2F2; }
    .tag { display: inline-block; background: #F3F4F6; border-radius: 3px; padding: 0 5px; font-size: 7.5px; color: #374151; margin: 0 2px 2px 0; }
    .trend td { vertical-align: bottom; text-align: center; padding: 0 1px; }
    .trend .col { background: #818CF8; width: 100%; border-radius: 2px 2px 0 0; }
    .trend .col.hit { background: #10B981; }
    .pagebreak { page-break-before: always; }
    .keep { page-break-inside: avoid; }
    .quote { border-left: 2px solid #D1D5DB; padding: 2px 0 2px 8px; color: #374151; }
</style>
</head>
<body>
<div id="hdr">
    <table><tr>
        <td class="logo">@if (!empty($logo))<img src="{{ $logo }}" alt="AptRun">@else<b style="font-size:15px;color:#06235E;">AptRun</b>@endif</td>
        <td class="title"><b>{{ $reportTitle ?? 'Report' }}</b><span>{{ $reportSubtitle ?? '' }}</span></td>
    </tr></table>
</div>

@yield('content')
</body>
</html>
