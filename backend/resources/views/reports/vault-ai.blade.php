@use('App\Support\ReportFormat', 'F')
@extends('reports.layout', [
    'reportTitle' => 'Vault AI Interview Report',
    'reportSubtitle' => ($data['college']['name'] ?? 'AptRun').' · '.F::date($data['generated_at']),
])

@section('content')
@php
    $st = $data['student'];
    $f = $data['final'];
    $tone = F::tone($f['average'], (int) $data['pass_mark'], 40);
@endphp

<table style="width:100%; border-collapse:collapse;"><tr>
    <td style="vertical-align:top;">
        <h1>{{ $st['name'] }}</h1>
        <p class="muted">{{ $st['roll_number'] ?: 'No roll number on file' }}@if ($st['branch']) · {{ $st['branch'] }}@endif @if ($st['section']) · Section {{ $st['section'] }}@endif</p>
        @if ($data['college']['name'])<p class="muted">{{ $data['college']['name'] }}@if ($data['college']['city']), {{ $data['college']['city'] }}@endif</p>@endif
        <p style="margin-top:6px;"><b>{{ $data['stack']['name'] }}</b>@if ($data['stack']['role']) <span class="muted">· {{ $data['stack']['role'] }}</span>@endif</p>
        <p class="small muted">Vault AI Interview: three sets, scored by the AI interviewer. The final average of the three sets decides the result — {{ (int) $data['pass_mark'] }}% or more qualifies for Mellow Vault.</p>
    </td>
    <td style="width:170px; vertical-align:top; text-align:right;">
        <div class="card soft" style="text-align:center;">
            <div class="kpi-label">Final average{{ $data['attempts'] > 1 ? ' (best series)' : '' }}</div>
            <div style="font-size:32px; font-weight:bold; line-height:1.1;" class="{{ $tone }}">{{ $f['average'] !== null ? rtrim(rtrim(number_format($f['average'], 2, '.', ''), '0'), '.') : '—' }}<span style="font-size:11px; color:#6B7280;">{{ $f['average'] !== null ? '%' : '' }}</span></div>
            <span class="badge {{ $tone }}">{{ $f['tier'] }}</span>
            <div class="small" style="margin-top:4px;">
                @if ($f['passed'])
                    <span class="good"><b>Qualified</b></span> for Mellow Vault
                @else
                    <span class="warn"><b>Below {{ (int) $data['pass_mark'] }}%</b></span> — not yet qualified
                @endif
            </div>
        </div>
    </td>
</tr></table>

@if ($f['by_admin'])
    <div class="callout warn" style="margin-top:8px;">This result was recorded by the AptRun team rather than from a sitting, so there are no answers to show.</div>
@endif

<h2>The three sets{{ $f['series'] ? ' — series '.$f['series'] : '' }}</h2>
@if (count($data['sets']) === 0)
    <p class="muted">No completed series yet.</p>
@else
    <table class="grid">
        <tr><th style="width:40px;">Set</th><th>Focus</th><th style="width:210px;">Score</th><th class="right" style="width:60px;">Result</th></tr>
        @foreach ($data['sets'] as $k => $set)
            @php $t = F::tone($set['score'], (int) $data['pass_mark'], 40); @endphp
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td><b>{{ $set['number'] }}</b></td>
                <td>{{ $set['title'] }}</td>
                <td>
                    <table style="width:100%; border-collapse:collapse;"><tr>
                        <td><div class="bar"><div class="fill {{ $t }}" style="width: {{ max(2, (int) $set['score']) }}%;"></div></div></td>
                        <td class="right nowrap" style="width:42px;"><b>{{ $set['score'] !== null ? $set['score'].'%' : '—' }}</b></td>
                    </tr></table>
                </td>
                <td class="right"><span class="badge {{ $t }}">{{ F::tone($set['score'], (int) $data['pass_mark'], 40) === 'good' ? 'Strong' : ($t === 'warn' ? 'Fair' : 'Weak') }}</span></td>
            </tr>
        @endforeach
        <tr>
            <td></td><td><b>Final average of the three sets</b></td>
            <td><b class="{{ $tone }}">{{ $f['average'] !== null ? rtrim(rtrim(number_format($f['average'], 2, '.', ''), '0'), '.') : '—' }}%</b></td>
            <td class="right"><span class="badge {{ $f['passed'] ? 'good' : 'warn' }}">{{ $f['passed'] ? 'Qualified' : 'Not yet' }}</span></td>
        </tr>
    </table>
    @if ($f['at'])<p class="small muted">Completed {{ F::date($f['at'], true) }} IST.</p>@endif
@endif

<h2>Every attempt</h2>
@if (count($data['history']) === 0)
    <p class="muted">Nothing completed yet.</p>
@else
    <table class="grid">
        <tr><th>#</th><th>Series</th><th>Set 1</th><th>Set 2</th><th>Set 3</th><th>Average</th><th>Result</th><th class="right">Completed</th></tr>
        @foreach ($data['history'] as $k => $e)
            <tr class="{{ $k % 2 ? 'alt' : '' }}">
                <td>{{ $k + 1 }}</td>
                <td>Series {{ $e['series'] }}@if ($e['is_best']) <span class="badge info">Best</span>@endif</td>
                @foreach (['1', '2', '3'] as $n)<td>{{ isset($e['scores'][$n]) ? $e['scores'][$n].'%' : '—' }}</td>@endforeach
                <td><b>{{ rtrim(rtrim(number_format($e['average'], 2, '.', ''), '0'), '.') }}%</b></td>
                <td><span class="badge {{ $e['passed'] ? 'good' : 'warn' }}">{{ $e['passed'] ? 'Qualified' : 'Below '.(int) $data['pass_mark'].'%' }}</span>@if (!empty($e['reset'])) <span class="small muted">(reset by AptRun)</span>@endif</td>
                <td class="right nowrap">{{ F::date($e['at']) }}</td>
            </tr>
        @endforeach
    </table>
    @if ($data['attempts'] > 1)<p class="small muted">The result on this report is the best series. A later, lower attempt never replaces it.</p>@endif
@endif

@foreach ($data['sets'] as $set)
    @if ($set['sitting'])
        @php $s = $set['sitting']; @endphp
        <div style="page-break-inside: avoid;">
        <h2>Set {{ $set['number'] }} in detail — {{ $set['title'] }}</h2>
        <p class="small muted">
            {{ $s['result']['score'] !== null ? round($s['result']['score']).'%' : 'No score' }}
            @if ($s['result']['completed_at']) · {{ F::date($s['result']['completed_at'], true) }} IST @endif
            @if ($s['result']['minutes']) · {{ $s['result']['minutes'] }} min @endif
            · {{ $s['result']['answered'] }} answer(s)
            @if ($s['integrity']['strikes'] > 0)
                · <span class="warn">{{ $s['integrity']['strikes'] }} proctoring strike(s)</span>
            @else
                · no proctoring strikes
            @endif
        </p>
        </div>
        @foreach ($s['questions'] as $q)
            <div class="keep" style="margin-bottom:8px; border:1px solid #E5E7EB; border-radius:6px; padding:7px 10px;">
                <table style="width:100%; border-collapse:collapse;"><tr>
                    <td><b>Q{{ $q['order'] }}</b>@if ($q['category']) <span class="tag">{{ F::humanise($q['category']) }}</span>@endif</td>
                    <td class="right nowrap" style="width:110px;"><span class="badge {{ F::tone($q['score']) }}">{{ $q['score'] !== null ? $q['score'].'%' : 'not scored' }}</span></td>
                </tr></table>
                <p style="margin:3px 0 4px 0;"><b>{{ $q['question'] }}</b></p>
                <div class="quote">{{ $q['answer'] !== '' ? \Illuminate\Support\Str::limit($q['answer'], 700) : '(no answer recorded)' }}</div>
                @if ($q['feedback'])<p class="small" style="margin:4px 0 0 0;"><span class="info"><b>{{ $q['reviewed_by_human'] ? 'Reviewer feedback' : 'AI feedback' }}:</b></span> {{ $q['feedback'] }}</p>@endif
            </div>
        @endforeach
    @endif
@endforeach

<p class="small muted" style="margin-top:14px;">Scored automatically by the AI interviewer. This report is a record of the Vault AI Interview as it stood on {{ F::date($data['generated_at']) }}; the best series is kept if the interview is taken again.</p>
@endsection
