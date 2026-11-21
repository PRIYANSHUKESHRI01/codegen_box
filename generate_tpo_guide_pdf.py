import base64
import os
import subprocess
import time

def build_tpo_guide_pdf():
    # Read logo
    logo_path = r"D:\Dev\AptRun\aptRun Logo.png"
    with open(logo_path, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AptRun Enterprise Campus Readiness Platform: Training &amp; Placement Officer (TPO) &amp; Institutional Administrator Guide</title>
<style>
  @page {{
    size: A4 portrait;
    margin: 7mm 9mm 9mm 9mm;
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
      height: 281mm;
      max-height: 281mm;
      box-sizing: border-box;
      overflow: hidden;
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
    font-size: 8.2pt;
    line-height: 1.34;
  }}

  .page {{
    padding: 1.5mm 1mm 7mm 1mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    height: 281mm;
    max-height: 281mm;
    box-sizing: border-box;
    overflow: hidden;
  }}

  /* Header Bar */
  .header-bar {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0284c7;
    padding-bottom: 4px;
    margin-bottom: 7px;
  }}
  .header-title {{
    font-size: 7.6pt;
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
    font-size: 7pt;
    color: #64748b;
  }}

  /* Footer Bar */
  .footer-bar {{
    position: absolute;
    bottom: 1mm;
    left: 1mm;
    right: 1mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 3px;
    font-size: 6.9pt;
    color: #94a3b8;
  }}

  /* Typography */
  h1 {{
    font-size: 15.5pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 3px;
  }}
  h2 {{
    font-size: 10.2pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-top: 5px;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }}
  h3 {{
    font-size: 8.7pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 4px;
    margin-bottom: 2px;
  }}
  p {{
    font-size: 7.9pt;
    color: #334155;
    margin-bottom: 4px;
    line-height: 1.32;
  }}

  /* Action Step Box */
  .step-box {{
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    padding: 5px 8px;
    margin-bottom: 5px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }}
  .step-num {{
    background: #0284c7;
    color: #ffffff;
    font-size: 7.2pt;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    flex-shrink: 0;
    margin-top: 1px;
  }}
  .step-content {{
    flex: 1;
  }}
  .step-title {{
    font-size: 8.1pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1px;
  }}
  .step-desc {{
    font-size: 7.6pt;
    color: #334155;
    line-height: 1.28;
  }}

  /* Callouts */
  .callout {{
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 5px 8px;
    margin-bottom: 5px;
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
  .callout.purple {{
    border-left-color: #7c3aed;
    background: #faf5ff;
  }}
  .callout-title {{
    font-size: 7.7pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1px;
  }}
  .callout-body {{
    font-size: 7.4pt;
    color: #334155;
    line-height: 1.26;
  }}

  /* Grids */
  .grid-2 {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-bottom: 5px;
  }}
  .grid-3 {{
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    margin-bottom: 5px;
  }}
  .grid-4 {{
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 5px;
  }}

  .card {{
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 5px 7px;
  }}
  .card.accent {{
    border-left: 2.5px solid #0284c7;
    background: #f8fafc;
  }}
  .card.emerald {{
    border-left: 2.5px solid #059669;
    background: #f0fdf4;
  }}
  .card.purple {{
    border-left: 2.5px solid #7c3aed;
    background: #faf5ff;
  }}
  .card.amber {{
    border-left: 2.5px solid #d97706;
    background: #fffbeb;
  }}

  /* Tables */
  table.data-table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5px;
    font-size: 7.5pt;
  }}
  table.data-table th {{
    background: #0f172a;
    color: #ffffff;
    font-weight: 700;
    padding: 4px 6px;
    text-align: left;
    border: 1px solid #1e293b;
    font-size: 7.2pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }}
  table.data-table td {{
    padding: 3.5px 6px;
    border: 1px solid #cbd5e1;
    color: #334155;
    line-height: 1.24;
  }}
  table.data-table tr:nth-child(even) td {{
    background: #f8fafc;
  }}

  /* Badges */
  .badge {{
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 6.6pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }}
  .badge-blue {{ background: #e0f2fe; color: #0369a1; }}
  .badge-green {{ background: #dcfce7; color: #15803d; }}
  .badge-purple {{ background: #f3e8ff; color: #7e22ce; }}
  .badge-amber {{ background: #fef3c7; color: #b45309; }}
  .badge-slate {{ background: #f1f5f9; color: #475569; }}

  .meta-tag {{
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7pt;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #e2e8f0;
    color: #0f172a;
  }}
</style>
</head>
<body>

<!-- ================================================= PAGE 1 ================================================= -->
<div class="page">
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 6mm;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="data:image/png;base64,{logo_b64}" alt="AptRun" style="height: 38px; width: auto;" />
      <div>
        <div style="font-size: 13.5pt; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">AptRun™ Enterprise Campus Readiness Platform</div>
        <div style="font-size: 7.6pt; color: #0369a1; font-weight: 700; letter-spacing: 0.04em;">COLLEGE TPO &amp; INSTITUTIONAL ADMINISTRATOR GUIDE &middot; GLOBAL EDITION 2026&ndash;2027</div>
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-purple" style="font-size: 7.2pt; padding: 2px 7px;">INSTITUTIONAL ADMINISTRATION PLAYBOOK</span>
      <div style="font-size: 6.8pt; color: #64748b; margin-top: 2px;">NAAC (2.3 &amp; 5.2) &middot; NIRF (METRIC 3) &middot; ABET ALIGNED</div>
    </div>
  </div>

  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 6px; padding: 12px 14px; margin-bottom: 6mm; border-left: 4px solid #0284c7;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="max-width: 78%;">
        <div style="font-size: 7.4pt; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: 0.06em;">Executive Institutional Manual &amp; Accreditation Playbook</div>
        <div style="font-size: 14pt; font-weight: 800; margin: 2px 0 4px 0; letter-spacing: -0.01em;">AptRun™ College TPO Guide: Governance, Batch Analytics &amp; Placement Pipeline</div>
        <div style="font-size: 8pt; color: #cbd5e1; line-height: 1.35;">
          The authoritative administrative and operational handbook for University Placement Directors, Training &amp; Placement Officers (TPOs), Deans of Academic Affairs, HODs, and Faculty Section Coordinators across 150+ partner universities worldwide. Manage large-scale student cohorts, automate campus mock drives, monitor real-time skill gaps, enforce assessment integrity, and connect campus cohorts directly with 500+ global corporate recruiters.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12);">
        <div style="font-size: 7.2pt; color: #94a3b8;">Enterprise Entity:</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #ffffff;">Mellow Vault</div>
        <div style="font-size: 6.8pt; color: #38bdf8;">Prayukti Development Pvt. Ltd.</div>
        <div style="font-size: 6.2pt; color: #94a3b8; margin-top: 2px;">CIN: U62099UP2024PTC207212</div>
      </div>
    </div>
  </div>

  <div class="grid-4" style="margin-bottom: 6mm;">
    <div class="card accent">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Campus Scale</div>
      <div style="font-size: 13pt; font-weight: 800; color: #0284c7;">500 &ndash; 50,000+</div>
      <div style="font-size: 7pt; color: #334155;">Students per Institution</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #64748b; font-size: 7.2pt; text-transform: uppercase;">Corporate Bridge</div>
      <div style="font-size: 13pt; font-weight: 800; color: #059669;">500+ Hiring Cos</div>
      <div style="font-size: 7pt; color: #334155;">Direct Mellow Vault Sourcing</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #64748b; font-size: 7.2pt; text-transform: uppercase;">Faculty Access</div>
      <div style="font-size: 13pt; font-weight: 800; color: #7c3aed;">RBAC Scoped</div>
      <div style="font-size: 7pt; color: #334155;">Section Coordinator Portals</div>
    </div>
    <div class="card amber">
      <div style="font-weight: 700; color: #64748b; font-size: 7.2pt; text-transform: uppercase;">Accreditation Reports</div>
      <div style="font-size: 13pt; font-weight: 800; color: #d97706;">1-Click Export</div>
      <div style="font-size: 7pt; color: #334155;">NAAC, NIRF &amp; ABET Formatted</div>
    </div>
  </div>

  <h2>Table of Contents &middot; Institutional Administration Directory</h2>
  <table class="data-table" style="margin-bottom: 5mm;">
    <thead>
      <tr>
        <th style="width: 10%;">Section</th>
        <th style="width: 38%;">Chapter &amp; Functional Scope</th>
        <th style="width: 42%;">Key Capabilities Covered</th>
        <th style="width: 10%; text-align: center;">Page</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Part 01</strong></td>
        <td><strong>Institutional Architecture &amp; Partnership Charter</strong></td>
        <td>Enterprise multi-tenant model, data isolation, accreditation mapping, global footprint</td>
        <td style="text-align: center; font-weight: 700;">Page 02</td>
      </tr>
      <tr>
        <td><strong>Part 02</strong></td>
        <td><strong>TPO Master Portal Setup &amp; Role Hierarchy</strong></td>
        <td>Master TPO account setup, department catalogue, delegating section coordinators</td>
        <td style="text-align: center; font-weight: 700;">Page 03</td>
      </tr>
      <tr>
        <td><strong>Part 03</strong></td>
        <td><strong>Student Roster Management &amp; Batch Onboarding</strong></td>
        <td>CSV bulk import schema, automated credentials email, transfer/graduation archive</td>
        <td style="text-align: center; font-weight: 700;">Page 04</td>
      </tr>
      <tr>
        <td><strong>Part 04</strong></td>
        <td><strong>Institutional Subscription, Seat Quota &amp; Project Lab</strong></td>
        <td>Enterprise vs Pro Campus, seat monitoring, Project Lab toggle switch, plan renewals</td>
        <td style="text-align: center; font-weight: 700;">Page 05</td>
      </tr>
      <tr>
        <td><strong>Part 05</strong></td>
        <td><strong>Cohort Analytics, ARS Matrix &amp; Skill Gap Heatmaps</strong></td>
        <td>Campus readiness distribution (ARS 80+), skill gap analytics across departments</td>
        <td style="text-align: center; font-weight: 700;">Page 06</td>
      </tr>
      <tr>
        <td><strong>Part 06</strong></td>
        <td><strong>Administering Campus Mock Drives &amp; Assessments</strong></td>
        <td>Custom drive scheduling, multi-stage tests, TCS/Infosys/Accenture blueprint presets</td>
        <td style="text-align: center; font-weight: 700;">Page 07</td>
      </tr>
      <tr>
        <td><strong>Part 07</strong></td>
        <td><strong>Proctoring Governance, Anti-Cheat &amp; Live Audit</strong></td>
        <td>Live proctor console, webcam flags, tab switches, Guardian desktop client integration</td>
        <td style="text-align: center; font-weight: 700;">Page 08</td>
      </tr>
      <tr>
        <td><strong>Part 08</strong></td>
        <td><strong>Section Coordinators &amp; Faculty Engagement</strong></td>
        <td>Department faculty dashboards, daily practice hours, early warning on lagging students</td>
        <td style="text-align: center; font-weight: 700;">Page 09</td>
      </tr>
      <tr>
        <td><strong>Part 09</strong></td>
        <td><strong>Corporate Placement Connect &amp; Mellow Vault Sourcing</strong></td>
        <td>Receiving corporate drive proposals, 1-click candidate shortlisting, resume vault</td>
        <td style="text-align: center; font-weight: 700;">Page 10</td>
      </tr>
      <tr>
        <td><strong>Part 10</strong></td>
        <td><strong>Accreditation Compliance &amp; Regulatory Data Exports</strong></td>
        <td>1-Click NAAC (5.1.2 &amp; 5.2.1) and NIRF Metric 3 placement tables, ISO 27001 data audit</td>
        <td style="text-align: center; font-weight: 700;">Page 11</td>
      </tr>
      <tr>
        <td><strong>Part 11</strong></td>
        <td><strong>Institutional SLA, Dedicated Support &amp; University Hotline</strong></td>
        <td>University Relationship Manager (URM), 99.95% uptime SLA, FDP faculty workshops</td>
        <td style="text-align: center; font-weight: 700;">Page 12</td>
      </tr>
    </tbody>
  </table>

  <div class="callout green">
    <div class="callout-title">Institutional Partnership Commitment</div>
    <div class="callout-body">
      AptRun is deployed across 150+ premier institutions globally. Our institutional architecture ensures complete student privacy, automated faculty coordination, and verifiable readiness data that directly empowers your university placement statistics and national accreditation rankings.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 01 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 2 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 01</span>
      Institutional Architecture &amp; Partnership Charter
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Executive Summary &amp; University Mission</h2>
  <p>The contemporary campus placement landscape requires universities to transition from episodic, manual placement training into a continuous, data-driven readiness pipeline. AptRun provides a unified, enterprise-grade assessment and skilling platform engineered specifically for university leadership.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 8pt; margin-bottom: 2px;">The Industry-Academia Divide</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Standard university curricula often lag behind rapid corporate demands in modern software stacks, cloud containerization, and multimodal AI interview formats. AptRun bridges this gap by embedding real-world engineering practices and corporate assessment patterns directly into university campus life.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Automated Institutional Governance</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Eliminate thousands of hours spent scheduling paper tests, grading assignments manually, and compiling placement spreadsheets. AptRun's automated proctoring, instant code execution, and dynamic readiness matrices provide real-time institutional visibility.
      </p>
    </div>
  </div>

  <h2>2. Multi-Tier Institutional Hierarchy</h2>
  <div class="step-box">
    <div class="step-num">Tier 1</div>
    <div class="step-content">
      <div class="step-title">Master TPO &amp; Placement Directorate Admin</div>
      <div class="step-desc">University-wide governance: oversees all departments, sets institutional pass cutoffs, manages subscription seats, approves corporate drive proposals, and exports university placement reports.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Tier 2</div>
    <div class="step-content">
      <div class="step-title">Department Heads (HODs) &amp; Placement Officers</div>
      <div class="step-desc">Branch-specific governance: monitors department cohorts (CSE, ECE, Mechanical, Civil), analyzes department skill gap heatmaps, and tracks branch placement eligibility.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Tier 3</div>
    <div class="step-content">
      <div class="step-title">Faculty Section Coordinators</div>
      <div class="step-desc">Classroom-level execution: mentors assigned sections (e.g., Section 4A), tracks daily practice hours, receives early warning alerts on lagging students, and monitors live proctored mock tests.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Tier 4</div>
    <div class="step-content">
      <div class="step-title">Student Cohorts (Undergraduate &amp; Postgraduate)</div>
      <div class="step-desc">Accesses coding arena, core engineering modules, Vault AI mocks, and Project Lab cloud workspaces under full institutional sponsorship.</div>
    </div>
  </div>

  <h2>3. Global Accreditation Alignment Matrix</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Accreditation Framework</th>
        <th style="width: 45%;">Specific Metric / Evaluation Standard</th>
        <th style="width: 30%;">AptRun Compliance Deliverable</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>NAAC (Criterion 5.1.2)</strong></td>
        <td>Capacity building and skills enhancement initiatives: Soft skills, Language and communication, Life skills, Computing skills.</td>
        <td>Automated institutional report certifying student hours across Spoken English, Vocab Sprint, and Monaco Coding IDE.</td>
      </tr>
      <tr>
        <td><strong>NAAC (Criterion 5.2.1)</strong></td>
        <td>Percentage of placement of outgoing students and progression to higher education.</td>
        <td>Direct export of verified candidate placement ledger with company names, CTC bands, and offer letters.</td>
      </tr>
      <tr>
        <td><strong>NIRF (Metric 3 &ndash; GO)</strong></td>
        <td>Graduation Outcomes: Percentage of students placed and median salary of graduating batch.</td>
        <td>Comprehensive CSV/Excel export formatted directly to NIRF data submission specifications.</td>
      </tr>
      <tr>
        <td><strong>ABET (Student Outcomes 1&ndash;7)</strong></td>
        <td>Ability to identify, formulate, and solve complex engineering problems and design system components.</td>
        <td>Project Lab Statement of Work (SOW) audit records and algorithmic execution traces.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 02 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 3 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 02</span>
      TPO Master Portal Setup &amp; Role Hierarchy
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Activating the University TPO Master Account</h2>
  <p>Upon institutional partnership finalization, Mellow Vault provisions your master university tenant. The designated Director of Placements / Master TPO receives an official provisioning email:</p>

  <div class="step-box">
    <div class="step-num">Step 1</div>
    <div class="step-content">
      <div class="step-title">Initial Master Admin Login &amp; Two-Factor Setup</div>
      <div class="step-desc">Navigate to <span class="meta-tag">https://aptrun.com/login</span>. Enter the master TPO email and temporary key provided in your partnership deed. Set a permanent administrator password and enable mandatory 2FA.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 2</div>
    <div class="step-content">
      <div class="step-title">Configure Institutional Profile &amp; Campus Branding</div>
      <div class="step-desc">Go to <strong>Settings &rarr; Institution Profile</strong>. Verify college full legal name, campus code, official domain allowlist (e.g., <span class="meta-tag">@mit.edu</span>, <span class="meta-tag">@iitd.ac.in</span>), and upload your official university crest.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 3</div>
    <div class="step-content">
      <div class="step-title">Set Default Academic Departments &amp; Branches</div>
      <div class="step-desc">Enable your campus academic departments: Computer Science &amp; Engineering, Information Technology, Electronics &amp; Communication, Mechanical, Electrical, Civil, and Management.</div>
    </div>
  </div>

  <h2>2. Delegating Section Coordinators &amp; Role-Based Access (RBAC)</h2>
  <p>To distribute operational workload while preserving institutional privacy, TPOs can appoint faculty Section Coordinators with strictly scoped permissions:</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Master TPO Admin</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Full campus control: manage subscriptions, assign college plans, delete/purge college records, invite coordinators, and manage all corporate drives.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Department HOD</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Department-scoped visibility: view all sections within CSE or ECE, export branch readiness matrices, and schedule department-wide mock assessments.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Section Coordinator</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Classroom-scoped visibility: track specific assigned sections (e.g. CSE-A, CSE-B), view daily practice streaks, and monitor live proctoring for their section only.</div>
    </div>
  </div>

  <h2>3. Inviting Faculty Section Coordinators</h2>
  <div class="step-box">
    <div class="step-num">&#128101;</div>
    <div class="step-content">
      <div class="step-title">Adding a Coordinator via the TPO Portal</div>
      <div class="step-desc">In the TPO Dashboard, navigate to <strong>Faculty &rarr; Section Coordinators &rarr; Add Coordinator</strong>. Enter the faculty member's name, official college email, department, and assigned section code (e.g. <em>"CSE-4B"</em>).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128274;</div>
    <div class="step-content">
      <div class="step-title">Zero Cross-Section Data Leakage</div>
      <div class="step-desc">Faculty coordinators cannot view students outside their designated section. Sensitive financial data, campus subscription prices, and corporate recruiter negotiation notes remain locked exclusively to the Master TPO.</div>
    </div>
  </div>

  <h2>4. Institutional Audit Logs &amp; Security Compliance</h2>
  <div class="callout green">
    <div class="callout-title">Enterprise Audit Trail Recording</div>
    <div class="callout-body">
      Every administrative action&mdash;including roster imports, student score overrides, mock assessment scheduling, coordinator invitations, and data exports&mdash;is permanently recorded in the institutional audit log with admin user ID, IP address, and cryptographic timestamp.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 03 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 4 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 03</span>
      Student Roster Management &amp; Batch Onboarding
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. High-Scale Bulk CSV Student Import</h2>
  <p>AptRun's ingestion engine is optimized to onboard entire university batches (10,000+ students) in under 3 minutes with automated schema validation and duplicate elimination.</p>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 18%;">CSV Column Header</th>
        <th style="width: 15%;">Data Type</th>
        <th style="width: 32%;">Description &amp; Validation Constraints</th>
        <th style="width: 35%;">Sample Entry</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="meta-tag">name</span></td>
        <td>String (Req)</td>
        <td>Student's full legal name. Automatically title-cased.</td>
        <td>Priya Sharma</td>
      </tr>
      <tr>
        <td><span class="meta-tag">email</span></td>
        <td>Email (Req)</td>
        <td>Official college or personal email. Must be unique across platform.</td>
        <td>priya.sharma@campus.edu</td>
      </tr>
      <tr>
        <td><span class="meta-tag">roll_number</span></td>
        <td>String (Req)</td>
        <td>University registration number or campus enrollment ID.</td>
        <td>2023-CSE-0142</td>
      </tr>
      <tr>
        <td><span class="meta-tag">branch</span></td>
        <td>String (Req)</td>
        <td>Department code: <span class="meta-tag">CSE</span>, <span class="meta-tag">ECE</span>, <span class="meta-tag">ME</span>, <span class="meta-tag">CE</span>, <span class="meta-tag">EE</span>, <span class="meta-tag">IT</span>.</td>
        <td>CSE</td>
      </tr>
      <tr>
        <td><span class="meta-tag">section</span></td>
        <td>String (Opt)</td>
        <td>Class section identifier (e.g., A, B, Section-1).</td>
        <td>A</td>
      </tr>
      <tr>
        <td><span class="meta-tag">cgpa</span></td>
        <td>Decimal (Opt)</td>
        <td>Cumulative Grade Point Average (0.00 to 10.00 scale).</td>
        <td>8.75</td>
      </tr>
      <tr>
        <td><span class="meta-tag">backlogs</span></td>
        <td>Integer (Opt)</td>
        <td>Current count of active academic arrears / backlogs (default: 0).</td>
        <td>0</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Automated Student Credentials Dispatch</h2>
  <div class="step-box">
    <div class="step-num">&#9993;</div>
    <div class="step-content">
      <div class="step-title">Direct SMTP Automated Delivery</div>
      <div class="step-desc">Immediately upon CSV upload, the system generates secure individual accounts and dispatches official welcome emails containing the student's username and temporary password.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128229;</div>
    <div class="step-content">
      <div class="step-title">Instant CSV Credential Backup Download</div>
      <div class="step-desc">If your campus operates in offline network environments or students lack immediate email access, the TPO portal provides a one-click password roster CSV download to distribute passwords in person.</div>
    </div>
  </div>

  <h2>3. Managing Cohort Lifecycle &amp; Section Transfers</h2>
  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Handling Section &amp; Branch Transfers</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        If a student transfers from Section A to Section B or switches engineering disciplines, update their profile via <strong>Student Directory &rarr; Edit Profile</strong> or re-upload the revised CSV. Historical coding submissions and ARS scores are preserved seamlessly.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Graduating Batch Archival</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        At the end of an academic cycle, graduating students can be transitioned to the <em>Alumni Talent Pool</em> with one click. Their verified resumes and ARS scores remain searchable by corporate recruiters in Mellow Vault, while freeing active campus seats.
      </p>
    </div>
  </div>

  <h2>4. Roster Data Sanitation &amp; Error Prevention</h2>
  <div class="callout amber">
    <div class="callout-title">Pre-Flight Ingestion Verification</div>
    <div class="callout-body">
      AptRun automatically flags common CSV formatting errors before writing to the database: duplicate roll numbers, malformed email addresses, missing branch headers, and out-of-range CGPA values. The TPO can fix individual rows inline or download an error delta report.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 04 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 5 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 04</span>
      Institutional Subscription, Seat Quota &amp; Project Lab
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Institutional Plan Tiers: Academic Enterprise vs Pro Campus</h2>
  <p>AptRun provides institutional partnership plans calibrated for universities of all sizes, ensuring full coverage without per-student transactional friction:</p>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Institutional Capability</th>
        <th style="width: 35%;">Academic Enterprise Plan</th>
        <th style="width: 40%;">Pro Campus Plan</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Campus Seat Capacity</strong></td>
        <td><strong>Unlimited Students</strong> (Entire University)</td>
        <td>Fixed Cohort Band (e.g. 1,000, 2,500, 5,000 seats)</td>
      </tr>
      <tr>
        <td><strong>Coding &amp; Practice Arena</strong></td>
        <td>Full Access (All 1,200+ Problems)</td>
        <td>Full Access (All 1,200+ Problems)</td>
      </tr>
      <tr>
        <td><strong>Multi-Branch Core Modules</strong></td>
        <td>Full Access across all Departments</td>
        <td>Full Access across all Departments</td>
      </tr>
      <tr>
        <td><strong>Vault AI Mock Interview Credits</strong></td>
        <td><strong>Unlimited</strong> for all enrolled students</td>
        <td>Custom monthly quota per student</td>
      </tr>
      <tr>
        <td><strong>Project Lab™ Cloud Workspaces</strong></td>
        <td><strong>Included (80 Hrs/Mo &middot; 3 Projects)</strong></td>
        <td><strong>Configurable Toggle (Included or Add-on)</strong></td>
      </tr>
      <tr>
        <td><strong>Automated Campus Mock Drives</strong></td>
        <td>Unlimited Scheduled Drives</td>
        <td>Unlimited Scheduled Drives</td>
      </tr>
      <tr>
        <td><strong>Dedicated Account Management</strong></td>
        <td>Senior University Relationship Manager (URM)</td>
        <td>Standard Institutional Priority Desk</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Real-Time Seat Allocation &amp; Quota Monitoring</h2>
  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Licensed Capacity</div>
      <div style="font-size: 13pt; font-weight: 800; color: #0284c7;">5,000 Seats</div>
      <div style="font-size: 7pt; color: #334155;">Institutional contracted seat limit.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Active Enrolled Roster</div>
      <div style="font-size: 13pt; font-weight: 800; color: #059669;">4,320 Students</div>
      <div style="font-size: 7pt; color: #334155;">Active student accounts currently using platform.</div>
    </div>
    <div class="card amber">
      <div style="font-weight: 700; color: #d97706; font-size: 7.8pt;">Available Headroom</div>
      <div style="font-size: 13pt; font-weight: 800; color: #d97706;">680 Seats</div>
      <div style="font-size: 7pt; color: #334155;">Remaining seats for mid-year lateral entry.</div>
    </div>
  </div>

  <h2>3. Superadmin &amp; TPO Plan Governance: Project Lab Control</h2>
  <p>The Master TPO and AptRun Superadmin hold complete governance over whether a partner institution's subscription includes cloud Project Lab workspaces:</p>

  <div class="step-box">
    <div class="step-num">&#128394;</div>
    <div class="step-content">
      <div class="step-title">Project Lab Access Toggle Switch</div>
      <div class="step-desc">In the Plan Management modal, the TPO can view their Project Lab status. When active, every student under that college immediately inherits 80 hours/month and 3 active full-stack workspaces with zero manual student licensing.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128683;</div>
    <div class="step-content">
      <div class="step-title">Immediate Plan Termination &amp; Re-Assignment Option</div>
      <div class="step-desc">Superadmins can immediately terminate or cancel an active college subscription with an audit reason, instantly freeing seats or transitioning the campus to a customized higher-tier contract without data disruption.</div>
    </div>
  </div>

  <h2>4. Mid-Semester Seat Expansion Guarantee</h2>
  <div class="callout green">
    <div class="callout-title">Zero Student Lock-Out Policy</div>
    <div class="callout-body">
      If a partner college exceeds its contracted seat limit during active admissions, AptRun's enterprise elasticity allows immediate seat quota expansion. Students are never locked out of ongoing mock drives or exams while commercial contract amendments are finalized.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 05 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 6 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 05</span>
      Cohort Analytics, ARS Matrix &amp; Skill Gap Heatmaps
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Institutional Readiness Matrix: The ARS Breakdown</h2>
  <p>The AptRun Readiness Score (ARS) consolidates student performance into actionable institutional cohorts, allowing TPOs to immediately identify placement-ready candidates and target interventions for struggling students:</p>

  <div class="grid-3">
    <div class="card emerald">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 1: Offer Ready</div>
      <div style="font-size: 13pt; font-weight: 800; color: #059669;">ARS 80 &ndash; 100</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Fully prepared for Super-Dream and Dream corporate drives (&dollar;12,000+ / &inr;10&ndash;25 LPA). Ready for immediate placement shortlisting.</div>
    </div>
    <div class="card accent">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 2: Developing</div>
      <div style="font-size: 13pt; font-weight: 800; color: #0284c7;">ARS 60 &ndash; 79</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Proficient in foundational programming. Prime candidates for standard Tier-1 IT services and core engineering hiring tracks (&inr;5&ndash;9 LPA).</div>
    </div>
    <div class="card amber">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 3: Foundational</div>
      <div style="font-size: 13pt; font-weight: 800; color: #d97706;">ARS 0 &ndash; 59</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Identified for targeted academic interventions: assigned to faculty coordinators for mandatory remedial coding and soft skill modules.</div>
    </div>
  </div>

  <h2>2. Department-Wise Skill Gap Heatmap</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 20%;">Department / Branch</th>
        <th style="width: 16%;">Data Structures</th>
        <th style="width: 16%;">Core Domain</th>
        <th style="width: 16%;">Soft Skills &amp; Fluency</th>
        <th style="width: 16%;">Vault AI Mocks</th>
        <th style="width: 16%;">Cohort Health</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Computer Science (CSE)</strong></td>
        <td><span class="badge badge-green">88% High</span></td>
        <td><span class="badge badge-green">82% High</span></td>
        <td><span class="badge badge-blue">76% Moderate</span></td>
        <td><span class="badge badge-green">84% High</span></td>
        <td><span class="badge badge-green">82.5 (Ready)</span></td>
      </tr>
      <tr>
        <td><strong>Information Tech (IT)</strong></td>
        <td><span class="badge badge-green">84% High</span></td>
        <td><span class="badge badge-blue">78% Moderate</span></td>
        <td><span class="badge badge-blue">74% Moderate</span></td>
        <td><span class="badge badge-green">80% High</span></td>
        <td><span class="badge badge-green">79.0 (Strong)</span></td>
      </tr>
      <tr>
        <td><strong>Electronics (ECE)</strong></td>
        <td><span class="badge badge-blue">68% Moderate</span></td>
        <td><span class="badge badge-green">85% High</span></td>
        <td><span class="badge badge-blue">70% Moderate</span></td>
        <td><span class="badge badge-blue">66% Moderate</span></td>
        <td><span class="badge badge-blue">72.2 (Developing)</span></td>
      </tr>
      <tr>
        <td><strong>Mechanical (ME)</strong></td>
        <td><span class="badge badge-amber">52% Low</span></td>
        <td><span class="badge badge-green">86% High</span></td>
        <td><span class="badge badge-blue">65% Moderate</span></td>
        <td><span class="badge badge-amber">58% Low</span></td>
        <td><span class="badge badge-amber">65.2 (Core Ready)</span></td>
      </tr>
      <tr>
        <td><strong>Civil Engineering (CE)</strong></td>
        <td><span class="badge badge-amber">48% Low</span></td>
        <td><span class="badge badge-green">82% High</span></td>
        <td><span class="badge badge-blue">62% Moderate</span></td>
        <td><span class="badge badge-amber">54% Low</span></td>
        <td><span class="badge badge-amber">61.5 (Core Ready)</span></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Actionable Insights from Skill Gap Analytics</h2>
  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Bridging Coding for Non-CS Branches</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        Notice that Mechanical and Civil students have outstanding core knowledge (86% and 82%) but lower software coding scores. The TPO can launch a targeted 4-week <em>"Python &amp; SQL for Core Engineers"</em> bootcamp module directly from the portal.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Refining Soft Skills for Tech Branches</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        CS/IT students often possess strong algorithmic skills but experience lower verbal fluency in corporate interviews. Assigning mandatory Spoken English and Vocabulary Sprint modules increases their interview conversion rate by up to 45%.
      </p>
    </div>
  </div>

  <h2>4. Tracking Campus Practice Engagement Hours</h2>
  <div class="callout purple">
    <div class="callout-title">Total Institutional Engineering Time Invested</div>
    <div class="callout-body">
      AptRun logs every second spent by students inside the code editor, core test banks, and Project Lab. TPOs can export institutional engagement reports demonstrating thousands of student hours invested in active technical skilling for university board reviews.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 06 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 7 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 06</span>
      Administering Campus Mock Drives &amp; Assessments
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Automating Campus Placement Preparation Drives</h2>
  <p>The AptRun Assessment Engine allows TPOs and Placement Cells to conduct large-scale, proctored mock recruitment drives that replicate exact corporate hiring patterns without needing third-party testing agencies.</p>

  <div class="step-box">
    <div class="step-num">Step 1</div>
    <div class="step-content">
      <div class="step-title">Create New Assessment &amp; Define Eligibility Rules</div>
      <div class="step-desc">In the TPO Dashboard, navigate to <strong>Campus Drives &rarr; Create Assessment</strong>. Specify test title, target branches (e.g. CSE, ECE), academic batches, minimum CGPA cutoff, and maximum allowable backlogs.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 2</div>
    <div class="step-content">
      <div class="step-title">Configure Multi-Stage Test Blueprint</div>
      <div class="step-desc">Combine aptitude MCQs, core engineering questions, hands-on algorithmic coding, and automated Vault AI interview rounds into a single unified campus drive schedule.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 3</div>
    <div class="step-content">
      <div class="step-title">Set Scheduling Window &amp; Anti-Cheat Lockdown</div>
      <div class="step-desc">Define start and end datetime windows. Set strict test duration (e.g. 90 minutes). Enable full-screen lockdown, webcam face proctoring, and negative marking rules.</div>
    </div>
  </div>

  <h2>2. 1-Click Company-Specific Assessment Presets</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 22%;">Corporate Blueprint</th>
        <th style="width: 48%;">Syllabus Architecture &amp; Sectional Breakdown</th>
        <th style="width: 30%;">Target Hiring Profile</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>TCS NQT Blueprint</strong></td>
        <td>Numerical Ability (26 Qs), Reasoning Ability (30 Qs), Verbal Ability (24 Qs), Advanced Coding (2 Hands-on Problems).</td>
        <td>TCS Ninja (3.6 LPA) &amp; Digital (7.2 LPA) Recruitment Drives</td>
      </tr>
      <tr>
        <td><strong>Accenture Assessment</strong></td>
        <td>Cognitive Assessment (50 Qs), Technical Assessment (Pseudocode, Common Application &amp; Security, 40 Qs), Coding (2 Problems).</td>
        <td>Associate Software Engineer (ASE) &amp; FSE Hiring Tracks</td>
      </tr>
      <tr>
        <td><strong>Infosys DSE / SE</strong></td>
        <td>Reasoning &amp; Mathematical Ability (45 Qs), Verbal Fluency (20 Qs), Hands-on Competitive Coding (3 Problems &ndash; DP &amp; Graphs).</td>
        <td>Specialist Programmer (9.5 LPA) &amp; DSE (6.5 LPA) Drives</td>
      </tr>
      <tr>
        <td><strong>Cognizant GenC Next</strong></td>
        <td>Aptitude &amp; Analytical Screening, Domain CS Fundamentals (DBMS, OS), Advanced Coding Challenge (2 Medium/Hard Problems).</td>
        <td>GenC (4.0 LPA) &amp; GenC Next (6.75 LPA) Cohort Selection</td>
      </tr>
      <tr>
        <td><strong>Wipro Elite NLTH</strong></td>
        <td>Quantitative Aptitude, Logical Reasoning, Written English Comprehension, 2 Coding Problems in Java / C++ / Python.</td>
        <td>Elite National Talent Hunt Campus Program</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Multi-Stage Drive Execution Architecture</h2>
  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Round 1: Online Screening Test</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        Automated MCQ aptitude + hands-on coding. Real-time test-case judge grading. Cutoff scores auto-filter candidates to Stage 2 with zero manual faculty grading.
      </p>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Round 2: Automated Vault AI Interview</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        Shortlisted candidates automatically unlock the Vault AI Technical Mock round. The AI conducts structured interviews, generating objective scorecards for TPO review.
      </p>
    </div>
  </div>

  <h2>4. Post-Drive Results &amp; Merit Rank List</h2>
  <div class="callout green">
    <div class="callout-title">Instant Comprehensive Score Roster</div>
    <div class="callout-body">
      Immediately upon test conclusion, the TPO portal compiles a ranked merit list showing sectional scores, total marks, coding test cases passed, proctoring flags, and overall percentile. Downloadable in Excel/PDF format for placement committee review.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 07 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 8 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 07</span>
      Proctoring Governance, Anti-Cheat &amp; Live Audit
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Enterprise Proctoring: Defending University Assessment Credibility</h2>
  <p>Employer trust depends directly on test integrity. AptRun combines browser-based AI proctoring with the native <strong>AptRun Guardian™</strong> desktop engine to provide university placement cells with unassailable examination security.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Live Proctor Console</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Real-time dashboard showing active test takers across the university campus with instant color-coded behavioral risk badges (Green, Amber, Red).</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">AptRun Guardian™ Client</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Lightweight Windows security engine for campus computer labs: locks USB ports, terminates background remote desktop apps (AnyDesk, TeamViewer).</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Tamper-Proof Dossier</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Timestamped snapshot evidence and keystroke cadence logs attached directly to every student submission for faculty disciplinary review.</div>
    </div>
  </div>

  <h2>2. Automated Integrity Triggers &amp; Severity Classification</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Violation Event</th>
        <th style="width: 25%;">Severity Rating</th>
        <th style="width: 50%;">Automated Institutional Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Multiple Faces in Camera Frame</strong></td>
        <td><span class="badge badge-amber">High Severity</span></td>
        <td>Timestamped snapshot logged. Visual alert flashed to candidate. Flagged in TPO Live Proctoring Console.</td>
      </tr>
      <tr>
        <td><strong>Absence from Video Frame (&gt; 10s)</strong></td>
        <td><span class="badge badge-amber">Medium Severity</span></td>
        <td>Exam timer pauses. Warning dialogue requires candidate re-verification before test can proceed.</td>
      </tr>
      <tr>
        <td><strong>Browser Tab Switching (&gt; 3 times)</strong></td>
        <td><span class="badge badge-purple">Critical Violation</span></td>
        <td>On 4th detected tab switch or window defocus event, candidate's exam is automatically locked and submitted.</td>
      </tr>
      <tr>
        <td><strong>Clipboard Copy-Paste Injection</strong></td>
        <td><span class="badge badge-blue">Blocked by System</span></td>
        <td>External clipboard paste attempts are blocked at browser level. Keystroke velocity anomaly logged in report.</td>
      </tr>
      <tr>
        <td><strong>Secondary Monitor Connection</strong></td>
        <td><span class="badge badge-purple">Critical Violation</span></td>
        <td>Test window blurs; prompt enforces candidate to disconnect secondary HDMI/DisplayPort display immediately.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Live Proctoring Control Console Walkthrough</h2>
  <div class="step-box">
    <div class="step-num">&#128065;</div>
    <div class="step-content">
      <div class="step-title">Real-Time Incident Stream</div>
      <div class="step-desc">TPOs and Section Coordinators can filter live candidates by severity flag: view students with 2+ tab switches or active voice alerts. Click any candidate to view live camera feed and test-case progress.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#9878;</div>
    <div class="step-content">
      <div class="step-title">Administrative Disqualification &amp; Pardon Controls</div>
      <div class="step-desc">If a candidate is observed communicating with peers in a computer lab, the TPO can terminate their exam with one click. Conversely, genuine technical glitches (e.g. browser crash) can be pardoned and granted a 10-minute time extension.</div>
    </div>
  </div>

  <h2>4. Post-Exam Integrity Dossier &amp; Appeal Review</h2>
  <div class="callout green">
    <div class="callout-title">Defensible Evidence for Student Inquiries</div>
    <div class="callout-body">
      If a student challenges their exam disqualification, the TPO can export the complete <strong>Integrity Audit Dossier</strong> containing exact second-by-second tab switch timestamps, captured violation photos, and code typing telemetry, ensuring complete transparency for university disciplinary committees.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 08 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 9 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 08</span>
      Section Coordinators &amp; Faculty Engagement
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Empowering Department Faculty in Placement Readiness</h2>
  <p>Successful campus placement outcomes require active participation from classroom professors. AptRun's <strong>Section Coordinator</strong> interface equips department faculty with intuitive tools to mentor and monitor their specific class sections without administrative overhead.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 8pt; margin-bottom: 2px;">Focused Section Mentorship</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Faculty coordinators see only their assigned class section (e.g., Section 4-A). They track daily practice streaks, individual problem solve rates, and identify students who have not logged in for over 7 calendar days.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Zero Clutter Administration</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Coordinators are insulated from complex billing, invoice management, and master campus settings. Their dashboard is dedicated entirely to student engagement, milestone tracking, and mock drive proctoring.
      </p>
    </div>
  </div>

  <h2>2. Early Warning System: Lagging Student Detection</h2>
  <p>Identify struggling students 6 months before recruitment season begins, enabling timely academic interventions:</p>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Alert Classification</th>
        <th style="width: 45%;">Diagnostic Criteria Triggered</th>
        <th style="width: 30%;">Recommended Faculty Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-amber">Disengaged Alert</span></td>
        <td>Zero coding problem submissions or platform logins in the last 14 calendar days.</td>
        <td>Faculty sends in-app reminder; schedules 1-on-1 counseling session during office hours.</td>
      </tr>
      <tr>
        <td><span class="badge badge-amber">Struggling Algorithmic</span></td>
        <td>Problem pass rate &lt; 30% across Easy/Medium DSA tracks despite 10+ attempts.</td>
        <td>Assign remedial foundational recursion and array drills from the Learning Centre.</td>
      </tr>
      <tr>
        <td><span class="badge badge-purple">Interview Anxiety Alert</span></td>
        <td>Vault AI Technical Mock score &lt; 50% with low verbal fluency and high filler-word count.</td>
        <td>Enroll student in Spoken English pronunciation drills and mock interview circuits.</td>
      </tr>
      <tr>
        <td><span class="badge badge-green">High-Flyer Star</span></td>
        <td>ARS &gt; 85 &middot; 30-day streak &middot; Project Lab milestone 3 completed.</td>
        <td>Nominate for Super-Dream corporate drives and Mellow Vault priority hiring list.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Inter-Section Benchmark Leaderboards</h2>
  <div class="step-box">
    <div class="step-num">&#127942;</div>
    <div class="step-content">
      <div class="step-title">Gamified Classroom Motivation</div>
      <div class="step-desc">AptRun maintains real-time inter-section leaderboards (e.g. CSE-A vs. CSE-B vs. CSE-C). Sections earn collective cohort XP based on total problems solved, active practice hours, and mock test scores.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128202;</div>
    <div class="step-content">
      <div class="step-title">Automated Weekly Faculty Digest Emails</div>
      <div class="step-desc">Every Monday at 8:00 AM, section coordinators receive an automated executive summary PDF detailing section solve rates, top 5 performers, and a list of lagging students requiring follow-up.</div>
    </div>
  </div>

  <h2>4. Aligning Classroom Teaching with Assessment Outcomes</h2>
  <div class="callout purple">
    <div class="callout-title">Curriculum-Aligned Custom Problem Sets</div>
    <div class="callout-body">
      Faculty coordinators can create custom practice playlists (e.g., <em>"Week 4: Binary Search Trees &amp; AVL Trees"</em>) directly aligned with their university semester syllabus, allowing students to reinforce classroom theory with immediate hands-on coding.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 09 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 10 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 09</span>
      Corporate Placement Connect &amp; Mellow Vault Sourcing
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Connecting Your University to 500+ Corporate Recruiters</h2>
  <p>AptRun is not just an assessment platform&mdash;it is an active corporate talent discovery bridge powered by <strong>Mellow Vault</strong>. When your university partners with AptRun, your students are positioned directly in front of over 500+ active enterprise hiring partners looking for verified tech talent.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Global Recruiter Network</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">TCS, Infosys, Accenture, Cognizant, Wipro, Capgemini, LTIMindtree, Tech Mahindra, plus high-growth fintech and product startups.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Verified Talent Pipeline</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Recruiters bypass unreliable resume claims by filtering candidates based on objective AptRun Readiness Scores (ARS) and verified Project Lab commits.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Zero Placement Fees</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">AptRun charges zero commission on student job offers. Institutional partnerships grant full access to corporate drive proposals at no extra cost.</div>
    </div>
  </div>

  <h2>2. Receiving &amp; Approving Corporate Drive Proposals</h2>
  <div class="step-box">
    <div class="step-num">Step 1</div>
    <div class="step-content">
      <div class="step-title">Incoming Drive Proposal in TPO Portal</div>
      <div class="step-desc">When a hiring partner launches a campus drive matching your university's academic profile, an official drive proposal appears in your <strong>TPO Portal &rarr; Corporate Drives</strong> drawer.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 2</div>
    <div class="step-content">
      <div class="step-title">Review CTC Packages, Job Descriptions &amp; Eligibility</div>
      <div class="step-desc">Inspect role specifications (e.g. Full-Stack Engineer, SDE-1), compensation packages (CTC in &dollar; / &inr; LPA), job locations, bond terms, and academic criteria (CGPA cutoff, allowed branches).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 3</div>
    <div class="step-content">
      <div class="step-title">1-Click Institutional Approval &amp; Student Broadcast</div>
      <div class="step-desc">Click <strong>Approve &amp; Broadcast</strong>. The opportunity is instantly pushed to eligible student dashboards with an automated email notification, opening student registrations.</div>
    </div>
  </div>

  <h2>3. The Digital Resume Vault &amp; Batch Export</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Recruitment Function</th>
        <th style="width: 45%;">TPO Capabilities &amp; System Automation</th>
        <th style="width: 30%;">Output Format</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Batch Resume Export</strong></td>
        <td>Download all verified student CVs matching specific recruiter criteria with one click, pre-sorted by ARS score and CGPA.</td>
        <td>Single ZIP archive containing standardized, ATS-friendly PDFs.</td>
      </tr>
      <tr>
        <td><strong>Verified Skill Badges</strong></td>
        <td>Every exported student profile includes cryptographically verifiable badges for passed Project Lab milestones and Vault AI interviews.</td>
        <td>Interactive QR code &amp; verification link embedded in resume header.</td>
      </tr>
      <tr>
        <td><strong>Shortlist Excel Roster</strong></td>
        <td>Generate structured candidate data rosters formatted to the recruiter's exact HR onboarding template.</td>
        <td>XLSX / CSV with candidate contacts, roll numbers, and technical ratings.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Enhancing Median Salary &amp; Placement Statistics</h2>
  <div class="callout green">
    <div class="callout-title">Measurable Placement Impact</div>
    <div class="callout-body">
      Partner universities report an average <strong>32% increase in total placement offers</strong> and an average <strong>28% increase in median compensation packages</strong> within the first academic year of deploying AptRun, driven by objective ARS visibility to premier corporate recruiters.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 10 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 11 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 10</span>
      Accreditation Compliance &amp; Regulatory Data Exports
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. 1-Click Accreditation Placement Documentation</h2>
  <p>Compiling placement and skills enhancement evidence for national and international accreditation bodies typically takes university staff months of manual paperwork. AptRun generates audit-ready documentation in seconds.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 8pt; margin-bottom: 2px;">NAAC Self-Study Report (SSR) Alignment</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Criterion 2.3.2:</strong> ICT-enabled tools including online learning resources for effective teaching-learning processes.<br/>
        &bull; <strong>Criterion 5.1.2:</strong> Capacity building and skills enhancement initiatives taken by the institution.<br/>
        &bull; <strong>Criterion 5.2.1:</strong> Percentage of placement of outgoing students during the year.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">NIRF Data Submission (Metric 3 &ndash; GO)</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Metric 3.1:</strong> Combined Metric for Placement and Higher Studies (GPHE).<br/>
        &bull; <strong>Metric 3.2:</strong> Median Salary of placed graduates over the past 3 academic years.<br/>
        &bull; <strong>Data Format:</strong> Direct quantitative tables structured to match NIRF Data Capturing System (DCS).
      </p>
    </div>
  </div>

  <h2>2. Generating Compliance Reports: TPO Walkthrough</h2>
  <div class="step-box">
    <div class="step-num">&#128196;</div>
    <div class="step-content">
      <div class="step-title">Select Accreditation Framework &amp; Academic Year</div>
      <div class="step-desc">In the TPO Dashboard, navigate to <strong>Analytics &rarr; Accreditation Reports</strong>. Choose your target standard: NAAC SSR, NIRF, ABET, or AICTE Mandatory Internship Compliance. Select academic year.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#9881;</div>
    <div class="step-content">
      <div class="step-title">Automated Data Compilation &amp; Statistical Aggregation</div>
      <div class="step-desc">The platform aggregates total hours invested in computing skills, soft skills participation counts, proctored mock assessment attendance sheets, and verified placement offer registers.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128190;</div>
    <div class="step-content">
      <div class="step-title">Download Audit-Ready PDF &amp; Raw Excel Ledgers</div>
      <div class="step-desc">Download a publication-quality PDF report complete with official university crest, statistical summary charts, and digital verification seal, accompanied by unedited raw data CSVs for peer review teams.</div>
    </div>
  </div>

  <h2>3. Student Data Privacy, Sovereignty &amp; Security Standards</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Security Dimension</th>
        <th style="width: 45%;">Institutional Guarantee &amp; Architecture</th>
        <th style="width: 30%;">Certification Standard</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Data Isolation &amp; Silos</strong></td>
        <td>Complete multi-tenant logical database isolation. No university's data is accessible by or co-mingled with any other partner institution.</td>
        <td>ISO/IEC 27001:2022 Certified Architecture</td>
      </tr>
      <tr>
        <td><strong>Encryption Standards</strong></td>
        <td>All network traffic encrypted using TLS 1.3 in transit; all database records, code submissions, and resumes encrypted via AES-256 at rest.</td>
        <td>SOC 2 Type II Aligned Infrastructure</td>
      </tr>
      <tr>
        <td><strong>Student Privacy Regulations</strong></td>
        <td>Strict compliance with FERPA (Family Educational Rights and Privacy Act) and GDPR. Zero sale or unauthorized sharing of student records.</td>
        <td>FERPA &amp; GDPR Compliant Practices</td>
      </tr>
      <tr>
        <td><strong>Cloud Infrastructure SLA</strong></td>
        <td>Hosted across multi-region Amazon Web Services (AWS) data centers with automated daily off-site backups and disaster recovery.</td>
        <td><strong>99.95% Guaranteed Uptime SLA</strong></td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 11 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 12 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 11</span>
      Institutional SLA, Dedicated Support &amp; University Directory
    </div>
    <div class="header-meta">AptRun™ Institutional Governance Manual &middot; Global Edition</div>
  </div>

  <h2>1. Dedicated Institutional Support &amp; Partnership Governance</h2>
  <p>Every partner university on AptRun is assigned a dedicated <strong>University Relationship Manager (URM)</strong> and direct technical operations support to ensure frictionless deployment across your entire academic calendar.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Dedicated URM Officer</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Your single point of contact for onboarding batches, custom assessment setups, corporate drive scheduling, and TPO queries.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Faculty Development Programs</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Comprehensive virtual and on-campus FDP workshops to train department faculty coordinators on platform analytics and student mentorship.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Student Orientation Webinars</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Live interactive onboarding sessions conducted by AptRun engineering leads to onboard student cohorts and drive platform adoption.</div>
    </div>
  </div>

  <h2>2. Institutional Service Level Agreement (SLA) Matrix</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Support Tier</th>
        <th style="width: 35%;">Channel &amp; Escalation Path</th>
        <th style="width: 40%;">Guaranteed Resolution Window</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Priority T1: Live Campus Drive Outage</strong></td>
        <td>Emergency Hotline: <strong>+91 76785 78295</strong></td>
        <td><strong>Immediate (Under 15 minutes)</strong> &middot; Dedicated DevOps engineer assigned</td>
      </tr>
      <tr>
        <td><strong>Priority T2: Roster Import &amp; Batch Queries</strong></td>
        <td>Institutional Desk: <span class="meta-tag">tpo-support@mellowvault.com</span></td>
        <td>Within 2 business hours</td>
      </tr>
      <tr>
        <td><strong>Priority T3: Custom Drive / Blueprint Requests</strong></td>
        <td>Assigned URM Email &amp; Calendar Booking</td>
        <td>Within 24 hours prior to drive launch</td>
      </tr>
      <tr>
        <td><strong>System Reliability Commitment</strong></td>
        <td>High-Availability AWS Multi-Zone Architecture</td>
        <td><strong>99.95% Annual Platform Availability Guarantee</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Official Corporate Directory &amp; Executive Endorsement</h2>
  <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-top: 3mm; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <div style="font-size: 9.2pt; font-weight: 800; color: #0f172a;">AptRun™ Enterprise Campus Readiness Platform</div>
      <div style="font-size: 7.8pt; color: #0369a1; font-weight: 700;">A Product of Mellow Vault &middot; A Unit of Prayukti Development Private Limited</div>
      <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">
        Corporate Identity Number (CIN): <strong>U62099UP2024PTC207212</strong><br/>
        Registered Offices: Noida (NCR) &amp; New Delhi, India &middot; Global Operations Desk: 150+ Partner Universities<br/>
        Institutional Relations Desk: <span class="meta-tag">partnerships@mellowvault.com</span> &middot; Portal: <span class="meta-tag">https://aptrun.com</span>
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-purple" style="font-size: 7.5pt; padding: 3px 8px;">GLOBAL UNIVERSITY EDITION</span>
      <div style="font-size: 6.8pt; color: #64748b; margin-top: 4px;">Verified by Mellow Vault Institutional Council</div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Campus Readiness Platform &middot; College TPO Guide</span>
    <span>Page 12 of 12</span>
  </div>
</div>

</body>
</html>
"""

    temp_html = r"D:\Dev\AptRun\temp_tpo_guide.html"
    output_pdf = r"D:\Dev\AptRun\docs\AptRun-College-TPO-Institutional-Guide.pdf"
    
    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html_content)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    cmd = [
        edge_path,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={output_pdf}",
        f"file:///{temp_html.replace(os.sep, '/')}"
    ]

    print("Generating College TPO User Guide PDF...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    time.sleep(2)

    if os.path.exists(output_pdf):
        print(f"Successfully generated: {output_pdf} (Size: {os.path.getsize(output_pdf)} bytes)")
    else:
        print("Failed to generate PDF. Stdout:", res.stdout, "Stderr:", res.stderr)

    if os.path.exists(temp_html):
        os.remove(temp_html)

if __name__ == "__main__":
    build_tpo_guide_pdf()
