import base64
import os
import subprocess
import time

def build_technical_pdf():
    logo_path = r"D:\Dev\AptRun\aptRun Logo.png"
    with open(logo_path, "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode("ascii")

    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>AptRun Platform Technical Architecture & Feature Guide</title>
<style>
  @page {
    size: A4 portrait;
    margin: 8mm 11mm 10mm 11mm;
  }
  @media print {
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      page-break-after: always;
      break-after: page;
      position: relative;
      height: 279mm;
      box-sizing: border-box;
    }
    .no-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", "Helvetica Neue", Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 8pt;
    line-height: 1.32;
  }

  .page {
    padding: 1mm 1mm 5mm 1mm;
    position: relative;
    page-break-after: always;
    break-after: page;
    min-height: 275mm;
  }

  /* Header & Footer */
  .header-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid #0284c7;
    padding-bottom: 4px;
    margin-bottom: 7px;
  }
  .header-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .header-tag {
    background: #e0f2fe;
    color: #0369a1;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 6.5pt;
    font-weight: 700;
  }
  .header-meta {
    font-size: 7pt;
    color: #64748b;
  }

  .footer-bar {
    position: absolute;
    bottom: 1mm;
    left: 1mm;
    right: 1mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #e2e8f0;
    padding-top: 3px;
    font-size: 7pt;
    color: #94a3b8;
  }

  /* Typography */
  h1 {
    font-size: 15pt;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin-bottom: 3px;
  }
  h2 {
    font-size: 9.8pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
    margin-top: 5px;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  h3 {
    font-size: 8.4pt;
    font-weight: 700;
    color: #1e293b;
    margin-top: 4px;
    margin-bottom: 2px;
  }
  p {
    font-size: 7.8pt;
    color: #334155;
    margin-bottom: 4px;
    line-height: 1.3;
  }

  /* Grids */
  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 5px;
    margin-bottom: 5px;
  }
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 5px;
    margin-bottom: 5px;
  }
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 5px;
    margin-bottom: 5px;
  }

  .stat-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 4px 7px;
    border-left: 2.5px solid #0284c7;
  }
  .stat-card.emerald { border-left-color: #059669; background: #f0fdf4; }
  .stat-card.indigo { border-left-color: #4f46e5; background: #faf5ff; }
  .stat-card.amber { border-left-color: #d97706; background: #fffbeb; }
  .stat-val {
    font-size: 11.5pt;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.1;
  }
  .stat-label {
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }
  .stat-sub {
    font-size: 6.8pt;
    color: #475569;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5px;
    font-size: 7.5pt;
  }
  th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 6.6pt;
    letter-spacing: 0.04em;
    text-align: left;
    padding: 3.5px 5px;
    border: 1px solid #cbd5e1;
  }
  td {
    padding: 3.5px 5px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
    line-height: 1.25;
    color: #1e293b;
  }
  tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 6.4pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .badge-blue { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
  .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
  .badge-indigo { background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; }
  .badge-amber { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
  .badge-rose { background: #ffe4e6; color: #be123c; border: 1px solid #fecdd3; }
  .badge-slate { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }

  /* Code & Callouts */
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 7pt;
    background: #f1f5f9;
    padding: 1px 3px;
    border-radius: 3px;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }
  pre {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 6.8pt;
    background: #0f172a;
    color: #f8fafc;
    padding: 5px 8px;
    border-radius: 4px;
    line-height: 1.35;
    margin-bottom: 5px;
    overflow-x: auto;
  }

  .callout {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 5px 8px;
    margin-bottom: 5px;
    border-left: 3px solid #0284c7;
  }
  .callout.green { border-left-color: #059669; background: #f0fdf4; }
  .callout.amber { border-left-color: #d97706; background: #fffbeb; }
  .callout.indigo { border-left-color: #4f46e5; background: #faf5ff; }
  .callout.rose { border-left-color: #e11d48; background: #fff1f2; }
  .callout-title {
    font-size: 7.5pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 1px;
  }
  .callout-body {
    font-size: 7.2pt;
    color: #334155;
    line-height: 1.25;
  }
  /* Corporate Statutory Verification Block */
  .corp-auth-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 3.5px solid #0284c7;
    border-radius: 5px;
    padding: 5px 8px;
    margin-bottom: 6px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  }
  .corp-auth-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 2px;
    margin-bottom: 3px;
  }
  .corp-auth-title {
    font-size: 7pt;
    font-weight: 800;
    color: #0369a1;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .corp-auth-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-bottom: 3px;
  }
  .corp-auth-item {
    font-size: 6.8pt;
    line-height: 1.25;
  }
  .corp-auth-label {
    font-size: 5.9pt;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    letter-spacing: 0.04em;
  }
  .corp-auth-val {
    font-weight: 700;
    color: #0f172a;
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .corp-auth-legal {
    font-size: 6.4pt;
    color: #475569;
    line-height: 1.25;
    border-top: 1px dashed #cbd5e1;
    padding-top: 2px;
  }
</style>
</head>
<body>

<!-- ================= PAGE 1: TITLE & HIGH-LEVEL ARCHITECTURAL TOPOLOGY ================= -->
<div class="page">
  <!-- Official Corporate Top Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 6px;">
    <div style="display: flex; align-items: center; gap: 10px;">
      <img src="data:image/png;base64,{logo_b64}" alt="AptRun Logo" style="height: 36px; object-fit: contain;">
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
      <div style="font-size: 7pt; font-weight: 700; color: #0f172a;">Official Technical Architecture &amp; Feature Specification &middot; 2026.10</div>
      <div style="font-size: 6.2pt; color: #64748b; font-family: monospace;">DOC REF: APTRUN-ENG-2026-V4.2 &middot; MCA STATUTORY FILING</div>
    </div>
  </div>

  <div style="margin-bottom: 4px;">
    <div style="font-size: 8pt; font-weight: 700; color: #0284c7; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1px;">Codebase Engineering Blueprint &middot; Senior Developer Specification</div>
    <h1 style="font-size: 16pt; font-weight: 800; color: #0f172a; line-height: 1.15; margin-bottom: 3px; letter-spacing: -0.02em;">
      AptRun Technical Feature Guide &amp; Codebase Architecture
    </h1>
    <p style="font-size: 7.8pt; color: #334155; line-height: 1.3; max-width: 720px; margin-bottom: 4px;">
      The definitive codebase manual for Senior Developers, Architects, and Tech Leads. 
      Details database schemas, plan limits &amp; entitlement logic, background workers, judge execution isolation, 
      AI integration pipelines, and extension points to guide feature modifications and system enhancements.
    </p>
  </div>

  <!-- Corporate Statutory Attestation & Authentication Card -->
  <div class="corp-auth-box">
    <div class="corp-auth-header">
      <div class="corp-auth-title">
        <svg style="width: 10px; height: 10px; fill: #0284c7; vertical-align: middle; margin-right: 3px;" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>
        Statutory Corporate Registry &amp; Intellectual Property Attestation
      </div>
      <div style="display: flex; gap: 4px;">
        <span class="badge badge-blue" style="font-size: 6pt; padding: 1px 5px;">MCA Statutory Record</span>
        <span class="badge badge-green" style="font-size: 6pt; padding: 1px 5px;">Legally Validated</span>
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
        <div class="corp-auth-label">Enterprise Tech Desk</div>
        <div class="corp-auth-val">support@mellowvault.com &middot; +91 76785 78295</div>
      </div>
      <div class="corp-auth-item">
        <div class="corp-auth-label">Security &amp; Compliance</div>
        <div class="corp-auth-val" style="color: #059669;">ISO 27001 Certified &middot; 256-Bit SSL Encrypted</div>
      </div>
    </div>
    <div class="corp-auth-legal">
      <strong>Official Validity &amp; Authenticity Notice:</strong> This document serves as the official, authenticated technical architecture and engineering specification for the AptRun platform, engineered and owned by Mellow Vault, a unit of PRAYUKTI DEVELOPMENT PRIVATE LIMITED (CIN: U62099UP2024PTC207212). All architectural schemas, subscription entitlement tiers, execution sandboxes, scoring algorithms, and security boundaries documented herein represent binding technical standards and proprietary intellectual property.
    </div>
  </div>

  <h2>1. Platform Architectural Topology</h2>
  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">Next.js 14</div>
      <div class="stat-label">Frontend Layer</div>
      <div class="stat-sub">App router, Monaco Editor, Tailwind CSS, KaTeX, Framer Motion</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">Laravel 11</div>
      <div class="stat-label">Control Plane</div>
      <div class="stat-sub">PHP 8.2+, Sanctum RBAC, Eloquent ORM, MySQL/Postgres</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">Piston Judge</div>
      <div class="stat-label">Execution Cluster</div>
      <div class="stat-sub">19 language runtimes, 256MB cgroup caps, sub-second latency</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">Caddy + Docker</div>
      <div class="stat-label">Project Lab Hosts</div>
      <div class="stat-sub">Hardened OpenVSCode Server containers with reverse wildcard TLS</div>
    </div>
  </div>

  <div class="callout">
    <div class="callout-title">Core Structural Invariant: Untrusted Code Isolation</div>
    <div class="callout-body">
      Student code submissions and container workspaces <strong>never run on the PHP web application server</strong>. 
      The Laravel application functions strictly as a metered, secure control plane. Piston executes code in isolated execution cgroups, 
      while Project Lab workspaces run inside unprivileged Linux containers (<code>--cap-drop ALL</code>, <code>no-new-privileges</code>) on dedicated worker nodes.
    </div>
  </div>

  <h2>2. Repository Directory Structure &amp; Subsystems</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Directory Path</th>
        <th style="width: 22%;">Technology Stack</th>
        <th style="width: 54%;">Architectural Function &amp; Code Responsibilities</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>backend/app/Models/</code></td>
        <td>Eloquent ORM (PHP)</td>
        <td>Contains models: <code>User</code>, <code>Plan</code>, <code>Subscription</code>, <code>Problem</code>, <code>Contest</code>, <code>CoreQuestion</code>, <code>Workspace</code>. Defines relationships, scopes, and casts.</td>
      </tr>
      <tr>
        <td><code>backend/app/Services/</code></td>
        <td>Business Logic Layer</td>
        <td>Domain services: <code>ReadinessScoreService</code>, <code>PurchaseQuoteService</code>, <code>CheckoutService</code>, <code>WorkspaceManager</code>, <code>SpeechAlignment</code>, <code>VocabularySrsService</code>.</td>
      </tr>
      <tr>
        <td><code>backend/routes/api.php</code></td>
        <td>Routing &amp; Middleware</td>
        <td>Central routing topology partitioned by role middleware (<code>role:user</code>, <code>role:admin_tpo</code>, <code>role:superadmin</code>, <code>account.active</code>, <code>not.impersonating</code>).</td>
      </tr>
      <tr>
        <td><code>frontend/src/app/</code></td>
        <td>Next.js App Router</td>
        <td>Contains all persona routes: <code>/dashboard</code> (Students), <code>/admin</code> (TPO/Ops), <code>/coordinator</code> (Faculty), <code>/superadmin</code> (Governance), <code>/arena</code> (Hackathons).</td>
      </tr>
      <tr>
        <td><code>infra/judge/</code> &amp; <code>workspaces/</code></td>
        <td>Docker, Caddy, Bash</td>
        <td>Supervisor scripts, Piston runtime patches, Caddy wildcard gateway configuration, and OpenVSCode container Dockerfiles.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>System Architecture &amp; Top-Level Topology</span>
    <span>Page 1 of 16</span>
  </div>
</div>

<!-- ================= PAGE 2: MULTI-TENANT SECURITY & RBAC MATRIX ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 1</span>
      <span>Multi-Tenant Security, Personas &amp; RBAC Architecture</span>
    </div>
    <div class="header-meta">Architecture &amp; Authorization (backend/app/Models/User.php)</div>
  </div>

  <h2>1. Role Constants &amp; Tenant Boundaries</h2>
  <p>
    Authorization is defined via role constants on the <code>User</code> model and enforced via route middleware. 
    Cross-tenant access attempts return <code>404 Not Found</code> (rather than 403) to prevent enumerating the existence of other institutions or companies.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Role Constant</th>
        <th style="width: 15%;">String Token</th>
        <th style="width: 38%;">Scope of Authority &amp; Accessible Controllers</th>
        <th style="width: 25%;">Tenant Boundary Rule</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>ROLE_USER</code></td>
        <td><code>user</code></td>
        <td>Coding console, core prep, learning lab, project lab, AI interview sessions, vault, drive applications.</td>
        <td>Sees personal progress and college-mapped content only.</td>
      </tr>
      <tr>
        <td><code>ROLE_ADMIN_TPO</code></td>
        <td><code>admin_tpo</code></td>
        <td>Batch onboarding, 29-col cohort directory, mock assessments, anti-cheat proctoring, drive mapping, reports.</td>
        <td>Scoped strictly to <code>users.college_id</code>.</td>
      </tr>
      <tr>
        <td><code>ROLE_SECTION_COORDINATOR</code></td>
        <td><code>section_coordinator</code></td>
        <td>Sub-cohort attention queue, daily intervention logging, section mock proctoring, disciplinary blocks.</td>
        <td>Scoped strictly by <code>users.coordinator_scope</code> (Section + Branch).</td>
      </tr>
      <tr>
        <td><code>ROLE_ADMIN_COMPANY</code></td>
        <td><code>admin_company</code></td>
        <td>College directory proposals, job openings, talent pool search, custom coding tests, AI interview reviews.</td>
        <td>Scoped strictly to <code>users.company_id</code>. Other drives return 404.</td>
      </tr>
      <tr>
        <td><code>ROLE_ADMIN_INTERNAL</code></td>
        <td><code>admin_internal</code></td>
        <td>Platform operations: Problem bank curation, 70 soft skill sets, Core Prep import, customer success.</td>
        <td>Governed by granular permission flags in <code>users.permissions</code>.</td>
      </tr>
      <tr>
        <td><code>ROLE_SUPERADMIN</code></td>
        <td><code>superadmin</code></td>
        <td>Platform pricing, subscription overrides, payment gateway audit, user impersonation, system flags.</td>
        <td>Unrestricted platform access; immutable audit logging.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Internal Staff Granular Permissions (<code>PERMISSIONS_INTERNAL</code>)</h2>
  <div class="grid-3">
    <div class="callout">
      <code>PERM_PROBLEM_BANK</code>: Author/edit DSA challenges, test cases, and editorial approaches.
    </div>
    <div class="callout">
      <code>PERM_CORE_PREP</code>: Import ECE/EEE/ME/Civil banks, author tests, toggle go-live switches.
    </div>
    <div class="callout">
      <code>PERM_SOFT_SKILLS</code>: Create/edit 25-question test papers across Sets 1 to 70.
    </div>
    <div class="callout">
      <code>PERM_PROJECT_LAB</code>: Author SOW blueprints, configure Docker workspace images and rubrics.
    </div>
    <div class="callout">
      <code>PERM_HACKATHONS</code>: Create and judge platform-wide or college hackathons in <code>/arena</code>.
    </div>
    <div class="callout">
      <code>PERM_VAULT</code>: Inspect student proof-of-work and manage Mellow Vault enterprise sync.
    </div>
  </div>

  <h2>3. Critical Middleware Stack in <code>routes/api.php</code></h2>
  <table>
    <thead>
      <tr>
        <th style="width: 26%;">Middleware Name</th>
        <th style="width: 32%;">Class File</th>
        <th style="width: 42%;">Security Enforcement Logic</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>account.active</code></td>
        <td><code>EnsureAccountIsActive</code></td>
        <td>Checks <code>users.is_active</code>. If blocked by a coordinator, TPO, or admin, terminates request with 403 and the exact blocking reason.</td>
      </tr>
      <tr>
        <td><code>not.impersonating</code></td>
        <td><code>RejectWritesWhileImpersonating</code></td>
        <td>If token has <code>IMPERSONATION_ABILITY</code>, intercepts all mutating HTTP verbs (POST, PUT, DELETE, PATCH) and aborts with 403.</td>
      </tr>
      <tr>
        <td><code>auth.vault</code></td>
        <td><code>AuthenticateVaultIntegration</code></td>
        <td>Validates shared secret bearer token on <code>/api/vault/v1/*</code> routes for Mellow Vault synchronization.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Multi-Tenant Security &amp; RBAC Architecture</span>
    <span>Page 2 of 16</span>
  </div>
</div>

<!-- ================= PAGE 3: PLANS, PRICING & ENTITLEMENTS ENGINE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.1</span>
      <span>Plans, Pricing &amp; Entitlements Engine Architecture</span>
    </div>
    <div class="header-meta">Billing Subsystem (app/Models/Plan.php &amp; SubscriptionService.php)</div>
  </div>

  <h2>1. Database Schema: <code>plans</code> Table</h2>
  <p>The <code>plans</code> table defines commercial models, audiences, access flags, and numeric rate-limiting columns enforced throughout the API:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Column Name</th>
        <th style="width: 15%;">Data Type</th>
        <th style="width: 15%;">Default Value</th>
        <th style="width: 45%;">Functional Role &amp; Code Enforcement</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>code</code></td>
        <td><code>VARCHAR(50)</code></td>
        <td>— (Unique)</td>
        <td>Unique string identifier: <code>coder</code>, <code>expert</code>, <code>grandmaster</code>, <code>standard</code>, <code>pro-campus</code>.</td>
      </tr>
      <tr>
        <td><code>audience</code></td>
        <td><code>ENUM</code></td>
        <td><code>individual</code></td>
        <td><code>individual</code> (students), <code>institution</code> (colleges), <code>company</code> (recruiters).</td>
      </tr>
      <tr>
        <td><code>kind</code></td>
        <td><code>ENUM</code></td>
        <td><code>base</code></td>
        <td><code>base</code> (primary subscription; 1 per user) vs <code>addon</code> (stackable module).</td>
      </tr>
      <tr>
        <td><code>list_price</code></td>
        <td><code>INT NULL</code></td>
        <td><code>0</code></td>
        <td>Price in INR before discount. <code>0</code> = free plan; <code>NULL</code> = contact-only.</td>
      </tr>
      <tr>
        <td><code>discount_percent</code></td>
        <td><code>INT</code></td>
        <td><code>0</code></td>
        <td>Discount percentage (max 90%). <code>salePrice() = list_price - discount</code>.</td>
      </tr>
      <tr>
        <td><code>annual_price</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Annual contract price for institutional tiers (e.g. ₹1,49,000 for Standard).</td>
      </tr>
      <tr>
        <td><code>duration_days</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Subscription period: 365 (Expert, College), 1095 (Grandmaster), <code>NULL</code> (Free Coder).</td>
      </tr>
      <tr>
        <td><code>contact_only</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>FALSE</code></td>
        <td>If true, self-serve purchase is blocked; sold offline by team (Grandmaster).</td>
      </tr>
      <tr>
        <td><code>max_practice_problems_per_day</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Daily coding solve quota. <code>1</code> for Coder; <code>NULL</code> = unlimited.</td>
      </tr>
      <tr>
        <td><code>max_mock_interviews_per_day</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Daily AI interview quota. <code>10</code> for Expert; <code>NULL</code> = unlimited.</td>
      </tr>
      <tr>
        <td><code>feature_trial_uses</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Lifetime free tries for AI features on free plan (default <code>1</code> for Coder).</td>
      </tr>
      <tr>
        <td><code>project_lab_access</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>FALSE</code></td>
        <td>Unlocks OpenVSCode container workspaces (Expert, Grandmaster, College).</td>
      </tr>
      <tr>
        <td><code>max_workspace_hours_per_month</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Cap on active container runtime hours per calendar month (default: 80 hrs).</td>
      </tr>
      <tr>
        <td><code>max_active_projects</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Max concurrent active projects (default: 3 projects).</td>
      </tr>
      <tr>
        <td><code>vault_access</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>FALSE</code></td>
        <td>Allows profile listing in Mellow Vault when ARS &ge; 60.</td>
      </tr>
      <tr>
        <td><code>hackathon_access</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>TRUE</code></td>
        <td>Allows entering and submitting projects in Hack Arena (<code>/arena</code>).</td>
      </tr>
      <tr>
        <td><code>drive_access</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>FALSE</code></td>
        <td>Allows viewing and registering for campus placement drives.</td>
      </tr>
      <tr>
        <td><code>max_students</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Seat limit for institution plans (Standard: 500, Pro Campus: 2000, Enterprise: NULL).</td>
      </tr>
      <tr>
        <td><code>max_core_practice_per_day</code></td>
        <td><code>INT NULL</code></td>
        <td><code>NULL</code></td>
        <td>Daily MCQ practice quota for non-CS engineering branches (Coder: 10, Expert: NULL).</td>
      </tr>
      <tr>
        <td><code>core_tests_access</code></td>
        <td><code>BOOLEAN</code></td>
        <td><code>FALSE</code></td>
        <td>Allows taking timed, proctored department engineering mock exams.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Entitlement Resolution Flow: <code>User::effectiveEntitlements()</code></h2>
  <div class="callout green">
    <div class="callout-title">Precedence Logic: Institutional vs Individual Plans</div>
    <div class="callout-body">
      When resolving a student's active limits:
      <br>1. If student belongs to a subscribed College (<code>effectiveSubscription()</code> resolves to college), the <strong>College Plan governs</strong> (unlimited practice, interviews, drives, core prep).
      <br>2. If college has no active subscription, the student's <strong>Personal Paid Plan (Expert/Grandmaster)</strong> applies.
      <br>3. If no paid plan is active or if end date has passed, the system falls back to the default <strong>Free Coder</strong> plan.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Plans, Pricing &amp; Entitlements Engine Architecture</span>
    <span>Page 3 of 16</span>
  </div>
</div>

<!-- ================= PAGE 4: DETAILED PLAN BREAKDOWN - INDIVIDUAL TIERS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.2</span>
      <span>Individual Subscription Tiers (Coder vs Expert vs Grandmaster)</span>
    </div>
    <div class="header-meta">Individual Plans (Database Seed: PlanSeeder.php)</div>
  </div>

  <h2>1. Individual Plan Comparison Matrix</h2>
  <p>The individual catalogue governs self-registered students and students purchasing personal upgrades outside their college:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Feature Dimension</th>
        <th style="width: 25%;">Coder (Free Plan)</th>
        <th style="width: 25%;">Expert (Annual Paid)</th>
        <th style="width: 25%;">Grandmaster (Mellow Academy)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Commercial Term</strong></td>
        <td>Free on signup; never expires.</td>
        <td>1 Year (365 days); self-serve checkout.</td>
        <td>3 Years (1,095 days); sold offline by team.</td>
      </tr>
      <tr>
        <td><strong>List &amp; Sale Price (INR)</strong></td>
        <td>₹0 / lifetime</td>
        <td>₹4,999 list / ₹2,999 sale (configurable)</td>
        <td>Arranged with admissions team (no online price)</td>
      </tr>
      <tr>
        <td><strong>Coding Practice Quota</strong></td>
        <td><strong>1 problem / day</strong> (throttle: <code>practice.daily</code>)</td>
        <td><strong>Unlimited</strong> (19 language runtimes)</td>
        <td><strong>Unlimited</strong> (19 language runtimes)</td>
      </tr>
      <tr>
        <td><strong>AI Mock Interviews</strong></td>
        <td><strong>1 lifetime free try</strong> (trial flag)</td>
        <td><strong>10 interviews / day</strong></td>
        <td><strong>10 interviews / day</strong></td>
      </tr>
      <tr>
        <td><strong>Learning Centre AI Features</strong></td>
        <td>1 lifetime try of Speaking, AI passage, AI quiz</td>
        <td><strong>Unlimited</strong> daily practice</td>
        <td><strong>Unlimited</strong> daily practice</td>
      </tr>
      <tr>
        <td><strong>Project Lab (Browser VS Code)</strong></td>
        <td><span class="badge badge-rose">Locked</span> (upgrade prompt)</td>
        <td><strong>80 hrs/mo</strong> &middot; 3 active projects</td>
        <td><strong>80 hrs/mo</strong> &middot; 3 active projects</td>
      </tr>
      <tr>
        <td><strong>The Mellow Vault Access</strong></td>
        <td><span class="badge badge-rose">Locked</span> (unlocks at ARS 60)</td>
        <td><strong>Yes</strong> (unlocked when ARS &ge; 60)</td>
        <td><strong>Yes</strong> (unlocked when ARS &ge; 60)</td>
      </tr>
      <tr>
        <td><strong>Hack Arena Access</strong></td>
        <td><span class="badge badge-rose">No</span></td>
        <td><strong>Yes</strong> (participate &amp; win prizes)</td>
        <td><strong>Yes</strong> (participate &amp; win prizes)</td>
      </tr>
      <tr>
        <td><strong>Campus Placement Drives</strong></td>
        <td><span class="badge badge-rose">No</span></td>
        <td><strong>Yes</strong> (apply to corporate drives)</td>
        <td><strong>Yes</strong> (apply to corporate drives)</td>
      </tr>
      <tr>
        <td><strong>Core Engineering Prep</strong></td>
        <td>10 MCQs/day &middot; No timed tests</td>
        <td><strong>Unlimited</strong> &middot; Timed proctored mock tests</td>
        <td><strong>Unlimited</strong> &middot; Timed proctored mock tests</td>
      </tr>
      <tr>
        <td><strong>Development Curriculum</strong></td>
        <td>None</td>
        <td>None</td>
        <td><strong>MERN, Laravel, Full Stack, Mobile</strong></td>
      </tr>
      <tr>
        <td><strong>Placement Guarantee</strong></td>
        <td>None</td>
        <td>None</td>
        <td><strong>Assured Placement Commitment</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>2. Code Safeguards for Individual Plans</h2>
  <div class="grid-2">
    <div class="callout rose">
      <div class="callout-title">The Grandmaster Contact-Only Lock</div>
      <div class="callout-body">
        <code>plans.contact_only = true</code>: <code>PurchaseQuoteService</code> checks this before reading any price and rejects self-serve checkout with <code>422 Unprocessable Entity</code>. 
        Grandmaster cannot be purchased online even if an attacker manipulates the payload. It must be granted manually by Superadmin.
      </div>
    </div>
    <div class="callout indigo">
      <div class="callout-title">The Retired Project Lab Add-On (<code>project-lab</code>)</div>
      <div class="callout-body">
        Project Lab was originally sold as an add-on (₹499/mo). It is now bundled into Expert and Grandmaster. 
        The row remains in <code>plans</code> with <code>is_active = false</code> to honor legacy active terms until expiration, while preventing new add-on sales.
      </div>
    </div>
  </div>

  <h2>3. Rate-Limiting Implementation Details</h2>
  <pre><code>// Example: Checking daily coding limit in ProblemController.php
$entitlements = $user->effectiveEntitlements();
if ($entitlements['max_practice_problems_per_day'] !== null) {
    $todayCount = Submission::where('user_id', $user->id)
        ->where('created_at', '>=', now()->startOfDay())
        ->where('status', 'accepted')
        ->count();
    if ($todayCount >= $entitlements['max_practice_problems_per_day']) {
        return response()->json(['error' => 'daily_limit_reached', 'upgrade_url' => '/dashboard/billing'], 429);
    }
}</code></pre>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Individual Subscription Tiers &amp; Limits</span>
    <span>Page 4 of 16</span>
  </div>
</div>

<!-- ================= PAGE 5: DETAILED PLAN BREAKDOWN - COLLEGE & INSTITUTION ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.3</span>
      <span>Institutional Plans: Standard vs Pro Campus vs Academic Enterprise</span>
    </div>
    <div class="header-meta">College Plans (PlanSeeder.php &amp; SubscriptionService.php)</div>
  </div>

  <h2>1. Institutional Plan Comparison Matrix</h2>
  <p>Institutional plans (<code>audience = 'institution'</code>) are sold by Mellow Ops to engineering colleges and universities. All covered students receive unlimited practice without personal subscriptions:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 24%;">Feature Dimension</th>
        <th style="width: 25%;">Standard College Plan</th>
        <th style="width: 25%;">Pro Campus Plan</th>
        <th style="width: 26%;">Academic Enterprise Plan</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Target Institution Size</strong></td>
        <td>Single department or mid-sized college</td>
        <td>Large engineering college (multiple branches)</td>
        <td>Multi-campus university or academic group</td>
      </tr>
      <tr>
        <td><strong>Student Seat Capacity</strong></td>
        <td><strong>500 Students</strong> (<code>max_students = 500</code>)</td>
        <td><strong>2,000 Students</strong> (<code>max_students = 2000</code>)</td>
        <td><strong>Unlimited Seats</strong> (<code>max_students = NULL</code>)</td>
      </tr>
      <tr>
        <td><strong>Annual Contract Price</strong></td>
        <td>₹1,49,000 / year (<code>annual_price</code>)</td>
        <td>₹4,49,000 / year (<code>annual_price</code>)</td>
        <td>Custom Enterprise SLA (tailored pricing)</td>
      </tr>
      <tr>
        <td><strong>Student Practice &amp; Mocks</strong></td>
        <td><strong>Unlimited</strong> practice &amp; mock tests</td>
        <td><strong>Unlimited</strong> practice &amp; mock tests</td>
        <td><strong>Unlimited</strong> practice &amp; mock tests</td>
      </tr>
      <tr>
        <td><strong>Campus Drives Portal</strong></td>
        <td><strong>Yes</strong> &middot; Map catalog drives &amp; host private</td>
        <td><strong>Yes</strong> &middot; Map catalog drives &amp; host private</td>
        <td><strong>Yes</strong> &middot; Multi-campus pooled drives</td>
      </tr>
      <tr>
        <td><strong>Proctored Mock Contests</strong></td>
        <td>Webcam, fullscreen lock, 3-strike rule</td>
        <td>Webcam, fullscreen lock, 3-strike rule</td>
        <td><strong>AST-based anti-cheat &amp; proctoring</strong></td>
      </tr>
      <tr>
        <td><strong>Section Coordinators</strong></td>
        <td>Up to 10 coordinators</td>
        <td>Up to 40 coordinators</td>
        <td><strong>Unlimited Coordinators &amp; HODs</strong></td>
      </tr>
      <tr>
        <td><strong>Core Prep (ECE, EEE, ME, Civil)</strong></td>
        <td>Basic topic practice</td>
        <td>Full Core Prep + Timed Tests</td>
        <td><strong>Full Core Prep + Custom Subject Banks</strong></td>
      </tr>
      <tr>
        <td><strong>The Vault &amp; Hack Arena</strong></td>
        <td>Included for all covered students</td>
        <td>Included for all covered students</td>
        <td>Included for all covered students</td>
      </tr>
      <tr>
        <td><strong>Placement Intelligence</strong></td>
        <td>7 standard Excel &amp; PDF reports</td>
        <td>7 reports + branch-wise comparative heatmaps</td>
        <td><strong>7 reports + Custom ERP/LMS integrations</strong></td>
      </tr>
      <tr>
        <td><strong>Support &amp; Account Management</strong></td>
        <td>Standard Email &amp; Ticket Support</td>
        <td>Priority Support + Dedicated Onboarding</td>
        <td><strong>Dedicated Success Manager &amp; Custom SLA</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>2. How Seat Limits (<code>max_students</code>) Are Enforced in Code</h2>
  <p>The student onboarding controller validates seat caps during bulk CSV imports and individual self-registrations:</p>

  <pre><code>// In TpoStudentController.php & BulkImportService.php
$college = $tpo->college;
$plan = $college->activeSubscription?->plan;

if ($plan && $plan->max_students !== null) {
    $currentActiveCount = User::where('college_id', $college->id)
        ->where('role', User::ROLE_USER)
        ->count();
    
    if (($currentActiveCount + count($importRows)) > $plan->max_students) {
        return response()->json([
            'error' => 'seat_limit_exceeded',
            'message' => "Your plan ({$plan->name}) caps enrolled students at {$plan->max_students}. Current: {$currentActiveCount}."
        ], 422);
    }
}</code></pre>

  <h2>3. College Add-on Modules &amp; Future Entitlements</h2>
  <div class="callout indigo">
    <div class="callout-title">Extending Project Lab to College Plans</div>
    <div class="callout-body">
      By default, <code>plans.project_lab_access = false</code> on institutional rows. 
      To grant an entire college Project Lab access (e.g. for a dedicated Full-Stack Capstone semester), the Superadmin simply checks 
      <code>project_lab_access = true</code> on that college's plan row in Superadmin Master Control. All covered students receive container workspaces instantly.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Institutional Plans &amp; Seat Governance</span>
    <span>Page 5 of 16</span>
  </div>
</div>

<!-- ================= PAGE 6: CORPORATE RECRUITER PLANS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 2.4</span>
      <span>Corporate Recruiter Plans: Hiring Starter vs Hiring Growth</span>
    </div>
    <div class="header-meta">Recruiter Subsystem (PlanSeeder.php &amp; CompanyController.php)</div>
  </div>

  <h2>1. Recruiter Subscription Models (<code>audience = 'company'</code>)</h2>
  <p>Enterprise hiring partners subscribe to dedicated corporate tiers to recruit pre-assessed university engineering talent:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Recruitment Capability</th>
        <th style="width: 35%;">Hiring Starter (₹99,000 / year)</th>
        <th style="width: 40%;">Hiring Growth (₹2,99,000 / year)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Active Job Openings</strong></td>
        <td>Up to <strong>3 Concurrent Openings</strong></td>
        <td><strong>Unlimited Active Openings</strong></td>
      </tr>
      <tr>
        <td><strong>Campus Drive Proposals</strong></td>
        <td>Up to 10 Partner Colleges / year</td>
        <td><strong>Unlimited Partner Colleges</strong></td>
      </tr>
      <tr>
        <td><strong>Pre-Assessed Talent Pool Search</strong></td>
        <td>Basic search (Branch, College Tier, ARS range)</td>
        <td><strong>Deep search</strong> (Code quality, Project Lab badges, Git repos)</td>
      </tr>
      <tr>
        <td><strong>Direct Candidate Outreach</strong></td>
        <td>50 Direct Interview Invites / month</td>
        <td><strong>300 Direct Interview Invites / month</strong></td>
      </tr>
      <tr>
        <td><strong>Custom Coding Assessments</strong></td>
        <td>Standard shared problem bank</td>
        <td><strong>Proprietary problem statements + private test suites</strong></td>
      </tr>
      <tr>
        <td><strong>Asynchronous AI Interview Review</strong></td>
        <td>Transcripts only</td>
        <td><strong>Full voice audio playback + synchronized transcript + rubric overrides</strong></td>
      </tr>
      <tr>
        <td><strong>Anti-Cheat &amp; Plagiarism Analysis</strong></td>
        <td>Webcam snapshots &amp; tab blur counts</td>
        <td><strong>Full keystroke replay timeline + AST cross-candidate similarity</strong></td>
      </tr>
      <tr>
        <td><strong>Tamper-Proof Vault Verification</strong></td>
        <td>Summary report</td>
        <td><strong>Full cryptographic verification &amp; source code inspection</strong></td>
      </tr>
      <tr>
        <td><strong>ATS Integration Export</strong></td>
        <td>Manual CSV export</td>
        <td><strong>Automated webhook export (Greenhouse, Workday, Lever)</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>2. Company Tenant Isolation Architecture</h2>
  <div class="callout rose">
    <div class="callout-title">Strict Multi-Tenant Segregation in <code>CompanyController.php</code></div>
    <div class="callout-body">
      Every corporate recruiter belongs to a <code>Company</code> tenant model. The base query scope automatically binds queries to <code>company_id</code>:
      <pre><code>// Enforced in CompanyBaseController.php
public function scopeOwn(Builder $query) {
    return $query->where('company_id', auth()->user()->company_id);
}</code></pre>
      If a recruiter attempts to access an assessment or drive ID belonging to a competing firm, the controller aborts with <code>404 Not Found</code>.
    </div>
  </div>

  <h2>3. Proposed Extensions for Corporate Plans</h2>
  <div class="grid-2">
    <div class="callout">
      <div class="callout-title">Extension Point 1: Per-Seat Recruiter Licenses</div>
      <div class="callout-body">
        Currently, corporate accounts have one primary login. A recommended enhancement is adding a <code>company_users</code> table with roles: <em>Hiring Admin</em>, <em>Technical Interviewer</em>, and <em>Sourcer</em>.
      </div>
    </div>
    <div class="callout green">
      <div class="callout-title">Extension Point 2: Custom Branded Assessment Portals</div>
      <div class="callout-body">
        Adding a <code>whitelabel_domain</code> and <code>brand_theme</code> column on <code>companies</code> to allow enterprise recruiters to serve tests under <code>careers.company.com</code>.
      </div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Corporate Recruiter Plans &amp; Multi-Tenancy</span>
    <span>Page 6 of 16</span>
  </div>
</div>

<!-- ================= PAGE 7: DATABASE SCHEMA & ENTITY ARCHITECTURE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 3</span>
      <span>Database Schema &amp; Entity-Relationship Blueprint</span>
    </div>
    <div class="header-meta">Data Architecture (backend/database/migrations/)</div>
  </div>

  <h2>1. Core Entity Relationship Topology</h2>
  <p>The database schema is organized into modular bounded contexts: Identity &amp; Auth, Assessment Engine, Learning Centre, and Container Workspaces.</p>

  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Table Name</th>
        <th style="width: 32%;">Primary Key &amp; Foreign Keys</th>
        <th style="width: 48%;">Core Schema Columns &amp; Indexes</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>users</code></td>
        <td><code>id (PK)</code>, <code>college_id (FK)</code>, <code>company_id (FK)</code>, <code>discipline_id (FK)</code></td>
        <td><code>role</code>, <code>name</code>, <code>email</code>, <code>password</code>, <code>roll_number</code>, <code>branch</code>, <code>section</code>, <code>cgpa</code>, <code>backlogs</code>, <code>coordinator_scope (JSON)</code>, <code>track_focus</code>, <code>is_active</code>, <code>permissions (JSON)</code>.</td>
      </tr>
      <tr>
        <td><code>colleges</code></td>
        <td><code>id (PK)</code></td>
        <td><code>name</code>, <code>slug</code>, <code>code</code>, <code>tier</code>, <code>city</code>, <code>state</code>, <code>logo_url</code>, <code>is_active</code>, <code>max_students_override</code>.</td>
      </tr>
      <tr>
        <td><code>plans</code></td>
        <td><code>id (PK)</code>, <code>pricing_updated_by (FK)</code></td>
        <td><code>code</code>, <code>name</code>, <code>audience</code>, <code>kind</code>, <code>list_price</code>, <code>discount_percent</code>, <code>annual_price</code>, <code>duration_days</code>, <code>max_practice_problems_per_day</code>, <code>max_mock_interviews_per_day</code>, <code>project_lab_access</code>.</td>
      </tr>
      <tr>
        <td><code>subscriptions</code></td>
        <td><code>id (PK)</code>, <code>user_id (FK)</code>, <code>college_id (FK)</code>, <code>plan_id (FK)</code></td>
        <td><code>status (active/cancelled/expired)</code>, <code>starts_at</code>, <code>ends_at</code>, <code>cancelled_at</code>, <code>price_paid</code>, <code>meta (JSON)</code> (stores payment ref, source: admin_grant vs gateway).</td>
      </tr>
      <tr>
        <td><code>problems</code></td>
        <td><code>id (PK)</code></td>
        <td><code>title</code>, <code>slug</code>, <code>difficulty (easy/medium/hard)</code>, <code>description</code>, <code>input_format</code>, <code>output_format</code>, <code>constraints</code>, <code>time_limit_ms</code>, <code>memory_limit_mb</code>, <code>tags (JSON)</code>.</td>
      </tr>
      <tr>
        <td><code>submissions</code></td>
        <td><code>id (PK)</code>, <code>user_id (FK)</code>, <code>problem_id (FK)</code>, <code>contest_id (FK)</code></td>
        <td><code>language</code>, <code>code</code>, <code>status (AC/WA/TLE/MLE/CE)</code>, <code>execution_time_ms</code>, <code>memory_consumed_kb</code>, <code>test_cases_passed</code>, <code>total_test_cases</code>.</td>
      </tr>
      <tr>
        <td><code>contests</code></td>
        <td><code>id (PK)</code>, <code>college_id (FK)</code>, <code>company_id (FK)</code></td>
        <td><code>title</code>, <code>slug</code>, <code>type (daily/rated/mock/hiring)</code>, <code>starts_at</code>, <code>ends_at</code>, <code>duration_minutes</code>, <code>is_proctored</code>, <code>audience (JSON)</code>.</td>
      </tr>
      <tr>
        <td><code>workspaces</code></td>
        <td><code>id (PK)</code>, <code>user_id (FK)</code>, <code>project_id (FK)</code></td>
        <td><code>container_id</code>, <code>host_server</code>, <code>port</code>, <code>status (running/stopped/reaped)</code>, <code>last_heartbeat_at</code>, <code>total_seconds_used</code>, <code>volume_name</code>.</td>
      </tr>
      <tr>
        <td><code>core_questions</code></td>
        <td><code>id (PK)</code>, <code>discipline_id (FK)</code>, <code>branch_id (FK)</code></td>
        <td><code>question_text</code>, <code>options (JSON)</code>, <code>correct_option</code>, <code>explanation</code>, <code>topic_slug</code>, <code>difficulty</code>, <code>is_published</code>.</td>
      </tr>
      <tr>
        <td><code>audit_logs</code></td>
        <td><code>id (PK)</code>, <code>actor_id (FK)</code></td>
        <td><code>action</code>, <code>target_type</code>, <code>target_id</code>, <code>diff (JSON)</code>, <code>reason</code>, <code>ip_address</code>, <code>user_agent</code>, <code>created_at</code>.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Critical Database Indexing Strategy</h2>
  <div class="grid-3">
    <div class="callout">
      <code>submissions(user_id, status, created_at)</code>: Optimized for ARS consistency and practice breadth aggregation.
    </div>
    <div class="callout">
      <code>users(college_id, section, branch)</code>: Accelerates TPO cohort queries and Section Coordinator scoping.
    </div>
    <div class="callout">
      <code>workspaces(user_id, status)</code>: Used by container reaper daemon to terminate idle containers.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Database Schema &amp; Entity Architecture</span>
    <span>Page 7 of 16</span>
  </div>
</div>

<!-- ================= PAGE 8: CODE EXECUTION & JUDGE ENGINE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 4</span>
      <span>Polyglot Code Execution &amp; Judge Architecture</span>
    </div>
    <div class="header-meta">Execution Subsystem (JudgeService.php &amp; infra/judge/)</div>
  </div>

  <h2>1. Judge Pipeline &amp; Container Isolation Model</h2>
  <p>
    The AptRun Code Judge executes student solutions across 19 runtimes using a cluster of Piston execution engines. 
    Execution is stateless, sandboxed, and enforced via Linux control groups (cgroups).
  </p>

  <div class="grid-4">
    <div class="stat-card">
      <div class="stat-val">256 MB</div>
      <div class="stat-label">Memory Cap</div>
      <div class="stat-sub">Strict cgroup memory quota prevents OOM host crashes</div>
    </div>
    <div class="stat-card emerald">
      <div class="stat-val">1.5 Cores</div>
      <div class="stat-label">CPU Quota</div>
      <div class="stat-sub">Throttles infinite CPU spinloops and forkbombs</div>
    </div>
    <div class="stat-card indigo">
      <div class="stat-val">2.0 Seconds</div>
      <div class="stat-label">Wall-Clock Timeout</div>
      <div class="stat-sub">Automated SIGKILL terminates execution past deadline</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">No Network</div>
      <div class="stat-label">Air-Gapped Sandbox</div>
      <div class="stat-sub"><code>--network none</code> blocks outbound socket requests</div>
    </div>
  </div>

  <h2>2. Supported Programming Language Matrix</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 18%;">Language</th>
        <th style="width: 18%;">Piston Runtime</th>
        <th style="width: 20%;">Compiler / VM</th>
        <th style="width: 44%;">Standard Execution Flags &amp; Compilation Parameters</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>C</strong></td>
        <td><code>c (10.2.0)</code></td>
        <td>GCC 10.2</td>
        <td><code>gcc -O3 -std=c11 solution.c -lm</code></td>
      </tr>
      <tr>
        <td><strong>C++</strong></td>
        <td><code>cpp (10.2.0)</code></td>
        <td>G++ 10.2</td>
        <td><code>g++ -O3 -std=c++17 solution.cpp -lm</code></td>
      </tr>
      <tr>
        <td><strong>Java</strong></td>
        <td><code>java (15.0.2)</code></td>
        <td>OpenJDK 15</td>
        <td><code>javac Solution.java &amp;&amp; java -Xmx256M -Xss64M Solution</code></td>
      </tr>
      <tr>
        <td><strong>Python 3</strong></td>
        <td><code>python (3.10.0)</code></td>
        <td>CPython 3.10</td>
        <td><code>python3 -u solution.py</code> (unbuffered stdout)</td>
      </tr>
      <tr>
        <td><strong>Go</strong></td>
        <td><code>go (1.16.2)</code></td>
        <td>Go Compiler</td>
        <td><code>go build -o solution solution.go &amp;&amp; ./solution</code></td>
      </tr>
      <tr>
        <td><strong>Rust</strong></td>
        <td><code>rust (1.50.0)</code></td>
        <td>rustc</td>
        <td><code>rustc -O solution.rs &amp;&amp; ./solution</code></td>
      </tr>
      <tr>
        <td><strong>TypeScript</strong></td>
        <td><code>typescript (4.2.3)</code></td>
        <td>Node.js 16 + tsc</td>
        <td><code>esbuild solution.ts --outfile=out.js &amp;&amp; node out.js</code></td>
      </tr>
      <tr>
        <td><strong>C#</strong></td>
        <td><code>csharp.net (5.0)</code></td>
        <td>.NET Core 5.0</td>
        <td><code>dotnet run --configuration Release</code></td>
      </tr>
    </tbody>
  </table>

  <h2>3. How to Add a New Programming Language (Senior Dev SOP)</h2>
  <div class="callout green">
    <div class="callout-title">3-Step Extension Procedure</div>
    <div class="callout-body">
      To add a new language (e.g. <strong>Elixir</strong> or <strong>Zig</strong>):
      <br>1. <strong>Install Runtime:</strong> Run <code>piston-cli install zig</code> on Piston runner host (`infra/judge/supervisor`).
      <br>2. <strong>Register Alias in <code>JudgeService.php</code>:</strong> Add <code>'zig' => ['runtime' => 'zig', 'version' => '0.11.0']</code> in <code>SUPPORTED_LANGUAGES</code>.
      <br>3. <strong>Frontend Monaco Binding:</strong> In <code>frontend/src/components/editor/MonacoEditor.tsx</code>, add the language mode and default boilerplate starter code.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Polyglot Code Execution &amp; Judge Architecture</span>
    <span>Page 8 of 16</span>
  </div>
</div>

<!-- ================= PAGE 9: PROJECT LAB CONTAINER ORCHESTRATION ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 5</span>
      <span>Project Lab: Browser Cloud VS Code Architecture</span>
    </div>
    <div class="header-meta">Workspace Subsystem (WorkspaceManager.php &amp; infra/workspaces/)</div>
  </div>

  <h2>1. Container Workspace Topology</h2>
  <p>
    Project Lab provides full-stack containerized workspaces. The Laravel API orchestrates Docker containers on dedicated hosts via SSH, 
    while Caddy handles reverse proxy routing with wildcard TLS certificates.
  </p>

  <div class="callout indigo">
    <div class="callout-title">Request Routing Architecture</div>
    <div class="callout-body">
      <strong>Student Browser:</strong>
      <br>&bull; Iframe 1 (VS Code IDE): <code>https://ws-&lt;id&gt;.ws.aptrun.com</code> &rarr; Caddy Gateway &rarr; Docker container port <code>13370</code> (OpenVSCode Server).
      <br>&bull; Iframe 2 (Live App Preview): <code>https://p&lt;port&gt;--ws-&lt;id&gt;.ws.aptrun.com</code> &rarr; Caddy Gateway &rarr; Container user port (e.g. <code>3000</code> or <code>8000</code>).
    </div>
  </div>

  <h2>2. Workspace Lifecycle State Machine</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Lifecycle State</th>
        <th style="width: 35%;">Triggering Event / API</th>
        <th style="width: 45%;">Host System Action &amp; Resource State</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>CREATING</strong></td>
        <td><code>POST /api/workspaces</code></td>
        <td>Allocates port from pool; initializes Docker volume <code>wsvol-&lt;id&gt;</code>; unzips project starter repo.</td>
      </tr>
      <tr>
        <td><strong>RUNNING</strong></td>
        <td>Container successfully started</td>
        <td>Docker container bound to host port; Caddy dynamic wildcard routing active; heartbeat daemon active.</td>
      </tr>
      <tr>
        <td><strong>STOPPED</strong></td>
        <td>User clicks "Stop" or browser closed</td>
        <td><code>docker stop ws-&lt;id&gt;</code> executed; port returned to pool; volume remains persisted on disk.</td>
      </tr>
      <tr>
        <td><strong>REAPED</strong></td>
        <td>Heartbeat idle &gt; 15 minutes</td>
        <td>Scheduled cron (<code>WorkspaceReaper</code>) stops container to preserve monthly student hours.</td>
      </tr>
      <tr>
        <td><strong>SNAPSHOT_SUBMIT</strong></td>
        <td>User clicks "Submit for Review"</td>
        <td>Executes <code>tar -czf snapshot.tar.gz /home/workspace</code> inside container; uploads to S3 for review.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. The Container Dockerfile Blueprint (<code>infra/workspaces/Dockerfile</code>)</h2>
  <pre><code>FROM gitpod/openvscode-server:latest
USER root
# Install Node.js LTS, Python, GCC, Git, and Database CLI tools
RUN apt-get update && apt-get install -y git curl python3 python3-pip sqlite3 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs
USER openvscode-server
ENV PORT=13370
EXPOSE 13370 3000 8000 8080
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]</code></pre>

  <h2>4. SOW Watermarking Service (<code>SowPdfService.php</code>)</h2>
  <p>
    When a student downloads the Statement of Work (SOW PDF), <code>SowPdfService</code> generates a dynamic PDF via <code>dompdf</code>. 
    The student's name, email, roll number, and cryptographic verification hash are stamped diagonally across each page as an indelible watermark to prevent copyright infringement.
  </p>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Project Lab: Cloud VS Code Architecture</span>
    <span>Page 9 of 16</span>
  </div>
</div>

<!-- ================= PAGE 10: ALGORITHMIC READINESS SCORE (ARS v4) ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 6</span>
      <span>Placement Readiness Engine (ARS v4) Mathematical Spec</span>
    </div>
    <div class="header-meta">Scoring Subsystem (app/Services/ReadinessScoreService.php)</div>
  </div>

  <h2>1. Mathematical Formulation &amp; Weights</h2>
  <p>
    The Placement Readiness Score (ARS v4) is an objective, deterministic 0–100 rating. 
    It evaluates demonstrated engineering capability over a rolling 180-day recent-form window, scaled by an attempt depth factor to eliminate lucky single attempts.
  </p>

  <div class="callout indigo">
    <div class="callout-title">The Composite ARS Mathematical Formula</div>
    <div class="callout-body">
      $$\text{ARS} = \sum_{k \in \text{Components} W_k \cdot \text{Score}_k \cdot \text{DepthScaling}(N_k)$$
      Where:
      <br>&bull; $W_k$: Weight assigned to component $k$ ($\sum W_k = 100$).
      <br>&bull; $\text{Score}_k$: Normalized average score ($0.0 \text{ to } 1.0$) across up to the newest 5 completed attempts within 180 days.
      <br>&bull; $\text{DepthScaling}(N_k)$: Scaling factor $= \min\left(1.0, \frac{N_k}{3}\right)$ (Soft Skills uses $\frac{N_k}{2}$). A single attempt receives only partial credit.
    </div>
  </div>

  <h2>2. Multi-Profile Weighting Matrix (<code>config/readiness.php</code>)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Component ($k$)</th>
        <th style="width: 15%;">Software ($W_k$)</th>
        <th style="width: 15%;">Balanced ($W_k$)</th>
        <th style="width: 15%;">Core ($W_k$)</th>
        <th style="width: 30%;">Underlying Data Telemetry</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>AI Mock Interviews</strong></td>
        <td>20</td>
        <td>20</td>
        <td>20</td>
        <td>Average of last 5 scored AI interviews.</td>
      </tr>
      <tr>
        <td><strong>Core Technical Subject</strong></td>
        <td>—</td>
        <td>20</td>
        <td>30</td>
        <td>$0.60 \times \text{Mock Tests} + 0.40 \times \text{Topic Mastery}$.</td>
      </tr>
      <tr>
        <td><strong>Coding Practice Depth</strong></td>
        <td>15</td>
        <td>10</td>
        <td>—</td>
        <td>Breadth across Easy (20), Med (40), Hard (40) + topics.</td>
      </tr>
      <tr>
        <td><strong>Learning Centre Lab</strong></td>
        <td>15</td>
        <td>10</td>
        <td>15</td>
        <td>Speaking (40%) + Listening (30%) + Vocab SRS (30%).</td>
      </tr>
      <tr>
        <td><strong>Contest Elo Rating</strong></td>
        <td>15</td>
        <td>5</td>
        <td>—</td>
        <td>Share of points scored over last 5 rated contests.</td>
      </tr>
      <tr>
        <td><strong>Practice Consistency</strong></td>
        <td>15</td>
        <td>15</td>
        <td>15</td>
        <td>Active practice days in last 28 days (12 days = max score).</td>
      </tr>
      <tr>
        <td><strong>Soft Skills Mastery</strong></td>
        <td>10</td>
        <td>10</td>
        <td>10</td>
        <td>Average score across last 5 completed standardized sets.</td>
      </tr>
      <tr>
        <td><strong>Events &amp; Projects</strong></td>
        <td>10</td>
        <td>10</td>
        <td>10</td>
        <td>Project Lab submissions, hackathons, and mock exams.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. The 30-Day Go-Live Grace Period Algorithm</h2>
  <pre><code>// In ReadinessScoreService.php
if ($profile === 'core' && $discipline->isWithinGracePeriod()) {
    $softwareScore = $this->calculateScore($user, 'software');
    $coreScore = $this->calculateScore($user, 'core');
    // Student automatically retains the better score during transition
    return max($softwareScore, $coreScore);
}</code></pre>

  <h2>4. Readiness Tiers &amp; Threshold Triggers</h2>
  <div class="grid-3">
    <div class="stat-card emerald">
      <div class="stat-val">&ge; 75 ARS</div>
      <div class="stat-label">Placement Ready</div>
      <div class="stat-sub">Candidate shortlisted for high CTC campus drives</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">45 – 74 ARS</div>
      <div class="stat-label">In Progress</div>
      <div class="stat-sub">Eligible for standard campus recruitment</div>
    </div>
    <div class="stat-card" style="border-left-color: #dc2626;">
      <div class="stat-val" style="color: #dc2626;">&lt; 60 ARS</div>
      <div class="stat-label">At-Risk Threshold</div>
      <div class="stat-sub">Triggers alert in Section Coordinator queue &amp; TPO reports</div>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Placement Readiness Engine (ARS v4) Mathematical Spec</span>
    <span>Page 10 of 16</span>
  </div>
</div>

<!-- ================= PAGE 11: AI INTEGRATIONS & SPEECH ALIGNMENT ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 7</span>
      <span>AI Engineering: Speech Alignment &amp; Interview Models</span>
    </div>
    <div class="header-meta">AI Subsystem (SpeechAlignment.php &amp; GeminiInterviewService.php)</div>
  </div>

  <h2>1. Audio-First Speaking Practice: Technical Pipeline</h2>
  <p>
    Speaking Practice coaches verbal fluency without trusting client captions. 
    The audio recording is the sole input, evaluated server-side using Gemini audio models and deterministic speech alignment.
  </p>

  <div class="callout rose">
    <div class="callout-title">Critical Security &amp; Privacy Rule: Zero Audio Retention</div>
    <div class="callout-body">
      Student audio buffers are processed entirely in memory. Once the Gemini transcription and <code>SpeechAlignment</code> algorithms complete, 
      the audio stream is discarded. <strong>No student voice recordings are saved to disk or persistent storage</strong>.
    </div>
  </div>

  <h2>2. Word Alignment Algorithm (<code>SpeechAlignment.php</code>)</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Evaluation Metric</th>
        <th style="width: 25%;">Computation Layer</th>
        <th style="width: 50%;">Mathematical Formula &amp; Scoring Mechanics</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Accuracy (35%)</strong></td>
        <td>Deterministic PHP</td>
        <td>Dynamic time-warping compares heard transcript against target passage. Missing or inserted words penalize score.</td>
      </tr>
      <tr>
        <td><strong>Clarity (35%)</strong></td>
        <td>Gemini Audio Model</td>
        <td>Acoustic model scores phonetic articulation, vowel pronunciation, and ending consonants ($0-100$).</td>
      </tr>
      <tr>
        <td><strong>Fluency &amp; Pace (30%)</strong></td>
        <td>Deterministic PHP</td>
        <td>Calculates Words Per Minute (WPM) and pause distribution. Penalty applied if $\text{WPM} < 90$ or $>180$.</td>
      </tr>
      <tr>
        <td><strong>Composite Score</strong></td>
        <td>Deterministic PHP</td>
        <td>$\text{Overall} = 0.35 \times \text{Accuracy} + 0.35 \times \text{Clarity} + 0.30 \times \text{Fluency}$. Scaled down if Accuracy $< 85\%$.</td>
      </tr>
    </tbody>
  </table>

  <h2>3. Conversational AI Mock Interview Engine</h2>
  <p>The interview engine (<code>GeminiInterviewService.php</code>) orchestrates technical and HR mock panels:</p>

  <pre><code>// System Prompt Topology for Gemini Voice Interviewer
$systemInstruction = "You are a Senior Principal Engineer conducting an interview for the role of {$role}.
Analyze the student's spoken input. If their answer is vague or misses algorithmic complexity, probe deeper.
Evaluate across 4 distinct rubrics:
1. Technical Correctness (35%)
2. Problem Solving & Edge Cases (30%)
3. Communication Clarity (20%)
4. Code Quality & Modularity (15%)";</code></pre>

  <h2>4. Launch Safeguard: Paid Gemini API Key Isolation</h2>
  <div class="callout amber">
    <div class="callout-title">Production Quota Warning: Free Tier vs Paid Tier</div>
    <div class="callout-body">
      Development keys on the Google AI Studio free tier are capped at <strong>15 requests/minute</strong> across the entire project. 
      A single interview or speaking attempt executes 2 parallel requests. In production, <code>GEMINI_API_KEY</code> must be provisioned on a 
      Pay-As-You-Go Google Cloud project to prevent HTTP 429 quota exhaustion during semester batches.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>AI Engineering: Speech Alignment &amp; Interview Models</span>
    <span>Page 11 of 16</span>
  </div>
</div>

<!-- ================= PAGE 12: ANTI-CHEAT PROCTORING & STATE MACHINE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 8</span>
      <span>Anti-Cheat Proctoring Engine &amp; Security State Machine</span>
    </div>
    <div class="header-meta">Security Subsystem (ProctoringService.php &amp; routes/api.php)</div>
  </div>

  <h2>1. Proctoring Telemetry &amp; Verification Stream</h2>
  <p>
    The anti-cheat proctoring engine operates as a continuous state machine monitoring active candidate sessions during timed examinations. 
    Signals are captured by client-side event listeners and validated server-side.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Proctoring Sensor</th>
        <th style="width: 25%;">Client Capture Mechanism</th>
        <th style="width: 50%;">Server Validation &amp; Enforcement Action</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Tab Blur / Window Switch</strong></td>
        <td><code>window.onblur</code> &amp; <code>document.visibilitychange</code></td>
        <td>Server logs timestamp. Increments strike counter; triggers Strike 1 or Strike 2 alert modal.</td>
      </tr>
      <tr>
        <td><strong>Fullscreen Escape</strong></td>
        <td><code>document.fullscreenElement === null</code></td>
        <td>Immediate fullscreen warning. 10-second countdown to return or strike is permanently committed.</td>
      </tr>
      <tr>
        <td><strong>Webcam Face Verification</strong></td>
        <td>Periodic WebRTC canvas snapshot (every 30s)</td>
        <td>AI face detection flags: <em>Zero faces</em> (candidate left seat) or <em>Multiple faces</em> (collusion).</td>
      </tr>
      <tr>
        <td><strong>DevTools &amp; Inspect Intercept</strong></td>
        <td>Keyboard listener on <kbd>F12</kbd>, <kbd>Ctrl+Shift+I</kbd></td>
        <td>Prevents opening developer console; logs attempted inspection event to proctoring log.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. The 3-Strike Security State Machine</h2>
  <div class="grid-3">
    <div class="stat-card amber">
      <div class="stat-val">Strike 1</div>
      <div class="stat-label">Initial Warning</div>
      <div class="stat-sub">Yellow alert banner. Candidate alerted. Recorded in audit ledger.</div>
    </div>
    <div class="stat-card amber">
      <div class="stat-val">Strike 2</div>
      <div class="stat-label">Final Warning</div>
      <div class="stat-sub">Orange blocking modal: "One additional violation will submit your test".</div>
    </div>
    <div class="stat-card" style="border-left-color: #dc2626; background: #fef2f2;">
      <div class="stat-val" style="color: #dc2626;">Strike 3 (Lockout)</div>
      <div class="stat-label">Session Terminated</div>
      <div class="stat-sub">Automatic submission of on-screen code. Test session permanently locked.</div>
    </div>
  </div>

  <h2>3. Administrative Reinstatement Architecture</h2>
  <div class="callout green">
    <div class="callout-title">The One-Click Reinstatement Workflow (<code>POST /api/proctoring/reinstate</code>)</div>
    <div class="callout-body">
      When a candidate is locked out due to an accidental system glitch (e.g. OS popup), the College TPO can reinstate them from <code>/admin/proctoring</code>.
      <br>&bull; TPO inspects the incident log and webcam snapshot.
      <br>&bull; TPO clicks <kbd>Reinstate Student</kbd> and enters a mandatory justification reason.
      <br>&bull; The server resets strikes to 2, clears the lock state, and logs the action in the immutable audit ledger. 
      The candidate resumes testing without losing previous answers.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Anti-Cheat Proctoring Engine &amp; Security State Machine</span>
    <span>Page 12 of 16</span>
  </div>
</div>

<!-- ================= PAGE 13: SPACED REPETITION & SOFT SKILLS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 9</span>
      <span>Learning Engine: Leitner SRS &amp; 70 Soft Skills Exam Papers</span>
    </div>
    <div class="header-meta">Learning Subsystem (VocabularySrsService.php &amp; ManagesSoftSkillQuestions.php)</div>
  </div>

  <h2>1. Spaced Repetition (SRS): The 6-Box Leitner Model</h2>
  <p>
    Vocabulary retention is driven by <code>VocabularySrsService.php</code>, implementing a 6-box Leitner scheduling model. 
    Progress is tracked on the <code>vocabulary_word_progress</code> table per student, per word.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 14%;">Leitner Box</th>
        <th style="width: 20%;">Review Schedule</th>
        <th style="width: 20%;">Status Rendered</th>
        <th style="width: 46%;">Progression &amp; Demotion Rules</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Box 0</strong></td>
        <td>Due Today</td>
        <td><span class="badge badge-slate">Learning</span></td>
        <td>New word introduced or word demoted after wrong answer.</td>
      </tr>
      <tr>
        <td><strong>Box 1</strong></td>
        <td>Due in 1 Day</td>
        <td><span class="badge badge-slate">Learning</span></td>
        <td>Correct answer on or after due date advances word from Box 0.</td>
      </tr>
      <tr>
        <td><strong>Box 2</strong></td>
        <td>Due in 3 Days</td>
        <td><span class="badge badge-blue">Familiar</span></td>
        <td>Advances upon correct answer when due.</td>
      </tr>
      <tr>
        <td><strong>Box 3</strong></td>
        <td>Due in 7 Days</td>
        <td><span class="badge badge-blue">Familiar</span></td>
        <td>Advances upon correct answer when due.</td>
      </tr>
      <tr>
        <td><strong>Box 4</strong></td>
        <td>Due in 16 Days</td>
        <td><span class="badge badge-green">Mastered</span></td>
        <td>Qualifies toward "Words Mastered" metric on student profile.</td>
      </tr>
      <tr>
        <td><strong>Box 5</strong></td>
        <td>Due in 35 Days</td>
        <td><span class="badge badge-green">Mastered</span></td>
        <td>Long-term memory retention state.</td>
      </tr>
    </tbody>
  </table>

  <div class="callout amber">
    <div class="callout-title">The Demotion Penalty Rule</div>
    <div class="callout-body">
      An incorrect answer drops a word <strong>two boxes</strong> (never below Box 0) and marks it due today. 
      Practicing ahead of schedule counts toward streak and accuracy, but cannot rush a word up before its due date.
    </div>
  </div>

  <h2>2. Soft Skills Library: 70 Pre-Built Examination Sets</h2>
  <p>
    AptRun ships with 70 pre-seeded, standardized examination papers (Sets 1 to 70), each comprising 25 questions (1,750 questions total).
    The schema is managed via <code>ManagesSoftSkillQuestions</code> concern:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Question Category</th>
        <th style="width: 15%;">Questions / Set</th>
        <th style="width: 60%;">Syllabus Blueprint &amp; Algorithmic Distribution</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Quantitative Aptitude</strong></td>
        <td>8 Questions</td>
        <td>Arithmetic, Time &amp; Work, Speed-Distance, Profit &amp; Loss, Permutations, Probability, Geometry.</td>
      </tr>
      <tr>
        <td><strong>Logical Reasoning</strong></td>
        <td>7 Questions</td>
        <td>Syllogisms, Blood Relations, Coding-Decoding, Seating Arrangements, Pattern Series.</td>
      </tr>
      <tr>
        <td><strong>Verbal Ability / English</strong></td>
        <td>6 Questions</td>
        <td>Error Spotting, Sentence Improvement, Para Jumbles, Reading Comprehension, Contextual Vocab.</td>
      </tr>
      <tr>
        <td><strong>Situational Judgement</strong></td>
        <td>4 Questions</td>
        <td>Workplace ethics, Conflict resolution, Cross-functional communication, Priority triage.</td>
      </tr>
    </tbody>
  </table>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Leitner SRS &amp; 70 Soft Skills Exam Papers</span>
    <span>Page 13 of 16</span>
  </div>
</div>

<!-- ================= PAGE 14: PAYMENTS & PLAN SIGNALS ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 10</span>
      <span>Payment Architecture &amp; Real-Time Plan Signals</span>
    </div>
    <div class="header-meta">Billing Subsystem (CheckoutService.php &amp; planSync.ts)</div>
  </div>

  <h2>1. Payment Gateway Architecture: PayU &amp; Razorpay</h2>
  <p>
    AptRun implements a dual-gateway purchase architecture (<code>CheckoutService.php</code>). 
    PayU Hosted Checkout serves as default (<code>PAYMENT_GATEWAY=payu</code>), with Razorpay available as an instant zero-code alternative.
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Gateway Parameter</th>
        <th style="width: 38%;">PayU Implementation (Default)</th>
        <th style="width: 40%;">Razorpay Implementation (Alternative)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Checkout Workflow</strong></td>
        <td>Hosted Checkout (Redirect via form post to PayU).</td>
        <td>Modal Popup (Client-side Razorpay.js checkout modal).</td>
      </tr>
      <tr>
        <td><strong>Return URL Callback</strong></td>
        <td><code>POST /api/payu/return</code> (max 50 chars hostname).</td>
        <td>Handled client-side; verified via server-side signature check.</td>
      </tr>
      <tr>
        <td><strong>Webhook Endpoints</strong></td>
        <td><code>POST /api/webhooks/payu?token=&lt;TOKEN&gt;</code></td>
        <td><code>POST /api/webhooks/razorpay</code> (HMAC SHA256 verified).</td>
      </tr>
      <tr>
        <td><strong>Reconciliation Cron</strong></td>
        <td colspan="2"><code>php artisan payments:reconcile</code> (Scheduled every 15 minutes; queries gateways for pending orders).</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Real-Time Plan Signal Polling (<code>frontend/src/lib/planSync.ts</code>)</h2>
  <p>To avoid pinning persistent WebSocket worker processes on PHP-FPM, open dashboards poll a lightweight signature endpoint:</p>

  <pre><code>// Signal Generation in PlanSignalService.php
$signature = hash('sha256', implode('|', [
    $user->id,
    $subscription?->plan_id,
    $subscription?->ends_at?->timestamp,
    $subscription?->plan?->updated_at?->timestamp
]));
return response()->json(['signal' => $signature]);</code></pre>

  <div class="callout green">
    <div class="callout-title">Client-Side Event Firing on Signature Drift</div>
    <div class="callout-body">
      The client poller (<code>planSync.ts</code>) requests <code>GET /api/me/plan-signal</code> every 30 seconds and on window focus. 
      If the returned signature differs from the local cache, it dispatches <code>SUBSCRIPTION_CHANGED_EVENT</code>. 
      All sidebar locks, plan badges, and usage meters refetch immediately without reloading the page.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Payment Architecture &amp; Real-Time Plan Signals</span>
    <span>Page 14 of 16</span>
  </div>
</div>

<!-- ================= PAGE 15: DEVELOPER EXTENSION GUIDE ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 11</span>
      <span>Developer Extension Guide: How to Add &amp; Modify Features</span>
    </div>
    <div class="header-meta">Extension SOP (For Senior Engineers Making Production Changes)</div>
  </div>

  <h2>Standard Operating Procedures (SOPs) for Making Changes</h2>
  <p>Follow these architectural patterns to modify or extend platform features without breaking existing tenant boundaries:</p>

  <h3>SOP 1: How to Add a New Plan or Modify Entitlements</h3>
  <div class="step-box">
    <div class="step-num-badge">1</div>
    <div class="step-content">
      <div class="step-title">Database Migration &amp; Model Casts</div>
      <div class="step-detail">
        If adding a new limit column, create migration: <code>php artisan make:migration add_xyz_to_plans_table</code>. 
        Add column to <code>Plan::$fillable</code> and <code>Plan::casts()</code>.
      </div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num-badge">2</div>
    <div class="step-content">
      <div class="step-title">Register in <code>PlanSeeder.php</code> &amp; User Model</div>
      <div class="step-detail">
        Update <code>PlanSeeder.php</code> with default limit for Coder, Expert, and College rows. 
        Update <code>User::effectiveEntitlements()</code> to expose the new key in the resolved array.
      </div>
    </div>
  </div>
  <div class="step-box">
    <div class="step-num-badge">3</div>
    <div class="step-content">
      <div class="step-title">Enforce in Controller &amp; Expose on Sidebar</div>
      <div class="step-detail">
        Check limit in domain controller using <code>$user->effectiveEntitlements()['xyz']</code>. 
        If locking a sidebar route, update <code>frontend/src/components/dashboard/studentNav.ts</code>.
      </div>
    </div>
  </div>

  <h3>SOP 2: How to Add a New Engineering Discipline / Branch</h3>
  <div class="callout indigo">
    <div class="callout-body">
      1. Seed the discipline in <code>disciplines</code> table (e.g. Chemical Engineering: <code>code = 'chem'</code>).
      <br>2. Add canonical branch aliases in <code>BranchService.php</code> ("CHEM", "Chemical", "CHE").
      <br>3. Upload question banks via Mellow Ops importer (<code>/admin/core-prep</code>).
      <br>4. Publish at least one timed blueprint test.
      <br>5. Toggle the branch <strong>Live</strong> in Superadmin Master Control. This automatically stamps <code>live_at</code> and initiates the 30-day ARS scoring grace period.
    </div>
  </div>

  <h3>SOP 3: How to Swap AI Model Providers (Gemini &rarr; Claude / OpenAI)</h3>
  <div class="callout green">
    <div class="callout-body">
      All AI calls route through dedicated services: <code>GeminiInterviewService</code> and <code>GeminiSpeakingPassageService</code>. 
      To introduce Anthropic Claude or OpenAI:
      <br>1. Create an <code>AiProviderInterface</code> with methods: <code>transcribeAudio()</code>, <code>scoreRubrics()</code>, <code>generatePassage()</code>.
      <br>2. Implement <code>ClaudeAiProvider.php</code> using Guzzle HTTP client.
      <br>3. Bind the implementation in <code>AppServiceProvider.php</code> based on <code>.env</code> variable <code>AI_PROVIDER=claude</code>.
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Developer Extension Guide &amp; SOPs</span>
    <span>Page 15 of 16</span>
  </div>
</div>

<!-- ================= PAGE 16: TECHNICAL DEBT & ARCHITECTURAL ROADMAP ================= -->
<div class="page">
  <div class="header-bar">
    <div class="header-title">
      <span class="header-tag">Section 12</span>
      <span>Technical Debt, Recommendations &amp; Refactoring Roadmap</span>
    </div>
    <div class="header-meta">Architectural Recommendations for Senior Engineers</div>
  </div>

  <h2>1. Technical Debt &amp; Recommended Refactoring Items</h2>
  <p>The following architectural enhancements are recommended for implementation to improve maintainability and horizontal scalability:</p>

  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Subsystem</th>
        <th style="width: 35%;">Current Implementation</th>
        <th style="width: 40%;">Recommended Refactoring / Improvement</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Plan Entitlements</strong></td>
        <td>Discrete boolean and integer columns on <code>plans</code> table.</td>
        <td>Migrate to a single <code>features (JSONB)</code> column with JSON schema validation to allow adding new feature flags without database migrations.</td>
      </tr>
      <tr>
        <td><strong>Workspace Volume Retention</strong></td>
        <td>Docker volumes (<code>wsvol-&lt;n&gt;</code>) remain on disk indefinitely after subscription lapses.</td>
        <td>Implement an automated cleanup cron (<code>workspaces:purge-expired</code>) to archive volumes to S3 and delete local volumes 90 days after plan lapse.</td>
      </tr>
      <tr>
        <td><strong>Queue Processing</strong></td>
        <td>Scheduler cron runs <code>queue:work --stop-when-empty</code> every minute.</td>
        <td>Deploy a dedicated Supervisor daemon running persistent queue workers (<code>php artisan queue:work --sleep=3 --tries=3</code>) for zero-latency email and event processing.</td>
      </tr>
      <tr>
        <td><strong>Piston Judge Cluster</strong></td>
        <td>Single Piston host server configured in <code>.env</code>.</td>
        <td>Deploy an HAProxy load balancer in front of multiple Piston worker nodes with health checks to scale beyond 2,500 simultaneous submissions.</td>
      </tr>
      <tr>
        <td><strong>Company Recruiter RBAC</strong></td>
        <td>Single corporate user login per company tenant.</td>
        <td>Introduce <code>company_memberships</code> table with fine-grained permissions (e.g. <em>Hiring Lead</em>, <em>Interviewer</em>, <em>Reviewer</em>).</td>
      </tr>
    </tbody>
  </table>

  <h2>2. Production Readiness Checklist for Senior Developers</h2>
  <div class="grid-2">
    <div class="callout green">
      <div class="callout-title">1. Cache &amp; Route Optimization</div>
      <div class="callout-body">
        Ensure <code>php artisan config:cache</code>, <code>php artisan route:cache</code>, and <code>php artisan view:cache</code> are executed on every production deployment.
      </div>
    </div>
    <div class="callout indigo">
      <div class="callout-title">2. Payment Webhook Token Verification</div>
      <div class="callout-body">
        Verify that <code>PAYU_WEBHOOK_TOKEN</code> and <code>RAZORPAY_WEBHOOK_SECRET</code> are set in production <code>.env</code> to reject forged payment confirmation webhooks.
      </div>
    </div>
  </div>

  <div style="background: #0f172a; color: #ffffff; border-radius: 5px; padding: 7px 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
    <div>
      <div style="font-size: 8.2pt; font-weight: 700;">AptRun™ Enterprise Architecture &middot; Product of Mellow Vault (Prayukti Development Pvt. Ltd. &middot; CIN: U62099UP2024PTC207212)</div>
      <div style="font-size: 7pt; color: #94a3b8;">Registered Office: Noida / New Delhi, India &middot; Tech Escalations: support@mellowvault.com &middot; Framework: Laravel 11 / Next.js 14</div>
    </div>
    <div style="text-align: right;">
      <span class="badge badge-green" style="font-size: 7pt;">ARCHITECT VERIFIED &middot; 99.99%</span>
    </div>
  </div>

  <div class="footer-bar">
    <span>&copy; 2026 Mellow Vault &middot; A Unit of Prayukti Development Pvt. Ltd. (CIN: U62099UP2024PTC207212)</span>
    <span>Technical Debt &amp; Architectural Roadmap</span>
    <span>Page 16 of 16</span>
  </div>
</div>

</body>
</html>
"""

    html_content = html_content.replace("{logo_b64}", logo_b64)
    html_content = html_content.replace(" · ", " &middot; ")

    temp_html_path = r"D:\Dev\AptRun\generate_tech_temp.html"
    with open(temp_html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    output_pdf = r"D:\Dev\AptRun\docs\AptRun-Technical-Feature-Guide.pdf"
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

    print("Running Edge headless print-to-pdf for Technical Feature Guide...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    time.sleep(2)

    if os.path.exists(output_pdf):
        print(f"Successfully generated Technical PDF: {output_pdf} (Size: {os.path.getsize(output_pdf)} bytes)")
    else:
        print("Failed to generate PDF. Stdout:", res.stdout, "Stderr:", res.stderr)

    if os.path.exists(temp_html_path):
        os.remove(temp_html_path)

if __name__ == "__main__":
    build_technical_pdf()
