@use('App\Support\ReportFormat', 'F')
@extends('reports.layout', [
    'reportTitle' => 'AI Interview Result',
    'reportSubtitle' => ($data['college']['name'] ?? 'AptRun').' · '.F::date($data['generated_at']),
])

@section('content')
@php
    $r = $data['result'];
    $st = $data['student'];
    $tone = $r['score'] === null ? 'muted' : ($r['passed'] ? 'good' : ($r['score'] >= 40 ? 'warn' : 'bad'));
@endphp

<table style="width:100%; border-collapse:collapse;"><tr>
    <td style="vertical-align:top;">
        <h1>{{ $st['name'] }}</h1>
        <p class="muted">{{ $st['roll_number'] ?: 'No roll number on file' }}@if ($st['branch']) · {{ $st['branch'] }}@endif @if ($st['section']) · Section {{ $st['section'] }}@endif</p>
        <p style="margin-top:6px;"><b>{{ $data['interview']['title'] }}</b></p>
        <p class="small muted">
            {{ F::humanise($r['status']) }}
            @if ($r['completed_at']) · {{ F::date($r['completed_at'], true) }} IST @endif
            @if ($r['minutes']) · {{ $r['minutes'] }} min @endif
            · {{ $r['answered'] }} answer(s)
        </p>
    </td>
    <td style="width:150px; vertical-align:top; text-align:right;">
        <div class="card soft" style="text-align:center;">
            <div class="kpi-label">Score</div>
            <div style="font-size:30px; font-weight:bold; line-height:1.1;" class="{{ $tone }}">{{ $r['score'] !== null ? round($r['score']) : '—' }}<span style="font-size:11px; color:#6B7280;">{{ $r['score'] !== null ? '%' : '' }}</span></div>
            <span class="badge {{ $tone }}">{{ $r['tier'] }}</span>
            @if ($r['passed'] !== null)<div class="small muted" style="margin-top:3px;">{{ $r['passed'] ? 'Reached' : 'Below' }} the {{ $data['interview']['target_score'] }}% target</div>@endif
        </div>
    </td>
</tr></table>

@if ($r['scoring_failed'] && $r['score'] === null)
    <div class="callout warn" style="margin-top:8px;">The automatic marking did not complete for this sitting, so it has no score yet. A reviewer can mark it from the interview results screen.</div>
@endif

@if ($data['strongest'] || $data['weakest'])
    <h2>Where this went well, and where to improve</h2>
    <table class="two"><tr>
        <td>
            <h3 class="good">Strongest answers</h3>
            @forelse ($data['strongest'] as $q)
                <p class="small"><b>Q{{ $q['order'] }} · {{ $q['score'] }}%</b> {{ \Illuminate\Support\Str::limit($q['question'], 110) }}</p>
            @empty<p class="muted">—</p>@endforelse
        </td>
        <td>
            <h3 class="warn">To work on</h3>
            @forelse ($data['weakest'] as $q)
                <p class="small"><b>Q{{ $q['order'] }} · {{ $q['score'] }}%</b> {{ \Illuminate\Support\Str::limit($q['question'], 110) }}</p>
            @empty<p class="muted">Every answer scored similarly.</p>@endforelse
        </td>
    </tr></table>
@endif

@if ($data['categories'])
    <h3>By question type</h3>
    @foreach ($data['categories'] as $c)
        <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
            <td style="width:140px;">{{ F::humanise($c['category']) }}</td>
            <td><div class="bar"><div class="fill {{ F::tone($c['average']) }}" style="width: {{ max(2, $c['average']) }}%;"></div></div></td>
            <td class="right nowrap" style="width:90px;"><b>{{ $c['average'] }}%</b> <span class="muted">· {{ $c['answers'] }} ans.</span></td>
        </tr></table>
    @endforeach
@endif

<h2>Every question</h2>
@forelse ($data['questions'] as $q)
    <div class="keep" style="margin-bottom:10px; border:1px solid #E5E7EB; border-radius:6px; padding:8px 10px;">
        <table style="width:100%; border-collapse:collapse;"><tr>
            <td><b>Question {{ $q['order'] }}</b>
                @if ($q['category']) <span class="tag">{{ F::humanise($q['category']) }}</span>@endif
                @if ($q['difficulty']) <span class="tag">{{ ucfirst($q['difficulty']) }}</span>@endif
            </td>
            <td class="right nowrap" style="width:120px;">
                <span class="badge {{ F::tone($q['score']) }}">{{ $q['score'] !== null ? $q['score'].'%' : 'not scored' }}</span>
            </td>
        </tr></table>
        <p style="margin:4px 0 5px 0;"><b>{{ $q['question'] }}</b></p>
        <div class="quote">{{ $q['answer'] !== '' ? \Illuminate\Support\Str::limit($q['answer'], 1100) : '(no answer recorded)' }}</div>
        @if ($q['feedback'])
            <p class="small" style="margin:5px 0 0 0;"><span class="info"><b>{{ $q['reviewed_by_human'] ? 'Reviewer feedback' : 'AI feedback' }}:</b></span> {{ $q['feedback'] }}</p>
        @endif
    </div>
@empty
    <p class="muted">No answers were recorded.</p>
@endforelse

<h2>Exam conduct</h2>
@if ($data['integrity']['strikes'] === 0 && !$data['integrity']['locked'])
    <div class="callout good">No proctoring strikes were recorded during this sitting.</div>
@else
    <p>{{ $data['integrity']['strikes'] }} strike(s) recorded{{ $data['integrity']['locked'] ? '; the sitting was locked' : '' }}.</p>
    @if ($data['integrity']['events'])
        <table class="grid">
            <tr><th>What happened</th><th>Counted as a strike</th><th class="right">When</th></tr>
            @foreach ($data['integrity']['events'] as $k => $e)
                <tr class="{{ $k % 2 ? 'alt' : '' }}"><td>{{ $e['label'] }}</td><td>{{ $e['counted'] ? 'Yes' : 'No' }}</td><td class="right nowrap">{{ F::date($e['at'], true) }}</td></tr>
            @endforeach
        </table>
    @endif
@endif

<p class="small muted" style="margin-top:14px;">
    Marked {{ $r['scored_by'] === 'reviewer' ? 'by a reviewer' : ($r['scored_by'] === 'ai' ? 'automatically by the AI interviewer' : 'not yet') }}. Practice results help you prepare; they are not a hiring decision.
</p>
@endsection
