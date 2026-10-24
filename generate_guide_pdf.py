import base64
import os
import subprocess
import time

def build_pdf():
    # Read logo
    logo_path = r"D:\Dev\AptRun\aptRun Logo.png"
    with open(logo_path, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AptRun Complete Feature Guide & Executive User Manual</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 10mm 12mm 12mm 12mm;
  }}
  @media print {{
    body {{
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
    .page {{
      page-break-after: always;
      break-after: page;
      position: relative;
      height: 275mm;
      box-sizing: border-box;
    }}
    .no-break {{
      page-break-inside: avoid;
      break-inside: avoid;
    }}
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 8.5pt;
    line-height: 1.38;
  }}

  /* Page Container */
  .page {{
    padding: 2mm 2mm 6mm 2mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    min-height: 270mm;
  }}

  /* Header and Footer */
  .header-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0284c7;
    padding-bottom: 4px;
    margin-bottom: 10px;
  }}
  .header-title {{
    font-size: 8pt;
    font-weight: 700;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .header-tag {{
    background: #e0f2fe;
    color: #0369a1;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 7pt;
    font-weight: 700;
  }}
  .header-meta {{
    font-size: 7.5pt;
    color: #64748b;
  }}

  .footer-bar {{
    position: absolute;
    bottom: 2mm;
    left: 2mm;
    right: 2mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    font-size: 7.5pt;
    color: #94a3b8;
  }}

  /* Typography */
  h1 {{
    font-size: 17pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }}
  h2 {{
    font-size: 11pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-top: 8px;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  h3 {{
    font-size: 9pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 6px;
    margin-bottom: 3px;
  }}
  p {{
    font-size: 8.2pt;
    color: #334155;
    margin-bottom: 6px;
    line-height: 1.35;
  }}

  /* Stat Grids */
  .grid-4 {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }}
  .grid-2 {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }}

  .stat-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 6px 10px;
    border-left: 3px solid #0284c7;
  }}
  .stat-card.emerald {{
    border-left-color: #059669;
    background: #f0fdf4;
  }}
  .stat-card.indigo {{
    border-left-color: #4f46e5;
    background: #f5f3ff;
  }}
  .stat-card.amber {{
    border-left-color: #d97706;
    background: #fffbeb;
  }}
  .stat-val {{
    font-size: 14pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }}
  .stat-label {{
    font-size: 7pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #64748b;
    margin-top: 2px;
  }}
  .stat-sub {{
    font-size: 7.2pt;
    color: #475569;
    margin-top: 2px;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 8px;
    font-size: 8pt;
  }}
  th {{
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 7pt;
    letter-spacing: 0.05em;
    text-align: left;
    padding: 5px 7px;
    border: 1px solid #cbd5e1;
  }}
  td {{
    padding: 4.5px 7px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    line-height: 1.32;
    color: #1e293b;
  }}
  tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  /* Badges */
  .badge {{
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 6.8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }}
  .badge-blue {{ background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }}
  .badge-green {{ background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }}
  .badge-indigo {{ background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }}
  .badge-amber {{ background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }}
  .badge-rose {{ background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }}
  .badge-slate {{ background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }}

  /* Cards & Callouts */
  .callout {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 7px 10px;
    margin-bottom: 8px;
    border-left: 3.5px solid #2563eb;
  }}
  .callout.green {{
    border-left-color: #059669;
    background: #f0fdf4;
  }}
  .callout.amber {{
    border-left-color: #d97706;
    background: #fffbeb;
  }}
  .callout.indigo {{
    border-left-color: #4f46e5;
    background: #faf5ff;
  }}
  .callout-title {{
    font-size: 8pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    gap: 5px;
  }}
  .callout-body {{
    font-size: 7.8pt;
    color: #334155;
    line-height: 1.32;
  }}

  /* Workflow flex */
  .workflow-steps {{
    display: flex;
    gap: 6px;
    margin-bottom: 8px;
  }}
  .workflow-step {{
    flex: 1;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 6px 8px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }}
  .step-num {{
    font-size: 7pt;
    font-weight: 800;
    color: #0284c7;
    text-transform: uppercase;
  }}
  .step-title {{
    font-size: 7.8pt;
    font-weight: 700;
    color: #0f172a;
    margin: 1px 0 2px 0;
  }}
  .step-desc {{
    font-size: 7pt;
    color: #475569;
    line-height: 1.25;
  }}

  /* Code block */
  code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7.4pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }}

  /* Pill indicator */
  .pill {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 7pt;
    font-weight: 600;
  }}
  .dot {{
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }}
  .dot-green {{ background: #16a34a; }}
  .dot-blue {{ background: #2563eb; }}
  .dot-amber {{ background: #d97706; }}
</style>
</head>
<body>

<!-- ================= PAGE 1: COVER & EXECUTIVE SUMMARY ================= -->
<div class="page">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15mm; margin-bottom: 20mm; border-bottom: 2px solid #0284c7; padding-bottom: 12px;">
    <div style="display: flex; align-items: center; gap: 14px;">
      <img src="data:image/png;base64,{logo_b64}" alt="AptRun Logo" style="height: 48px; object-fit: contain;">
    </div>
    <div style="text-align: right;">
      <span class="badge badge-blue" style="font-size: 8pt; padding: 3px 8px;">Official Release 2026.10</span>
      <div style="font-size: 8pt; color: #64748b; margin-top: 4px;">Universal Multi-Dashboard Architecture</div>
    </div>
  </div>

  <div style="margin-bottom: 20mm;">
    <div style="font-size: 11pt; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px;">Enterprise Product & Technical Manual</div>
    <h1 style="font-size: 28pt; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 12px; letter-spacing: -0.03em;">
      AptRun Platform Complete Feature Guide
    </h1>
    <p style="font-size: 11pt; color: #334155; line-height: 1.5; max-width: 680px;">
      The definitive operational and architectural reference for AptRun — the AI-native campus placement, technical assessment, 
      and verified talent ecosystem bridging Students, University Placement Cells (TPOs), Faculty Coordinators, and Enterprise Hiring Partners.
    </p>
  </div>

  <!-- Key Metrics Banner -->
  <div class="grid-3" style="gap: 12px; margin-bottom: 15mm;">
    <div class="stat-card" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #0284c7; font-size: 18pt;">19 Runtimes</div>
      <div class="stat-label">Isolated Polyglot Judge</div>
      <div class="stat-sub">C++, Java, Python, Go, Rust, TS with live sub-second sandboxed execution</div>
    </div>
    <div class="stat-card emerald" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #059669; font-size: 18pt;">100-Pt ARS v4</div>
      <div class="stat-label">Algorithmic Readiness</div>
      <div class="stat-sub">Deterministic 7-factor competency scoring without academic bias</div>
    </div>
    <div class="stat-card indigo" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #4f46e5; font-size: 18pt;">70 Exam Papers</div>
      <div class="stat-label">1,750 Proctored MCQs</div>
      <div class="stat-sub">Quantitative, Logical, Verbal, and Situational Judgement libraries</div>
    </div>
    <div class="stat-card amber" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #d97706; font-size: 18pt;">5 Engineering Branches</div>
      <div class="stat-label">Deep Core Prep</div>
      <div class="stat-sub">CSE, ECE, EEE, Mechanical, Civil with scientific KaTeX testing</div>
    </div>
    <div class="stat-card" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #0f172a; font-size: 18pt;">Browser VS Code</div>
      <div class="stat-label">Project Lab Containers</div>
      <div class="stat-sub">Containerized OpenVSCode IDE with live web preview and client SOW PDFs</div>
    </div>
    <div class="stat-card emerald" style="padding: 10px 14px;">
      <div class="stat-val" style="color: #059669; font-size: 18pt;">Voice AI Mocks</div>
      <div class="stat-label">Gemini Speech Alignment</div>
      <div class="stat-sub">Dynamic technical & behavioral rounds with audio clarity and fluency analysis</div>
    </div>
  </div>

  <!-- Executive Table of Roles -->
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 15mm;">
    <div style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
      Ecosystem User Portals Covered in this Guide
    </div>
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 8pt;">
      <div>
        <strong>1. Student Arena & Learning Hub:</strong> Practice coding, proctored contests, multi-branch core prep, OpenVSCode Project Lab, Gemini AI voice mocks, SRS vocabulary, audio-first speaking, and cryptographic Vault credentials.
      </div>
      <div>
        <strong>2. College Placement Cell (TPO):</strong> Batch onboarding, 29-column cohort management, campus hiring drives, mock test scheduling, live proctoring anti-cheat radar, and 7 automated Excel/PDF placement intelligence reports.
      </div>
      <div>
        <strong>3. Recruiter / Corporate Hiring Hub:</strong> Pre-assessed talent pool discovery, university campus drive proposals, custom polyglot coding tests, asynchronous voice interview reviews, and tamper-proof credential verification.
      </div>
      <div>
        <strong>4. Section Coordinator & Superadmin Control:</strong> Faculty sub-cohort monitoring with weighted attention queues; Superadmin multi-tenant pricing, payment gateway reconciliation, safe user impersonation, and Judge scaling.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Confidential & Proprietary · Prepared for Enterprise Institutions & Corporate Partners</span>
    <span>Page 1 of 14</span>
  </div>
</div>

<!-- ================= PAGE 2: ARCHITECTURE & MULTI-TENANT ECOSYSTEM ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 1</span>
      <span>System Architecture & Multi-Tenant Persona Engine</span>
    </div>
    <div class="header-meta">AptRun Platform Architecture</div>
  </div>

  <h2>1. Unified Architectural Topology</h2>
  <p>
    AptRun operates as a high-throughput, decoupled platform separating student runtime interaction from institutional control logic.
    Student and administrative web sessions are served via Next.js with client-side state hydration, communicating with a resilient Laravel 11
    control plane backed by PostgreSQL/MySQL, Redis caching, isolated container workers, and direct AI inference engines.
  </p>

  <div class="callout indigo">
    <div class="callout-title">Core Security Philosophy: Zero Untrusted Execution on Web Hosts</div>
    <div class="callout-body">
      Student code submissions never execute on web or API application nodes. All execution occurs across isolated Piston Docker execution
      clusters with strict memory caps (256 MB), CPU quotas (1.5 cores), and aggressive network isolation. Project Lab browser workspaces run in
      independent Caddy-routed OpenVSCode containers with restricted Linux capabilities (<code>--cap-drop ALL</code>, <code>no-new-privileges</code>).
    </div>
  </div>

  <h2>2. Multi-Role Permission & Persona Access Matrix</h2>
  <p>
    Access is strictly regulated via Role-Based Access Control (RBAC) enforced at both route middleware (<code>routes/api.php</code>) and service scopes.
    Internal operations personnel possess fine-grained permission flags, while tenant data is strictly quarantined by institution.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">User Persona</th>
        <th style="width: 14%;">Portal Route</th>
        <th style="width: 28%;">Primary Operational Capabilities</th>
        <th style="width: 25%;">Tenant Isolation & Data Boundaries</th>
        <th style="width: 15%;">Enforced Role</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Student Coder</strong></td>
        <td><code>/dashboard</code><br><code>/arena</code></td>
        <td>Solve DSA, take proctored tests, build container projects, practice speaking/vocabulary, track ARS score, apply to drives.</td>
        <td>Sees personal progress, college-mapped drives, and public platform contents. Cannot access peer codes or logs.</td>
        <td><span class="badge badge-green">role: user</span></td>
      </tr>
      <tr>
        <td><strong>College TPO</strong></td>
        <td><code>/admin</code><br>(TPO View)</td>
        <td>Batch onboarding, 29-col student cohort directory, drive scheduling, mock assessments, anti-cheat reinstatement, 7 reports.</td>
        <td>Strictly scoped to their college. Cannot inspect candidates or drives of other universities.</td>
        <td><span class="badge badge-blue">role: admin_tpo</span></td>
      </tr>
      <tr>
        <td><strong>Section Coordinator</strong></td>
        <td><code>/coordinator</code></td>
        <td>Faculty sub-cohort monitoring, attention ranking queue, daily intervention logging, section test proctoring, account blocks.</td>
        <td>Strictly bound to assigned college, section, and branch scope. Cannot access other sections.</td>
        <td><span class="badge badge-blue">role: section_coord</span></td>
      </tr>
      <tr>
        <td><strong>Hiring Partner</strong></td>
        <td><code>/admin/company</code></td>
        <td>Propose campus drives, post openings, search verified Vault talent pool, custom coding/aptitude tests, review AI mocks.</td>
        <td>Isolated corporate tenant. Other companies' drives and candidate pipelines return 404.</td>
        <td><span class="badge badge-indigo">role: admin_company</span></td>
      </tr>
      <tr>
        <td><strong>Mellow Ops Staff</strong></td>
        <td><code>/admin</code><br>(Mellow View)</td>
        <td>Content authoring: DSA problem bank, 70 soft skill sets, Core Prep syllabus banks, company drive curation, customer success.</td>
        <td>Granted granular permission tokens (e.g. <code>perm:problem_bank</code>, <code>perm:vault</code>).</td>
        <td><span class="badge badge-amber">role: admin_internal</span></td>
      </tr>
      <tr>
        <td><strong>Platform Superadmin</strong></td>
        <td><code>/superadmin</code></td>
        <td>Global pricing, plan limits, seat allocation, PayU/Razorpay reconciliation, write-locked user impersonation, Judge scaling.</td>
        <td>Unrestricted platform governance. Every action recorded in immutable audit ledger.</td>
        <td><span class="badge badge-rose">role: superadmin</span></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Real-Time Entitlement Synchronization Engine</h2>
  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Lightweight Plan-Signal Polling (<code>GET /api/me/plan-signal</code>)</div>
      <div class="callout-body">
        To prevent persistent WebSocket worker exhaustion on PHP-FPM, open dashboards poll a sub-millisecond cryptographic signature every
        30 seconds (and on window focus/tab restore). When an administrator modifies a student's plan, extends days, or adjusts limits, the
        signature instantly drifts, triggering <code>SUBSCRIPTION_CHANGED_EVENT</code> across the frontend without requiring a page reload.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Zero-Cached Entitlement Enforcement</div>
      <div class="callout-body">
        While the frontend reflects real-time UI states, every backend API call evaluates authorization dynamically against the database
        (<code>Plan::scopePaidTier</code>, <code>User::projectLabCoverage()</code>). If a plan expires or is revoked, locked features terminate
        immediately on the next HTTP payload.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Architecture & Multi-Tenant Persona Engine</span>
    <span>Page 2 of 14</span>
  </div>
</div>

<!-- ================= PAGE 3: STUDENT ARENA - PRACTICE, CONTESTS & CORE PREP ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.1</span>
      <span>Student Arena: Code Practice, Contests & Core Engineering</span>
    </div>
    <div class="header-meta">Student Dashboard (/dashboard)</div>
  </div>

  <h2>1. Monaco Polyglot Code Practice Arena</h2>
  <p>
    The Practice Arena (<code>/dashboard/practice</code>) delivers a high-performance, developer-grade algorithmic training ground.
    Students practice across 19 modern programming languages with real-time Monaco editor autocomplete, linting, and custom test input capabilities.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">19 Runtimes</div>
      <div class="stat-label">Compiler Engines</div>
      <div class="stat-sub">C, C++, Java, Python, Go, Rust, C#, PHP, JS, TS, etc.</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">&lt; 850 ms</div>
      <div class="stat-label">Execution Latency</div>
      <div class="stat-sub">Warm Piston runner pools deliver near-instant verdicts</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">5 Verdicts</div>
      <div class="stat-label">Evaluation Engine</div>
      <div class="stat-sub">AC (Accepted), WA, TLE (Time Limit), MLE, CE</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">Company Tags</div>
      <div class="stat-label">Interview Mapping</div>
      <div class="stat-sub">Filtered by Google, Amazon, Microsoft, TCS, Infosys</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Feature Component</th>
        <th style="width: 48%;">Technical & User Capabilities</th>
        <th style="width: 30%;">Operational Boundaries & Plan Rules</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Monaco Code Console</strong></td>
        <td>Syntax highlighting, bracket pairing, multi-cursor editing, theme toggles, and memory/time limit benchmarks per problem.</td>
        <td>Remembers student draft code in local cache per language until submitted.</td>
      </tr>
      <tr>
        <td><strong>Custom Test Runner</strong></td>
        <td>Allows running arbitrary custom test inputs before submission; outputs stdout, stderr, execution wall-clock time, and memory consumed.</td>
        <td>Throttled to prevent runner denial-of-service; max 2 MB output buffer.</td>
      </tr>
      <tr>
        <td><strong>Multi-Language Submissions</strong></td>
        <td>Full test suite evaluation with hidden edge cases. Historical attempt viewer enables line-by-line inspection of previously submitted solutions.</td>
        <td>Free Coder: 1 problem/day.<br>Expert / College: Unlimited submissions.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Weekly Proctored Contests & Elo Rating System</h2>
  <p>
    AptRun hosts weekly rated contests and private college mock contests (<code>/dashboard/contests</code>). Contest skill is tracked
    via an Elo-based competitive rating starting at 1200, categorized into Divisions 1–3 and 1–7 Star mastery tiers.
  </p>

  <div class="workflow-steps">
    <div class="workflow-step">
      <div class="step-num">Step 1: Check-In</div>
      <div class="step-title">Hardware Verification</div>
      <div class="step-desc">Camera and microphone access validated; proctoring service initializes tamper tokens.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 2: Fullscreen Lock</div>
      <div class="step-title">Strict Environment</div>
      <div class="step-desc">Browser enters forced fullscreen; devtools, keyboard shortcuts, and right-clicks blocked.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 3: 3-Strike Rule</div>
      <div class="step-title">Anti-Cheat Enforcement</div>
      <div class="step-desc">Tab blur or window exit flags Strike 1 & 2. Strike 3 triggers immediate automatic code submission and lock.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 4: Scoreboard</div>
      <div class="step-title">Live Dynamic Ranking</div>
      <div class="step-desc">Problems weighted by difficulty and time penalty; global and college leaderboards update live.</div>
    </div>
  </div>

  <h2>3. Multi-Branch Core Engineering Prep (ECE, EEE, Mechanical, Civil)</h2>
  <p>
    Recognizing that engineering placements extend beyond software coding, AptRun delivers dedicated Core Prep (<code>/dashboard/core</code>)
    for core branches. Students selecting "Core First" or "Balanced" tracks practice branch fundamentals and take timed, proctored subject mock tests.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Core Engineering Module</th>
        <th style="width: 48%;">Syllabus & Capabilities</th>
        <th style="width: 30%;">Assessment Engine Rules</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Electronics & Comm. (ECE)</strong></td>
        <td>Digital Electronics, Microprocessors (8085/8086/ARM), Signals & Systems, Analog Circuits, VLSI Design, Electromagnetics.</td>
        <td rowspan="4">
          <strong>Timed Proctored Testing:</strong><br>
          • Server-synchronized countdown clock.<br>
          • Negative marking (e.g., +1.0 / -0.25).<br>
          • On-screen Scientific Calculator.<br>
          • KaTeX rendering for circuit & mechanical formulas.<br>
          • Instant worked step-by-step solutions.<br>
          • Topic mastery tracking (75% threshold).
        </td>
      </tr>
      <tr>
        <td><strong>Electrical Eng. (EEE)</strong></td>
        <td>Circuit Theory, Power Systems, Electrical Machines, Control Systems, Power Electronics, Renewable Energy Systems.</td>
      </tr>
      <tr>
        <td><strong>Mechanical Eng. (ME)</strong></td>
        <td>Thermodynamics, Strength of Materials, Fluid Mechanics, Manufacturing Technology, Kinematics & Dynamics, Machine Design.</td>
      </tr>
      <tr>
        <td><strong>Civil Engineering (CE)</strong></td>
        <td>Structural Analysis, RCC & Steel Design, Geotechnical & Soil Mechanics, Surveying, Fluid Mechanics, Transportation Eng.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Student Arena: Code Practice, Contests & Core Prep</span>
    <span>Page 3 of 14</span>
  </div>
</div>

<!-- ================= PAGE 4: STUDENT ARENA - LEARNING CENTRE & SOFT SKILLS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.2</span>
      <span>Student Arena: AI Learning Centre & Soft Skills Library</span>
    </div>
    <div class="header-meta">Student Dashboard (/dashboard/learning-centre)</div>
  </div>

  <h2>1. Vocabulary Sprint: Spaced Repetition (SRS) Engine</h2>
  <p>
    The Vocabulary Sprint module (<code>/dashboard/learning-centre/vocabulary</code>) builds professional and interview-grade communication
    confidence. It features 160 hand-curated workplace and technical words organized across 8 progressive decks, managed by a 6-box Leitner SRS model.
  </p>

  <div class="grid-3">
    <div class="stat-card">
      <div class="stat-val">160 Words</div>
      <div class="stat-label">Core Lexicon</div>
      <div class="stat-sub">Handpicked corporate, algorithmic, and boardroom vocabulary</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">6 Leitner Boxes</div>
      <div class="stat-label">Spaced Retention</div>
      <div class="stat-sub">Box 0 (Today) → Box 1 (1d) → Box 2 (3d) → Box 3 (7d) → Box 4 (16d) → Box 5 (35d)</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">4 Question Angles</div>
      <div class="stat-label">Progressive Difficulty</div>
      <div class="stat-sub">Meaning match → Word selection → Sentence fill → Active memory spelling</div>
    </div>
  </div>

  <div class="callout">
    <div class="callout-title">SRS Progression Mechanics: Deterministic Memory Reinforcement</div>
    <div class="callout-body">
      A word advances to the next box only when successfully answered on or after its due date. An incorrect answer immediately drops the word
      two boxes (never below Box 0) and marks it due today. Mastered status requires reaching Box 4 or Box 5. Custom Gemini-generated vocabulary
      drills allow students to practice words in specialized technical domains.
    </div>
  </div>

  <h2>2. Audio-First Speaking Practice with Gemini Evaluation</h2>
  <p>
    Speaking Practice (<code>/dashboard/learning-centre/speaking</code>) eliminates the speech coaching bottleneck. Students read curated interview
    passages or AI-synthesized custom topics aloud, receiving precise phonetics, pacing, and grammatical alignment scores.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Evaluation Dimension</th>
        <th style="width: 48%;">Scoring Logic & Algorithm</th>
        <th style="width: 28%;">Privacy & Performance Safeguards</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Speech Alignment Accuracy (35%)</strong></td>
        <td>Deterministic server-side dynamic time warping (<code>SpeechAlignment</code>) compares transcribed audio against passage text to catch missed or inserted words.</td>
        <td rowspan="4">
          <strong>Strict Audio Privacy:</strong><br>
          • Voice recordings processed in memory only.<br>
          • <strong>Zero permanent audio storage.</strong><br>
          • Browser speech-to-text is client caption only; Gemini receives raw audio to eliminate client spoofing.<br>
          • Hardware voice activity detector blocks muted recordings with 0 requests.
        </td>
      </tr>
      <tr>
        <td><strong>Pronunciation Clarity (35%)</strong></td>
        <td>Gemini evaluates acoustic clarity, phonetic vowel articulation, and word endings, flagging words needing a second listen.</td>
      </tr>
      <tr>
        <td><strong>Fluency & Pace (30%)</strong></td>
        <td>Measures words-per-minute (WPM), hesitation pause durations, and filler frequencies (e.g., "um", "uh", "like"). Penalty applied if pace &lt; 90 WPM.</td>
      </tr>
      <tr>
        <td><strong>Composite Score & Threshold</strong></td>
        <td>Overall = <code>0.35×Accuracy + 0.35×Clarity + 0.30×Fluency</code>. Scaled downward if Accuracy &lt; 85%. Pass threshold is 60%.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Listening Lab: Corporate Comprehension</h2>
  <p>
    Listening Practice (<code>/dashboard/learning-centre/listening</code>) trains students for multinational client calls and technical meetings.
    Comprises 24 graded audio lessons spanning accent variations, technical problem descriptions, requirement briefings, and timed Q&A quizzes.
  </p>

  <h2>4. Standardized Soft Skills Library: 70 Pre-Built Exam Sets</h2>
  <p>
    AptRun provides a library of 70 numbered, standardized examination sets (<code>/dashboard/soft-skills</code>), comprising 1,750 questions
    calibrated to industry placement assessments (TCS NQT, Infosys, Accenture, Capgemini, Cognizant).
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Question Category</th>
        <th style="width: 15%;">Questions / Set</th>
        <th style="width: 45%;">Syllabus & Placement Focus</th>
        <th style="width: 18%;">Scoring Engine</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Quantitative Aptitude</strong></td>
        <td>8 Questions</td>
        <td>Arithmetic, Time & Work, Speed-Distance, Profit & Loss, Percentages, Permutations, Probability, Geometry.</td>
        <td rowspan="4">
          • Standard 25 Qs / 30 mins.<br>
          • Instant automated marking.<br>
          • Percentile ranking vs peers.<br>
          • Category-wise weakness radar.<br>
          • Directly feeds 10% of ARS.
        </td>
      </tr>
      <tr>
        <td><strong>Logical Reasoning</strong></td>
        <td>7 Questions</td>
        <td>Deductive logic, Syllogisms, Blood Relations, Coding-Decoding, Seating Arrangements, Pattern Series.</td>
      </tr>
      <tr>
        <td><strong>Verbal Ability / English</strong></td>
        <td>6 Questions</td>
        <td>Sentence Correction, Spotting Errors, Reading Comprehension, Para Jumbles, Vocabulary in Context.</td>
      </tr>
      <tr>
        <td><strong>Situational Judgement</strong></td>
        <td>4 Questions</td>
        <td>Workplace ethics, Conflict resolution, Team collaboration, Professional escalation, Priority management.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Student Arena: AI Learning Centre & Soft Skills</span>
    <span>Page 4 of 14</span>
  </div>
</div>

<!-- ================= PAGE 5: STUDENT ARENA - PROJECT LAB & AI MOCK INTERVIEWS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.3</span>
      <span>Student Arena: Project Lab & Conversational AI Interviews</span>
    </div>
    <div class="header-meta">Student Dashboard (/dashboard/projects & /dashboard/interviews)</div>
  </div>

  <h2>1. Project Lab: In-Browser Containerized VS Code Workspace</h2>
  <p>
    Project Lab (<code>/dashboard/projects</code>) bridges the gap between toy algorithmic scripts and enterprise full-stack development.
    Students pick industry-grade applications (E-commerce marketplaces, hospital systems, LMS, analytics engines) and develop them inside an
    embedded, dedicated OpenVSCode Server container running on AptRun workspace hosts.
  </p>

  <div class="workflow-steps">
    <div class="workflow-step">
      <div class="step-num">Step 1</div>
      <div class="step-title">Statement of Work</div>
      <div class="step-desc">Download client SOW PDF, watermarked with student email and verification hash.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 2</div>
      <div class="step-title">1-Click Container Spinup</div>
      <div class="step-desc">Dedicated Docker workspace launches in seconds with pre-installed Node.js, Python, Git.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 3</div>
      <div class="step-title">Live App Preview</div>
      <div class="step-desc">Secondary iframe renders running student application via reverse wildcard Caddy proxy.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 4</div>
      <div class="step-title">Code Snapshot & Review</div>
      <div class="step-desc">Submits tarball snapshot for milestone review, lint checking, and verified Vault badge.</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Infrastructure Component</th>
        <th style="width: 48%;">Technical Implementation</th>
        <th style="width: 30%;">Limits & Resource Governance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Workspace Runtime</strong></td>
        <td>OpenVSCode Server inside hardened Ubuntu container; SSH control-plane orchestration via Laravel <code>WorkspaceManager</code>.</td>
        <td>Resource envelope: 1.5 CPU cores, 2 GB RAM, 10 GB persistent storage volume per student.</td>
      </tr>
      <tr>
        <td><strong>Caddy Wildcard Gateway</strong></td>
        <td>Routes <code>ws-&lt;id&gt;.ws.domain</code> to VS Code and <code>p&lt;port&gt;--ws-&lt;id&gt;.ws.domain</code> to student's running web server.</td>
        <td>Automatic TLS certificates; subdomains isolated between concurrent student sessions.</td>
      </tr>
      <tr>
        <td><strong>Usage Accounting</strong></td>
        <td>Container heartbeat daemon monitors active window focus; idle workspaces reaped automatically after 15 minutes.</td>
        <td><strong>Expert / Grandmaster:</strong> 80 active workspace-hours / month; max 3 concurrent projects.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Voice & Text Conversational AI Mock Interviews</h2>
  <p>
    The AI Mock Interview engine (<code>/dashboard/interviews</code>) replicates rigorous corporate technical and behavioral interview panels.
    Powered by tuned Gemini models, the system conducts real-time conversational interviews, listens to spoken responses, formulates dynamic
    follow-up probes, and produces actionable rubric evaluations.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">Real Voice</div>
      <div class="stat-label">Speech-to-Speech</div>
      <div class="stat-sub">Synthetic interviewer voice with browser microphone capture</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">Contextual</div>
      <div class="stat-label">Adaptive Follow-Ups</div>
      <div class="stat-sub">Challenges vague answers and probes edge cases dynamically</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">4 Rubrics</div>
      <div class="stat-label">Comprehensive Scoring</div>
      <div class="stat-sub">Problem Solving, Tech Correctness, Communication, Code Quality</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">20% of ARS</div>
      <div class="stat-label">High-Impact Pillar</div>
      <div class="stat-sub">Average of last 5 scored interviews feeds Placement Readiness</div>
    </div>
  </div>

  <h2>3. Company-Targeted Interview Tracks</h2>
  <p>
    Students can select curated roadmaps for specific corporate interview formats (<code>/dashboard/interview-tracks</code>). Each track includes
    company-specific syllabus rounds (Online Assessment, Data Structures, System Design, HR/Cultural Fit):
  </p>
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 7.8pt;">
    <div class="callout" style="margin-bottom: 0;">
      <strong>Product Tier-1:</strong> Google, Amazon, Microsoft, Meta tracks focusing on algorithmic complexity, trees/graphs, and scalable system design.
    </div>
    <div class="callout green" style="margin-bottom: 0;">
      <strong>Enterprise IT Services:</strong> TCS Digital/Ninja, Infosys DSE/SE, Wipro Turbo, Cognizant GenC Next tracks targeting core CS, SQL, and aptitude.
    </div>
    <div class="callout indigo" style="margin-bottom: 0;">
      <strong>Core Engineering:</strong> 13 dedicated role templates for ECE/EEE/ME/Civil (VLSI Design Engineer, Embedded Firmware, Power Systems, CAD/CAM).
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Student Arena: Project Lab & Conversational AI Interviews</span>
    <span>Page 5 of 14</span>
  </div>
</div>

<!-- ================= PAGE 6: STUDENT ARENA - READINESS (ARS v4) & VAULT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.4</span>
      <span>Student Arena: Placement Readiness Score (ARS v4) & Vault</span>
    </div>
    <div class="header-meta">Student Dashboard (/dashboard/vault & /dashboard/reports)</div>
  </div>

  <h2>1. AptRun Readiness Score (ARS v4): Deterministic 0–100 Rating</h2>
  <p>
    The AptRun Readiness Score (ARS v4) is an objective, deterministic 0–100 composite index calculated exclusively from demonstrated
    student performance. Unlike traditional college systems, ARS excludes academic CGPA and backlogs from the score itself (which are evaluated
    separately for drive eligibility cutoffs), ensuring equal opportunity for self-taught engineers and non-traditional candidates.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Scoring Pillar</th>
        <th style="width: 14%;">Software Weight</th>
        <th style="width: 14%;">Balanced Weight</th>
        <th style="width: 14%;">Core Tech Weight</th>
        <th style="width: 38%;">Measurement Metric & Recent-Form Window</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>AI Mock Interviews</strong></td>
        <td><strong>20 Points</strong></td>
        <td>20 Points</td>
        <td>20 Points</td>
        <td>Average score of the last 5 completed technical & HR AI interviews within 180 days.</td>
      </tr>
      <tr>
        <td><strong>Core Technical Subject</strong></td>
        <td>—</td>
        <td><strong>20 Points</strong></td>
        <td><strong>30 Points</strong></td>
        <td>60% recent proctored Core test performance + 40% syllabus topic mastery (≥75% accuracy over ≥5 attempts).</td>
      </tr>
      <tr>
        <td><strong>Coding Practice Depth</strong></td>
        <td><strong>15 Points</strong></td>
        <td>10 Points</td>
        <td>—</td>
        <td>Catalog breadth & depth: Easy (20 pts), Medium (40 pts), Hard (40 pts) plus algorithmic topic coverage.</td>
      </tr>
      <tr>
        <td><strong>Learning Centre Modules</strong></td>
        <td><strong>15 Points</strong></td>
        <td>10 Points</td>
        <td>15 Points</td>
        <td>Speaking Practice (40%), Listening Lab (30%), Vocabulary SRS Mastery (30%) across recent 5 sessions.</td>
      </tr>
      <tr>
        <td><strong>Contest Performance</strong></td>
        <td><strong>15 Points</strong></td>
        <td>5 Points</td>
        <td>—</td>
        <td>Percentage of total available contest points scored across last 5 rated contests. Elo rating acts as floor.</td>
      </tr>
      <tr>
        <td><strong>Practice Consistency</strong></td>
        <td><strong>15 Points</strong></td>
        <td>15 Points</td>
        <td>15 Points</td>
        <td>Active practice days in the trailing 28 days (12 active days = maximum 15 points credit).</td>
      </tr>
      <tr>
        <td><strong>Soft Skills Mastery</strong></td>
        <td><strong>10 Points</strong></td>
        <td>10 Points</td>
        <td>10 Points</td>
        <td>Average score across the last 5 completed standardized Soft Skill assessments.</td>
      </tr>
      <tr>
        <td><strong>Events & Project Submissions</strong></td>
        <td><strong>10 Points</strong></td>
        <td>10 Points</td>
        <td>10 Points</td>
        <td>Verifiable participation: Hackathon submissions, Project Lab milestones, and college mock tests over 90 days.</td>
      </tr>
      <tr style="background: #f1f5f9; font-weight: 700;">
        <td>Total Composite ARS</td>
        <td>100 Points</td>
        <td>100 Points</td>
        <td>100 Points</td>
        <td>30-Day Go-Live Grace: Core students retain the higher of Software vs Core score during transition.</td>
      </tr>
    </tbody>
  </table>

  <div class="grid-3" style="margin-top: 6px;">
    <div class="stat-card emerald">
      <div class="stat-val">≥ 75 ARS</div>
      <div class="stat-label">Placement Ready</div>
      <div class="stat-sub">Fast-tracked for Tier-1 corporate drives and high CTC hiring pools</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">45 – 74 ARS</div>
      <div class="stat-label">In Progress</div>
      <div class="stat-sub">Active training phase; eligible for general and mid-tier campus drives</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">&lt; 45 ARS</div>
      <div class="stat-label">Needs Training</div>
      <div class="stat-sub">Flagged in Section Coordinator queue for remedial intervention (&lt;60 is At-Risk)</div>
    </div>
  </div>

  <h2>2. The Mellow Vault: Verifiable Cryptographic Credentials</h2>
  <p>
    The Vault (<code>/dashboard/vault</code>) transforms student work into cryptographically verifiable credentials. Once a student's ARS
    reaches <strong>60 points</strong> and they possess an eligible plan (Expert, Grandmaster, or College Enterprise), they can opt into the Vault.
  </p>

  <div class="grid-2">
    <div class="callout green">
      <div class="callout-title">Direct Enterprise Visibility & Headhunting</div>
      <div class="callout-body">
        Opted-in Vault profiles sync bi-directionally with Mellow Vault, enabling pre-vetted corporate recruiters to browse verified portfolios,
        inspect actual Project Lab repositories, review AI interview transcripts, and issue direct hiring offers without preliminary screening.
      </div>
    </div>
    <div class="callout indigo">
      <div class="callout-title">Comprehensive Performance Report PDF</div>
      <div class="callout-body">
        Students can download an official 4-page verified performance dossier stamped with cryptographic verification hashes, QR authentication,
        readiness radar breakdowns, solved DSA metrics, and language competency breakdown.
      </div>
    </div>
  </div>

  <h2>3. Campus Placement Drives Pipeline (Student View)</h2>
  <p>
    Students track all upcoming and active placement drives (<code>/dashboard#placement-drives</code>). The system automatically evaluates
    eligibility criteria (minimum CGPA, allowed active backlogs, mandatory branch, and minimum ARS cutoff) before allowing registration.
    Candidates follow each round in real-time: <code>Applied → Shortlisted → Online Assessment → Interview Round → Offer Extended</code>.
  </p>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Student Arena: Placement Readiness (ARS v4) & Vault</span>
    <span>Page 6 of 14</span>
  </div>
</div>

<!-- ================= PAGE 7: COLLEGE PLACEMENT HUB - COHORT & COORDINATORS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 3.1</span>
      <span>College Placement Hub (TPO): Batch Onboarding & Cohort Oversight</span>
    </div>
    <div class="header-meta">College Admin Dashboard (/admin & /admin/students)</div>
  </div>

  <h2>1. TPO Command Center & Institutional Intelligence</h2>
  <p>
    The Training & Placement Officer (TPO) Command Center (<code>/admin</code>) delivers high-level operational oversight across the entire graduating batch.
    Placement officers monitor the institutional placement funnel, real-time batch readiness distribution, branch-wise placement percentages,
    and average CTC growth metrics across all engineering disciplines.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">29 Columns</div>
      <div class="stat-label">Student Master Schema</div>
      <div class="stat-sub">Comprehensive tracking from academics to granular skill scores</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">1-Click Import</div>
      <div class="stat-label">Bulk Excel / CSV Onboarding</div>
      <div class="stat-sub">Validates duplicates, maps branches, issues temporary activation tokens</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Real-Time Funnel</div>
      <div class="stat-label">Drive Conversion</div>
      <div class="stat-sub">Tracks Registered → Shortlisted → Interviewed → Offered → Accepted</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">&lt; 60 ARS Filter</div>
      <div class="stat-label">At-Risk Early Warning</div>
      <div class="stat-sub">Instantly isolates candidates falling behind before drive season</div>
    </div>
  </div>

  <h2>2. Student Cohort Management & 360° Inspection Drawer</h2>
  <p>
    The Student Cohort directory (<code>/admin/students</code>) provides search, multi-faceted filtering, and granular inspection of every enrolled student.
    Clicking any student row opens the slide-out <strong>Student 360° Management Drawer</strong>, exposing four detailed dimensions:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Drawer Tab</th>
        <th style="width: 50%;">Information Displayed & Audit Telemetry</th>
        <th style="width: 30%;">Administrative Control Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Overview & Academics</strong></td>
        <td>Official Roll Number, Email, Phone, Parent Contact, Branch, Section, Current CGPA, Active Backlogs, Placement Drive Eligibility Status.</td>
        <td>Edit academic credentials, correct branch/section mapping, update personal contacts.</td>
      </tr>
      <tr>
        <td><strong>2. Placement Readiness</strong></td>
        <td>Current ARS v4 score breakdown (Interviews, Coding, Core, Soft Skills, Consistency), historical score trajectory, and 7-day practice velocity.</td>
        <td>Trigger manual score recalculation; export student individual performance dossier PDF.</td>
      </tr>
      <tr>
        <td><strong>3. Submissions & Code</strong></td>
        <td>Chronological log of recent 80 practice problems and contest submissions. Full syntax-highlighted source code viewer with test results.</td>
        <td>Inspect code quality, investigate plagiarism flags, review contest attempt timelines.</td>
      </tr>
      <tr>
        <td><strong>4. Coordinator History</strong></td>
        <td>Chronological log of all interventions: faculty calls, meetings, notes, remediation plans, and coordinator account block actions.</td>
        <td>Review faculty follow-up accountability; escalate student welfare concerns.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Section Coordinator Delegation & Collision-Free Scoping</h2>
  <p>
    To scale supervision across batches of thousands of students, TPOs delegate supervisory authority to faculty members via
    Section Coordinators (<code>/admin/coordinators</code>). Each coordinator is granted a targeted sub-cohort restricted by Section and Branch.
  </p>

  <div class="callout indigo">
    <div class="callout-title">Branch Scoping Engine: Collision-Free Allocation Guarantee</div>
    <div class="callout-body">
      Coordinators can be assigned to an entire section (e.g. "Section A") or narrowed to specific branches (e.g. "Section A - CSE" vs "Section A - ECE").
      The server strictly refuses overlapping scopes: two coordinators can never cover the same student. If unmapped branches exist, the TPO dashboard
      highlights <strong>"N students not covered"</strong> with a 1-click reassignment wizard.
    </div>
  </div>

  <div class="workflow-steps">
    <div class="workflow-step">
      <div class="step-num">Step 1</div>
      <div class="step-title">Faculty Invitation</div>
      <div class="step-desc">TPO provisions coordinator account with institutional email and department.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 2</div>
      <div class="step-title">Scope Assignment</div>
      <div class="step-desc">Binds coordinator to designated Section and Branch families (CSE, ECE, ME, etc.).</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 3</div>
      <div class="step-title">Autonomous Action</div>
      <div class="step-desc">Coordinator accesses dedicated <code>/coordinator</code> portal with ranked attention queue.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Step 4</div>
      <div class="step-title">TPO Oversight</div>
      <div class="step-desc">All coordinator logs and student contact notes automatically surface in TPO master cohort drawer.</div>
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>College Placement Hub: Cohort & Section Coordinators</span>
    <span>Page 7 of 14</span>
  </div>
</div>

<!-- ================= PAGE 8: COLLEGE PLACEMENT HUB - TESTS, DRIVES & REPORTS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 3.2</span>
      <span>College Placement Hub (TPO): Assessments, Drives & Reports</span>
    </div>
    <div class="header-meta">College Admin Dashboard (/admin/drives & /admin/reports)</div>
  </div>

  <h2>1. Campus Placement Drives & Corporate Funnel Management</h2>
  <p>
    The Campus Drives portal (<code>/admin/drives</code>) empowers placement teams to manage end-to-end recruitment pipelines.
    TPOs can create proprietary college hiring drives or map verified drives syndicated from AptRun’s enterprise hiring catalogue.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Drive Configuration</th>
        <th style="width: 48%;">Rules & Algorithmic Enforcement</th>
        <th style="width: 30%;">Stage Progression Tracking</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Eligibility Criteria Engine</strong></td>
        <td>TPOs set strict cutoffs: Minimum CGPA (e.g. 7.5), Maximum Active Backlogs (e.g. 0), Allowed Engineering Branches, and Minimum ARS Threshold (e.g. 65).</td>
        <td rowspan="3">
          <strong>Full Funnel Pipeline:</strong><br>
          1. <strong>Registered:</strong> Verified applicants.<br>
          2. <strong>Shortlisted:</strong> TPO approved.<br>
          3. <strong>Assessment / OA:</strong> Scores logged.<br>
          4. <strong>Interview Rounds:</strong> Technical/HR.<br>
          5. <strong>Offered:</strong> Package (CTC) recorded.<br>
          6. <strong>Accepted / Declined:</strong> Official count.
        </td>
      </tr>
      <tr>
        <td><strong>Catalog Drive Mapping</strong></td>
        <td>Browse corporate hiring drives posted by AptRun partners. 1-click mapping makes the drive visible to eligible students in the college.</td>
      </tr>
      <tr>
        <td><strong>Shortlist & Offer Recording</strong></td>
        <td>Publish company shortlists, schedule on-campus interview slots, record final CTC offers (LPA), and track student acceptance contracts.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Institutional Proctored Assessments & Core Mock Tests</h2>
  <p>
    Colleges schedule college-wide mock coding contests (<code>/admin/mock-contests</code>), AI interview mock drives (<code>/admin/mock-interviews</code>),
    and department core engineering tests (<code>/admin/mock-core-tests</code>) to benchmark student readiness under simulated exam conditions.
  </p>

  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Live Anti-Cheat Proctoring Monitor (<code>/admin/proctoring</code>)</div>
      <div class="callout-body">
        Real-time proctoring console streaming active test integrity signals. Flags webcam disconnections, multi-face detections, fullscreen escapes,
        and tab-switch blur counts. Displays live student strikes with an administrative <strong>One-Click Reinstatement</strong> button for verified false positives.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">AI Interview Score Overrides & Transcript Review</div>
      <div class="callout-body">
        TPOs can inspect asynchronous student AI mock interview recordings and full verbatim transcripts. While Gemini generates baseline rubric scores,
        faculty retain full authority to override technical scores and append proprietary developmental feedback.
      </div>
    </div>
  </div>

  <h2>3. The 7 Automated Institutional Placement Reports (Excel & PDF)</h2>
  <p>
    The TPO Reports engine (<code>/admin/reports</code>) generates 7 comprehensive, audit-ready operational spreadsheets and executive PDFs
    built dynamically from live production data. All reports support filtering by graduating batch, department, and section.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Report Name</th>
        <th style="width: 50%;">Core Content & Analytics Included</th>
        <th style="width: 25%;">Format & Audience</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Student Cohort Master</strong></td>
        <td>Complete 29-column roster: personal contacts, branch, section, CGPA, backlogs, ARS score, language competency, signed-in status.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Master Record</td>
      </tr>
      <tr>
        <td><strong>2. Placement Readiness Summary</strong></td>
        <td>Batch-wide readiness distribution: Ready (≥75), In Progress (45–74), Needs Training (&lt;45) with component score breakdowns.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Executive TPO</td>
      </tr>
      <tr>
        <td><strong>3. At-Risk Student Roster</strong></td>
        <td>Isolates all students with ARS &lt; 60 or low practice consistency (&lt;3 days/month), detailing specific weakness components.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Remedial Faculty</td>
      </tr>
      <tr>
        <td><strong>4. Campus Drive Shortlist</strong></td>
        <td>Filtered applicant rosters for specific visiting companies, confirming academic eligibility and verified technical badges.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Visiting Recruiters</td>
      </tr>
      <tr>
        <td><strong>5. Assessment Attendance & Scores</strong></td>
        <td>Detailed results for proctored contests, core engineering tests, and soft skills exams with question-level breakdown.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Department HODs</td>
      </tr>
      <tr>
        <td><strong>6. Programming Language Competency</strong></td>
        <td>Language adoption distribution across C++, Java, Python, JavaScript with solve depth and submission accuracy ratings.</td>
        <td><span class="badge badge-green">Excel XLSX</span> · Curriculum Review</td>
      </tr>
      <tr>
        <td><strong>7. Section Performance Comparison</strong></td>
        <td>Comparative cross-section benchmarks showing coordinator coverage, daily streaks, mock test participation, and average ARS.</td>
        <td><span class="badge badge-blue">Excel & PDF</span> · Dean / Principal</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>College Placement Hub: Tests, Drives & Reports</span>
    <span>Page 8 of 14</span>
  </div>
</div>

<!-- ================= PAGE 9: RECRUITER HIRING HUB - PIPELINE & CANDIDATE SEARCH ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 4.1</span>
      <span>Recruiter Hiring Hub: Campus Pipeline & Candidate Discovery</span>
    </div>
    <div class="header-meta">Recruiter Dashboard (/admin/company)</div>
  </div>

  <h2>1. Corporate Hiring Command Center</h2>
  <p>
    The Hiring Partner portal (<code>/admin/company</code>) provides enterprise talent acquisition teams with a modern, end-to-end university recruiting engine.
    Recruiters manage campus recruitment campaigns, discover pre-assessed engineering talent, and track candidate progression with zero administrative friction.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">11 Hub Tools</div>
      <div class="stat-label">Full Hiring Suite</div>
      <div class="stat-sub">From college discovery to proctored testing and verified hiring</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">0 Inactive Resumes</div>
      <div class="stat-label">Verified Activity</div>
      <div class="stat-sub">Candidates ranked strictly by real-world coding and interview telemetry</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Direct Campus Access</div>
      <div class="stat-label">University Directory</div>
      <div class="stat-sub">1-click proposals to accredited Tier-1, Tier-2, and Tier-3 institutions</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">100% Data Isolation</div>
      <div class="stat-label">Private Pipelines</div>
      <div class="stat-sub">Proprietary job openings and applicant pools strictly segregated</div>
    </div>
  </div>

  <h2>2. Accredited Partner Colleges Directory & Drive Proposals</h2>
  <p>
    Corporate recruiters can browse AptRun’s network of partner universities (<code>/admin/company/colleges</code>).
    Recruiters filter institutions by accreditation tier, geographic region, and graduating batch size, then propose recruitment drives directly to college TPOs.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Proposal Workflow Stage</th>
        <th style="width: 45%;">Operational Action</th>
        <th style="width: 30%;">Privacy & Access Constraints</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Discovery & Selection</strong></td>
        <td>Search partner colleges by university tier (Tier 1 / 2 / 3), city, state, and engineering student headcount.</td>
        <td>Aggregate statistics displayed; individual student rosters are hidden prior to mutual agreement.</td>
      </tr>
      <tr>
        <td><strong>2. Drive Proposal Dispatch</strong></td>
        <td>Attach a defined Job Opening (Role, CTC Package, Hiring Timeline, Eligibility Cutoffs) and submit proposal to College TPO.</td>
        <td>Proposal lands in college TPO's inbox; status tracked as <code>Pending → Approved → Declined</code>.</td>
      </tr>
      <tr>
        <td><strong>3. Activation & Application</strong></td>
        <td>Upon TPO approval, the drive immediately publishes into the college’s student dashboard.</td>
        <td>Eligible students apply directly; applications flow into the company's candidate pipeline.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Pre-Assessed Talent Pool & Candidate Search Engine</h2>
  <p>
    Rather than waiting for applications, enterprise recruiters can proactively scout engineering candidates via the
    <strong>Pre-Assessed Talent Pool</strong> (<code>/admin/company/candidates</code> & <code>/admin/company/talent-pool</code>).
    Every candidate has demonstrated hands-on technical proficiency validated by the AptRun platform.
  </p>

  <div class="callout green">
    <div class="callout-title">Multi-Vector Technical Search Filters</div>
    <div class="callout-body">
      Recruiters can filter pre-assessed candidates across multiple verified vectors:
      <strong>Placement Readiness Score (ARS)</strong> range, <strong>Primary Coding Language</strong> (Python, Java, C++, TypeScript),
      <strong>Core Engineering Discipline</strong> (CSE, ECE, EEE, Mechanical, Civil), <strong>Verified Project Lab Badges</strong>,
      and <strong>Academic Cutoffs</strong> (minimum CGPA, zero backlogs).
    </div>
  </div>

  <h2>4. Candidate Outreach & Hiring Pipeline Funnel</h2>
  <p>
    Recruiters track all applicants across customized multi-stage hiring funnels:
    <code>Registered / Sourced → Shortlisted → Proctored Assessment → Asynchronous AI Interview → Technical Panel → Final Offer</code>.
    One-click bulk actions allow recruiters to dispatch assessment invitations, schedule panel rounds, and issue offer letters with automated candidate notifications.
  </p>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Recruiter Hiring Hub: Pipeline & Candidate Discovery</span>
    <span>Page 9 of 14</span>
  </div>
</div>

<!-- ================= PAGE 10: RECRUITER HIRING HUB - CUSTOM TESTING & VAULT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 4.2</span>
      <span>Recruiter Hiring Hub: Custom Testing & Vault Verification</span>
    </div>
    <div class="header-meta">Recruiter Dashboard (/admin/company/assessments & /admin/company/vault)</div>
  </div>

  <h2>1. Custom Technical Coding & Soft Skills Assessments</h2>
  <p>
    Hiring partners can author bespoke, proctored entrance assessments (<code>/admin/company/assessments</code>) mapped directly to active job openings.
    Tests can combine algorithmic coding challenges with standardized aptitude and behavioral screening.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Assessment Type</th>
        <th style="width: 48%;">Features & Authoring Capabilities</th>
        <th style="width: 30%;">Proctoring & Integrity Safeguards</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Algorithmic Coding Tests</strong></td>
        <td>Select problems from AptRun's shared library or author proprietary problem statements with private test cases across 19 programming languages.</td>
        <td rowspan="2">
          <strong>Full Anti-Cheat Suite:</strong><br>
          • Automated webcam face presence monitoring.<br>
          • Fullscreen escape & window blur tracking.<br>
          • Server-enforced 3-strike auto-submission.<br>
          • Code playback timeline (replay keystrokes).<br>
          • Cross-candidate code similarity analysis.
        </td>
      </tr>
      <tr>
        <td><strong>Soft Skills & Aptitude Screening</strong></td>
        <td>1-click selection from 70 pre-calibrated soft skill question papers (Quantitative, Logical, Verbal, Situational) or custom MCQ authoring.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Asynchronous AI & Technical Panel Interview Evaluation</h2>
  <p>
    Recruiters review candidate mock and preliminary interview performances (<code>/admin/company/interviews</code>).
    The system displays full verbatim conversation transcripts, audio playback of candidate responses, and Gemini rubric breakdowns across Technical Correctness, Communication, and Problem Solving.
  </p>

  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">AI Rubric Transparency with Human Override</div>
      <div class="callout-body">
        Recruiters can inspect why an answer received specific ratings, review highlighted technical inaccuracies, and manually adjust candidate
        scores or record internal interviewer remarks before proceeding to in-person panel interviews.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Asynchronous Video & Audio Playback</div>
      <div class="callout-body">
        Spoken responses are stored privately for review by the authorized hiring organization. Interview recordings can be played back at 1.0x,
        1.25x, or 1.5x speeds with synchronized transcript highlighting to accelerate hiring triage.
      </div>
    </div>
  </div>

  <h2>3. Verified Vault Credentials: Zero Resume Fraud</h2>
  <p>
    The Vault Verification portal (<code>/admin/company/vault</code>) allows recruiters to authenticate candidate claims against tamper-proof,
    cryptographically verified performance telemetry. Resume inflation is completely eliminated.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Verified Artifact</th>
        <th style="width: 48%;">Proof-of-Work Telemetry Inspected</th>
        <th style="width: 28%;">Recruiter Advantage</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Project Lab Artifacts</strong></td>
        <td>Inspect complete source code snapshots, Git commit histories, and running container previews of student full-stack capstones.</td>
        <td>Verifies actual software engineering craftsmanship rather than static claimed GitHub links.</td>
      </tr>
      <tr>
        <td><strong>Algorithmic Skill Rating</strong></td>
        <td>Elo contest rating trajectory, star division badges, and verified submission counts under timed proctored conditions.</td>
        <td>Guarantees genuine problem-solving speed without reliance on external unverified badges.</td>
      </tr>
      <tr>
        <td><strong>Spoken English & Fluency</strong></td>
        <td>Verified pronunciation accuracy (SpeechAlignment), words-per-minute pacing, and situational judgment scores.</td>
        <td>Accelerates screening for client-facing and global corporate consulting roles.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Enterprise Hiring Analytics & Reports</h2>
  <p>
    Recruiters monitor campus recruitment ROI via live analytics (<code>/admin/company/reports</code>): Time-to-Hire, Offer-Acceptance Ratios,
    Funnel Drop-Off Points, and Cross-University Quality Benchmarks. Full candidate datasets can be exported to Excel for corporate ATS integration (Workday, Greenhouse, Lever).
  </p>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Recruiter Hiring Hub: Custom Testing & Vault Verification</span>
    <span>Page 10 of 14</span>
  </div>
</div>

<!-- ================= PAGE 11: SECTION COORDINATOR & HACK ARENA ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 5</span>
      <span>Faculty Section Coordinator & Standalone Hack Arena</span>
    </div>
    <div class="header-meta">Coordinator (/coordinator) & Hack Arena (/arena)</div>
  </div>

  <h2>1. Section Coordinator Command Center (Faculty Supervisor)</h2>
  <p>
    Section Coordinators (<code>/coordinator</code>) are departmental faculty members delegated responsibility over specific classroom sections.
    Unlike high-level placement directors, coordinators focus on granular daily engagement, student welfare, attendance monitoring, and targeted remedial intervention.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">Ranked Queue</div>
      <div class="stat-label">Needs Attention</div>
      <div class="stat-sub">Top 12 students auto-prioritized by risk severity algorithm</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">Follow-Up Log</div>
      <div class="stat-label">Intervention Tracking</div>
      <div class="stat-sub">Log calls, in-person meetings, parental notes with due dates</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Live Proctoring</div>
      <div class="stat-label">Section Integrity</div>
      <div class="stat-sub">Real-time anti-cheat view isolated to their classroom students</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">Account Blocks</div>
      <div class="stat-label">Disciplinary Holds</div>
      <div class="stat-sub">Temporary holds with mandatory reason text visible to TPO</div>
    </div>
  </div>

  <h2>2. Algorithmic "Needs Attention" Priority Engine</h2>
  <p>
    Coordinators do not guess which students need help. AptRun computes a real-time risk score sorting the 12 most critical students to the top:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Trigger Condition</th>
        <th style="width: 14%;">Risk Points</th>
        <th style="width: 44%;">Underlying Reason & Operational Context</th>
        <th style="width: 14%;">Urgency Level</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Locked out of Contest</strong></td>
        <td><strong>+ 50 Pts</strong></td>
        <td>Student received 3 proctoring strikes or security lockout; needs immediate review to reinstate.</td>
        <td><span class="badge badge-rose">Immediate</span></td>
      </tr>
      <tr>
        <td><strong>Follow-Up Overdue</strong></td>
        <td><strong>+ 45 Pts</strong></td>
        <td>A scheduled counseling call or remedial milestone passed without completion.</td>
        <td><span class="badge badge-rose">Immediate</span></td>
      </tr>
      <tr>
        <td><strong>Follow-Up Due Today</strong></td>
        <td><strong>+ 35 Pts</strong></td>
        <td>Action item scheduled for today's follow-up queue.</td>
        <td><span class="badge badge-amber">High</span></td>
      </tr>
      <tr>
        <td><strong>Never Signed In</strong></td>
        <td><strong>+ 30 Pts</strong></td>
        <td>Account provisioned by TPO but student has not completed first-time password setup.</td>
        <td><span class="badge badge-amber">High</span></td>
      </tr>
      <tr>
        <td><strong>Dormant Account</strong></td>
        <td><strong>+ 25 Pts</strong></td>
        <td>Zero platform practice activity recorded in the past 14 consecutive days.</td>
        <td><span class="badge badge-blue">Medium</span></td>
      </tr>
      <tr>
        <td><strong>Needs Training Tier</strong></td>
        <td><strong>+ 15 Pts</strong></td>
        <td>Current ARS readiness score is below 45 points.</td>
        <td><span class="badge badge-slate">Remedial</span></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Standalone Hack Arena Portal (<code>/arena</code>)</h2>
  <p>
    The Hack Arena is a full-screen competitive hackathon portal (<code>/arena</code>) distinct from standard dashboard pages.
    Hosted by AptRun Mellow Ops and corporate hiring sponsors, it fosters hands-on engineering innovation, team collaboration, and prize-winning hackathons.
  </p>

  <div class="workflow-steps">
    <div class="workflow-step">
      <div class="step-num">Phase 1</div>
      <div class="step-title">Team Formation</div>
      <div class="step-desc">Students register solo or form multi-member teams with custom invite codes.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Phase 2</div>
      <div class="step-title">Problem Reveal</div>
      <div class="step-desc">Host reveals themes, architectural constraints, APIs, and evaluation rubrics.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Phase 3</div>
      <div class="step-title">Multi-Stage Submission</div>
      <div class="step-desc">Teams submit project proposals, GitHub repo links, live demo URLs, and video pitches.</div>
    </div>
    <div class="workflow-step">
      <div class="step-num">Phase 4</div>
      <div class="step-title">Jury Scoring & Awards</div>
      <div class="step-desc">Evaluators score across Innovation, Feasibility, Code Quality, and UI/UX.</div>
    </div>
  </div>

  <div class="callout green">
    <div class="callout-title">Audience Scope & Access Governance</div>
    <div class="callout-body">
      Hackathons can be published to <strong>All Platform Students</strong> or restricted to <strong>Specific Partner Colleges</strong>.
      College TPOs cannot edit or cancel corporate hackathons (preventing external interference), while corporate sponsors gain direct access to finalist codebases and team members for placement hiring.
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Section Coordinator & Standalone Hack Arena</span>
    <span>Page 11 of 14</span>
  </div>
</div>

<!-- ================= PAGE 12: SUPERADMIN MASTER CONTROL - PRICING & GOVERNANCE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 6.1</span>
      <span>Superadmin Master Control: Plans, Pricing & Governance</span>
    </div>
    <div class="header-meta">Superadmin Master Console (/superadmin)</div>
  </div>

  <h2>1. Superadmin Master Executive Console</h2>
  <p>
    The Superadmin Master Console (<code>/superadmin</code>) is the central administrative nervous system of AptRun.
    Restricted strictly to <code>role: superadmin</code>, it controls platform-wide subscription economics, tenant provisioning,
    financial reconciliation, internal staff permissions, and immutable security governance.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">Dynamic Pricing</div>
      <div class="stat-label">Plans & Limits Engine</div>
      <div class="stat-sub">Live adjustments to list prices, discounts, and feature quotas</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">Gateway Audit</div>
      <div class="stat-label">PayU & Razorpay Sync</div>
      <div class="stat-sub">Automated reconciliation of orders, webhooks, and offline grants</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Safe Impersonation</div>
      <div class="stat-label">"View as User" Mode</div>
      <div class="stat-sub">Diagnostic session with strict server-enforced write-locks</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">100% Audit Log</div>
      <div class="stat-label">Immutable Security</div>
      <div class="stat-sub">Every administrative modification logged with actor IP & reason</div>
    </div>
  </div>

  <h2>2. Plans & Dynamic Pricing Engine</h2>
  <p>
    AptRun manages three distinct student plan tiers. Superadmins adjust prices and limits in real-time without redeploying software:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Subscription Tier</th>
        <th style="width: 16%;">Commercial Model</th>
        <th style="width: 38%;">Feature Entitlements & Daily Limits</th>
        <th style="width: 28%;">Administrative Controls</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Coder (Free Plan)</strong></td>
        <td>Free on signup; never expires.</td>
        <td>1 coding problem/day, 1 lifetime AI mock interview try, 1 lifetime Speaking/Vocabulary AI try, access to ready-made soft skills.</td>
        <td>Default tier for self-registered students. Cannot access Project Lab or Vault.</td>
      </tr>
      <tr>
        <td><strong>Expert (Annual Plan)</strong></td>
        <td>Self-serve checkout via PayU / Razorpay; 1 Year (365 days).</td>
        <td>Unlimited coding practice, 10 AI voice mocks/day, unlimited Learning Centre, <strong>Project Lab access</strong> (80 hrs/mo), <strong>The Vault</strong>, Hack Arena.</td>
        <td>Superadmin sets List Price, Sale Price, and Discount percentage live in Plans & Pricing tab.</td>
      </tr>
      <tr>
        <td><strong>Grandmaster (Mellow Academy)</strong></td>
        <td>Sold exclusively offline by admissions team; 3 Years (1,095 days).</td>
        <td>Full Expert feature set + complete Mellow Academy development curriculum (MERN, Laravel, Mobile Apps) with assured placement guarantee.</td>
        <td>Marked <code>contact_only = true</code>. Cannot be bought self-serve; granted manually by Superadmin.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Manual Subscription Overrides & Offline Payment Grants</h2>
  <p>
    Superadmins can manually grant, extend, or terminate plans (<code>/superadmin?tab=subscriptions</code>):
  </p>

  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Manual Grant: "Give a Plan"</div>
      <div class="callout-body">
        Enables granting Expert or Grandmaster to a student for 1 to 1,825 days. A mandatory audit <strong>Reason</strong> is required.
        Can be recorded as <em>Free of Charge</em> (price=0, excluded from recurring revenue) or <em>Paid Outside Gateway</em> (fee recorded, converts marketing lead).
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Subscription Extension & Cancellation</div>
      <div class="callout-body">
        <strong>Extend:</strong> Appends days to <code>current_period_end</code> without modifying historical price.
        <strong>Cancel:</strong> Immediately reverts student to free Coder plan. Cancelling a college or company plan requires re-entering the Superadmin password.
      </div>
    </div>
  </div>

  <h2>4. Identity Governance & Safe "View As User" Impersonation</h2>
  <p>
    To resolve customer support inquiries, superadmins can inspect any account through the <strong>360° Accounts Drawer</strong>:
  </p>
  <ul>
    <li><strong>Password Visibility:</strong> Superadmins can inspect system-generated temporary passwords issued to college-imported students. Once a student personalizes their password, it becomes cryptographically irreversibly hashed.</li>
    <li><strong>Global Session Revocation:</strong> Instantly invalidates all active Sanctum bearer tokens across all devices for compromised accounts.</li>
    <li><strong>Write-Locked Impersonation ("View As User"):</strong> Superadmins generate an impersonation token (<code>impersonation:&lt;id&gt;</code>). The middleware (<code>RejectWritesWhileImpersonating</code>) rejects all state-mutating requests (POST, PUT, DELETE) with 403, preventing accidental data modification while inspecting student or TPO views.</li>
  </ul>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Superadmin Master Control: Plans, Pricing & Governance</span>
    <span>Page 12 of 14</span>
  </div>
</div>

<!-- ================= PAGE 13: SUPERADMIN MASTER CONTROL - INFRASTRUCTURE & OPS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 6.2</span>
      <span>Superadmin Master Control: Infrastructure, Scaling & Operations</span>
    </div>
    <div class="header-meta">Superadmin Master Console (/superadmin?tab=infrastructure)</div>
  </div>

  <h2>1. Judge Execution Infrastructure & 1,000-Student Scale Rig</h2>
  <p>
    The AptRun automated judge cluster is engineered to sustain concurrent semester examination spikes exceeding 1,000 active students simultaneously.
    The Infrastructure dashboard (<code>/superadmin?tab=infrastructure</code>) monitors runtime health, Piston worker queues, and execution latencies.
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">1,000+ Users</div>
      <div class="stat-label">Concurrent Scale</div>
      <div class="stat-sub">Verified under rigorous 1,000-student load test harness</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">Piston Engines</div>
      <div class="stat-label">Sandboxed Workers</div>
      <div class="stat-sub">Isolated container runtimes with warm compiler pools</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Redis Broker</div>
      <div class="stat-label">Asynchronous Queues</div>
      <div class="stat-sub">Buffers burst contest submissions during high-traffic finishes</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">99.99% Target</div>
      <div class="stat-label">Cluster Uptime</div>
      <div class="stat-sub">Automated health checks and worker failover routing</div>
    </div>
  </div>

  <h2>2. Immutable Security Audit Ledger</h2>
  <p>
    Security compliance is guaranteed via an append-only Audit Log (<code>/superadmin?tab=audit</code>). Every administrative intervention,
    plan override, student block, and configuration modification is cryptographically recorded:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Audit Field</th>
        <th style="width: 52%;">Telemetry Recorded</th>
        <th style="width: 30%;">Compliance & Security Value</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Actor Identification</strong></td>
        <td>Authenticated User ID, Full Name, Admin Role (Superadmin, Internal Ops, TPO), and Origin IPv4/IPv6 address.</td>
        <td>Definitive accountability; eliminates shared credential ambiguity.</td>
      </tr>
      <tr>
        <td><strong>Target Entity</strong></td>
        <td>Target entity model (<code>User</code>, <code>Plan</code>, <code>Subscription</code>, <code>College</code>, <code>Contest</code>) and primary key.</td>
        <td>Instant isolation of all actions affecting a specific customer or institution.</td>
      </tr>
      <tr>
        <td><strong>Action & Payload Diff</strong></td>
        <td>Action verb (<code>plan.grant</code>, <code>student.block</code>, <code>price.update</code>) and serialized before/after JSON diff.</td>
        <td>Provides complete audit trail for rollbacks and financial compliance.</td>
      </tr>
      <tr>
        <td><strong>Mandatory Reason</strong></td>
        <td>User-entered textual justification required on all write modals before the backend executes the mutation.</td>
        <td>Prevents arbitrary or undocumented administrative changes.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Central Mellow Operations Control (Ops Toolset)</h2>
  <p>
    Superadmins and Mellow Operations staff manage universal platform curriculum assets accessible across all dashboards:
  </p>

  <div class="grid-3">
    <div class="callout" style="margin-bottom: 0;">
      <div class="callout-title">Universal Problem Bank</div>
      <div class="callout-body">
        Author and curate multi-language algorithmic problems. Configure public examples, hidden edge test cases, execution constraints, topic tags, and official editorial solutions.
      </div>
    </div>
    <div class="callout green" style="margin-bottom: 0;">
      <div class="callout-title">Core Prep Question Importer</div>
      <div class="callout-body">
        Bulk CSV/Excel importer for ECE, EEE, Mechanical, and Civil question banks. Features automated dry-run syntax verification, KaTeX formula parsing, and item analysis.
      </div>
    </div>
    <div class="callout indigo" style="margin-bottom: 0;">
      <div class="callout-title">Project Lab Blueprints</div>
      <div class="callout-body">
        Author real-world project templates. Configure container base images, pre-installed packages, milestone tasks, client SOW text, and grading criteria.
      </div>
    </div>
  </div>

  <h2>4. Marketing Performance & Lead Attribution Pipeline</h2>
  <p>
    The Marketing console (<code>/marketing</code> & <code>/superadmin?tab=marketing</code>) tracks B2B university partnerships and B2C Mellow Academy student leads.
    Inbound inquiries from the "Talk to Team" modal automatically route to the least-loaded representative, tracking statuses from <code>New → Contacted → Engaged → Converted → Lost</code>.
  </p>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Superadmin Master Control: Infrastructure & Operations</span>
    <span>Page 13 of 14</span>
  </div>
</div>

<!-- ================= PAGE 14: UNIFIED FEATURE MATRIX & OPERATIONAL REFERENCE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 7</span>
      <span>Unified Feature Matrix & Operational Quick Reference</span>
    </div>
    <div class="header-meta">Platform-Wide Capabilities Matrix</div>
  </div>

  <h2>1. Cross-Dashboard Capabilities Comparison Matrix</h2>
  <p>
    A concise operational overview mapping features across all six AptRun platform personas:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Platform Feature Area</th>
        <th style="width: 12%;">Student</th>
        <th style="width: 12%;">College TPO</th>
        <th style="width: 13%;">Coordinator</th>
        <th style="width: 13%;">Recruiter</th>
        <th style="width: 13%;">Mellow Ops</th>
        <th style="width: 12%;">Superadmin</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Polyglot Code Practice (19 Langs)</strong></td>
        <td><span class="badge badge-green">Full Solve</span></td>
        <td><span class="badge badge-slate">Inspect</span></td>
        <td><span class="badge badge-slate">Inspect</span></td>
        <td><span class="badge badge-slate">Inspect</span></td>
        <td><span class="badge badge-blue">Author Bank</span></td>
        <td><span class="badge badge-rose">Master Control</span></td>
      </tr>
      <tr>
        <td><strong>Weekly Rated Contests & Rating</strong></td>
        <td><span class="badge badge-green">Compete</span></td>
        <td><span class="badge badge-blue">Host Mock</span></td>
        <td><span class="badge badge-slate">View Scores</span></td>
        <td><span class="badge badge-blue">Host Hiring</span></td>
        <td><span class="badge badge-blue">Schedule All</span></td>
        <td><span class="badge badge-rose">Master Control</span></td>
      </tr>
      <tr>
        <td><strong>Anti-Cheat Proctoring (3-Strikes)</strong></td>
        <td><span class="badge badge-amber">Enforced</span></td>
        <td><span class="badge badge-green">Reinstate</span></td>
        <td><span class="badge badge-slate">Monitor Sec</span></td>
        <td><span class="badge badge-slate">Inspect Logs</span></td>
        <td><span class="badge badge-blue">Calibrate</span></td>
        <td><span class="badge badge-rose">Master Control</span></td>
      </tr>
      <tr>
        <td><strong>Multi-Branch Core Prep (5 Branches)</strong></td>
        <td><span class="badge badge-green">Practice/Test</span></td>
        <td><span class="badge badge-blue">Mock Tests</span></td>
        <td><span class="badge badge-slate">View Mastery</span></td>
        <td><span class="badge badge-slate">Search Talent</span></td>
        <td><span class="badge badge-blue">Import Bank</span></td>
        <td><span class="badge badge-rose">Go-Live Switch</span></td>
      </tr>
      <tr>
        <td><strong>Vocabulary Sprint & Speaking AI</strong></td>
        <td><span class="badge badge-green">Daily Drills</span></td>
        <td><span class="badge badge-slate">Cohort Stats</span></td>
        <td><span class="badge badge-slate">Streak Monitor</span></td>
        <td><span class="badge badge-slate">Fluency Score</span></td>
        <td><span class="badge badge-blue">Prompt Models</span></td>
        <td><span class="badge badge-rose">API Governance</span></td>
      </tr>
      <tr>
        <td><strong>70 Soft Skills Exam Papers (1,750 Qs)</strong></td>
        <td><span class="badge badge-green">Take Tests</span></td>
        <td><span class="badge badge-blue">Deploy Tests</span></td>
        <td><span class="badge badge-slate">View Results</span></td>
        <td><span class="badge badge-blue">Screening Tests</span></td>
        <td><span class="badge badge-blue">Author Sets</span></td>
        <td><span class="badge badge-rose">Master Control</span></td>
      </tr>
      <tr>
        <td><strong>Project Lab (Browser VS Code IDE)</strong></td>
        <td><span class="badge badge-green">Build & Submit</span></td>
        <td><span class="badge badge-slate">Review Code</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-slate">Inspect Repo</span></td>
        <td><span class="badge badge-blue">Author Blueprints</span></td>
        <td><span class="badge badge-rose">Docker Hosts</span></td>
      </tr>
      <tr>
        <td><strong>Conversational Voice AI Interviews</strong></td>
        <td><span class="badge badge-green">Take Mocks</span></td>
        <td><span class="badge badge-blue">Assign / Override</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-slate">Review Transcripts</span></td>
        <td><span class="badge badge-blue">Role Tracks</span></td>
        <td><span class="badge badge-rose">Model Controls</span></td>
      </tr>
      <tr>
        <td><strong>Readiness Score (ARS v4) & Vault</strong></td>
        <td><span class="badge badge-green">Own Score</span></td>
        <td><span class="badge badge-blue">Batch Analytics</span></td>
        <td><span class="badge badge-amber">Attention Queue</span></td>
        <td><span class="badge badge-green">Search & Scout</span></td>
        <td><span class="badge badge-blue">Sync Oversight</span></td>
        <td><span class="badge badge-rose">Formula Config</span></td>
      </tr>
      <tr>
        <td><strong>Campus Recruitment Drives</strong></td>
        <td><span class="badge badge-green">Apply</span></td>
        <td><span class="badge badge-blue">Manage / Map</span></td>
        <td><span class="badge badge-slate">View Roster</span></td>
        <td><span class="badge badge-green">Post & Hire</span></td>
        <td><span class="badge badge-blue">Syndicate</span></td>
        <td><span class="badge badge-rose">Global Oversight</span></td>
      </tr>
      <tr>
        <td><strong>7 Automated Placement Reports</strong></td>
        <td><span class="badge badge-green">Personal PDF</span></td>
        <td><span class="badge badge-blue">Batch Excel/PDF</span></td>
        <td><span class="badge badge-blue">Section Report</span></td>
        <td><span class="badge badge-blue">Hiring Report</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-rose">All Reports</span></td>
      </tr>
      <tr>
        <td><strong>Pricing, Billing & Payment Sync</strong></td>
        <td><span class="badge badge-green">Subscribe</span></td>
        <td><span class="badge badge-slate">Read Plan</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-slate">—</span></td>
        <td><span class="badge badge-rose">Full Control</span></td>
      </tr>
    </tbody>
  </table>

  <h2>2. Operational Endpoints & Technical Service-Level Targets (SLAs)</h2>
  <div class="grid-3">
    <div class="callout" style="margin-bottom: 0;">
      <strong>Piston Code Judge SLA:</strong> Sub-second evaluation (&lt;850ms) for compiled languages (C++, Java, Rust) and &lt;400ms for interpreted languages (Python, JS).
    </div>
    <div class="callout green" style="margin-bottom: 0;">
      <strong>Project Lab Container Boot:</strong> Cold container instantiation under 6.5s; warm container restoration under 1.2s via Caddy reverse proxy.
    </div>
    <div class="callout indigo" style="margin-bottom: 0;">
      <strong>Voice AI Alignment Latency:</strong> Asynchronous audio processing and transcription alignment returned in &lt;2.4s from recording submission.
    </div>
  </div>

  <div style="margin-top: 8px; background: #0f172a; color: #ffffff; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <div style="font-size: 8.5pt; font-weight: 700;">AptRun Universal Placement Ecosystem</div>
      <div style="font-size: 7.2pt; color: #94a3b8;">Headquarters: Mellow Technologies · Support: support@mellowvault.com · Status: https://status.aptrun.com</div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-green" style="font-size: 7.5pt;">SYSTEM OPERATIONAL</span>
    </div>
  </div>

  <div class="footer-bar">
    <span>AptRun Platform Guide · Edition 2026.10</span>
    <span>Unified Feature Matrix & Operational Quick Reference</span>
    <span>Page 14 of 14</span>
  </div>
</div>

</body>
</html>
"""

    temp_html_path = r"D:\Dev\AptRun\generate_guide_temp.html"
    with open(temp_html_path, "w", encoding="utf-8") as f:
        html_content = html_content.replace(" · ", " &middot; ")
        f.write(html_content)

    output_pdf = r"D:\Dev\AptRun\docs\AptRun-Complete-Feature-Guide.pdf"
    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        edge_path,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={output_pdf}",
        f"file:///{temp_html_path.replace(os.sep, '/')}"
    ]

    print("Running Edge headless print-to-pdf...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    time.sleep(2)

    if os.path.exists(output_pdf):
        print(f"Successfully generated PDF: {output_pdf} (Size: {os.path.getsize(output_pdf)} bytes)")
        # Also copy to docs/AptRun-Feature-Guide.pdf
        dest_pdf = r"D:\Dev\AptRun\docs\AptRun-Feature-Guide.pdf"
        import shutil
        shutil.copyfile(output_pdf, dest_pdf)
        print(f"Copied to: {dest_pdf}")
    else:
        print("Failed to generate PDF. Stdout:", res.stdout, "Stderr:", res.stderr)

    if os.path.exists(temp_html_path):
        os.remove(temp_html_path)

if __name__ == "__main__":
    build_pdf()
