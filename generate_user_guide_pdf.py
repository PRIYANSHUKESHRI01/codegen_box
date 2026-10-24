import base64
import os
import subprocess
import time

def build_how_to_use_pdf():
    # Read logo
    logo_path = r"D:\Dev\AptRun\aptRun Logo.png"
    with open(logo_path, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AptRun Complete User & Feature Guide: How to Use the Platform</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 8mm 11mm 10mm 11mm;
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
      height: 279mm;
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
    font-size: 8.3pt;
    line-height: 1.35;
  }}

  .page {{
    padding: 1mm 1mm 5mm 1mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    min-height: 275mm;
  }}

  /* Header & Footer */
  .header-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0284c7;
    padding-bottom: 4px;
    margin-bottom: 8px;
  }}
  .header-title {{
    font-size: 7.8pt;
    font-weight: 700;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 6px;
  }}
  .header-tag {{
    background: #e0f2fe;
    color: #0369a1;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 6.8pt;
    font-weight: 700;
  }}
  .header-meta {{
    font-size: 7.2pt;
    color: #64748b;
  }}

  .footer-bar {{
    position: absolute;
    bottom: 1mm;
    left: 1mm;
    right: 1mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    font-size: 7.2pt;
    color: #94a3b8;
  }}

  /* Typography */
  h1 {{
    font-size: 16pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 4px;
  }}
  h2 {{
    font-size: 10.5pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-top: 6px;
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
  }}
  p {{
    font-size: 8pt;
    color: #334155;
    margin-bottom: 5px;
    line-height: 1.32;
  }}

  /* Action Step Box (How To Use Format) */
  .step-box {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 6px;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  }}
  .step-num-badge {{
    background: #0284c7;
    color: #ffffff;
    font-size: 7.5pt;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 1px;
  }}
  .step-content {{
    flex: 1;
  }}
  .step-title {{
    font-size: 8.2pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1px;
  }}
  .step-detail {{
    font-size: 7.8pt;
    color: #334155;
    line-height: 1.3;
  }}
  .step-action {{
    font-size: 7.3pt;
    color: #0369a1;
    font-weight: 600;
    margin-top: 2px;
  }}

  /* Callouts */
  .callout {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 6px 9px;
    margin-bottom: 6px;
    border-left: 3px solid #0284c7;
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
    font-size: 7.8pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1px;
  }}
  .callout-body {{
    font-size: 7.5pt;
    color: #334155;
    line-height: 1.28;
  }}

  /* Stat & Quick Grids */
  .grid-4 {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }}
  .grid-2 {{
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    margin-bottom: 6px;
  }}

  .stat-card {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 5px 8px;
    border-left: 2.5px solid #0284c7;
  }}
  .stat-card.emerald {{
    border-left-color: #059669;
    background: #f0fdf4;
  }}
  .stat-card.amber {{
    border-left-color: #d97706;
    background: #fffbeb;
  }}
  .stat-val {{
    font-size: 13pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }}
  .stat-label {{
    font-size: 6.8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-top: 1px;
  }}
  .stat-sub {{
    font-size: 7pt;
    color: #475569;
    margin-top: 1px;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 6px;
    font-size: 7.8pt;
  }}
  th {{
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 6.8pt;
    letter-spacing: 0.04em;
    text-align: left;
    padding: 4px 6px;
    border: 1px solid #cbd5e1;
  }}
  td {{
    padding: 4px 6px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    line-height: 1.28;
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
    font-size: 6.6pt;
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

  code {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7.2pt;
    background: #f1f5f9;
    padding: 1px 3px;
    border-radius: 3px;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }}

  /* Keyboard shortcut tag */
  kbd {{
    font-family: ui-monospace, monospace;
    font-size: 6.8pt;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    padding: 1px 4px;
    box-shadow: 0 1px 0 rgba(0,0,0,0.1);
  }}

  /* Corporate Verification Block */
  .corp-auth-box {{
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 3.5px solid #0284c7;
    border-radius: 6px;
    padding: 6px 9px;
    margin-bottom: 7px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }}
  .corp-auth-header {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 3px;
    margin-bottom: 4px;
  }}
  .corp-auth-title {{
    font-size: 7.2pt;
    font-weight: 800;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 4px;
  }}
  .corp-auth-grid {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 4px;
  }}
  .corp-auth-item {{
    font-size: 6.9pt;
    line-height: 1.25;
  }}
  .corp-auth-label {{
    font-size: 6pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.04em;
  }}
  .corp-auth-val {{
    font-weight: 700;
    color: #0f172a;
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }}
  .corp-auth-legal {{
    font-size: 6.6pt;
    color: #475569;
    line-height: 1.3;
    border-top: 1px dashed #cbd5e1;
    padding-top: 3px;
  }}
</style>
</head>
<body>

<!-- ================= PAGE 1: TITLE, QUICKSTART & ONBOARDING ================= -->
<div class="page">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5mm; margin-bottom: 4mm; border-bottom: 2px solid #0284c7; padding-bottom: 6px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="data:image/png;base64,{logo_b64}" alt="AptRun Logo" style="height: 38px; object-fit: contain;">
      <div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em;">AptRun™ Enterprise Platform</div>
        <div style="font-size: 6.8pt; font-weight: 600; color: #475569;">A Product of <strong>Mellow Vault</strong> &middot; A Unit of <strong>PRAYUKTI DEVELOPMENT PRIVATE LIMITED</strong></div>
      </div>
    </div>
    <div style="text-align: right;">
      <div style="display: flex; gap: 4px; justify-content: flex-end; margin-bottom: 2px;">
        <span class="badge badge-blue" style="font-size: 6.5pt; padding: 1px 6px;">CIN: U62099UP2024PTC207212</span>
        <span class="badge badge-green" style="font-size: 6.5pt; padding: 1px 6px;">ISO 27001 Certified</span>
      </div>
      <div style="font-size: 7pt; font-weight: 700; color: #0f172a;">Official Technical &amp; Operational User Manual &middot; 2026.10</div>
      <div style="font-size: 6.5pt; color: #64748b; font-family: monospace;">DOC REF: APTRUN-OUM-2026-V4.2 &middot; MCA STATUTORY FILING</div>
    </div>
  </div>

  <div style="margin-bottom: 3.5mm;">
    <div style="font-size: 8.5pt; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">Campus Skilling, Automated Evaluation &amp; Corporate Placement System</div>
    <h1 style="font-size: 19pt; font-weight: 800; color: #0f172a; line-height: 1.15; margin-bottom: 4px; letter-spacing: -0.02em;">
      AptRun User Guide: How to Use Every Feature
    </h1>
    <p style="font-size: 8.3pt; color: #334155; line-height: 1.35; max-width: 700px;">
      A certified, step-by-step operational handbook for <strong>Students</strong>, <strong>College TPOs</strong>, 
      <strong>Faculty Section Coordinators</strong>, and <strong>Enterprise Recruiters</strong>. Learn how to navigate every dashboard, 
      launch containers, run proctored tests, track readiness, and manage campus hiring pipelines.
    </p>
  </div>

  <!-- Corporate Statutory Attestation & Authentication Card -->
  <div class="corp-auth-box">
    <div class="corp-auth-header">
      <div class="corp-auth-title">
        <svg style="width: 11px; height: 11px; fill: #0284c7; vertical-align: middle; margin-right: 3px;" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        Statutory Corporate Registry &amp; Intellectual Property Attestation
      </div>
      <div style="display: flex; gap: 4px;">
        <span class="badge badge-blue" style="font-size: 6.2pt; padding: 1px 5px;">MCA Statutory Record</span>
        <span class="badge badge-green" style="font-size: 6.2pt; padding: 1px 5px;">Legally Validated</span>
      </div>
    </div>
    <div class="corp-auth-grid">
      <div class="corp-auth-item">
        <div class="corp-auth-label">Platform Product</div>
        <div class="corp-auth-val">AptRun™ Platform (aptrun.com)</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Proprietary Brand</div>
        <div class="corp-auth-val">Mellow Vault (mellowvault.com)</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Parent Corporate Body</div>
        <div class="corp-auth-val">PRAYUKTI DEVELOPMENT PRIVATE LIMITED</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Corporate Identity No. (CIN)</div>
        <div class="corp-auth-val" style="font-family: monospace; color: #0284c7; font-weight: 800;">U62099UP2024PTC207212</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Statutory Authority</div>
        <div class="corp-auth-val">Ministry of Corporate Affairs, Govt. of India</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Registered Operations Base</div>
        <div class="corp-auth-val">Noida / New Delhi, Uttar Pradesh, India</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Enterprise Support &amp; Desk</div>
        <div class="corp-auth-val">support@mellowvault.com &middot; +91 76785 78295</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Information Security Standards</div>
        <div class="corp-auth-val" style="color: #059669;">ISO 27001 Certified &middot; 256-Bit SSL Encrypted</div>
      </div>
    </div>
    <div class="corp-auth-legal">
      <strong>Official Validity &amp; Authenticity Notice:</strong> This document serves as the official, authenticated operational user handbook for the AptRun platform, engineered and owned by Mellow Vault, a unit of PRAYUKTI DEVELOPMENT PRIVATE LIMITED (CIN: U62099UP2024PTC207212). All workflows, student scoring algorithms (AptRun Readiness Score v3/v4), proctoring compliance protocols, tenant controls, and placement pipelines documented herein represent binding operational standards for participating educational institutions, candidates, and enterprise recruiters.
    </div>
  </div>

  <h2>First-Time Onboarding: How Every User Begins</h2>
  <div class="grid-2">
    <div class="step-box">
      <div class="step-num-badge">1</div>
      <div class="step-content">
        <div class="step-title">Student First Login & Track Selection</div>
        <div class="step-detail">
          Navigate to <code>/login</code> or follow your college email link. The wizard prompts you to:
          <br>• <strong>Confirm Branch:</strong> Resolves to CSE, ECE, EEE, Mechanical, or Civil.
          <br>• <strong>Select Track Focus:</strong> Choose <em>IT First</em>, <em>Core First</em>, or <em>Balanced</em>.
          <br>• <strong>Primary Language:</strong> Pick C++, Java, Python, or "I don't code yet".
        </div>
        <div class="step-action">Where: /signup or First-Login Modal &rarr; Settings &gt; Branch &amp; Track</div>
      </div>
    </div>
    <div class="step-box">
      <div class="step-num-badge">2</div>
      <div class="step-content">
        <div class="step-title">TPO / Coordinator Activation</div>
        <div class="step-detail">
          Placement Officers and Faculty sign in with university credentials.
          <br>• <strong>TPOs:</strong> Land on <code>/admin</code> (TPO Command Center) with batch funnel metrics.
          <br>• <strong>Coordinators:</strong> Land on <code>/coordinator</code> with assigned section rosters.
          <br>• <strong>Temporary Logins:</strong> Must set a personalized password upon first entry.
        </div>
        <div class="step-action">Where: /login &rarr; Automatic role redirection to /admin or /coordinator</div>
      </div>
    </div>
  </div>

  <h2>The 4 Primary Operational Personas in this Playbook</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">User Role</th>
        <th style="width: 25%;">Dashboard Route</th>
        <th style="width: 35%;">Your Main Daily Objective</th>
        <th style="width: 20%;">Key Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Student Coder</strong></td>
        <td><code>/dashboard</code> &amp; <code>/arena</code></td>
        <td>Solve DSA, take proctored tests, build full-stack projects, raise ARS to $\ge 60$, get hired.</td>
        <td><span class="badge badge-green">Daily Practice &amp; Vault</span></td>
      </tr>
      <tr>
        <td><strong>College TPO</strong></td>
        <td><code>/admin</code> (TPO View)</td>
        <td>Onboard batch, track readiness, map campus drives, delegate faculty, export 7 reports.</td>
        <td><span class="badge badge-blue">Cohort &amp; Drive Funnel</span></td>
      </tr>
      <tr>
        <td><strong>Faculty Coordinator</strong></td>
        <td><code>/coordinator</code></td>
        <td>Check 12-student "Needs Attention" queue, log counseling calls, monitor live section tests.</td>
        <td><span class="badge badge-indigo">Remedial Interventions</span></td>
      </tr>
      <tr>
        <td><strong>Corporate Recruiter</strong></td>
        <td><code>/admin/company</code></td>
        <td>Propose campus drives, scout verified ARS talent, author coding tests, review AI mock videos.</td>
        <td><span class="badge badge-amber">Direct Campus Sourcing</span></td>
      </tr>
    </tbody>
  </table>

  <div class="callout green" style="margin-top: 6px;">
    <div class="callout-title">Navigation Quick Tip: The Real-Time Plan Signal</div>
    <div class="callout-body">
      AptRun features an automatic real-time sync heartbeat (<code>/api/me/plan-signal</code>). When your college upgrades your plan or your subscription changes, sidebar locks and feature limits update within 30 seconds automatically—<strong>no page refresh required</strong>.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Getting Started, Onboarding &amp; Persona Directory</span>
    <span>Page 1 of 14</span>
  </div>
</div>

<!-- ================= PAGE 2: STUDENT PLAYBOOK - CODE PRACTICE & MONACO ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 1</span>
      <span>How to Practice Coding &amp; Use the Monaco IDE</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/practice)</div>
  </div>

  <h2>How to Solve Algorithmic Problems: Step-by-Step</h2>
  <p>The Practice Arena (<code>/dashboard/practice</code>) is your core developer training ground. Follow this workflow to solve problems efficiently:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Browse &amp; Filter Problems</div>
      <div class="step-detail">
        Open <strong>Practice Arena</strong> from the sidebar. Use the top filters:
        <br>&bull; <strong>Difficulty:</strong> Filter by <em>Easy</em>, <em>Medium</em>, or <em>Hard</em>.
        <br>&bull; <strong>Topic Tags:</strong> Select Arrays, Trees, Graphs, Dynamic Programming, Strings, Greedy.
        <br>&bull; <strong>Company Tags:</strong> Filter problems asked at Google, Amazon, Microsoft, TCS, Infosys.
        <br>&bull; A green checkmark appears on cards for problems you have already accepted (AC).
      </div>
      <div class="step-action">UI: Click problem title &rarr; Opens Monaco Editor View (/dashboard/practice/view/[id])</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Select Your Programming Language</div>
      <div class="step-detail">
        In the editor header dropdown, select from <strong>19 supported programming languages</strong>:
        C, C++, Java, Python 3, Go, Rust, TypeScript, JavaScript, C#, PHP, Kotlin, Swift, etc.
        <br>&bull; The editor automatically loads language-specific starter boilerplate and main execution templates.
        <br>&bull; <em>Auto-Save:</em> AptRun caches your unsubmitted code locally per language so you never lose drafts.
      </div>
      <div class="step-action">Shortcut: Use the language selector dropdown on top right of the editor toolbar</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Run Code with Custom Test Inputs</div>
      <div class="step-detail">
        Before submitting, verify edge cases using the test panel:
        <br>&bull; Check the <strong>"Custom Input"</strong> checkbox below the editor.
        <br>&bull; Enter your custom standard input (stdin) in the text area.
        <br>&bull; Click <kbd>Run Code</kbd> (or press <kbd>Ctrl</kbd> + <kbd>'</kbd>).
        <br>&bull; Inspect output: stdout, stderr, execution wall-clock time (ms), and peak memory consumed (KB).
      </div>
      <div class="step-action">Execution Speed: Sub-second execution (&lt;850ms) powered by isolated Piston runners</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">4</div>
    <div class="step-content">
      <div class="step-title">Submit Code &amp; Understand Verdicts</div>
      <div class="step-detail">
        Click the green <kbd>Submit</kbd> button (or <kbd>Ctrl</kbd> + <kbd>Enter</kbd>). Your code is evaluated against hidden test cases.
      </div>
    </div>
  </div>

  <h2>Submission Verdict Reference Table</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 15%;">Verdict</th>
        <th style="width: 25%;">Meaning</th>
        <th style="width: 40%;">Why It Happens</th>
        <th style="width: 20%;">What You Should Do</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-green">AC (Accepted)</span></td>
        <td>100% Correct</td>
        <td>Your code passed all standard and hidden edge test cases within time and memory limits.</td>
        <td>Problem marked solved; points added to your Readiness Score.</td>
      </tr>
      <tr>
        <td><span class="badge badge-rose">WA (Wrong Answer)</span></td>
        <td>Incorrect Output</td>
        <td>Logic failed on specific edge cases (e.g., negative numbers, empty arrays, large integers).</td>
        <td>Check the failed test input displayed on screen and debug your logic.</td>
      </tr>
      <tr>
        <td><span class="badge badge-amber">TLE (Time Limit)</span></td>
        <td>Algorithm Too Slow</td>
        <td>Time complexity exceeded (e.g. $O(N^2)$ instead of $O(N \log N)$ on $N=10^5$).</td>
        <td>Optimize your algorithm; replace nested loops with hash maps or binary search.</td>
      </tr>
      <tr>
        <td><span class="badge badge-amber">MLE (Memory Limit)</span></td>
        <td>Exceeded 256 MB</td>
        <td>Infinite recursion or allocating excessive matrix memory in memory-constrained environment.</td>
        <td>Check recursion base cases and optimize auxiliary space structures.</td>
      </tr>
      <tr>
        <td><span class="badge badge-slate">CE (Compile Error)</span></td>
        <td>Syntax Error</td>
        <td>Missing semicolons, type mismatches, or missing library imports.</td>
        <td>Read the compiler output log displayed in the red console banner.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout indigo">
    <div class="callout-title">How to Inspect Past Submissions</div>
    <div class="callout-body">
      Click the <strong>Submissions</strong> tab below the problem description. Click on any past attempt to open a modal displaying the exact code you submitted, the verdict received, execution time, and date stamp.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: Code Practice &amp; Monaco IDE</span>
    <span>Page 2 of 14</span>
  </div>
</div>

<!-- ================= PAGE 3: STUDENT PLAYBOOK - CONTESTS & PROCTORING ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 2</span>
      <span>How to Compete in Contests &amp; Anti-Cheat Rules</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/contests)</div>
  </div>

  <h2>How to Take a Proctored Contest: Complete Walkthrough</h2>
  <p>AptRun hosts weekly rated programming contests and college mock assessments (<code>/dashboard/contests</code>). Follow these instructions to avoid disqualification:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Register &amp; Check Countdown</div>
      <div class="step-detail">
        Open <strong>Contests</strong> in the sidebar. Contests are grouped into <em>Upcoming</em>, <em>Live Now</em>, and <em>Past</em>.
        <br>&bull; Click <kbd>Register</kbd> on upcoming contests. When the timer hits zero, click <kbd>Enter Contest</kbd>.
        <br>&bull; <em>Audience check:</em> College mock contests are visible only if mapped to your university by your TPO.
      </div>
      <div class="step-action">UI: Click Enter Contest on the live contest card (/dashboard/contests/view/[id])</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Complete Pre-Flight Hardware Checks</div>
      <div class="step-detail">
        Before entering the problem console, the anti-cheat proctoring wizard runs hardware checks:
        <br>&bull; <strong>Camera Permission:</strong> Allow browser webcam access. Position yourself centered and clearly lit.
        <br>&bull; <strong>Microphone Permission:</strong> Verify audio levels to ensure background noise monitoring is active.
        <br>&bull; <strong>Browser Check:</strong> Close secondary monitors, screen-sharing apps (Zoom, Discord), and browser devtools.
      </div>
      <div class="step-action">Warning: Denying camera permissions blocks entry into proctored tests</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Enter Forced Fullscreen Environment</div>
      <div class="step-detail">
        Click <kbd>Enter Fullscreen &amp; Start Test</kbd>. The browser locks into full-screen mode.
        <br>&bull; The test clock synchronizes with the server. A countdown appears at the top center.
        <br>&bull; Use the top <strong>Problem Palette</strong> (Problem A, B, C, D) to navigate between challenges.
      </div>
      <div class="step-action">Rule: Do NOT press Esc or switch tabs during the contest</div>
    </div>
  </div>

  <h2>Understanding the Anti-Cheat 3-Strike Rule</h2>
  <div class="grid-3">
    <div class="stat-card amber">
      <div class="stat-val">Strike 1</div>
      <div class="stat-label">First Warning</div>
      <div class="stat-sub">Tab blur or fullscreen exit. Screen shows yellow alert banner. Recorded in audit log.</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">Strike 2</div>
      <div class="stat-label">Final Warning</div>
      <div class="stat-sub">Second violation. Yellow-orange modal alerts you: "One more strike will terminate your test".</div>
    </div>
    <div class="stat-card" style="border-left-color: #dc2626; background: #fef2f2;">
      <div class="stat-val" style="color: #dc2626;">Strike 3</div>
      <div class="stat-label">Locked Out</div>
      <div class="stat-sub">Automatic submission of on-screen code. Access ends immediately. Only TPO can reinstate.</div>
    </div>
  </div>

  <h2>What Triggers an Anti-Cheat Strike?</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Action</th>
        <th style="width: 18%;">Result</th>
        <th style="width: 54%;">Why It's Enforced</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Switching Browser Tabs</strong></td>
        <td><span class="badge badge-rose">Strike Issued</span></td>
        <td>Window blur event detected immediately by client and verified by proctoring server.</td>
      </tr>
      <tr>
        <td><strong>Exiting Fullscreen Mode</strong></td>
        <td><span class="badge badge-rose">Strike Issued</span></td>
        <td>Pressing <kbd>Esc</kbd> or minimizing window triggers immediate security alert.</td>
      </tr>
      <tr>
        <td><strong>Webcam Obstruction / Leaving Seat</strong></td>
        <td><span class="badge badge-amber">Flagged in Log</span></td>
        <td>AI detects absence of face or multiple faces in camera feed; flagged for TPO inspection.</td>
      </tr>
      <tr>
        <td><strong>Opening Inspect / DevTools</strong></td>
        <td><span class="badge badge-rose">Immediate Strike</span></td>
        <td>Keyboard shortcuts like <kbd>F12</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>I</kbd> are intercepted.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout green">
    <div class="callout-title">Understanding Your Skill Rating &amp; Divisions</div>
    <div class="callout-body">
      Rated contests update your <strong>Elo Skill Rating</strong> (starts at 1200). Divisions are:
      <strong>Division 3</strong> (&lt;1400 rating), <strong>Division 2</strong> (1400–1799 rating), and <strong>Division 1</strong> (&ge;1800 rating).
      Perform well to earn 1 to 7 star badges displayed on your public Vault profile.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: Contests &amp; Anti-Cheat Rules</span>
    <span>Page 3 of 14</span>
  </div>
</div>

<!-- ================= PAGE 4: STUDENT PLAYBOOK - CORE ENGINEERING PREP ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 3</span>
      <span>How to Prepare for Core Engineering Branches</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/core)</div>
  </div>

  <h2>How to Use Core Prep (ECE, EEE, Mechanical, Civil)</h2>
  <p>
    If you are an engineering student in a non-CS department, Core Prep (<code>/dashboard/core</code>) gives you specialized technical preparation.
    Here is how to use it for topic mastery and timed mock exams:
  </p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Verify Your Branch &amp; Track Focus</div>
      <div class="step-detail">
        In <strong>Settings &gt; Branch &amp; Track</strong>, ensure your branch is correctly mapped:
        <br>&bull; <strong>Electronics &amp; Comm. (ECE):</strong> Signals, Digital VLSI, Analog Circuits, Microprocessors.
        <br>&bull; <strong>Electrical Engineering (EEE):</strong> Power Systems, Machines, Control Systems, Power Electronics.
        <br>&bull; <strong>Mechanical Engineering (ME):</strong> Thermodynamics, SOM, Fluid Mechanics, Kinematics, CAD/CAM.
        <br>&bull; <strong>Civil Engineering (CE):</strong> Structures, RCC &amp; Steel, Geotechnical, Surveying, Transportation.
        <br>&bull; Set Track Focus to <strong>"Core First"</strong> (places Core Prep right under Overview) or <strong>"Balanced"</strong>.
      </div>
      <div class="step-action">UI: Sidebar shows "Core Prep" with a "New" badge as soon as your branch is live</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Daily Topic Practice (Instant Worked Solutions)</div>
      <div class="step-detail">
        Click on <strong>Topic Practice</strong>:
        <br>&bull; Select a subject module (e.g. <em>Power Electronics</em> or <em>Strength of Materials</em>).
        <br>&bull; Select an individual topic &rarr; Start answering questions.
        <br>&bull; <strong>Instant Feedback:</strong> After selecting an option, click <kbd>Check Answer</kbd>. AptRun immediately displays whether you are correct, accompanied by a full step-by-step worked derivation with KaTeX equations.
      </div>
      <div class="step-action">Limits: Free plan: 10 Qs/day. Expert / College plan: Unlimited practice</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Take Timed Proctored Core Tests</div>
      <div class="step-detail">
        Navigate to <strong>Core Tests</strong> tab (<code>/dashboard/core/tests</code>). Click <kbd>Start Test</kbd> on available papers:
        <br>&bull; <strong>Server-Enforced Clock:</strong> Countdown timer runs at top right; test submits automatically when time expires.
        <br>&bull; <strong>Negative Marking:</strong> Watch for penalty schemes (+1.0 for correct, -0.25 for wrong).
        <br>&bull; <strong>On-Screen Calculator:</strong> Click the floating calculator icon to open a scientific calculator for complex calculations.
        <br>&bull; <strong>Question Palette:</strong> Navigate questions, mark questions for review, and inspect answered/unanswered counts.
      </div>
      <div class="step-action">Where: /dashboard/core/session?test=[id]</div>
    </div>
  </div>

  <h2>How Core Mastery Feeds Your Readiness Score</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Core Component</th>
        <th style="width: 20%;">Weight in Core ARS</th>
        <th style="width: 55%;">How It Is Calculated &amp; How to Maximize It</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Timed Mock Tests</strong></td>
        <td><strong>60% of Core Score</strong></td>
        <td>Average percentage scored across your last 5 completed timed Core tests within the last 180 days. Take mock tests regularly to keep recent form high.</td>
      </tr>
      <tr>
        <td><strong>Syllabus Topic Mastery</strong></td>
        <td><strong>40% of Core Score</strong></td>
        <td>Percentage of your branch's topics where you have achieved <strong>Mastered</strong> status (&ge;5 answers with &ge;75% accuracy over 180 days across practice and tests).</td>
      </tr>
    </tbody>
  </table>

  <div class="callout green">
    <div class="callout-title">The 30-Day Go-Live Grace Period</div>
    <div class="callout-body">
      When your college switches your branch live on Core Prep, a <strong>30-day grace period</strong> protects your score: the server computes your score under both the Software and Core formulas and automatically <strong>gives you the higher score</strong>, ensuring you never drop in rank while building your subject record.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: Core Engineering Prep</span>
    <span>Page 4 of 14</span>
  </div>
</div>

<!-- ================= PAGE 5: STUDENT PLAYBOOK - AI LEARNING CENTRE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 4</span>
      <span>How to Use the AI Learning Centre</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/learning-centre)</div>
  </div>

  <h2>1. Vocabulary Sprint: Mastering Words with Spaced Repetition (SRS)</h2>
  <p>The Vocabulary module (<code>/dashboard/learning-centre/vocabulary</code>) trains you on 160 high-impact interview words using the Leitner 6-box model.</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Start Your Daily Sprint (3 Minutes)</div>
      <div class="step-detail">
        Open <strong>Vocabulary Sprint</strong> &rarr; Click <kbd>Start Daily Sprint</kbd> (~12 questions).
        <br>&bull; The algorithm queues words due for review today, plus 2–4 new words from your active deck.
        <br>&bull; <strong>Meet the Word:</strong> New words are introduced first with audio pronunciation, definition, example sentence, and usage tip.
      </div>
      <div class="step-action">Goal: Complete 10 answers daily to maintain your practice streak</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Answer Progressive Question Types</div>
      <div class="step-detail">
        As words advance across Leitner boxes, questions increase in difficulty:
        <br>&bull; <em>Level 1:</em> Definition match &rarr; <em>Level 2:</em> Pick word for a meaning &rarr; <em>Level 3:</em> Sentence blank &rarr; <em>Level 4:</em> <strong>Type from memory</strong> (spelling counts; single-letter slips are flagged as near misses).
        <br>&bull; Correct answers advance words toward Box 5 (Mastered). Mistakes drop words 2 boxes and schedule review today.
      </div>
    </div>
  </div>

  <h2>2. Audio-First Speaking Practice with Pronunciation Feedback</h2>
  <p>Speaking Practice (<code>/dashboard/learning-centre/speaking</code>) coaches your spoken English clarity, fluency, and articulation without human bias.</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Choose a Reading Passage or Generate a Custom AI Topic</div>
      <div class="step-detail">
        Browse the passage library (<em>Interview Ready</em>, <em>Workplace English</em>, <em>Tech &amp; Career</em>, <em>Everyday English</em>), or click <kbd>AI Custom Passage</kbd> and enter any topic (e.g. "My React project", "How DNS works").
      </div>
      <div class="step-action">UI: Click Start Practice on any passage card</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Record Your Spoken Answer Aloud</div>
      <div class="step-detail">
        Click <kbd>Start Recording</kbd>. A live audio waveform confirms microphone capture.
        <br>&bull; Read the passage naturally. Avoid rushing or whispering. Click <kbd>Stop &amp; Submit</kbd> when finished.
        <br>&bull; <em>Hardware voice detector:</em> Silent or muted recordings are rejected locally to preserve requests.
      </div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Review Word-by-Word Alignment &amp; Pronunciation Notes</div>
      <div class="step-detail">
        AptRun analyzes your raw audio using <code>SpeechAlignment</code> and Gemini speech models:
        <br>&bull; <strong>Overall Score (0-100):</strong> 0.35 &times; Accuracy + 0.35 &times; Clarity + 0.30 &times; Fluency. Pass mark is &ge; 60%.
        <br>&bull; <strong>Word Heatmap:</strong> Words highlighted green (accurate), yellow (hesitation), or red (mispronounced/omitted).
        <br>&bull; <strong>"Worth a Second Listen":</strong> Specific words flagged for acoustic coaching.
      </div>
      <div class="step-action">Privacy: Audio recordings are processed in memory and never permanently stored</div>
    </div>
  </div>

  <h2>3. Listening Lab: Corporate Dialogue Comprehension</h2>
  <div class="callout indigo">
    <div class="callout-title">How to Complete a Listening Lesson (<code>/dashboard/learning-centre/listening</code>)</div>
    <div class="callout-body">
      Select from 24 graded audio lessons. Click <kbd>Play Audio</kbd> to listen to simulated corporate client briefings or standup calls. Answer the comprehension questions before the timer expires. Your score feeds the Learning Centre component of your ARS.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: AI Learning Centre</span>
    <span>Page 5 of 14</span>
  </div>
</div>

<!-- ================= PAGE 6: STUDENT PLAYBOOK - SOFT SKILLS & PROJECT LAB ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 5</span>
      <span>How to Use Soft Skills &amp; Project Lab Workspaces</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/soft-skills &amp; /dashboard/projects)</div>
  </div>

  <h2>1. Soft Skills Tests: How to Practice the 70 Exam Sets</h2>
  <p>The Soft Skills portal (<code>/dashboard/soft-skills</code>) contains 70 pre-calibrated examination papers calibrated to corporate placement exams.</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Select an Exam Set or Assigned Test</div>
      <div class="step-detail">
        Open <strong>Soft Skills</strong>. The page displays tests in two sections:
        <br>&bull; <strong>Assigned to You:</strong> Mandatory tests scheduled by your College TPO or a visiting hiring partner.
        <br>&bull; <strong>AptRun Question Sets (Sets 1 to 70):</strong> Open library. Search by number (e.g. "Set 14") or filter by status: <em>Not Attempted</em>, <em>In Progress</em>, or <em>Completed</em>.
      </div>
      <div class="step-action">UI: Click Start Test or Resume Test on any test card</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Complete the 25-Question Exam</div>
      <div class="step-detail">
        Each set contains 25 questions with a 30-minute timer:
        <br>&bull; <strong>8 Quantitative Aptitude &middot; 7 Logical Reasoning &middot; 6 Verbal Ability &middot; 4 Situational Judgement.</strong>
        <br>&bull; Navigate using the bottom question dots. Click <kbd>Submit Test</kbd> when finished.
        <br>&bull; <em>Instant Results:</em> View your overall score, category percentiles, and full answer review with explanations.
      </div>
    </div>
  </div>

  <h2>2. Project Lab: Building Real-World Apps in In-Browser VS Code</h2>
  <p>Project Lab (<code>/dashboard/projects</code>) provides containerized cloud developer workspaces to build and deploy portfolio-grade applications.</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Browse Projects &amp; Download Client Statement of Work (SOW)</div>
      <div class="step-detail">
        Browse projects across categories: E-Commerce, Healthcare, EdTech, FinTech.
        <br>&bull; Click on a project card &rarr; Click <kbd>Download SOW PDF</kbd>.
        <br>&bull; Read the client brief, business requirements, API specifications, and milestone deliverables.
      </div>
      <div class="step-action">Entitlement: Included in Expert and Grandmaster plans (80 workspace-hours/month)</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Launch Your Dedicated Cloud Workspace (1-Click)</div>
      <div class="step-detail">
        Click <kbd>Launch Workspace</kbd>. AptRun spins up an isolated OpenVSCode Server container:
        <br>&bull; <strong>Left Panel:</strong> Full-featured VS Code in browser with terminal, file tree, extensions, and git.
        <br>&bull; <strong>Right Panel:</strong> Live web preview rendering your running application via reverse Caddy proxy.
        <br>&bull; <em>Auto-Reap:</em> Workspaces idle for 15 minutes stop automatically to conserve your monthly hours.
      </div>
      <div class="step-action">Shortcut: Open integrated terminal with Ctrl + ` to run npm install or npm run dev</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Submit Milestones &amp; Request Review</div>
      <div class="step-detail">
        Tick off completed milestones in the workspace sidebar checklist. When finished:
        <br>&bull; Click <kbd>Submit Code for Review</kbd>. The system snapshots your container filesystem and triggers automated verification.
        <br>&bull; Verified projects earn an authenticated badge in your Mellow Vault portfolio.
      </div>
    </div>
  </div>

  <div class="callout green">
    <div class="callout-title">Storage &amp; Volume Persistence</div>
    <div class="callout-body">
      Your code is saved on a persistent volume (<code>wsvol-&lt;id&gt;</code>). When your workspace stops, your files remain intact. Relaunching the workspace restores your exact directory state.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: Soft Skills &amp; Project Lab</span>
    <span>Page 6 of 14</span>
  </div>
</div>

<!-- ================= PAGE 7: STUDENT PLAYBOOK - INTERVIEWS, READINESS & VAULT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Student Playbook 6</span>
      <span>How to Ace AI Mocks, Raise ARS &amp; Enter The Vault</span>
    </div>
    <div class="header-meta">Student Portal (/dashboard/interviews, /dashboard/vault &amp; /dashboard/drives)</div>
  </div>

  <h2>1. AI Mock Interviews: Speech-to-Speech Practice</h2>
  <p>The AI Interview portal (<code>/dashboard/interviews</code>) simulates technical and HR panels using speech-to-speech AI.</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Select an Interview Track or Role Template</div>
      <div class="step-detail">
        Click <kbd>New Mock Interview</kbd>. Choose a role template (e.g. <em>Full Stack Engineer</em>, <em>Data Analyst</em>, <em>Embedded Systems</em>), or select a company track (Google, Amazon, TCS Digital).
      </div>
      <div class="step-action">UI: Click Start Session &rarr; Allow microphone permission</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Conduct the Interview Session</div>
      <div class="step-detail">
        The synthetic AI interviewer asks a verbal question. Listen through your speakers/headphones.
        <br>&bull; Click <kbd>Speak</kbd> and answer verbally (or use the text input toggle).
        <br>&bull; The AI listens, evaluates your answer, and asks dynamic follow-up questions to probe depth.
        <br>&bull; Click <kbd>Conclude Interview</kbd> when all rounds finish.
      </div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Inspect Your Rubric Scorecard &amp; Transcript</div>
      <div class="step-detail">
        Review your post-interview report:
        <br>&bull; <strong>4 Rubric Scores:</strong> Technical Correctness (35%), Problem Solving (30%), Communication (20%), Code Quality (15%).
        <br>&bull; <strong>Verbatim Transcript:</strong> Read the full conversation with inline technical feedback.
        <br>&bull; Your last 5 scored interviews directly drive 20% of your Placement Readiness Score.
      </div>
    </div>
  </div>

  <h2>2. How to Raise Your Placement Readiness Score (ARS v4)</h2>
  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">+20 Pts</div>
      <div class="stat-label">AI Interviews</div>
      <div class="stat-sub">Maintain &ge;80% avg across last 5 interviews</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">+15 Pts</div>
      <div class="stat-label">Consistency</div>
      <div class="stat-sub">Practice 12 days in the trailing 28 days</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">+15 Pts</div>
      <div class="stat-label">Coding Breadth</div>
      <div class="stat-sub">Solve 20 Easy, 40 Med, 40 Hard problems</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">+15 Pts</div>
      <div class="stat-label">Learning Centre</div>
      <div class="stat-sub">Complete daily vocabulary sprints and speaking</div>
    </div>
  </div>

  <h2>3. How to Enter The Vault &amp; Apply to Campus Drives</h2>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Unlock Vault Eligibility (ARS &ge; 60)</div>
      <div class="step-detail">
        When your ARS score crosses <strong>60 points</strong> and you hold an eligible plan (Expert, Grandmaster, or College), open <strong>Vault</strong> (<code>/dashboard/vault</code>).
        <br>&bull; Toggle the <strong>"List My Profile in Mellow Vault"</strong> switch to ON.
        <br>&bull; Your verified badges, project repos, and contest stats become visible to hundreds of corporate recruiters.
      </div>
      <div class="step-action">Where: /dashboard/vault &rarr; 1-click opt-in toggle (revocable anytime)</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Apply to Campus Placement Drives</div>
      <div class="step-detail">
        Scroll to <strong>Upcoming &amp; Drives</strong> on your dashboard:
        <br>&bull; The system checks your CGPA, backlogs, branch, and ARS score against company criteria.
        <br>&bull; Click <kbd>Apply Now</kbd> on eligible drives. Track your stage live: <code>Applied &rarr; Shortlisted &rarr; OA &rarr; Interview &rarr; Offer</code>.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Student Playbook: Interviews, Readiness &amp; Vault</span>
    <span>Page 7 of 14</span>
  </div>
</div>

<!-- ================= PAGE 8: COLLEGE TPO PLAYBOOK - ONBOARDING & COHORT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">College TPO Playbook 1</span>
      <span>Batch Onboarding &amp; Student Cohort Management</span>
    </div>
    <div class="header-meta">College Admin Dashboard (/admin &amp; /admin/students)</div>
  </div>

  <h2>How to Onboard Your Entire Student Batch: Step-by-Step</h2>
  <p>The College TPO portal (<code>/admin</code>) enables placement teams to bring thousands of students onto AptRun in minutes:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Prepare the Student Excel / CSV Roster</div>
      <div class="step-detail">
        Format your student data sheet with the standard 9 columns:
        <br><code>Name, Roll_Number, Email, Phone, Parent_Phone, Branch, Section, CGPA, Backlogs</code>
        <br>&bull; <em>Branch normalization:</em> Variations like "MECH", "ME", and "Mechanical" are automatically mapped.
        <br>&bull; <em>Section names:</em> Whitespace and casing are normalized ("A", "a ", "A " are treated as Section A).
      </div>
      <div class="step-action">UI: /admin/students &rarr; Click "Import Students" button on top right</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Upload Roster &amp; Review Dry-Run Validation</div>
      <div class="step-detail">
        Drag and drop your XLSX/CSV file. AptRun performs instant validation:
        <br>&bull; Highlights duplicate roll numbers or existing emails.
        <br>&bull; Shows how many new accounts will be created and how many existing records will be updated.
        <br>&bull; Click <kbd>Confirm Import</kbd>. The server generates student accounts and sends welcome activation links.
      </div>
    </div>
  </div>

  <h2>How to Use the 29-Column Student Cohort Directory</h2>
  <p>Navigate to <strong>Student Cohort</strong> (<code>/admin/students</code>) to search and filter your entire student body:</p>

  <div class="grid-3">
    <div class="callout">
      <div class="callout-title">Smart Filters Toolbar</div>
      <div class="callout-body">
        Filter by <strong>Branch</strong>, <strong>Section</strong>, <strong>Readiness Tier</strong> (Ready, In Progress, Needs Training), <strong>At-Risk (&lt;60 ARS)</strong>, <strong>Drive Eligible Only</strong>, or <strong>Coding Language</strong>.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Batch Multi-Select Actions</div>
      <div class="callout-body">
        Select multiple student checkboxes to dispatch bulk email notifications, assign custom mock tests, or export filtered rosters to Excel.
      </div>
    </div>
    <div class="callout indigo">
      <div class="callout-title">Live Practice Streaks</div>
      <div class="callout-body">
        Table columns display 7-day practice score, active streak, last active date, and current placement drive status in real time.
      </div>
    </div>
  </div>

  <h2>Using the Student 360° Management Drawer</h2>
  <p>Click on any student row in the cohort table to slide open their comprehensive 4-tab 360° drawer:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Drawer Tab</th>
        <th style="width: 50%;">Information Displayed</th>
        <th style="width: 30%;">TPO Control Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Overview</strong></td>
        <td>Roll Number, Personal Phone, Parent Phone, Branch, Section, Academic CGPA, Backlogs, Drive Eligibility status.</td>
        <td>Edit contact information, correct CGPA/backlog errors, or re-map branch.</td>
      </tr>
      <tr>
        <td><strong>2. Placement Readiness</strong></td>
        <td>Full ARS v4 breakdown: Interview score, Coding score, Core Technical score, Consistency score, Soft Skills score.</td>
        <td>Click <kbd>Recalculate Readiness</kbd> or <kbd>Download Student PDF Dossier</kbd>.</td>
      </tr>
      <tr>
        <td><strong>3. Submissions</strong></td>
        <td>Chronological log of the student's latest 80 practice and contest attempts. Syntax-highlighted code viewer.</td>
        <td>Inspect code quality, verify originality, and investigate plagiarism flags.</td>
      </tr>
      <tr>
        <td><strong>4. Coordinator History</strong></td>
        <td>Chronological log of all interventions logged by faculty: phone calls, meetings, notes, and disciplinary blocks.</td>
        <td>Review faculty follow-up compliance; lift coordinator account holds.</td>
      </tr>
    </tbody>
  </table>

  <h2>How to Delegate Section Coordinators</h2>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Assign Faculty to Sections &amp; Branches</div>
      <div class="step-detail">
        Open <strong>Section Coordinators</strong> (<code>/admin/coordinators</code>) &rarr; Click <kbd>Add Coordinator</kbd>.
        <br>&bull; Select faculty member email, designated Section (e.g. "Section A"), and Branch Scope (All or Specific branches).
        <br>&bull; <em>Collision Check:</em> Server prevents two coordinators from covering the same branch in a section.
        <br>&bull; Check the <strong>"N not covered"</strong> chip to find and assign unmapped student sections.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>College TPO Playbook: Batch Onboarding &amp; Cohort</span>
    <span>Page 8 of 14</span>
  </div>
</div>

<!-- ================= PAGE 9: COLLEGE TPO PLAYBOOK - TESTS, DRIVES & REPORTS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">College TPO Playbook 2</span>
      <span>Scheduling Mock Tests, Managing Drives &amp; Reports</span>
    </div>
    <div class="header-meta">College Admin Dashboard (/admin/drives &amp; /admin/reports)</div>
  </div>

  <h2>1. How to Schedule Institutional Mock Assessments</h2>
  <p>TPOs can deploy mock coding contests, AI interview drives, and soft skill tests for their students:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Schedule a Mock Coding Contest</div>
      <div class="step-detail">
        Open <strong>Mock Contests</strong> (<code>/admin/mock-contests</code>) &rarr; Click <kbd>Create Mock Contest</kbd>.
        <br>&bull; Set Title, Start Time, Duration (e.g. 90 mins), and targeted branches/sections.
        <br>&bull; Pick problems from AptRun's problem bank or clone standard Mellow contest papers.
        <br>&bull; Toggle <strong>Strict Proctoring</strong> to ON (enforces webcam, fullscreen lock, and 3-strike rule).
      </div>
      <div class="step-action">UI: Click Publish &rarr; Test automatically appears on assigned students' dashboards</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Deploy Soft Skills Question Papers</div>
      <div class="step-detail">
        Open <strong>Soft Skills</strong> (<code>/admin/mock-soft-skills</code>) &rarr; Click <kbd>New Soft Skills Test</kbd>.
        <br>&bull; Step 1: Enter Title, Duration (e.g. 30 mins), and Passing Percentage.
        <br>&bull; Step 2: Click <kbd>Add Ready-Made Question Set</kbd> &rarr; Pick from Sets 1 to 70.
        <br>&bull; Click <kbd>Add Set &amp; Publish</kbd>. Questions are copied into your private test instance.
      </div>
    </div>
  </div>

  <h2>2. Live Anti-Cheat Proctoring Radar &amp; Reinstatement</h2>
  <p>During live examinations, monitor real-time integrity via the Proctoring Console (<code>/admin/proctoring</code>):</p>
  <ul>
    <li><strong>Live Radar Grid:</strong> Displays active test-takers with webcam indicators, tab-switch blur counts, and strike tallies.</li>
    <li><strong>Incident Stream:</strong> Real-time alerts when students trigger Strike 1, Strike 2, or Strike 3 (Lockout).</li>
    <li><strong>How to Reinstate a Locked Student:</strong> If a student is locked out due to verified hardware glitch, click the student's row in the proctoring feed &rarr; Click <kbd>Reinstate Student</kbd> &rarr; Enter mandatory reason. The student can immediately resume the test without resetting previous answers.</li>
  </ul>

  <h2>3. How to Manage Campus Placement Drives</h2>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Map Catalog Drives or Create Private Drives</div>
      <div class="step-detail">
        Open <strong>Campus Drives</strong> (<code>/admin/drives</code>):
        <br>&bull; <strong>Available to Map:</strong> Browse corporate drives syndicated by AptRun hiring partners. Click <kbd>Map to College</kbd> to make the drive visible to your eligible students.
        <br>&bull; <strong>Create Private Drive:</strong> Click <kbd>New Placement Drive</kbd> for visiting companies.
      </div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Set Strict Eligibility Cutoffs &amp; Track Funnel</div>
      <div class="step-detail">
        Configure eligibility rules: Minimum CGPA (e.g. 7.0), Max Backlogs (0), Allowed Branches, and Minimum ARS score (e.g. 65).
        <br>&bull; Track applicants across stages: <code>Registered &rarr; Shortlisted &rarr; OA &rarr; Interview &rarr; Offered &rarr; Accepted</code>.
        <br>&bull; Record final CTC packages (LPA) for accepted offers to feed institutional placement rate metrics.
      </div>
    </div>
  </div>

  <h2>4. How to Generate the 7 Institutional Placement Reports</h2>
  <div class="callout indigo">
    <div class="callout-title">One-Click Excel &amp; PDF Report Generation (<code>/admin/reports</code>)</div>
    <div class="callout-body">
      Select your target branch or section &rarr; Click <kbd>Download Report</kbd> on any of the 7 ready-made reports:
      <br><strong>1. Student Cohort Master (XLSX)</strong> &middot; <strong>2. Placement Readiness Summary (XLSX)</strong> &middot; <strong>3. At-Risk Student Roster (XLSX)</strong> &middot; <strong>4. Campus Drive Shortlist (XLSX)</strong> &middot; <strong>5. Assessment Scores (XLSX)</strong> &middot; <strong>6. Language Competency (XLSX)</strong> &middot; <strong>7. Section Performance (PDF)</strong>.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>College TPO Playbook: Tests, Drives &amp; Reports</span>
    <span>Page 9 of 14</span>
  </div>
</div>

<!-- ================= PAGE 10: FACULTY SECTION COORDINATOR PLAYBOOK ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Coordinator Playbook</span>
      <span>Faculty Section Coordinator Daily Playbook</span>
    </div>
    <div class="header-meta">Coordinator Portal (/coordinator)</div>
  </div>

  <h2>How Section Coordinators Manage Their Classroom: Daily SOP</h2>
  <p>
    As a Faculty Section Coordinator (<code>/coordinator</code>), your mission is daily student engagement, attendance tracking, 
    and early remedial intervention before placement season begins.
  </p>

  <h2>1. Your Morning Routine: The 12-Student "Needs Attention" Queue</h2>
  <p>Every morning, open <code>/coordinator</code>. At the top of your dashboard sits the auto-ranked <strong>Needs Attention</strong> queue:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Student Status</th>
        <th style="width: 14%;">Risk Points</th>
        <th style="width: 44%;">Why They Are in Your Queue</th>
        <th style="width: 20%;">Your Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Locked out of Test</strong></td>
        <td><span class="badge badge-rose">+50 Pts</span></td>
        <td>Received 3 proctoring strikes during a test; currently locked out of assessments.</td>
        <td>Investigate incident in proctoring log; notify TPO if reinstatement is justified.</td>
      </tr>
      <tr>
        <td><strong>Follow-Up Overdue</strong></td>
        <td><span class="badge badge-rose">+45 Pts</span></td>
        <td>A scheduled counseling call or remedial check-in date passed without completion.</td>
        <td>Call student immediately; record notes in follow-up log.</td>
      </tr>
      <tr>
        <td><strong>Follow-Up Due Today</strong></td>
        <td><span class="badge badge-amber">+35 Pts</span></td>
        <td>A scheduled follow-up action is due today.</td>
        <td>Conduct check-in meeting; mark task as Completed.</td>
      </tr>
      <tr>
        <td><strong>Never Signed In</strong></td>
        <td><span class="badge badge-amber">+30 Pts</span></td>
        <td>Account provisioned by TPO but student has never set their password.</td>
        <td>Resend activation credentials or remind student in class.</td>
      </tr>
      <tr>
        <td><strong>Dormant Account</strong></td>
        <td><span class="badge badge-blue">+25 Pts</span></td>
        <td>Zero practice problems or tests completed in the last 14 consecutive days.</td>
        <td>Message student to restart practice habit.</td>
      </tr>
      <tr>
        <td><strong>Needs Training Tier</strong></td>
        <td><span class="badge badge-slate">+15 Pts</span></td>
        <td>Readiness Score (ARS) is below 45 points (&lt;60 is classified At-Risk).</td>
        <td>Assign targeted topic practice or soft skills sets.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. How to Log Follow-Up Interventions</h2>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Select Student &amp; Open Follow-Up Log</div>
      <div class="step-detail">
        In your section roster, click on the student row &rarr; Click <kbd>Add Follow-Up Note</kbd>.
        <br>&bull; <strong>Interaction Type:</strong> Select <em>Phone Call</em>, <em>In-Person Meeting</em>, <em>Message</em>, or <em>Internal Note</em>.
        <br>&bull; <strong>Notes:</strong> Enter details (e.g., "Student struggling with Graph algorithms; advised to complete Easy BFS sheet").
        <br>&bull; <strong>Follow-Up Due Date:</strong> Set a due date (e.g. 7 days from now) to automatically schedule the next check-in.
      </div>
      <div class="step-action">Transparency: All coordinator notes automatically surface in the TPO master cohort drawer</div>
    </div>
  </div>

  <h2>3. Live Section Proctoring &amp; Account Holds</h2>
  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Section-Level Live Proctoring (<code>/coordinator/proctoring</code>)</div>
      <div class="callout-body">
        During college-wide mock tests, coordinators open their dedicated proctoring tab. This feed isolates <strong>only students in your assigned classroom</strong>, letting you spot absent students or webcam violations without sifting through the whole batch.
      </div>
    </div>
    <div class="callout amber">
      <div class="callout-title">Placing Disciplinary Account Blocks</div>
      <div class="callout-body">
        If a student commits repeated infractions, coordinators can place a temporary hold. Click <kbd>Block Account</kbd> on the student row. <strong>A mandatory reason string is required.</strong> Note: Coordinators can only lift blocks placed by themselves; TPO blocks must be lifted by TPO.
      </div>
    </div>
  </div>

  <h2>4. Exporting Section Reports</h2>
  <p>Navigate to <strong>Section Reports</strong> (<code>/coordinator/reports</code>). Download weekly section attendance spreadsheets and ARS growth metrics to present at department faculty meetings.</p>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Faculty Section Coordinator Daily Playbook</span>
    <span>Page 10 of 14</span>
  </div>
</div>

<!-- ================= PAGE 11: RECRUITER PLAYBOOK - SOURCING & TESTING ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Recruiter Playbook 1</span>
      <span>Campus Sourcing, Drive Proposals &amp; Talent Discovery</span>
    </div>
    <div class="header-meta">Recruiter Dashboard (/admin/company)</div>
  </div>

  <h2>How Corporate Recruiters Source &amp; Hire on AptRun: Step-by-Step</h2>
  <p>The Hiring Partner portal (<code>/admin/company</code>) streamlines university recruitment, eliminating unverified resumes and manual screening:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Discover Partner Colleges &amp; Propose Campus Drives</div>
      <div class="step-detail">
        Open <strong>Partner Colleges</strong> (<code>/admin/company/colleges</code>):
        <br>&bull; Browse accredited engineering colleges. Filter by Tier (Tier 1 / 2 / 3), State, and graduating student volume.
        <br>&bull; Click <kbd>Propose Campus Drive</kbd> &rarr; Select your Job Opening (CTC package, dates, roles, cutoffs).
        <br>&bull; The proposal lands directly in the College TPO's inbox. Upon approval, the drive goes live to eligible students.
      </div>
      <div class="step-action">UI: Track proposal statuses (Pending, Approved, Declined) directly in the college directory</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Post Job Openings &amp; Configure the Hiring Funnel</div>
      <div class="step-detail">
        Open <strong>Job Openings</strong> (<code>/admin/company/drives</code>) &rarr; Click <kbd>Post New Opening</kbd>:
        <br>&bull; <strong>Role Details:</strong> Title, Role Type (Full-time, Internship), Location, CTC Range (LPA).
        <br>&bull; <strong>Eligibility Criteria:</strong> Set minimum CGPA, maximum allowed backlogs, and minimum ARS score threshold.
        <br>&bull; <strong>Selection Stages:</strong> Configure your funnel: <code>Online Assessment &rarr; AI Mock &rarr; Tech Panel &rarr; HR Offer</code>.
      </div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Scout Pre-Assessed Candidates in the Talent Pool</div>
      <div class="step-detail">
        Rather than waiting for applications, actively headhunt candidates in <strong>Candidates &gt; Talent Pool</strong>:
        <br>&bull; <strong>Filter by Verified ARS:</strong> Select candidates with ARS &ge; 75 (Placement Ready).
        <br>&bull; <strong>Filter by Language &amp; Stack:</strong> Find developers verified in C++, Java, Python, React, Go, etc.
        <br>&bull; <strong>Filter by Discipline:</strong> Filter software vs core engineering branches (ECE, EEE, Mechanical, Civil).
        <br>&bull; Click <kbd>Invite to Apply</kbd> or <kbd>Direct Interview Invite</kbd> to reach top candidates directly.
      </div>
      <div class="step-action">Guarantee: Zero unverified claims; all candidates in the Vault are actively tested</div>
    </div>
  </div>

  <h2>4. Managing the Candidate Hiring Pipeline</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Pipeline Stage</th>
        <th style="width: 50%;">Candidate Activity &amp; Status</th>
        <th style="width: 30%;">Recruiter Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Applied</strong></td>
        <td>Candidate applied to drive or accepted invitation; academic eligibility pre-verified.</td>
        <td>Review profile; 1-click batch invite to Assessment.</td>
      </tr>
      <tr>
        <td><strong>2. Assessment</strong></td>
        <td>Candidate completes proctored coding and aptitude test. Automated test scores logged.</td>
        <td>Inspect code playback, anti-cheat flags, and ranking.</td>
      </tr>
      <tr>
        <td><strong>3. AI Interview</strong></td>
        <td>Candidate completes asynchronous voice AI interview round. Transcripts available.</td>
        <td>Listen to recordings; review rubric scores.</td>
      </tr>
      <tr>
        <td><strong>4. Technical Panel</strong></td>
        <td>Candidate scheduled for live video interview with engineering leads.</td>
        <td>Record interviewer feedback and recommendation.</td>
      </tr>
      <tr>
        <td><strong>5. Offer Extended</strong></td>
        <td>Official offer letter dispatched through platform with CTC details.</td>
        <td>Track candidate offer acceptance in real time.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Recruiter Playbook: Sourcing, Drives &amp; Discovery</span>
    <span>Page 11 of 14</span>
  </div>
</div>

<!-- ================= PAGE 12: RECRUITER PLAYBOOK - ASSESSMENTS & VAULT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Recruiter Playbook 2</span>
      <span>Custom Assessments &amp; Vault Verification</span>
    </div>
    <div class="header-meta">Recruiter Dashboard (/admin/company/assessments &amp; /admin/company/vault)</div>
  </div>

  <h2>1. How to Author Custom Technical Assessments</h2>
  <p>Hiring partners can author bespoke coding and soft skill tests (<code>/admin/company/assessments</code>) tailored to their tech stacks:</p>

  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Create Test &amp; Select Problem Bank Questions</div>
      <div class="step-detail">
        Click <kbd>Create Assessment</kbd> &rarr; Map to your active Job Opening.
        <br>&bull; Choose problems from AptRun's shared library or author custom proprietary coding challenges.
        <br>&bull; Configure allowed languages (e.g. restrict to Java and C++ for backend roles).
        <br>&bull; Add an aptitude screening section by attaching ready-made Soft Skills sets (Sets 1 to 70).
      </div>
      <div class="step-action">UI: Click Publish &rarr; Generate secure candidate invite links or dispatch via email</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Inspect Anti-Cheat Reports &amp; Keystroke Playback</div>
      <div class="step-detail">
        Open <strong>Proctoring</strong> (<code>/admin/company/proctoring</code>) to review test integrity:
        <br>&bull; Review candidate webcam snapshots taken throughout the assessment.
        <br>&bull; Inspect window blur and fullscreen violation counts.
        <br>&bull; <strong>Code Replay:</strong> Click <kbd>Replay Code</kbd> to watch a keystroke-by-keystroke playback of how the candidate developed their solution, detecting sudden pastes of pre-written code.
      </div>
    </div>
  </div>

  <h2>2. How to Review Asynchronous AI Mock Interviews</h2>
  <p>Recruiters evaluate candidate voice interview recordings in <code>/admin/company/interviews</code>:</p>

  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Audio Playback with Transcript Sync</div>
      <div class="callout-body">
        Listen to spoken candidate answers at 1.0x, 1.25x, or 1.5x speed. The verbatim transcript highlights words in sync with the audio, allowing you to evaluate verbal confidence, clarity, and technical terminology.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">AI Rubrics with Human Score Overrides</div>
      <div class="callout-body">
        Review Gemini's automated breakdown across Technical Correctness, Communication, and Problem Solving. Recruiters can adjust scores manually and append private interviewer notes before deciding on next rounds.
      </div>
    </div>
  </div>

  <h2>3. How to Verify Credentials in The Mellow Vault</h2>
  <p>The Vault Verification portal (<code>/admin/company/vault</code>) lets recruiters verify proof-of-work with zero reliance on unverified resumes:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Credential Dimension</th>
        <th style="width: 45%;">What You Can Authenticate</th>
        <th style="width: 30%;">Recruiter Benefit</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Project Lab Code Repos</strong></td>
        <td>Inspect the actual source code, Git commit history, and live container deployment of the student's capstone project.</td>
        <td>Confirms true software craftsmanship versus copied boilerplate tutorials.</td>
      </tr>
      <tr>
        <td><strong>Contest Elo Rating</strong></td>
        <td>Inspect verified performance curves across weekly timed proctored coding contests under 3-strike anti-cheat rules.</td>
        <td>Proves genuine algorithmic speed and problem-solving under strict exam conditions.</td>
      </tr>
      <tr>
        <td><strong>Spoken English &amp; Fluency</strong></td>
        <td>Review objective pronunciation accuracy scores (SpeechAlignment), WPM pacing, and situational judgment scores.</td>
        <td>Accelerates screening for multinational client-facing roles.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Exporting Candidate Hiring Reports</h2>
  <p>Open <strong>Hiring Reports</strong> (<code>/admin/company/reports</code>). View candidate conversion funnels, offer-acceptance ratios, and download complete candidate spreadsheets formatted for corporate ATS import (Workday, Greenhouse, Lever).</p>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Recruiter Playbook: Assessments &amp; Vault Verification</span>
    <span>Page 12 of 14</span>
  </div>
</div>

<!-- ================= PAGE 13: SUPERADMIN MASTER CONTROL PLAYBOOK ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Superadmin Playbook</span>
      <span>Superadmin Master Governance &amp; Scaling Playbook</span>
    </div>
    <div class="header-meta">Superadmin Master Console (/superadmin)</div>
  </div>

  <h2>How to Operate the Superadmin Master Console</h2>
  <p>
    The Superadmin Master Control (<code>/superadmin</code>) is restricted to <code>role: superadmin</code>. 
    It controls platform economics, university tenant provisioning, payment reconciliation, and infrastructure scaling.
  </p>

  <h2>1. Plans &amp; Dynamic Pricing Management</h2>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Update Plan Pricing in Real Time</div>
      <div class="step-detail">
        Open <strong>Plans &amp; Pricing</strong> (<code>/superadmin?tab=plans</code>):
        <br>&bull; Edit the <strong>List Price</strong> and <strong>Sale Price</strong> for the Expert plan (e.g. list &dollar;14,999, sale &dollar;12,999/yr).
        <br>&bull; Changes apply immediately on the public pricing page and checkout without redeploying code.
        <br>&bull; <em>Grandmaster Plan:</em> Marked <code>contact_only = true</code>. Shows "Sold by our team" and cannot be bought online.
      </div>
      <div class="step-action">UI: Click Save Changes &rarr; Pricing cache clears instantly</div>
    </div>
  </div>

  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Adjust Daily Feature Limits</div>
      <div class="step-detail">
        Click <kbd>Edit Limits</kbd> on any plan card:
        <br>&bull; Modify daily coding limits, daily AI mock interview quotas, and monthly Project Lab workspace-hours (default: 80 hrs).
        <br>&bull; Toggle access switches: <code>hackathon_access</code>, <code>vault_access</code>, <code>project_lab_access</code>.
      </div>
    </div>
  </div>

  <h2>2. Manual Subscription Overrides &amp; Payment Grants</h2>
  <p>Superadmins can grant, extend, or terminate plans manually (<code>/superadmin?tab=subscriptions</code>):</p>
  <ul>
    <li><strong>Give a Plan:</strong> Click <kbd>Give Plan</kbd> &rarr; Pick student email &rarr; Select plan (Expert or Grandmaster) &rarr; Set term (1 to 1,825 days) &rarr; <strong>Enter mandatory audit reason</strong>. Choose <em>Free of Charge</em> or <em>Paid Outside Gateway</em> (records offline fee).</li>
    <li><strong>Extend Days:</strong> Adds days to <code>current_period_end</code> without altering historical pricing.</li>
    <li><strong>Cancel Plan:</strong> Reverts student immediately to free Coder tier. Cancelling a university or corporate plan requires re-entering the Superadmin master password.</li>
  </ul>

  <h2>3. Safe Impersonation ("View As User" Mode)</h2>
  <div class="callout green">
    <div class="callout-title">Write-Locked Diagnostic Impersonation</div>
    <div class="callout-body">
      To troubleshoot user issues, open <strong>Accounts &amp; Logins</strong> &rarr; Click <kbd>Manage</kbd> on any user &rarr; Click <kbd>View as this user</kbd>.
      <br>&bull; Generates an impersonation token (<code>impersonation:&lt;id&gt;</code>).
      <br>&bull; <strong>Write-Lock Guarantee:</strong> The middleware (<code>RejectWritesWhileImpersonating</code>) automatically blocks all state-mutating requests (POST, PUT, DELETE) with <code>403 Forbidden</code>, preventing accidental data corruption while inspecting a student or TPO dashboard.
    </div>
  </div>

  <h2>4. Immutable Audit Ledger &amp; Judge Scaling Infrastructure</h2>
  <div class="grid-2">
    <div class="callout indigo">
      <div class="callout-title">Immutable Audit Log (<code>/superadmin?tab=audit</code>)</div>
      <div class="callout-body">
        Every administrative modification records Actor ID, Target Model, Action verb, before/after JSON diff, user IP address, and mandatory reason. Guarantees complete compliance and accountability.
      </div>
    </div>
    <div class="callout amber">
      <div class="callout-title">Judge Infrastructure (<code>/superadmin?tab=infrastructure</code>)</div>
      <div class="callout-body">
        Monitor Piston runner worker pools, Redis execution queues, and WebSocket signaling. Benchmarked to sustain concurrent examination loads exceeding 1,000+ active students simultaneously.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Superadmin Master Governance &amp; Scaling Playbook</span>
    <span>Page 13 of 14</span>
  </div>
</div>

<!-- ================= PAGE 14: CHEAT SHEET & TROUBLESHOOTING FAQ ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Reference Guide</span>
      <span>Operational Cheat Sheet &amp; Troubleshooting FAQ</span>
    </div>
    <div class="header-meta">Platform-Wide Quick Reference</div>
  </div>

  <h2>Role-by-Role Daily Action Checklist</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 18%;">User Role</th>
        <th style="width: 42%;">Daily Operations Checklist</th>
        <th style="width: 40%;">Primary Target Metric</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Student Coder</strong></td>
        <td>1. Solve 1-2 DSA problems &middot; 2. Complete daily 3-min Vocabulary Sprint &middot; 3. Take 1 Speaking/Interview mock &middot; 4. Check active drives.</td>
        <td>Maintain streak; push ARS &ge; 60 to unlock The Vault.</td>
      </tr>
      <tr>
        <td><strong>College TPO</strong></td>
        <td>1. Review batch placement funnel &middot; 2. Inspect At-Risk (&lt;60 ARS) students &middot; 3. Map new campus drives &middot; 4. Export weekly XLSX reports.</td>
        <td>Achieve 100% batch drive eligibility and placement conversion.</td>
      </tr>
      <tr>
        <td><strong>Section Coordinator</strong></td>
        <td>1. Check top 12 "Needs Attention" queue &middot; 2. Contact overdue students &middot; 3. Log intervention notes &middot; 4. Monitor live section mock tests.</td>
        <td>Clear daily overdue follow-up tickets; lift unjustified blocks.</td>
      </tr>
      <tr>
        <td><strong>Corporate Recruiter</strong></td>
        <td>1. Check drive applications &middot; 2. Search pre-assessed Vault talent &middot; 3. Review AI mock interview audio/transcripts &middot; 4. Issue offer letters.</td>
        <td>Accelerate Time-to-Hire with pre-vetted candidates.</td>
      </tr>
      <tr>
        <td><strong>Superadmin</strong></td>
        <td>1. Check Piston Judge latency &middot; 2. Review payment reconciliation logs &middot; 3. Audit manual grants &middot; 4. Monitor university onboarding leads.</td>
        <td>Maintain 99.99% judge uptime and zero subscription leakage.</td>
      </tr>
    </tbody>
  </table>

  <h2>Troubleshooting &amp; Frequently Asked Questions (FAQ)</h2>
  <div class="grid-2">
    <div class="callout amber">
      <div class="callout-title">Q: My webcam is blocked or test says "Hardware Not Found"</div>
      <div class="callout-body">
        <strong>Fix:</strong> Click the lock/tune icon on your browser address bar &rarr; Set Camera and Microphone to <em>Allow</em>. Close any apps that use the webcam (Zoom, Teams, Discord) and refresh the page.
      </div>
    </div>
    <div class="callout amber">
      <div class="callout-title">Q: I got 3 strikes and got locked out of a contest</div>
      <div class="callout-body">
        <strong>Fix:</strong> Contact your College TPO or Section Coordinator immediately. They can open the proctoring incident log and click <kbd>Reinstate Student</kbd> to unlock your session without losing saved answers.
      </div>
    </div>
    <div class="callout">
      <div class="callout-title">Q: My Project Lab workspace shows "Disconnected"</div>
      <div class="callout-body">
        <strong>Fix:</strong> If you are idle for 15 minutes, your container stops automatically to save monthly hours. Simply click <kbd>Restart Workspace</kbd>. All your code on the persistent volume is restored.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Q: I bought Expert or got a grant but features still show locked</div>
      <div class="callout-body">
        <strong>Fix:</strong> The client polls <code>/api/me/plan-signal</code> every 30s. If you don't see it immediately, navigate to <strong>Plans &amp; Billing</strong> (<code>/dashboard/billing</code>) to trigger an instant signature refetch.
      </div>
    </div>
  </div>

  <h2>System Support &amp; Escalation Directory</h2>
  <div style="background: #0f172a; color: #ffffff; border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
    <div>
      <div style="font-size: 8.5pt; font-weight: 700;">AptRun™ Enterprise Skilling &middot; Product of Mellow Vault (Prayukti Development Pvt. Ltd. &middot; CIN: U62099UP2024PTC207212)</div>
      <div style="font-size: 7.2pt; color: #94a3b8;">Official Support &amp; Helpdesk: support@mellowvault.com &middot; Helpline: +91 76785 78295 &middot; Registered Office: Noida / New Delhi, India</div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-green" style="font-size: 7.5pt;">SYSTEM OPERATIONAL &middot; 99.99%</span>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Cheat Sheet, Troubleshooting FAQ &amp; Escalation Directory</span>
    <span>Page 14 of 14</span>
  </div>
</div>

</body>
</html>
"""

    # Replace middle dots with &middot; for clean rendering
    html_content = html_content.replace(" · ", " &middot; ")

    temp_html_path = r"D:\Dev\AptRun\generate_how_to_temp.html"
    with open(temp_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    output_pdf = r"D:\Dev\AptRun\docs\AptRun-Complete-Feature-Guide.pdf"
    alt_pdf = r"D:\Dev\AptRun\docs\AptRun-User-Guide-How-To-Use.pdf"
    std_pdf = r"D:\Dev\AptRun\docs\AptRun-Feature-Guide.pdf"

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

    print("Running Edge headless print-to-pdf for How-To-Use Guide...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    time.sleep(2)

    if os.path.exists(output_pdf):
        print(f"Successfully generated PDF: {output_pdf} (Size: {os.path.getsize(output_pdf)} bytes)")
        import shutil
        shutil.copyfile(output_pdf, alt_pdf)
        shutil.copyfile(output_pdf, std_pdf)
        print(f"Copied to: {alt_pdf} and {std_pdf}")
    else:
        print("Failed to generate PDF. Stdout:", res.stdout, "Stderr:", res.stderr)

    if os.path.exists(temp_html_path):
        os.remove(temp_html_path)

if __name__ == "__main__":
    build_how_to_use_pdf()
