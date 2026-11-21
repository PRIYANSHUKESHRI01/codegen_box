import base64
import os
import subprocess
import time

def build_student_guide_pdf():
    # Read logo
    logo_path = r"D:\Dev\AptRun\aptRun Logo.png"
    with open(logo_path, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AptRun Enterprise Platform: Official Student & Candidate User Guide</title>
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
        <div style="font-size: 13.5pt; font-weight: 800; color: #0f172a; letter-spacing: -0.01em;">AptRun™ Enterprise Skilling Platform</div>
        <div style="font-size: 7.6pt; color: #0369a1; font-weight: 700; letter-spacing: 0.04em;">CANDIDATE &amp; STUDENT USER GUIDE &middot; GLOBAL UNIVERSITY EDITION 2026&ndash;2027</div>
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-blue" style="font-size: 7.2pt; padding: 2px 7px;">VERIFIED STUDENT HANDBOOK</span>
      <div style="font-size: 6.8pt; color: #64748b; margin-top: 2px;">ISO 27001 &middot; AICTE &middot; NAAC / NIRF COMPLIANT</div>
    </div>
  </div>

  <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 6px; padding: 12px 14px; margin-bottom: 6mm; border-left: 4px solid #0284c7;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div style="max-width: 78%;">
        <div style="font-size: 7.4pt; text-transform: uppercase; color: #38bdf8; font-weight: 700; letter-spacing: 0.06em;">Official Candidate Onboarding &amp; Practice Handbook</div>
        <div style="font-size: 14pt; font-weight: 800; margin: 2px 0 4px 0; letter-spacing: -0.01em;">AptRun™ Complete Student Guide: Master Coding, Core Prep &amp; Placement Readiness</div>
        <div style="font-size: 8pt; color: #cbd5e1; line-height: 1.35;">
          A comprehensive operational manual for undergraduate, postgraduate engineering, management, and technology students across 150+ global universities. Master technical coding in 12+ languages, crack branch-specific core assessments, practice in Vault AI™ multimodal interview circuits, build enterprise microservices in Project Lab™, and secure Tier-1 placement offers.
        </div>
      </div>
      <div style="text-align: right; background: rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.12);">
        <div style="font-size: 7.2pt; color: #94a3b8;">Parent Entity:</div>
        <div style="font-size: 8.5pt; font-weight: 800; color: #ffffff;">Mellow Vault</div>
        <div style="font-size: 6.8pt; color: #38bdf8;">Prayukti Development Pvt. Ltd.</div>
        <div style="font-size: 6.2pt; color: #94a3b8; margin-top: 2px;">CIN: U62099UP2024PTC207212</div>
      </div>
    </div>
  </div>

  <div class="grid-4" style="margin-bottom: 6mm;">
    <div class="card accent">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Practice Repository</div>
      <div style="font-size: 13pt; font-weight: 800; color: #0284c7;">1,200+</div>
      <div style="font-size: 7pt; color: #334155;">DSA, MCQs &amp; Company Tracks</div>
    </div>
    <div class="card emerald">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Judge Runtimes</div>
      <div style="font-size: 13pt; font-weight: 800; color: #059669;">12+ Langs</div>
      <div style="font-size: 7pt; color: #334155;">Piston-powered Container Judge</div>
    </div>
    <div class="card purple">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Vault AI Mock Rounds</div>
      <div style="font-size: 13pt; font-weight: 800; color: #7c3aed;">41 Stacks</div>
      <div style="font-size: 7pt; color: #334155;">Multimodal Speech &amp; Composure</div>
    </div>
    <div class="card amber">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Cloud Project Lab</div>
      <div style="font-size: 13pt; font-weight: 800; color: #d97706;">80 Hrs/Mo</div>
      <div style="font-size: 7pt; color: #334155;">Full-Stack Terminal &amp; SOW PDF</div>
    </div>
  </div>

  <h2>Table of Contents &middot; Navigation Directory</h2>
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
        <td><strong>Getting Started, Dashboard &amp; Onboarding</strong></td>
        <td>Activation email, password set, branch confirm, resume vault upload, ARS meter</td>
        <td style="text-align: center; font-weight: 700;">Page 02</td>
      </tr>
      <tr>
        <td><strong>Part 02</strong></td>
        <td><strong>Coding Practice Arena &amp; Monaco IDE</strong></td>
        <td>1,200+ problems, 12+ language runtimes, test case execution, hints, time complexity</td>
        <td style="text-align: center; font-weight: 700;">Page 03</td>
      </tr>
      <tr>
        <td><strong>Part 03</strong></td>
        <td><strong>Multi-Branch Core Engineering Preparation</strong></td>
        <td>ECE, Mech, Civil, Electrical, Marine, Chemical &amp; Merchant Navy orals/ROR flashcards</td>
        <td style="text-align: center; font-weight: 700;">Page 04</td>
      </tr>
      <tr>
        <td><strong>Part 04</strong></td>
        <td><strong>Soft Skills, Business English &amp; Learning Centre</strong></td>
        <td>Acoustic voice analysis, pronunciation score, vocabulary sprint, quantitative aptitude</td>
        <td style="text-align: center; font-weight: 700;">Page 05</td>
      </tr>
      <tr>
        <td><strong>Part 05</strong></td>
        <td><strong>Vault AI™ Interactive Mock Interview Room</strong></td>
        <td>41 tech stacks, 3-stage interview circuit, speech cadence, filler words, PDF ledger</td>
        <td style="text-align: center; font-weight: 700;">Page 06</td>
      </tr>
      <tr>
        <td><strong>Part 06</strong></td>
        <td><strong>Project Lab™ Cloud Workspaces</strong></td>
        <td>In-browser VS Code, terminal, container execution, anti-plagiarism typing audit, SOW</td>
        <td style="text-align: center; font-weight: 700;">Page 07</td>
      </tr>
      <tr>
        <td><strong>Part 07</strong></td>
        <td><strong>Hackathon Arena &amp; Live Contests</strong></td>
        <td>Campus hackathons, team role formation, weekly live coding contests, XP leaderboards</td>
        <td style="text-align: center; font-weight: 700;">Page 08</td>
      </tr>
      <tr>
        <td><strong>Part 08</strong></td>
        <td><strong>Exam Integrity &amp; Proctoring Guardian</strong></td>
        <td>Webcam facial tracking, dual monitor lock, continuous tab switch check, audio analysis</td>
        <td style="text-align: center; font-weight: 700;">Page 09</td>
      </tr>
      <tr>
        <td><strong>Part 09</strong></td>
        <td><strong>Subscriptions, College Coverage &amp; Promo Offers</strong></td>
        <td>Free vs Expert vs Grandmaster, college-sponsored entitlement, 100% off promo codes</td>
        <td style="text-align: center; font-weight: 700;">Page 10</td>
      </tr>
      <tr>
        <td><strong>Part 10</strong></td>
        <td><strong>Placement Pipeline &amp; The Mellow Vault Bridge</strong></td>
        <td>ARS score tiers (80+ Offer Ready), 500+ recruiter discovery, verified digital credentials</td>
        <td style="text-align: center; font-weight: 700;">Page 11</td>
      </tr>
      <tr>
        <td><strong>Part 11</strong></td>
        <td><strong>Student Helpdesk, FAQ &amp; Contact Directory</strong></td>
        <td>Troubleshooting code timeout, webcam fix, official support SLA &amp; emergency helpline</td>
        <td style="text-align: center; font-weight: 700;">Page 12</td>
      </tr>
    </tbody>
  </table>

  <div class="callout green">
    <div class="callout-title">Institutional Notice for Reviewing Partner Campuses</div>
    <div class="callout-body">
      This document governs student operations on AptRun across all 150 partner universities. Student profiles, coding submissions, and interview reports remain private to the student and their enrolled college, fully compliant with international student data sovereignty standards.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 01 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 2 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 01</span>
      Getting Started, Dashboard &amp; Account Onboarding
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Access Pathways &amp; Initial Account Setup</h2>
  <p>Students access AptRun through either an institution-sponsored account provisioned by their college TPO, or through self-serve registration on <span class="meta-tag">https://aptrun.com</span>.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 8pt; margin-bottom: 2px;">Pathway A: College-Sponsored Account</div>
      <p style="font-size: 7.6pt; line-height: 1.28;">
        Your college TPO imports your batch into the campus directory. You receive an automated credentials email from <span class="meta-tag">no-reply@mellowvault.com</span> containing your official username (college roll number or institutional email) and a one-time temporary password.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Pathway B: Independent Student Sign-Up</div>
      <p style="font-size: 7.6pt; line-height: 1.28;">
        Visit <span class="meta-tag">aptrun.com/signup</span>. Enter your full name, personal email, phone number, and select your university. Verify via email OTP. If your college later onboard with AptRun, your personal account merges seamlessly without losing progress.
      </p>
    </div>
  </div>

  <h2>2. Step-by-Step First Login Walkthrough</h2>
  <div class="step-box">
    <div class="step-num">Step 1</div>
    <div class="step-content">
      <div class="step-title">Access Login Portal &amp; Update Password</div>
      <div class="step-desc">Open <span class="meta-tag">https://aptrun.com/login</span>. Enter your registered email and temporary password. The security system automatically prompts you to create a secure personal password (minimum 8 characters, alphanumeric + symbol).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 2</div>
    <div class="step-content">
      <div class="step-title">Branch, Specialization &amp; Study Year Confirmation</div>
      <div class="step-desc">Select your engineering or academic branch (e.g., Computer Science, ECE, Mechanical, Civil, Merchant Navy). Confirm your current academic semester and expected graduation year. This calibrates your personalized core prep track.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 3</div>
    <div class="step-content">
      <div class="step-title">Resume Vault Upload &amp; Profile Verification</div>
      <div class="step-desc">Navigate to <strong>Profile &rarr; Resume Vault</strong>. Upload your current resume in PDF format (under 5MB). The AI parser extracts your tech stack, projects, and CGPA to generate your verified candidate card for recruiter search.</div>
    </div>
  </div>

  <h2>3. The Student Dashboard Explained</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Dashboard Component</th>
        <th style="width: 45%;">Functional Role &amp; Measurement</th>
        <th style="width: 30%;">Recommended Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>AptRun Readiness Score (ARS)</strong></td>
        <td>Composite metric (0 to 100) computed from DSA accuracy, core subjects, AI mock interviews, and soft skills fluency.</td>
        <td>Target <strong>80+ (Offer Ready)</strong> for priority shortlist by enterprise recruiters.</td>
      </tr>
      <tr>
        <td><strong>Daily Practice Streak</strong></td>
        <td>Tracks consecutive calendar days with at least 1 solved problem or completed drill.</td>
        <td>Maintain a 30-day streak to unlock Grandmaster leaderboard badges and contest perks.</td>
      </tr>
      <tr>
        <td><strong>Assigned College Drives</strong></td>
        <td>Live and scheduled assessments assigned specifically by your college TPO or department coordinator.</td>
        <td>Check the <em>Campus Assessments</em> drawer daily for mandatory proctored mock drives.</td>
      </tr>
      <tr>
        <td><strong>Project Lab Workspaces</strong></td>
        <td>Access your active full-stack cloud projects, tracked runtime hours, and milestone progress.</td>
        <td>Launch in-browser container environments for hands-on capstone engineering.</td>
      </tr>
      <tr>
        <td><strong>Weekly Contest Banner</strong></td>
        <td>Countdown timer to Saturday live algorithmic contests with national leaderboards and cash rewards.</td>
        <td>Register 24 hours prior to contest start to secure seat in the anti-cheat proctored arena.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout purple">
    <div class="callout-title">Pro-Tip: Keeping Your Profile Enterprise-Ready</div>
    <div class="callout-body">
      Ensure your GitHub profile, LinkedIn URL, and verified coding handle are linked in <strong>Profile &rarr; Settings</strong>. Mellow Vault's hiring algorithms cross-reference project commits and ARS rankings when presenting shortlists to Tier-1 companies.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 02 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 3 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 02</span>
      Coding Practice Arena &amp; Monaco Browser IDE
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Catalog Architecture: 1,200+ Curated Problems</h2>
  <p>The AptRun Coding Arena covers foundational algorithms to complex distributed systems challenges, indexed across 4 core tiers:</p>

  <div class="grid-4">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Easy Tier (350+ Qs)</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Arrays, Strings, Recursion, Bitwise, Two Pointers. Focus on syntax fluency and clean edge-case handling.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Medium Tier (550+ Qs)</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Trees, Graphs, DP, Sliding Window, Greedy, Backtracking. Core foundation for product company screening.</div>
    </div>
    <div class="card amber">
      <div style="font-weight: 700; color: #d97706; font-size: 7.8pt;">Hard Tier (200+ Qs)</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Segment Trees, Advanced Graph Flow, Hard DP on Trees, Trie, System-level Concurrency. Dream drive prep.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Company Tracks (150+)</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">TCS NQT, Infosys DSE, Accenture Advanced, Cognizant GenC Next, Amazon SDE, Google Kickstart patterns.</div>
    </div>
  </div>

  <h2>2. The Monaco-Powered Online IDE Experience</h2>
  <p>AptRun embeds the industry-standard Microsoft Monaco editor (the engine powering VS Code) directly in your browser, integrated with an isolated Piston container judge.</p>

  <div class="grid-2">
    <div>
      <div class="step-box">
        <div class="step-num">&lt;/&gt;</div>
        <div class="step-content">
          <div class="step-title">Multi-Language Runtimes (12+ Supported)</div>
          <div class="step-desc">Switch seamlessly between Python 3.10, Java 17, C++20, C11, C# (.NET 8), Go 1.21, Rust 1.74, TypeScript, JavaScript (Node 20), PHP 8.2, and Ruby.</div>
        </div>
      </div>
      <div class="step-box">
        <div class="step-num">&#9881;</div>
        <div class="step-content">
          <div class="step-title">Custom Test Execution &amp; Debugging</div>
          <div class="step-desc">Type custom input payloads in the <strong>Custom Input</strong> tab to test edge cases (empty arrays, negative bounds, large integers) before official submission.</div>
        </div>
      </div>
      <div class="step-box">
        <div class="step-num">&#128065;</div>
        <div class="step-content">
          <div class="step-title">Hidden Test Suite &amp; Time/Memory Limits</div>
          <div class="step-desc">Submissions are evaluated against 20 to 50 hidden test cases enforcing strict CPU execution limits (typically 1.0 to 2.0s) and memory limits (256MB).</div>
        </div>
      </div>
    </div>
    <div>
      <div class="step-box">
        <div class="step-num">&#128161;</div>
        <div class="step-content">
          <div class="step-title">Progressive Hints &amp; Complexity Matrix</div>
          <div class="step-desc">Stuck? Unlock up to 3 progressive hints that nudge your algorithmic thinking without revealing the raw solution. Review time ($O$) and space constraints.</div>
        </div>
      </div>
      <div class="step-box">
        <div class="step-num">&#128214;</div>
        <div class="step-content">
          <div class="step-title">Editorial Solutions &amp; Community Approaches</div>
          <div class="step-desc">After passing or after 3 attempts, review verified editorial walkthroughs comparing Brute Force vs Optimal ($O(N)$) implementations.</div>
        </div>
      </div>
      <div class="step-box">
        <div class="step-num">&#128293;</div>
        <div class="step-content">
          <div class="step-title">Daily Challenge &amp; Streak Multipliers</div>
          <div class="step-desc">Solve the featured Problem of the Day to earn 50 XP and double your daily streak multiplier, boosting your ranking on the campus leaderboard.</div>
        </div>
      </div>
    </div>
  </div>

  <h2>3. Understanding Judge Verdicts</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 15%;">Verdict Code</th>
        <th style="width: 25%;">Meaning</th>
        <th style="width: 60%;">Resolution Guide</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="badge badge-green">AC (Accepted)</span></td>
        <td>All test cases passed.</td>
        <td>Solution satisfies both runtime time limits and memory boundaries. Problem marked solved.</td>
      </tr>
      <tr>
        <td><span class="badge badge-amber">TLE (Time Limit)</span></td>
        <td>Execution exceeded CPU limit.</td>
        <td>Your algorithmic complexity is too high (e.g., $O(N^2)$ instead of required $O(N \log N)$ or $O(N)$). Optimize nested loops and use hash maps.</td>
      </tr>
      <tr>
        <td><span class="badge badge-amber">MLE (Memory Limit)</span></td>
        <td>Process exceeded memory allocation.</td>
        <td>Avoid creating deep recursive stacks or duplicate multi-dimensional arrays. Implement iterative state machines.</td>
      </tr>
      <tr>
        <td><span class="badge badge-blue">WA (Wrong Answer)</span></td>
        <td>Output differed from expected.</td>
        <td>Review failed case diff. Check corner cases: zero inputs, single element, negative values, integer overflow (use 64-bit integers).</td>
      </tr>
      <tr>
        <td><span class="badge badge-slate">RE / CE</span></td>
        <td>Runtime or Compilation Error.</td>
        <td>Syntax errors, unhandled null pointers, array index out of bounds, or division by zero. Inspect the error console trace.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 03 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 4 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 03</span>
      Multi-Branch Core Engineering Preparation
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Beyond IT: Dedicated Modules for Every Engineering Discipline</h2>
  <p>AptRun is unique in providing comprehensive campus readiness for non-CS disciplines. Every engineering branch has access to high-yield technical question banks, numerical drills, and concept flashcards aligned with GATE, PSU, and Core Corporate assessments.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 8pt; margin-bottom: 2px;">Electronics &amp; Communication (ECE)</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Digital Electronics &amp; VLSI:</strong> Verilog HDL syntax, CMOS logic gates, state machines, timing diagrams.<br/>
        &bull; <strong>Microprocessors:</strong> 8051, 8086, ARM Cortex architectures, assembly memory mapping, interrupts.<br/>
        &bull; <strong>Signals &amp; Systems:</strong> Fourier, Laplace, Z-transforms, digital filter design (FIR/IIR).<br/>
        &bull; <strong>Target Recruiters:</strong> Texas Instruments, Qualcomm, Intel, Nvidia, AMD, L&amp;T Technology.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Mechanical Engineering (ME)</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Thermal &amp; Fluid:</strong> Thermodynamics cycles (Rankine, Otto, Diesel), Navier-Stokes, Heat Transfer.<br/>
        &bull; <strong>Strength of Materials:</strong> Stress-strain tensors, Mohr's circle, shear force and bending moment diagrams.<br/>
        &bull; <strong>Manufacturing Science:</strong> CNC machining, casting defects, welding metallurgy, Metrology.<br/>
        &bull; <strong>Target Recruiters:</strong> Tata Motors, Larsen &amp; Toubro, Thermax, Bosch, Mahindra, General Electric.
      </p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card amber">
      <div style="font-weight: 700; color: #d97706; font-size: 8pt; margin-bottom: 2px;">Electrical Engineering (EE)</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Machines &amp; Drives:</strong> Transformers, Induction Motors, Synchronous Alternators, BLDC motors.<br/>
        &bull; <strong>Power Systems:</strong> Load flow analysis (Gauss-Seidel), fault calculations, protective relaying.<br/>
        &bull; <strong>Control Systems:</strong> Root locus, Bode plots, Nyquist stability criterion, State space modeling.<br/>
        &bull; <strong>Target Recruiters:</strong> Schneider Electric, Siemens, ABB, Tata Power, BHEL, Alstom.
      </p>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 8pt; margin-bottom: 2px;">Civil &amp; Structural Engineering (CE)</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        &bull; <strong>Structural Analysis:</strong> Moment distribution method, matrix stiffness, finite element basics.<br/>
        &bull; <strong>Concrete &amp; Steel:</strong> IS 456 / Eurocode design of beams, columns, footing, prestressed concrete.<br/>
        &bull; <strong>Geotechnical &amp; Transportation:</strong> Soil shear strength, foundation bearing capacity, pavement design.<br/>
        &bull; <strong>Target Recruiters:</strong> L&amp;T Construction, Shapoorji Pallonji, AECOM, Tata Projects, Jacobs.
      </p>
    </div>
  </div>

  <h2>2. Specialized Core Track: Merchant Navy &amp; Maritime Deck/Engine</h2>
  <div class="step-box">
    <div class="step-num">&#9875;</div>
    <div class="step-content">
      <div class="step-title">Chief Mate &amp; 2nd Mate Oral Exam Question Bank (Functions 1, 2, 3)</div>
      <div class="step-desc">Covers international maritime navigation safety, cargo operations, ship stability (GZ curves, hydrostatic tables), MARPOL Annexes I-VI, and SOLAS convention compliance.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128741;</div>
    <div class="step-content">
      <div class="step-title">ROR (Regulations for Preventing Collisions at Sea) Pictorial QA Cards</div>
      <div class="step-desc">Interactive flashcards for Rules 1-38, day shapes, navigation lights, sound and light signals, and vessel encounter situations (Head-on, Crossing, Overtaking) with instant pictorial validation.</div>
    </div>
  </div>

  <h2>3. Core Assessment Formats &amp; Scoring</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Assessment Format</th>
        <th style="width: 45%;">Design &amp; Question Architecture</th>
        <th style="width: 30%;">Exam Marking Scheme</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Multiple Choice (MCQ Single)</strong></td>
        <td>Single correct answer from 4 choices testing core theoretical knowledge.</td>
        <td>+1.0 Marks &middot; -0.25 Negative marking option (configured by college TPO).</td>
      </tr>
      <tr>
        <td><strong>Numerical Answer Type (NAT)</strong></td>
        <td>Input precise decimal values without multiple choice options; tests true analytical calculation.</td>
        <td>+2.0 Marks &middot; Zero negative penalty &middot; Numerical tolerance bands allowed (&plusmn;0.5%).</td>
      </tr>
      <tr>
        <td><strong>Concept Flashcards</strong></td>
        <td>Spaced repetition flashcards for rapid revision of formulas, definitions, and component schematics.</td>
        <td>Ungraded mastery mode &middot; Tracks retention interval and memory decay.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 04 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 5 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 04</span>
      Soft Skills, Business English &amp; Learning Centre
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Spoken English &amp; Pronunciation Engine</h2>
  <p>Modern campus recruiters evaluate verbal communication and executive presence alongside technical ability. AptRun's in-browser voice lab captures your acoustic speech and runs automated phoneme evaluation.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Pronunciation Accuracy</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Speech recognition compares your spoken waveform against standard Received Pronunciation (RP) and General American corporate benchmarks.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Speaking Pace &amp; Fluency</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Measures Words Per Minute (WPM). The ideal professional presentation window is 120&ndash;150 WPM. Flags rushed articulation and awkward pauses.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Filler-Word Tracking</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Detects and counts involuntary conversational crutches (<em>"um", "uh", "basically", "you know", "like"</em>) to build executive communication confidence.</div>
    </div>
  </div>

  <h2>2. Vocabulary Sprint: Rapid Lexicon Drills</h2>
  <div class="step-box">
    <div class="step-num">&#9201;</div>
    <div class="step-content">
      <div class="step-title">60-Second Rapid-Fire Challenges</div>
      <div class="step-desc">Test your corporate and business English lexicon. Identify high-frequency synonyms, antonyms, contextual collocations, and idiomatic phrases used in global business operations.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128200;</div>
    <div class="step-content">
      <div class="step-title">Contextual Business English Sets</div>
      <div class="step-desc">Practice real-world corporate correspondence: drafting executive summaries, resolving client escalations, writing concise bug reports, and participating in agile standups.</div>
    </div>
  </div>

  <h2>3. General Aptitude &amp; Reasoning Modules</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Aptitude Module</th>
        <th style="width: 45%;">Core Syllabus &amp; Problem Typologies</th>
        <th style="width: 30%;">Corporate Exam Relevancy</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Quantitative Aptitude</strong></td>
        <td>Number systems, percentages, profit &amp; loss, simple/compound interest, time &amp; work, time-speed-distance, permutations, combinations, probability.</td>
        <td>Standard in TCS NQT, Infosys, Cognizant, Wipro, Capgemini Round 1 screening.</td>
      </tr>
      <tr>
        <td><strong>Logical Reasoning</strong></td>
        <td>Linear and circular seating arrangements, syllogisms, blood relations, direction sense, coding-decoding, clocks, calendars, cubes &amp; dice.</td>
        <td>Critical for product companies, financial institutions, and analytics firms.</td>
      </tr>
      <tr>
        <td><strong>Data Interpretation</strong></td>
        <td>Tabular charts, bar graphs, pie charts, radar plots, line graphs, caselet reasoning, data sufficiency analysis.</td>
        <td>Essential for consulting, investment banking, and fintech placement tracks.</td>
      </tr>
      <tr>
        <td><strong>Verbal Ability</strong></td>
        <td>Reading comprehension passages, sentence correction, spotting grammatical errors, para jumbles, sentence completion, critical reasoning.</td>
        <td>Mandatory across all IT services, MNCs, and management aptitude exams.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Flashcards &amp; Rapid Revision Centre</h2>
  <div class="callout amber">
    <div class="callout-title">Adaptive Spaced Repetition (SRS) Engine</div>
    <div class="callout-body">
      When studying in the Learning Centre, questions you answer incorrectly are automatically flagged and scheduled for re-testing at optimal decay intervals (24 hours, 3 days, 7 days). This guarantees long-term memory consolidation before major campus placement drives.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 05 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 6 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 05</span>
      Vault AI™ Interactive Mock Interview Room
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. What is Vault AI™?</h2>
  <p>Vault AI™ is an automated multimodal interview engine that simulates live technical and HR interviews with top industry engineering managers. It uses real-time speech synthesis, natural speech recognition, and facial composure analysis to conduct authentic technical conversations.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">41 Tech Stacks</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Full Stack (.NET, Spring Boot, MERN), Cloud/DevOps (AWS, K8s), Data Science, Machine Learning, Embedded Systems.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Dynamic Follow-Ups</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">The AI doesn't just read static questions; it analyzes your exact response and asks probing follow-ups on edge cases and architectural trade-offs.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Stored PDF Ledger</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Generates an authoritative verified interview transcript and performance score card stored permanently in your Mellow Vault record.</div>
    </div>
  </div>

  <h2>2. The 3-Stage Interview Circuit</h2>
  <div class="step-box">
    <div class="step-num">Stage 1</div>
    <div class="step-content">
      <div class="step-title">Technical Foundations &amp; Syntax Core (10&ndash;12 mins)</div>
      <div class="step-desc">Evaluates language runtime mechanics (e.g., JVM garbage collection, Python GIL, JavaScript event loop, C++ memory pointers), data structure selection, and algorithmic efficiency.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Stage 2</div>
    <div class="step-content">
      <div class="step-title">System Architecture &amp; Real-World Scenarios (15&ndash;20 mins)</div>
      <div class="step-desc">Presents practical architectural problems (e.g., designing an idempotent payment webhook, scaling microservice caching, database indexing strategies, race condition resolution).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Stage 3</div>
    <div class="step-content">
      <div class="step-title">Behavioral, Culture &amp; Leadership Competencies (10 mins)</div>
      <div class="step-desc">Evaluates cross-functional teamwork, conflict resolution, dealing with ambiguous requirements, meeting tight deadlines, and communication using the STAR methodology.</div>
    </div>
  </div>

  <h2>3. Preparing Your Environment for a Live Mock</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">System Requirement</th>
        <th style="width: 45%;">Specification &amp; Optimum Setting</th>
        <th style="width: 30%;">Common Fault Prevention</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Webcam &amp; Lighting</strong></td>
        <td>HD 720p or 1080p camera positioned at eye level. Face illuminated from front; avoid bright backlighting.</td>
        <td>Allow browser camera permission when prompted by Chrome/Edge.</td>
      </tr>
      <tr>
        <td><strong>Microphone &amp; Audio</strong></td>
        <td>Dedicated headset or noise-cancelling directional microphone. Quiet ambient room.</td>
        <td>Avoid speaker feedback by using headphones rather than laptop speakers.</td>
      </tr>
      <tr>
        <td><strong>Network Bandwidth</strong></td>
        <td>Stable broadband connection with minimum 5 Mbps upload/download speed. Low ping.</td>
        <td>Disconnect heavy background downloads or VPN tunnels during the interview session.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Post-Interview Scorecard &amp; Report</h2>
  <div class="callout green">
    <div class="callout-title">The Vault AI Verified Evaluation Metric</div>
    <div class="callout-body">
      At the conclusion of each session, Vault AI calculates your <strong>Technical Competency Index (0&ndash;100)</strong>, <strong>Communication Fluency Score</strong>, and <strong>Composure Rating</strong>. A downloadable, tamper-evident PDF report is generated containing the full question-by-question transcript, your strengths, identified vulnerabilities, and recommended remedial coding problems.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 06 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 7 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 06</span>
      Project Lab™ Cloud Workspaces (Expert &amp; Grandmaster)
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Cloud Workspaces: Full-Stack Engineering in the Browser</h2>
  <p>Project Lab™ bridges the gap between toy algorithmic coding and production software engineering. Included in <strong>Expert</strong> and <strong>Grandmaster</strong> plans (and institution-sponsored Pro/Enterprise college licenses), it provisions dedicated containerized Linux environments running directly in your browser.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">80 Active Hours / Month</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Generous computing budget for spinning up full-stack servers, database instances, and frontend development servers.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">3 Concurrent Projects</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Work across multiple industry capstones simultaneously (e.g. FinTech API, Hospital Management, AI Chatbot).</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Integrated Terminal</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Full bash shell access with pre-installed Git, Docker, Node.js, Python, Java, PostgreSQL, and Redis.</div>
    </div>
  </div>

  <h2>2. Featured Capstone Architecture: Hospital Management System</h2>
  <p>An enterprise-grade, multi-tenant microservices architecture designed to prove real-world engineering capability:</p>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 20%;">Milestone Stage</th>
        <th style="width: 45%;">Engineering Deliverables &amp; Technical Scope</th>
        <th style="width: 35%;">Automated Validation Criteria</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Milestone 01: Core Architecture</strong></td>
        <td>Database schema migration, relational models (Patients, Doctors, Appointments, Billing), and JWT authentication middleware.</td>
        <td>Unit tests pass; database seeders populate valid relational constraints without orphaned records.</td>
      </tr>
      <tr>
        <td><strong>Milestone 02: RESTful APIs</strong></td>
        <td>Doctor scheduling endpoints, appointment conflict resolution logic, role-based authorization (Admin, Doctor, Patient).</td>
        <td>Integration test suite verifies concurrency locks and double-booking prevention.</td>
      </tr>
      <tr>
        <td><strong>Milestone 03: Event Processing</strong></td>
        <td>Asynchronous notification queues (email/SMS appointment reminders), audit logging, and payment gateway webhooks.</td>
        <td>Mock webhook handler verifies cryptographic signature verification and idempotent execution.</td>
      </tr>
      <tr>
        <td><strong>Milestone 04: Production Build</strong></td>
        <td>Docker Compose deployment manifest, reverse proxy routing (Nginx/Caddy), health-check probe endpoints.</td>
        <td>Containerized build script builds cleanly and responds with HTTP 200 on <span class="meta-tag">/healthz</span>.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Anti-Plagiarism &amp; Authorship Integrity Guard</h2>
  <div class="grid-2">
    <div class="card amber">
      <div style="font-weight: 700; color: #d97706; font-size: 7.8pt; margin-bottom: 2px;">Keystroke Typing Velocity Audit</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        Project Lab tracks typing cadence, edit increments, and commit frequency. Bulk pasting of pre-written monolithic blocks triggers an integrity review, ensuring students genuinely write their own code.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt; margin-bottom: 2px;">Statement of Work (SOW) Verification PDF</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        Upon passing all milestones, the platform generates a formal <strong>Statement of Work (SOW) Completion Certificate</strong> featuring git commit hashes, total engineering hours, and a verified project portfolio link.
      </p>
    </div>
  </div>

  <h2>4. Workspace Quota Management &amp; Auto-Hibernate</h2>
  <div class="callout green">
    <div class="callout-title">Automatic Idling Protection</div>
    <div class="callout-body">
      To preserve your monthly 80-hour allocation, workspaces automatically hibernate after 15 minutes of inactivity. All file edits, git branches, and installed packages are safely persisted on persistent cloud SSD storage and restore within 5 seconds when you reconnect.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 07 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 8 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 07</span>
      Hackathon Arena &amp; Live Competitive Contests
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. The AptRun Hackathon Arena</h2>
  <p>Participate in university-wide, inter-college, and corporate sponsored hackathons hosted on the AptRun arena. Build full-stack solutions, submit live demos, and compete for industry awards.</p>

  <div class="grid-3">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 7.8pt;">Team Formation &amp; Roles</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Form teams of 2 to 4 members. Assign specific functional roles: Team Lead, Backend Engineer, Frontend Specialist, and AI/Data Lead.</div>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Curated Problem Statements</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Industry-aligned briefs across FinTech, HealthTech, ClimateTech, EdTech, and AI for Bharat with clear evaluation rubrics.</div>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Milestone Progress Submissions</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Submit progressive checkpoints: Pitch Deck, Database Architecture, GitHub Repository Link, and Working Demo Video.</div>
    </div>
  </div>

  <h2>2. Weekly Live Algorithmic Contests</h2>
  <div class="step-box">
    <div class="step-num">&#9874;</div>
    <div class="step-content">
      <div class="step-title">Contest Schedule &amp; Format</div>
      <div class="step-desc">Weekly live contests take place every Saturday at 8:00 PM IST. The contest comprises 4 algorithmic problems (1 Easy, 2 Medium, 1 Hard) over 90 minutes.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128337;</div>
    <div class="step-content">
      <div class="step-title">Dynamic ICPC-Style Scoring &amp; Penalty Calculation</div>
      <div class="step-desc">Points are awarded based on problem weightage. Ties are broken by submission timestamp plus a 10-minute penalty for each rejected submission (WA/TLE).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#127942;</div>
    <div class="step-content">
      <div class="step-title">Weekly Cash &amp; Merchandise Rewards</div>
      <div class="step-desc">Top 3 national rankers receive direct cash prizes (&dollar;50 to &dollar;200 / &inr;5,000 to &inr;20,000) and AptRun official merchandise kits. College toppers receive exclusive Grandmaster badges.</div>
    </div>
  </div>

  <h2>3. Live Contest Rules &amp; Anti-Cheat Standards</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Contest Regulation</th>
        <th style="width: 45%;">Rule Specification &amp; Enforcement</th>
        <th style="width: 30%;">Penalty on Violation</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Single Account Policy</strong></td>
        <td>Each participant may only register and participate using one verified AptRun account.</td>
        <td>Permanent disqualification; forfeiture of all weekly rewards.</td>
      </tr>
      <tr>
        <td><strong>Code Similarity Audits</strong></td>
        <td>All submitted source code undergoes post-contest MOSS-level abstract syntax tree (AST) plagiarism checking.</td>
        <td>Rating reset to 0; 90-day contest suspension; report forwarded to college TPO.</td>
      </tr>
      <tr>
        <td><strong>External Collaboration Lock</strong></td>
        <td>Sharing solutions, discussing test cases on Discord/WhatsApp, or using LLM code generation during live windows is strictly forbidden.</td>
        <td>Immediate contest zero; ban from Mellow Vault talent discovery.</td>
      </tr>
      <tr>
        <td><strong>Full-Screen Lock Mode</strong></td>
        <td>Contest window must remain maximized. Switching tabs or opening external browsers logs an audit flag.</td>
        <td>After 3 tab-switches, contest session auto-terminates.</td>
      </tr>
    </tbody>
  </table>

  <h2>4. Daily Speed Drills: Fast Reflex Practice</h2>
  <div class="callout purple">
    <div class="callout-title">15-Minute Sprint Assessments</div>
    <div class="callout-body">
      Short on time? Launch a Daily Speed Drill: 2 rapid algorithmic problems and 5 core MCQs designed to keep your problem-solving reflexes razor sharp between academic classes.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 08 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 9 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 08</span>
      Exam Integrity &amp; Proctoring Guardian
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Enterprise-Grade Assessment Integrity</h2>
  <p>To ensure campus assessment scores and mock drive results are trusted by global employers, AptRun implements a robust dual-mode proctoring system: in-browser AI monitoring and the native <strong>AptRun Guardian™</strong> desktop client.</p>

  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0284c7; font-size: 8pt; margin-bottom: 2px;">Mode A: In-Browser AI Proctoring</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Standard for weekly contests and campus practice mocks. Runs directly inside Google Chrome or Microsoft Edge. Requires camera and microphone access. Continuously tracks face orientation, tab switches, and audio anomalies.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Mode B: AptRun Guardian™ Desktop App</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        Mandatory for official college campus placement screening and high-stakes company drives. A lightweight Windows security client that locks the desktop, disables virtual machines, blocks screen-sharing software, and prevents secondary monitors.
      </p>
    </div>
  </div>

  <h2>2. Monitored Behavioral Signals &amp; Thresholds</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Integrity Signal</th>
        <th style="width: 45%;">Detection Mechanism &amp; AI Logic</th>
        <th style="width: 30%;">Threshold &amp; Automated Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Continuous Face Presence</strong></td>
        <td>On-device computer vision models verify that candidate's face remains centered in the video frame throughout the assessment.</td>
        <td>Warning issued if face missing &gt; 5 seconds; 3 warnings triggers exam freeze.</td>
      </tr>
      <tr>
        <td><strong>Multi-Person Detection</strong></td>
        <td>Detects secondary individuals entering camera frame or leaning over candidate's shoulder.</td>
        <td>Flagged as high-severity violation; timestamped snapshot recorded in TPO audit log.</td>
      </tr>
      <tr>
        <td><strong>Audio &amp; Voice Activity</strong></td>
        <td>Acoustic processing flags speech, whisper frequencies, and external phone conversations.</td>
        <td>Audio wave log appended to candidate's proctoring dossier.</td>
      </tr>
      <tr>
        <td><strong>Tab &amp; Window Defocus</strong></td>
        <td>Monitors browser focus events. Detects switching to secondary tabs, search engines, or chat apps.</td>
        <td>3 tab switches allowed for accidental clicks; 4th switch auto-submits exam.</td>
      </tr>
      <tr>
        <td><strong>Clipboard &amp; Keystroke Lock</strong></td>
        <td>Disables <span class="meta-tag">Ctrl+C</span> / <span class="meta-tag">Ctrl+V</span> pasting from outside sources. Context menu right-click is blocked.</td>
        <td>Attempts to paste code trigger an immediate screen warning banner.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Candidate Privacy Charter &amp; Ethical AI Principles</h2>
  <div class="callout green">
    <div class="callout-title">Zero Biometric Storage Guarantee</div>
    <div class="callout-body">
      AptRun adheres strictly to GDPR and FERPA data privacy regulations. Facial recognition models run client-side in browser WebAssembly; no facial vectors, fingerprints, or permanent biometric identifiers are ever stored on cloud servers. Video frames captured during flagged anomalies are accessible solely by your verified college TPO.
    </div>
  </div>

  <h2>4. Resolving Accidental Disconnections</h2>
  <div class="step-box">
    <div class="step-num">&#128268;</div>
    <div class="step-content">
      <div class="step-title">Network Drop / Browser Crash Recovery</div>
      <div class="step-desc">If your internet disconnects during a proctored exam, your code editor and answers are auto-saved locally every 15 seconds. Reopen the exam link within 10 minutes to resume from your exact state. Your elapsed time clock continues running during network outages.</div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 09 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 10 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 09</span>
      Subscriptions, College Coverage &amp; Promo Offers
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Understanding the AptRun Subscription Matrix</h2>
  <p>AptRun provides flexible entitlement options designed to ensure no student is blocked from placement readiness:</p>

  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 20%;">Feature &amp; Module</th>
        <th style="width: 25%;">Student Tier (Free)</th>
        <th style="width: 27%;">Expert Plan (Personal / College)</th>
        <th style="width: 28%;">Grandmaster (Mellow Academy)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>DSA &amp; Practice Arena</strong></td>
        <td>All 1,200+ Problems</td>
        <td>All 1,200+ Problems + Video Editorials</td>
        <td>All Problems + 1-on-1 Code Review</td>
      </tr>
      <tr>
        <td><strong>Core Engineering Tracks</strong></td>
        <td>Foundational MCQs</td>
        <td>Full ECE, ME, CE, EE &amp; Marine Banks</td>
        <td>Full Core Banks + Senior Mentor Q&amp;A</td>
      </tr>
      <tr>
        <td><strong>Vault AI Mock Interviews</strong></td>
        <td>1 Mock Session / Month</td>
        <td>Unlimited Mocks across 41 Stacks</td>
        <td>Unlimited Mocks + Live Human Expert Mock</td>
      </tr>
      <tr>
        <td><strong>Project Lab Workspaces</strong></td>
        <td><span class="badge badge-slate">Not Included</span></td>
        <td><strong>80 Hrs/Mo &middot; 3 Active Projects</strong></td>
        <td><strong>160 Hrs/Mo &middot; Unlimited Projects</strong></td>
      </tr>
      <tr>
        <td><strong>Mellow Academy Program</strong></td>
        <td><span class="badge badge-slate">Not Included</span></td>
        <td><span class="badge badge-slate">Not Included</span></td>
        <td><strong>3-Year Guaranteed Placement Program</strong></td>
      </tr>
      <tr>
        <td><strong>Recruiter Vault Discovery</strong></td>
        <td>Standard Pool</td>
        <td><strong>Priority Verified Badge</strong></td>
        <td><strong>Top 1% Super-Dream Shortlisting</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>2. College-Sponsored Coverage &amp; Personal Entitlements</h2>
  <div class="grid-2">
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 8pt; margin-bottom: 2px;">Automatic Institutional Coverage</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        If your university holds an active <strong>Academic Enterprise</strong> or <strong>Pro Campus</strong> subscription, you are automatically covered. You pay zero individual subscription fees; your account displays an institutional badge, granting full access to all practice tracks, mocks, and Project Lab.
      </p>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 8pt; margin-bottom: 2px;">Personal Plan Immediate Precedence</div>
      <p style="font-size: 7.5pt; line-height: 1.28;">
        If you purchase or are awarded an individual <strong>Expert</strong> or <strong>Grandmaster</strong> plan, your personal plan takes effect <strong>immediately</strong>. It does not wait for your college plan to expire, instantly granting higher workspace quotas and direct corporate recruitment prioritization.
      </p>
    </div>
  </div>

  <h2>3. Redeeming 100% Off Promotional Offers &amp; Coupons</h2>
  <div class="step-box">
    <div class="step-num">Step 1</div>
    <div class="step-content">
      <div class="step-title">Access the Pricing &amp; Offers Page</div>
      <div class="step-desc">Log into your account and navigate to <span class="meta-tag">aptrun.com/pricing</span> or click <strong>Upgrade</strong> on your top navigation bar.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 2</div>
    <div class="step-content">
      <div class="step-title">Enter Promotional Voucher / Campus Code</div>
      <div class="step-desc">If you have received a promotional scholarship code (e.g., from a campus hackathon victory or placement cell campaign), enter the coupon in the <strong>Redeem Offer</strong> field.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">Step 3</div>
    <div class="step-content">
      <div class="step-title">Instant Activation Without Billing Blocks</div>
      <div class="step-desc">Even if you are currently on a college-sponsored plan, 100% off promotional redemptions activate immediately without payment gateway redirects or duplicate billing restrictions.</div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 10 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 11 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 10</span>
      Placement Pipeline &amp; The Mellow Vault Bridge
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. The AptRun Readiness Score (ARS) Matrix</h2>
  <p>The AptRun Readiness Score (ARS) is an objective, tamper-proof metric calculated dynamically from your platform performance. It eliminates resume fluff and showcases your verified engineering capabilities to prospective employers.</p>

  <div class="grid-3">
    <div class="card emerald">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 1: Offer Ready</div>
      <div style="font-size: 13pt; font-weight: 800; color: #059669;">ARS 80 &ndash; 100</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Eligible for direct fast-track interviews with top tech giants, product firms, and Tier-1 MNC hiring drives. Priority recruiter visibility.</div>
    </div>
    <div class="card accent">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 2: Developing</div>
      <div style="font-size: 13pt; font-weight: 800; color: #0284c7;">ARS 60 &ndash; 79</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Solid foundational proficiency. Recommended to complete 2 additional Vault AI mocks and 1 Project Lab capstone to reach Tier 1.</div>
    </div>
    <div class="card amber">
      <div style="font-size: 7.2pt; color: #64748b; font-weight: 700; text-transform: uppercase;">Tier 3: Foundational</div>
      <div style="font-size: 13pt; font-weight: 800; color: #d97706;">ARS 0 &ndash; 59</div>
      <div style="font-size: 7.2pt; color: #334155; margin-top: 2px;">Early learner stage. Follow the guided 60-day roadmap in the Learning Centre: focus on Easy/Medium DSA and core MCQs.</div>
    </div>
  </div>

  <h2>2. How Global Recruiters Source from Mellow Vault</h2>
  <p>AptRun is not just an assessment tool; it is a direct talent bridge connecting verified campus students with over 500+ active enterprise hiring partners:</p>

  <div class="step-box">
    <div class="step-num">&#128084;</div>
    <div class="step-content">
      <div class="step-title">Automated Recruiter Filtering &amp; Talent Discovery</div>
      <div class="step-desc">Hiring partners (Accenture, TCS, Cognizant, Infosys, Wipro, Capgemini, Fintech Startups) run automated searches filtering by tech stack, branch, CGPA, and ARS cutoff (e.g., <em>"ARS &gt; 80 in Java + Spring Boot"</em>).</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128196;</div>
    <div class="step-content">
      <div class="step-title">One-Click Resume Vault Shortlisting</div>
      <div class="step-desc">Recruiters review your verified profile card, listen to audio excerpts of your Vault AI interview, inspect your Project Lab commit logs, and download your standardized resume.</div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num">&#128227;</div>
    <div class="step-content">
      <div class="step-title">Direct Interview Invites &amp; Drive Notifications</div>
      <div class="step-desc">When shortlisted, you receive an instant email and SMS invitation to an on-campus or virtual interview drive, bypassing the traditional resume screening round.</div>
    </div>
  </div>

  <h2>3. Verified Digital Badges &amp; LinkedIn Sharing</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Digital Credential</th>
        <th style="width: 45%;">Verification Scope &amp; Evidence</th>
        <th style="width: 30%;">Employer Verification Link</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>AptRun Verified Candidate Badge</strong></td>
        <td>Issued to candidates achieving ARS 80+. Cryptographically verifiable badge link for resume header and LinkedIn profile.</td>
        <td>Permanent URL: <span class="meta-tag">aptrun.com/verify/&lt;user-id&gt;</span></td>
      </tr>
      <tr>
        <td><strong>Project Lab SOW Certificate</strong></td>
        <td>Authenticates completion of enterprise capstone projects with full commit integrity and authorship audit.</td>
        <td>Includes verifiable SHA-256 commit hash.</td>
      </tr>
      <tr>
        <td><strong>Vault AI Interview Transcript</strong></td>
        <td>Stored multi-stage interview report featuring technical rating, fluency score, and verified video proctoring stamp.</td>
        <td>Downloadable formal evaluation PDF.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout green">
    <div class="callout-title">The Mellow Vault Placement Guarantee (Grandmaster Plan)</div>
    <div class="callout-body">
      Students enrolled in the Mellow Academy Grandmaster program receive a 3-year placement assurance contract: dedicated 1-on-1 industry mentorship, weekly code reviews, and guaranteed direct interview drives until a verified offer letter is secured.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 11 of 12</span>
  </div>
</div>

<!-- ================================================= PAGE 12 ================================================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Part 11</span>
      Student Helpdesk, Troubleshooting FAQ &amp; Contact Directory
    </div>
    <div class="header-meta">AptRun™ Student Manual &middot; Global Edition</div>
  </div>

  <h2>1. Common Troubleshooting Scenarios</h2>
  <div class="grid-2">
    <div class="card accent">
      <div style="font-weight: 700; color: #0369a1; font-size: 7.8pt;">Issue: Webcam Not Allowed in Vault AI / Exam</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        <strong>Fix:</strong> Click the padlock icon on your browser address bar &rarr; Site Settings &rarr; Set <em>Camera</em> and <em>Microphone</em> to <strong>Allow</strong>. Ensure no other application (Zoom, Teams) is holding the webcam lock. Refresh page.
      </p>
    </div>
    <div class="card emerald">
      <div style="font-weight: 700; color: #059669; font-size: 7.8pt;">Issue: Code Submission Shows "Execution Timeout"</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        <strong>Fix:</strong> Verify your code does not contain infinite <span class="meta-tag">while(true)</span> loops or unbuffered console print statements inside large loops. Use fast I/O (<span class="meta-tag">BufferedReader</span> in Java, <span class="meta-tag">sys.stdin</span> in Python).
      </p>
    </div>
  </div>
  <div class="grid-2">
    <div class="card amber">
      <div style="font-weight: 700; color: #d97706; font-size: 7.8pt;">Issue: Project Lab Workspace Shows Disconnected</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        <strong>Fix:</strong> Workspaces hibernate after 15 mins of idle time. Click <strong>Restart Container</strong> on the workspace toolbar. Your files, git state, and database tables are safely restored within 5 seconds.
      </p>
    </div>
    <div class="card purple">
      <div style="font-weight: 700; color: #7c3aed; font-size: 7.8pt;">Issue: Temporary Password Not Received</div>
      <p style="font-size: 7.4pt; line-height: 1.26;">
        <strong>Fix:</strong> Check your Spam / Promotional folder for emails from <span class="meta-tag">no-reply@mellowvault.com</span>. Alternatively, visit <span class="meta-tag">aptrun.com/forgot-password</span> and enter your registered roll number / email.
      </p>
    </div>
  </div>

  <h2>2. Support Service Level Agreement (SLA) &amp; Escalation Path</h2>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width: 25%;">Support Tier</th>
        <th style="width: 35%;">Channel &amp; Coordinates</th>
        <th style="width: 40%;">Guaranteed Response Time</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Tier 1: General Student Helpdesk</strong></td>
        <td>Email: <span class="meta-tag">support@mellowvault.com</span></td>
        <td>Within 4 business hours (Mon &ndash; Sat, 9:00 AM &ndash; 8:00 PM IST)</td>
      </tr>
      <tr>
        <td><strong>Tier 2: Live Assessment Helpline</strong></td>
        <td>Emergency WhatsApp: <strong>+91 76785 78295</strong></td>
        <td><strong>Immediate (Under 10 minutes)</strong> during active campus placement drives</td>
      </tr>
      <tr>
        <td><strong>Tier 3: Academic / TPO Escalations</strong></td>
        <td>Institutional Portal: <span class="meta-tag">aptrun.com/support</span></td>
        <td>Handled directly by dedicated University Relationship Manager</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Official Corporate Directory &amp; Governance</h2>
  <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 10px 14px; margin-top: 3mm; display: flex; justify-content: space-between; align-items: center;">
    <div>
      <div style="font-size: 9.2pt; font-weight: 800; color: #0f172a;">AptRun™ Enterprise Campus Readiness Platform</div>
      <div style="font-size: 7.8pt; color: #0369a1; font-weight: 700;">A Product of Mellow Vault &middot; A Unit of Prayukti Development Private Limited</div>
      <div style="font-size: 7.2pt; color: #64748b; margin-top: 2px;">
        Corporate Identity Number (CIN): <strong>U62099UP2024PTC207212</strong><br/>
        Registered Offices: Noida (NCR) &amp; New Delhi, India &middot; Global CDN: AWS Cloud Infrastructure
      </div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-green" style="font-size: 7.5pt; padding: 3px 8px;">ISO 27001 COMPLIANT</span>
      <div style="font-size: 6.8pt; color: #64748b; margin-top: 4px;">Uptime SLA: <strong>99.95%</strong></div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AptRun™ Enterprise Skilling Platform &middot; Student &amp; Candidate Guide</span>
    <span>Page 12 of 12</span>
  </div>
</div>

</body>
</html>
"""

    temp_html = r"D:\Dev\AptRun\temp_student_guide.html"
    output_pdf = r"D:\Dev\AptRun\docs\AptRun-Student-User-Guide.pdf"
    
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

    print("Generating Student User Guide PDF...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    time.sleep(2)

    if os.path.exists(output_pdf):
        print(f"Successfully generated: {output_pdf} (Size: {os.path.getsize(output_pdf)} bytes)")
    else:
        print("Failed to generate PDF. Stdout:", res.stdout, "Stderr:", res.stderr)

    if os.path.exists(temp_html):
        os.remove(temp_html)

if __name__ == "__main__":
    build_student_guide_pdf()
