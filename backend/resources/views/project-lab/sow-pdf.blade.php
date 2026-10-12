<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $topic->title }} — Statement of Work</title>
<style>
    @page { margin: 56px 44px 56px 44px; }
    body { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; line-height: 1.5; color: #1b2033; }
    h1 { font-size: 22pt; line-height: 1.2; margin: 0 0 6px 0; color: #0f1530; }
    h2 { font-size: 15pt; margin: 22px 0 6px 0; padding-bottom: 4px; border-bottom: 1px solid #d6dae6; color: #0f1530; }
    h3 { font-size: 12pt; margin: 16px 0 4px 0; color: #1b2033; }
    h4 { font-size: 10.5pt; margin: 12px 0 2px 0; }
    /* A heading is never left alone at the foot of a page, and a table row is never cut in two. */
    h2, h3, h4 { page-break-after: avoid; }
    tr { page-break-inside: avoid; }
    table, pre { page-break-inside: avoid; }
    p { margin: 0 0 8px 0; }
    ul, ol { margin: 0 0 8px 0; padding-left: 20px; }
    li { margin-bottom: 2px; }
    code { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; background: #eef0f7; padding: 1px 3px; }
    pre { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.6pt; background: #f2f4fa; border: 1px solid #dde1ee; padding: 8px; white-space: pre-wrap; }
    pre code { background: none; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: 6px 0 12px 0; }
    th, td { border: 1px solid #cfd4e4; padding: 3px 6px; text-align: left; vertical-align: top; font-size: 9.2pt; line-height: 1.35; }
    th { background: #eef0f7; }
    /* Requirement ids ("APT-1") sit in the first column in code style; they must never wrap. */
    td:first-child code { white-space: nowrap; }
    blockquote { margin: 0 0 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid #b9c0da; color: #3a4260; }
    .brand { font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; color: #5b63d3; font-weight: bold; margin-bottom: 14px; }
    .meta td { border: none; padding: 2px 14px 2px 0; font-size: 9.6pt; }
    .meta .k { color: #5a6280; width: 110px; }
    .summary { font-size: 11.5pt; color: #2c3350; margin: 10px 0 14px 0; }
    .rule { border-top: 2px solid #5b63d3; margin: 14px 0 6px 0; }
    .milestone { margin-bottom: 10px; page-break-inside: avoid; }
    .criteria li { list-style: square; }
</style>
</head>
<body>

<div class="brand">AptRun &middot; Project Lab &middot; Statement of Work</div>
<h1>{{ $topic->title }}</h1>
<div class="summary">{{ $topic->summary }}</div>

<table class="meta">
    <tr><td class="k">Category</td><td>{{ $topic->category }}</td></tr>
    <tr><td class="k">Difficulty</td><td>{{ ucfirst($topic->difficulty) }}</td></tr>
    <tr><td class="k">Estimated effort</td><td>{{ $topic->estimated_hours }} hours</td></tr>
    @if (! empty($topic->tech_stack))
        <tr><td class="k">Tech stack</td><td>{{ implode(', ', $topic->tech_stack) }}</td></tr>
    @endif
    <tr><td class="k">SOW version</td><td>v{{ $topic->sow_version }}</td></tr>
    <tr><td class="k">Issued to</td><td>{{ $student->name }} ({{ $student->email }}) on {{ $issuedOn }}</td></tr>
</table>
<div class="rule"></div>

@if (! empty($topic->outcomes))
    <h2>What you will build and learn</h2>
    <ul>
        @foreach ($topic->outcomes as $outcome)
            <li>{{ $outcome }}</li>
        @endforeach
    </ul>
@endif

{!! $body !!}

@if ($topic->milestones->isNotEmpty())
    <h2>Milestones and acceptance criteria</h2>
    <p>Each milestone is reviewed against its acceptance criteria. A milestone is done when every criterion is met.</p>
    @foreach ($topic->milestones as $i => $milestone)
        <div class="milestone">
            <h3>{{ $i + 1 }}. {{ $milestone->title }} <span style="font-weight: normal; font-size: 9pt; color: #5a6280;">(about {{ $milestone->estimated_hours }} h)</span></h3>
            @if (filled($milestone->description))
                <p>{{ $milestone->description }}</p>
            @endif
            @if (! empty($milestone->acceptance_criteria))
                <ul class="criteria">
                    @foreach ($milestone->acceptance_criteria as $criterion)
                        <li>{{ $criterion }}</li>
                    @endforeach
                </ul>
            @endif
        </div>
    @endforeach
@endif

</body>
</html>
