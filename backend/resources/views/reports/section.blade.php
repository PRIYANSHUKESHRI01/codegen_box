@use('App\Support\ReportFormat', 'F')
@extends('reports.layout', [
    'reportTitle' => 'Section Performance Report',
    'reportSubtitle' => ($data['college']['name'] ?? 'AptRun').' · '.F::date($data['generated_at']),
])

@section('content')
@php
    $s = $data['summary'];
    $mix = [['Placement Ready', $s['tiers']['placement_ready'], 'good'], ['In Progress', $s['tiers']['in_progress'], 'info'], ['Needs Training', $s['tiers']['needs_training'], 'warn']];
    $total = max(1, $s['size']);
    $tierTone = fn ($t) => $t === 'Placement Ready' ? 'good' : ($t === 'In Progress' ? 'info' : 'warn');
    $trend = $data['trend']['points'];
@endphp

<h1>Section {{ $data['section'] }}</h1>
<p class="muted">{{ $data['college']['name'] ?? '' }}@if (!empty($data['college']['city'])), {{ $data['college']['city'] }}@endif @if ($data['scope']) · {{ $data['scope'] }} only @endif</p>
<p class="small muted">Prepared by {{ $data['prepared_by']['name'] }} · {{ F::date($data['generated_at'], true) }} IST</p>

<h2>At a glance</h2>
<table class="kpis"><tr>
    <td><div class="kpi-label">Students</div><div class="kpi-value">{{ $s['size'] }}</div><div class="kpi-sub">{{ $s['blocked'] }} blocked</div></td>
    <td><div class="kpi-label">Average readiness</div><div class="kpi-value {{ F::tone($s['avg_readiness']) }}">{{ $s['avg_readiness'] }}</div>
        <div class="kpi-sub">@if ($data['college_average']['average'] !== null)college avg {{ $data['college_average']['average'] }}@else out of 100 @endif</div></td>
    <td><div class="kpi-label">Practising</div><div class="kpi-value {{ F::tone($s['practising_percent'], 60, 30) }}">{{ $s['practising_percent'] }}%</div><div class="kpi-sub">{{ $s['practising'] }} active lately</div></td>
    <td><div class="kpi-label">At risk</div><div class="kpi-value {{ $s['at_risk'] > 0 ? 'bad' : 'good' }}">{{ $s['at_risk'] }}</div><div class="kpi-sub">readiness below {{ \App\Services\CoordinatorOverviewService::AT_RISK_BELOW }}</div></td>
    <td><div class="kpi-label">Not signed in</div><div class="kpi-value {{ $s['never_signed_in'] > 0 ? 'warn' : 'good' }}">{{ $s['never_signed_in'] }}</div><div class="kpi-sub">never logged in</div></td>
    <td><div class="kpi-label">Follow-ups</div><div class="kpi-value {{ $s['overdue_follow_ups'] > 0 ? 'bad' : '' }}">{{ $s['open_follow_ups'] }}</div><div class="kpi-sub">{{ $s['overdue_follow_ups'] }} overdue</div></td>
</tr></table>

<h2>Readiness mix</h2>
@foreach ($mix as [$label, $count, $tone])
    <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
        <td style="width:110px;">{{ $label }}</td>
        <td><div class="bar"><div class="fill {{ $tone }}" style="width: {{ $count > 0 ? max(3, (int) round($count / $total * 100)) : 0 }}%;"></div></div></td>
        <td class="right nowrap" style="width:90px;"><b>{{ $count }}</b> <span class="muted">{{ (int) round($count / $total * 100) }}%</span></td>
    </tr></table>
@endforeach

@if (count($trend) > 1)
    @php $pts = array_slice($trend, -42); @endphp
    <h3>Average readiness, last {{ count($pts) }} days
        @if ($data['trend']['change_7d'] !== null)<span class="small {{ $data['trend']['change_7d'] >= 0 ? 'good' : 'bad' }}">({{ $data['trend']['change_7d'] >= 0 ? '+' : '' }}{{ $data['trend']['change_7d'] }} in 7 days)</span>@endif
    </h3>
    <table class="trend" style="width:100%; border-collapse:collapse; height:46px;"><tr>
        @foreach ($pts as $p)<td style="height:46px;"><div class="col {{ $p['average'] >= 60 ? 'hit' : '' }}" style="height: {{ max(2, (int) round($p['average'] * 0.44)) }}px;"></div></td>@endforeach
    </tr></table>
    <p class="small muted">Green bars are days when the section average was at or above the Vault line (60).</p>
@endif

<h2>Who needs a conversation this week</h2>
@if ($data['attention'])
    <table class="grid">
        <tr><th>Student</th><th class="right">Readiness</th><th>Why</th></tr>
        @foreach ($data['attention'] as $k => $a)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td><b>{{ $a['name'] }}</b>@if ($a['roll_number'])<br><span class="small muted">{{ $a['roll_number'] }}</span>@endif</td>
                <td class="right {{ F::tone($a['readiness_score']) }}"><b>{{ $a['readiness_score'] }}</b></td>
                <td>{{ implode(' · ', array_column($a['reasons'], 'label')) }}</td>
            </tr>
        @endforeach
    </table>
@else
    <div class="callout good">Nobody stands out as needing urgent attention right now.</div>
@endif

<table class="two" style="margin-top:6px;"><tr>
    <td>
        <h3 class="good">Leading the section</h3>
        <table class="grid">@foreach (array_slice($data['leaders'], 0, 6) as $r)<tr><td>{{ $r['name'] }}</td><td class="right good"><b>{{ $r['readiness'] }}</b></td></tr>@endforeach</table>
    </td>
    <td>
        <h3 class="warn">Needs the most support</h3>
        <table class="grid">@foreach (array_slice($data['needs_support'], 0, 6) as $r)<tr><td>{{ $r['name'] }}</td><td class="right warn"><b>{{ $r['readiness'] }}</b></td></tr>@endforeach</table>
    </td>
</tr></table>

@if ($data['movers']['improved'] || $data['movers']['slipped'])
    <table class="two"><tr>
        <td><h3 class="good">Most improved (14 days)</h3>
            @forelse ($data['movers']['improved'] as $m)<p class="small">{{ $m['name'] }} <b class="good">+{{ $m['change'] }}</b> <span class="muted">({{ $m['from'] }} → {{ $m['to'] }})</span></p>@empty<p class="muted">—</p>@endforelse</td>
        <td><h3 class="bad">Slipped (14 days)</h3>
            @forelse ($data['movers']['slipped'] as $m)<p class="small">{{ $m['name'] }} <b class="bad">{{ $m['change'] }}</b> <span class="muted">({{ $m['from'] }} → {{ $m['to'] }})</span></p>@empty<p class="muted">—</p>@endforelse</td>
    </tr></table>
@endif

@if (count($data['branches']) > 1)
    <h2>By branch</h2>
    <table class="grid"><tr><th>Branch</th><th class="right">Students</th><th class="right">Avg readiness</th></tr>
        @foreach ($data['branches'] as $k => $b)<tr class="{{ $k % 2 ? 'alt' : '' }}"><td>{{ $b['branch'] }}</td><td class="right">{{ $b['students'] }}</td><td class="right {{ F::tone($b['average']) }}"><b>{{ $b['average'] }}</b></td></tr>@endforeach
    </table>
@endif

@if ($data['events'])
    <h2>Mock AI interviews scheduled for this section</h2>
    <table class="grid">
        <tr><th>Interview</th><th>Window</th><th class="right">Done</th><th class="right">Part-way</th><th class="right">Not started</th><th class="right">Avg score</th></tr>
        @foreach ($data['events'] as $k => $e)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td>{{ \Illuminate\Support\Str::limit($e['title'], 44) }}</td>
                <td class="small">@if ($e['opens_at']){{ F::date($e['opens_at']) }}@else open @endif → @if ($e['closes_at']){{ F::date($e['closes_at']) }}@else no deadline @endif</td>
                <td class="right">{{ $e['completed'] }}/{{ $e['in_section'] }}</td>
                <td class="right">{{ $e['in_progress'] }}</td>
                <td class="right {{ $e['not_started'] > 0 ? 'warn' : '' }}"><b>{{ $e['not_started'] }}</b></td>
                <td class="right">{{ $e['average_score'] !== null ? $e['average_score'].'%' : '—' }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if ($data['follow_ups'])
    <h2>Open follow-ups</h2>
    <table class="grid">
        <tr><th>Student</th><th>Note</th><th>Due</th></tr>
        @foreach (array_slice($data['follow_ups'], 0, 20) as $k => $f)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td><b>{{ $f['student']['name'] }}</b></td>
                <td>{{ \Illuminate\Support\Str::limit($f['body'], 130) }}</td>
                <td class="nowrap {{ $f['status'] === 'overdue' ? 'bad' : '' }}">{{ $f['follow_up_on'] ? F::date($f['follow_up_on']) : '—' }}{{ $f['status'] === 'overdue' ? ' · overdue' : '' }}</td>
            </tr>
        @endforeach
    </table>
@endif

<h2 class="pagebreak" style="margin-top:0;">Every student ({{ count($data['students']) }})</h2>
<table class="grid">
    <tr><th>Student</th><th>Branch</th><th class="right">Readiness</th><th>Level</th><th class="right">Solved</th><th>Practice</th><th class="right">Follow-ups</th></tr>
    @foreach ($data['students'] as $k => $r)
        <tr class="{{ $k % 2 ? 'alt' : '' }}">
            <td><b>{{ $r['name'] }}</b>@if ($r['blocked']) <span class="badge bad">blocked</span>@endif @if ($r['roll_number'])<br><span class="small muted">{{ $r['roll_number'] }}</span>@endif</td>
            <td>{{ $r['branch'] ?? '—' }}</td>
            <td class="right {{ F::tone($r['readiness']) }}"><b>{{ $r['readiness'] }}</b></td>
            <td><span class="badge {{ $tierTone($r['tier']) }}">{{ $r['tier'] }}</span></td>
            <td class="right">{{ $r['solved'] }}</td>
            <td class="small">{{ ['active' => 'Active', 'slipping' => 'Slipping', 'dormant' => 'Dormant', 'not_started' => 'Not started', 'pending_activation' => 'Not signed in'][$r['engagement']] ?? $r['engagement'] }}@if ($r['days_since_practice'] !== null) · {{ $r['days_since_practice'] }}d ago @endif</td>
            <td class="right">{{ $r['open_follow_ups'] ?: '—' }}</td>
        </tr>
    @endforeach
</table>

<p class="small muted" style="margin-top:14px;">
    Figures are AptRun's records at the time of generation. This document contains personal data of students; share it only with people who need it for placement support.
</p>
@endsection
