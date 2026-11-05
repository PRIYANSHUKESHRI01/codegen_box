@use('App\Support\ReportFormat', 'F')
@extends('reports.layout', [
    'reportTitle' => 'Mock AI Interview Report',
    'reportSubtitle' => ($data['college']['name'] ?? 'AptRun').' · '.F::date($data['generated_at']),
])

@section('content')
@php
    $i = $data['interview'];
    $p = $data['participation'];
    $s = $data['scores'];
    $maxBucket = max(1, max(array_column($s['distribution'], 'count')));
@endphp

<h1>{{ $i['title'] }}</h1>
<p class="muted">
    {{ $data['college']['name'] ?? '' }} · {{ ucfirst($i['schedule_state'] === 'unscheduled' ? 'open any time' : $i['schedule_state']) }}
    @if ($i['opens_at']) · Opens {{ F::date($i['opens_at'], true) }}@endif
    @if ($i['closes_at']) · Closes {{ F::date($i['closes_at'], true) }}@endif
    (IST)
</p>
<p class="small muted">For: {{ $i['audience'] }} · {{ $i['question_count'] }} question(s) · target score {{ $i['target_score'] }}%</p>
@if ($i['description'])<p class="small">{{ \Illuminate\Support\Str::limit($i['description'], 400) }}</p>@endif

<h2>Results at a glance</h2>
<table class="kpis"><tr>
    <td><div class="kpi-label">In audience</div><div class="kpi-value">{{ $p['audience'] }}</div><div class="kpi-sub">students</div></td>
    <td><div class="kpi-label">Completed</div><div class="kpi-value {{ F::tone($p['completion_rate'], 75, 40) }}">{{ $p['completed'] }}</div><div class="kpi-sub">{{ $p['completion_rate'] }}% of audience</div></td>
    <td><div class="kpi-label">Not started</div><div class="kpi-value {{ $p['not_started'] > 0 ? 'warn' : 'good' }}">{{ $p['not_started'] }}</div><div class="kpi-sub">{{ $p['in_progress'] }} part-way</div></td>
    <td><div class="kpi-label">Average score</div><div class="kpi-value {{ F::tone($s['average']) }}">{{ $s['average'] !== null ? round($s['average']).'%' : '—' }}</div><div class="kpi-sub">median {{ $s['median'] !== null ? round($s['median']).'%' : '—' }}</div></td>
    <td><div class="kpi-label">Reached target</div><div class="kpi-value {{ F::tone($s['pass_rate'], 60, 30) }}">{{ $s['pass_rate'] !== null ? $s['pass_rate'].'%' : '—' }}</div><div class="kpi-sub">{{ $s['pass_count'] }} of {{ $p['scored'] }} scored</div></td>
    <td><div class="kpi-label">Integrity</div><div class="kpi-value {{ $data['integrity']['total_strikes'] > 0 ? 'bad' : 'good' }}">{{ $data['integrity']['total_strikes'] }}</div><div class="kpi-sub">strikes · {{ $data['integrity']['locked'] }} locked</div></td>
</tr></table>

@if ($data['insights'])
    <h2>What this tells you</h2>
    <ul class="tight">@foreach ($data['insights'] as $line)<li>{{ $line }}</li>@endforeach</ul>
@endif

<h2>Score distribution</h2>
<table style="width:100%; border-collapse:collapse;">
    @foreach ($s['distribution'] as $b)
        <tr>
            <td style="width:60px; padding:3px 0;">{{ $b['label'] }}</td>
            <td><div class="bar" style="height:10px;"><div class="fill {{ $loop->index >= 2 ? 'good' : ($loop->index === 1 ? 'warn' : 'bad') }}" style="height:10px; width: {{ $b['count'] > 0 ? max(3, (int) round($b['count'] / $maxBucket * 100)) : 0 }}%;"></div></div></td>
            <td class="right nowrap" style="width:80px;"><b>{{ $b['count'] }}</b> <span class="muted">student(s)</span></td>
        </tr>
    @endforeach
</table>
<p class="small muted">Highest {{ $s['highest'] !== null ? round($s['highest']).'%' : '—' }} · lowest {{ $s['lowest'] !== null ? round($s['lowest']).'%' : '—' }} · scored sittings only.</p>

@if ($data['categories'])
    <h2>By question type</h2>
    @foreach ($data['categories'] as $c)
        <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
            <td style="width:140px;">{{ F::humanise($c['category']) }}</td>
            <td><div class="bar"><div class="fill {{ F::tone($c['average']) }}" style="width: {{ max(2, $c['average']) }}%;"></div></div></td>
            <td class="right nowrap" style="width:96px;"><b>{{ $c['average'] }}%</b> <span class="muted">· {{ $c['answers'] }} ans.</span></td>
        </tr></table>
    @endforeach
@endif

<h2>Question by question</h2>
<table class="grid">
    <tr><th style="width:24px;">#</th><th>Question</th><th>Type</th><th class="right">Answered</th><th class="right">Avg score</th></tr>
    @foreach ($data['questions'] as $k => $q)
        <tr class="{{ $k % 2 ? 'alt' : '' }}">
            <td>{{ $q['order'] }}</td>
            <td>{{ \Illuminate\Support\Str::limit($q['question'], 120) }}</td>
            <td>{{ F::humanise($q['category']) }}</td>
            <td class="right">{{ $q['answered'] }}</td>
            <td class="right {{ F::tone($q['average']) }}"><b>{{ $q['average'] !== null ? $q['average'].'%' : '—' }}</b></td>
        </tr>
    @endforeach
</table>

<h2 class="pagebreak" style="margin-top:0;">Every student</h2>
@if ($data['students'])
    <table class="grid">
        <tr><th style="width:24px;">#</th><th>Student</th><th>Section</th><th>Status</th><th class="right">Answered</th><th class="right">Score</th><th>Level</th><th class="right">Strikes</th><th>Date</th></tr>
        @foreach ($data['students'] as $k => $r)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td>{{ $r['rank'] ?? '—' }}</td>
                <td><b>{{ $r['name'] }}</b>@if ($r['roll_number'])<br><span class="small muted">{{ $r['roll_number'] }}</span>@endif</td>
                <td>{{ $r['section'] ?? '—' }}</td>
                <td>{{ F::humanise($r['status']) }}</td>
                <td class="right">{{ $r['answered'] }}/{{ $r['questions'] }}</td>
                <td class="right {{ F::tone($r['score']) }}"><b>{{ $r['score'] !== null ? round($r['score']).'%' : ($r['scoring_failed'] ? 'review' : '—') }}</b></td>
                <td>{{ $r['tier'] }}</td>
                <td class="right {{ $r['strikes'] > 0 ? 'bad' : '' }}">{{ $r['strikes'] }}{{ $r['locked'] ? ' · locked' : '' }}</td>
                <td class="nowrap">{{ F::date($r['completed_at'] ?? $r['started_at']) }}</td>
            </tr>
        @endforeach
    </table>
@else
    <p class="muted">Nobody has started this interview yet.</p>
@endif

@if ($data['not_attempted'])
    <h2>Not started yet ({{ count($data['not_attempted']) }})</h2>
    <p class="small muted">Everyone in the audience who has not opened the interview. A reminder goes out automatically before it closes; you can also follow up directly.</p>
    <table class="grid">
        <tr><th>Student</th><th>Roll number</th><th>Section</th><th>Branch</th></tr>
        @foreach ($data['not_attempted'] as $k => $r)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td>{{ $r['name'] }}@if ($r['blocked']) <span class="badge bad">blocked</span>@endif</td>
                <td>{{ $r['roll_number'] ?? '—' }}</td>
                <td>{{ $r['section'] ?? '—' }}</td>
                <td>{{ $r['branch'] ?? '—' }}</td>
            </tr>
        @endforeach
    </table>
@endif

<p class="small muted" style="margin-top:14px;">
    Scores are the AI interviewer's per-answer marks (or a reviewer's, where one re-marked an answer), averaged per sitting. This document contains personal data of students; share it only with people who need it for placement support.
</p>
@endsection
