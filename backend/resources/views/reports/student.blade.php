@use('App\Support\ReportFormat', 'F')
@extends('reports.layout', [
    'reportTitle' => 'Student Performance Report',
    'reportSubtitle' => ($data['college']['name'] ?? 'AptRun').' · '.F::date($data['generated_at']),
])

@section('content')
@php
    $s = $data['student'];
    $h = $data['headline'];
    $r = $data['readiness'];
    $n = $data['narrative'];
    $tierTone = match ($h['tier']) { 'Placement Ready' => 'good', 'In Progress' => 'info', default => 'warn' };
    $isStaff = $data['audience'] === 'staff';
@endphp

{{-- ───────────── Identity ───────────── --}}
<table style="width:100%; border-collapse:collapse;"><tr>
    <td style="vertical-align:top;">
        <h1>{{ $s['name'] }}</h1>
        <p class="muted">
            {{ $s['roll_number'] ?: 'No roll number on file' }}
            · {{ $s['branch'] ?: 'Branch not on file' }}@if ($s['section']) · Section {{ $s['section'] }}@endif
            @if (!empty($s['year_label'])) · {{ $s['year_label'] }}@endif
        </p>
        <p class="small muted">
            {{ $data['college']['name'] ?? 'Mellow Direct (no college)' }}@if (!empty($data['college']['city'])), {{ $data['college']['city'] }}@endif
            · {{ $s['email'] }}@if ($s['phone']) · {{ $s['phone'] }}@endif
            @if ($isStaff && !empty($s['parent_phone'])) · Parent: {{ $s['parent_phone'] }}@endif
        </p>
        <p class="small muted">
            CGPA {{ $s['cgpa'] ?? '—' }} · Backlogs {{ $s['backlogs'] ?? '—' }}
            · Member since {{ F::date($s['joined_at'] ?? null) }}
            · Last seen {{ F::date($s['last_seen_at'] ?? null) }}
            @if (!empty($s['is_blocked'])) · <span class="bad"><b>Account blocked</b></span>@endif
        </p>
    </td>
    <td style="width:150px; vertical-align:top; text-align:right;">
        <div class="card soft" style="text-align:center;">
            <div class="kpi-label">Readiness</div>
            <div style="font-size:30px; font-weight:bold; color:#06235E; line-height:1.1;">{{ $h['readiness'] }}<span style="font-size:11px; color:#6B7280;">/100</span></div>
            <span class="badge {{ $tierTone }}">{{ $h['tier'] }}</span>
        </div>
    </td>
</tr></table>

{{-- ───────────── Headline numbers ───────────── --}}
<h2>At a glance</h2>
<table class="kpis"><tr>
    <td><div class="kpi-label">Problems solved</div><div class="kpi-value">{{ $h['solved'] }}</div><div class="kpi-sub">{{ $data['coding']['solved']['easy']['solved'] }}E · {{ $data['coding']['solved']['medium']['solved'] }}M · {{ $data['coding']['solved']['hard']['solved'] }}H</div></td>
    <td><div class="kpi-label">Acceptance</div><div class="kpi-value {{ F::tone($h['acceptance_rate'], 60, 35) }}">{{ F::percent($h['acceptance_rate']) }}</div><div class="kpi-sub">{{ $h['submissions'] }} submissions</div></td>
    <td><div class="kpi-label">Streak</div><div class="kpi-value">{{ $h['streak'] }}<span style="font-size:9px;"> d</span></div><div class="kpi-sub">best {{ $h['best_streak'] }} · {{ $h['active_days_30'] }} active days / 30</div></td>
    <td><div class="kpi-label">Contest rating</div><div class="kpi-value" style="font-size:13px;">{{ $h['rating'] }}</div><div class="kpi-sub">{{ $h['contests'] }} contest(s) entered</div></td>
    <td><div class="kpi-label">AI interviews</div><div class="kpi-value {{ F::tone($h['interview_average']) }}">{{ F::percent($h['interview_average']) }}</div><div class="kpi-sub">{{ $h['interviews_completed'] }} completed</div></td>
    <td><div class="kpi-label">Soft skills</div><div class="kpi-value {{ F::tone($h['soft_skill_average']) }}">{{ F::percent($h['soft_skill_average']) }}</div><div class="kpi-sub">{{ count($data['soft_skills']) }} test(s)</div></td>
</tr></table>

{{-- ───────────── Summary ───────────── --}}
<h2>Summary</h2>
<div class="callout {{ $tierTone === 'good' ? 'good' : ($tierTone === 'warn' ? 'warn' : '') }}"><b>{{ $n['verdict'] }}</b></div>
<table class="two" style="margin-top:6px;"><tr>
    <td>
        <h3 class="good">What is going well</h3>
        @if ($n['strengths'])<ul class="tight">@foreach ($n['strengths'] as $line)<li>{{ $line }}</li>@endforeach</ul>@else<p class="muted">Nothing stands out yet — a few weeks of steady practice will change that.</p>@endif
    </td>
    <td>
        <h3 class="warn">Needs attention</h3>
        @if ($n['concerns'])<ul class="tight">@foreach ($n['concerns'] as $line)<li>{{ $line }}</li>@endforeach</ul>@else<p class="muted">No concerns on record.</p>@endif
    </td>
</tr></table>
@if ($n['actions'])
    <h3>Recommended next steps</h3>
    <ul class="tight">@foreach ($n['actions'] as $line)<li>{{ $line }}</li>@endforeach</ul>
@endif

{{-- ───────────── Readiness ───────────── --}}
<h2>Placement readiness</h2>
<table class="grid">
    <tr><th style="width:34%;">Component</th><th style="width:12%;" class="right">Score</th><th style="width:12%;" class="right">Weight</th><th style="width:12%;" class="right">Adds</th><th>&nbsp;</th></tr>
    @foreach ($r['components'] as $i => $c)
        <tr class="{{ $i % 2 ? 'alt' : '' }}">
            <td>{{ $c['label'] }}</td>
            <td class="right"><b>{{ $c['score'] }}</b></td>
            <td class="right muted">{{ $c['weight_percent'] }}%</td>
            <td class="right muted">+{{ number_format($c['contribution'], 1) }}</td>
            <td><div class="bar"><div class="fill {{ F::tone($c['score']) }}" style="width: {{ max(2, min(100, (int) $c['score'])) }}%;"></div></div></td>
        </tr>
    @endforeach
</table>
@if (count($r['trend']) > 1)
    @php $points = array_slice($r['trend'], -42); $line = $r['trend_summary']['threshold'] ?? 60; @endphp
    <h3>Readiness over the last {{ count($points) }} days
        @if (($r['trend_summary']['change_7d'] ?? null) !== null)
            <span class="small {{ $r['trend_summary']['change_7d'] >= 0 ? 'good' : 'bad' }}">({{ $r['trend_summary']['change_7d'] >= 0 ? '+' : '' }}{{ $r['trend_summary']['change_7d'] }} in 7 days)</span>
        @endif
    </h3>
    <table class="trend" style="width:100%; border-collapse:collapse; height:46px;"><tr>
        @foreach ($points as $p)
            <td style="height:46px;"><div class="col {{ $p['score'] >= $line ? 'hit' : '' }}" style="height: {{ max(2, (int) round($p['score'] * 0.44)) }}px;"></div></td>
        @endforeach
    </tr></table>
    <p class="small muted">Green bars are days at or above the Vault line ({{ $line }}). Best so far {{ $r['trend_summary']['best'] ?? $r['score'] }}@if (!empty($r['trend_summary']['tracking_since'])) · tracked since {{ F::date($r['trend_summary']['tracking_since']) }}@endif.</p>
@endif
@if (($r['eligible_drives']['active'] ?? 0) > 0)
    <p>Eligible for <b>{{ $r['eligible_drives']['eligible'] }}</b> of {{ $r['eligible_drives']['active'] }} drive(s) currently open at the college.</p>
@endif

{{-- ───────────── Coding ───────────── --}}
<h2>Coding practice</h2>
<table class="two"><tr>
    <td>
        <h3>Solved by difficulty</h3>
        @foreach (['easy' => 'Easy', 'medium' => 'Medium', 'hard' => 'Hard'] as $key => $label)
            @php $d = $data['coding']['solved'][$key]; $pct = $d['total'] > 0 ? (int) round($d['solved'] / $d['total'] * 100) : 0; @endphp
            <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
                <td style="width:48px;">{{ $label }}</td>
                <td><div class="bar"><div class="fill info" style="width: {{ max($d['solved'] > 0 ? 3 : 0, $pct) }}%;"></div></div></td>
                <td class="right nowrap" style="width:62px;"><b>{{ $d['solved'] }}</b> <span class="muted">/ {{ $d['total'] }}</span></td>
            </tr></table>
        @endforeach
    </td>
    <td>
        <h3>Verdicts on {{ $h['submissions'] }} submission(s)</h3>
        @forelse ($data['coding']['verdicts'] as $v)
            @php $pct = $h['submissions'] > 0 ? (int) round($v['count'] / $h['submissions'] * 100) : 0; @endphp
            <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
                <td style="width:92px;">{{ F::humanise($v['status']) }}</td>
                <td><div class="bar"><div class="fill {{ $v['status'] === 'accepted' ? 'good' : 'muted' }}" style="width: {{ max(3, $pct) }}%;"></div></div></td>
                <td class="right nowrap" style="width:62px;"><b>{{ $v['count'] }}</b> <span class="muted">{{ $pct }}%</span></td>
            </tr></table>
        @empty
            <p class="muted">No code submitted yet.</p>
        @endforelse
    </td>
</tr></table>

@php $langs = $data['coding']['languages']['languages'] ?? []; @endphp
@if ($langs)
    <h3>Languages</h3>
    <table class="grid">
        <tr><th>Language</th><th class="right">Solved</th><th class="right">Submissions</th><th class="right">Accepted</th><th>Read</th></tr>
        @foreach ($langs as $i => $l)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td><b>{{ F::language($l['language']) }}</b>@if (($data['coding']['languages']['actual_primary_language'] ?? null) === $l['language']) <span class="badge info">main</span>@endif</td>
                <td class="right">{{ $l['solved'] }}</td>
                <td class="right">{{ $l['attempts'] }}</td>
                <td class="right">{{ $l['acceptance_rate'] }}%</td>
                <td>{{ match ($l['proficiency'] ?? '') { 'strong' => 'Strong', 'getting_started' => 'Getting started', default => 'Steady' } }}</td>
            </tr>
        @endforeach
    </table>
    @if (!empty($data['coding']['languages']['stated']['primary_language']))
        <p class="small muted">Says they code in {{ F::language($data['coding']['languages']['stated']['primary_language']) }}@if (!empty($data['coding']['languages']['mismatch'])), but solves mostly in {{ F::language($data['coding']['languages']['actual_primary_language']) }}@endif.</p>
    @endif
@endif

@if ($data['coding']['topics_strong'] || $data['coding']['topics_weak'])
    <table class="two"><tr>
        <td><h3 class="good">Strongest topics</h3>
            @forelse ($data['coding']['topics_strong'] as $t)<span class="tag">{{ $t['topic'] }} · {{ $t['solved'] }}/{{ $t['total'] }} · {{ $t['accuracy'] }}%</span>@empty<p class="muted">Not enough solved problems yet.</p>@endforelse</td>
        <td><h3 class="bad">Weakest topics</h3>
            @forelse ($data['coding']['topics_weak'] as $t)<span class="tag">{{ $t['topic'] }} · {{ $t['accuracy'] }}%</span>@empty<p class="muted">No weak topic stands out.</p>@endforelse</td>
    </tr></table>
@endif

@if ($data['coding']['recent'])
    <h3>Latest submissions</h3>
    <table class="grid">
        <tr><th>Problem</th><th>Difficulty</th><th>Language</th><th>Verdict</th><th class="right">When</th></tr>
        @foreach ($data['coding']['recent'] as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ \Illuminate\Support\Str::limit($x['problem_title'], 46) }}@if ($x['kind'] === 'contest') <span class="badge muted">contest</span>@endif</td>
                <td>{{ ucfirst($x['difficulty']) }}</td>
                <td>{{ F::language($x['language']) }}</td>
                <td class="{{ $x['status'] === 'accepted' ? 'good' : 'bad' }}">{{ F::humanise($x['status']) }}</td>
                <td class="right nowrap">{{ F::date($x['submitted_at']) }}</td>
            </tr>
        @endforeach
    </table>
@endif

{{-- ───────────── Contests ───────────── --}}
<h2>Contests</h2>
@if ($data['contests'])
    <table class="grid">
        <tr><th>Contest</th><th>Type</th><th>Date</th><th class="right">Rank</th><th class="right">Score</th><th class="right">Solved</th><th class="right">Rating</th></tr>
        @foreach (array_slice($data['contests'], 0, 15) as $i => $c)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ \Illuminate\Support\Str::limit($c['title'], 44) }}</td>
                <td>{{ F::humanise($c['contest_type']) }}</td>
                <td class="nowrap">{{ F::date($c['start_at']) }}</td>
                <td class="right">{{ $c['rank'] ?? '—' }}</td>
                <td class="right">{{ $c['score'] ?? '—' }}</td>
                <td class="right">{{ $c['problems_solved'] }}/{{ $c['problem_count'] }}</td>
                <td class="right nowrap">@if ($c['rating_after'] !== null){{ $c['rating_before'] ?? '—' }} → <b>{{ $c['rating_after'] }}</b>@else — @endif</td>
            </tr>
        @endforeach
    </table>
@else
    <p class="muted">Has not entered a contest yet.</p>
@endif

{{-- ───────────── AI interviews ───────────── --}}
<h2>AI interviews</h2>
@if ($data['interviews']['rows'])
    <table class="grid">
        <tr><th>Interview</th><th>Kind</th><th>Date</th><th>Status</th><th class="right">Answers</th><th class="right">Score</th><th class="right">Strikes</th></tr>
        @foreach (array_slice($data['interviews']['rows'], 0, 18) as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ \Illuminate\Support\Str::limit($x['title'], 40) }}@if ($x['company']) <span class="muted">· {{ $x['company'] }}</span>@endif</td>
                <td>{{ $x['kind'] }}</td>
                <td class="nowrap">{{ F::date($x['date']) }}</td>
                <td>{{ F::humanise($x['status']) }}</td>
                <td class="right">{{ $x['answered'] }}</td>
                <td class="right {{ F::tone($x['score']) }}"><b>{{ $x['score'] !== null ? round($x['score']).'%' : '—' }}</b></td>
                <td class="right {{ $x['violations'] > 0 ? 'bad' : '' }}">{{ $x['violations'] }}{{ $x['locked'] ? ' · locked' : '' }}</td>
            </tr>
        @endforeach
    </table>
    @if ($data['interviews']['categories'])
        <h3>Average score by question type</h3>
        @foreach ($data['interviews']['categories'] as $c)
            <table style="width:100%; border-collapse:collapse; margin-bottom:3px;"><tr>
                <td style="width:130px;">{{ F::humanise($c['category']) }}</td>
                <td><div class="bar"><div class="fill {{ F::tone($c['average']) }}" style="width: {{ max(2, $c['average']) }}%;"></div></div></td>
                <td class="right nowrap" style="width:90px;"><b>{{ $c['average'] }}%</b> <span class="muted">· {{ $c['answers'] }} ans.</span></td>
            </tr></table>
        @endforeach
    @endif
@else
    <p class="muted">No AI interview taken yet.</p>
@endif

@if ($data['vault_ai'])
    <h3>Vault AI Interview qualification</h3>
    <table class="grid">
        <tr><th>Stack</th><th>Status</th><th class="right">Series average</th><th class="right">Attempt</th></tr>
        @foreach ($data['vault_ai'] as $i => $v)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ $v['stack'] }}</td>
                <td><span class="badge {{ $v['status'] === 'qualified' ? 'good' : ($v['status'] === 'cooling_down' ? 'warn' : 'muted') }}">{{ F::humanise($v['status']) }}</span></td>
                <td class="right">{{ F::percent($v['average']) }}</td>
                <td class="right">{{ $v['attempt'] }} / {{ $v['max_attempts'] }}</td>
            </tr>
        @endforeach
    </table>
@endif

{{-- ───────────── Soft skills & core ───────────── --}}
@if ($data['soft_skills'])
    <h2>Soft skills</h2>
    <table class="grid">
        <tr><th>Assessment</th><th>Type</th><th>Date</th><th class="right">Score</th><th>Result</th></tr>
        @foreach (array_slice($data['soft_skills'], 0, 10) as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ \Illuminate\Support\Str::limit($x['title'], 46) }}</td>
                <td>{{ F::humanise($x['assessment_type']) }}</td>
                <td class="nowrap">{{ F::date($x['completed_at']) }}</td>
                <td class="right {{ F::tone($x['score_percent']) }}"><b>{{ round($x['score_percent']) }}%</b></td>
                <td>{{ $x['passed'] ? 'Passed' : 'Not passed' }}</td>
            </tr>
        @endforeach
    </table>
@endif

@if (!empty($data['core']['subjects']))
    <h2>Core subjects (last 30 days)</h2>
    <table class="grid">
        <tr><th>Subject</th><th class="right">Questions answered</th><th class="right">Accuracy</th><th>&nbsp;</th></tr>
        @foreach ($data['core']['subjects'] as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td>{{ $x['name'] }}</td>
                <td class="right">{{ $x['attempts'] }}</td>
                <td class="right {{ F::tone($x['accuracy']) }}"><b>{{ $x['accuracy'] }}%</b></td>
                <td style="width:30%;"><div class="bar"><div class="fill {{ F::tone($x['accuracy']) }}" style="width: {{ max(2, $x['accuracy']) }}%;"></div></div></td>
            </tr>
        @endforeach
    </table>
@endif

{{-- ───────────── Placement ───────────── --}}
<h2>Placement pipeline</h2>
@if ($data['drives'])
    <table class="grid">
        <tr><th>Company</th><th>Role</th><th>Stage</th><th>Updated</th><th class="right">Offer</th></tr>
        @foreach ($data['drives'] as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td><b>{{ $x['company_name'] ?? $x['drive_title'] }}</b></td>
                <td>{{ $x['role_title'] ?? '—' }}</td>
                <td><span class="badge {{ in_array($x['stage'], ['offered', 'joined'], true) ? 'good' : (in_array($x['stage'], ['rejected', 'withdrawn'], true) ? 'bad' : 'info') }}">{{ F::humanise($x['stage']) }}</span></td>
                <td class="nowrap">{{ F::date($x['stage_updated_at']) }}</td>
                <td class="right">{{ $x['ctc_offered'] ?? '—' }}</td>
            </tr>
        @endforeach
    </table>
@else
    <p class="muted">Not in any drive pipeline yet.</p>
@endif

{{-- ───────────── Conduct ───────────── --}}
<h2>Exam conduct</h2>
@if ($data['conduct']['clean'])
    <div class="callout good">No proctoring strikes or lock-outs across {{ $data['conduct']['contest_sittings'] }} proctored contest sitting(s) and {{ count($data['interviews']['rows']) }} interview sitting(s).</div>
@else
    <table class="grid">
        <tr><th>Where</th><th class="right">Sittings</th><th class="right">Strikes</th><th class="right">Lock-outs</th></tr>
        <tr><td>Contests</td><td class="right">{{ $data['conduct']['contest_sittings'] }}</td><td class="right bad">{{ $data['conduct']['contest_violations'] }}</td><td class="right bad">{{ $data['conduct']['contest_lockouts'] }}</td></tr>
        <tr class="alt"><td>AI interviews</td><td class="right">{{ count($data['interviews']['rows']) }}</td><td class="right bad">{{ $data['conduct']['interview_violations'] }}</td><td class="right bad">{{ $data['conduct']['interview_lockouts'] }}</td></tr>
    </table>
@endif

{{-- ───────────── Notes (staff only) ───────────── --}}
@if ($isStaff && $data['notes'])
    <h2>Mentor follow-ups</h2>
    <table class="grid">
        <tr><th style="width:14%;">When</th><th style="width:18%;">By</th><th>Note</th><th style="width:16%;">Follow-up</th></tr>
        @foreach ($data['notes'] as $i => $x)
            <tr class="{{ $i % 2 ? 'alt' : '' }}">
                <td class="nowrap">{{ F::date($x['at']) }}</td>
                <td>{{ $x['author'] ?? '—' }}</td>
                <td>{{ \Illuminate\Support\Str::limit($x['body'], 260) }}</td>
                <td class="nowrap">@if ($x['follow_up_on']){{ F::date($x['follow_up_on']) }} {{ $x['resolved'] ? '· done' : '' }}@else — @endif</td>
            </tr>
        @endforeach
    </table>
@endif

<p class="small muted" style="margin-top:14px;">
    All figures are taken from AptRun's records at the moment this report was generated and describe activity on AptRun only.
    @if ($isStaff) This document contains personal data of {{ $s['name'] }}; share it only with people who need it for placement support. @endif
</p>
@endsection
