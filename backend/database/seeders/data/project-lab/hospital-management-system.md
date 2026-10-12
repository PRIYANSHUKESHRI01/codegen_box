> **Read this first.** This document is your contract with the client. Build everything marked **Must**, aim for the **Should** items, and treat **Could** as a bonus. Work through the milestones in order, because each one builds on the last, and tick them off in Project Lab as you go. If a requirement is unclear, make a sensible decision, write it down in your README under "Decisions", and keep moving. Reviewers reward a documented decision over a silent guess.

## 1. Background

CityCare Hospital (a fictional 60-bed hospital in Pune) runs six outpatient departments and sees about 300 patients a day. Today the front desk takes appointments by phone and writes them in paper registers. The result is predictable: two patients are booked into the same slot several times a week, people wait without knowing when their turn is, prescriptions are handwritten and hard to read, and the accounts team re-types the day's bills every night.

The management has asked your team to build an **outpatient (OPD) management system** that replaces the registers. It covers the journey of one outpatient visit, from booking to consultation to billing. It does not cover admitted patients, pharmacy or laboratory work (see Out of scope).

You will deliver a working web application, built from scratch in your workspace, that the hospital's four kinds of users can operate without training.

## 2. Objectives

By the end of the project the system must:

- **Replace the paper registers.** Every patient has one digital record with their full visit history.
- **Make double-booking impossible**, not merely unlikely, even when two people click "Book" at the same moment.
- **Give each user exactly the access they need and nothing more.** A patient sees only their own data, a receptionist never reads clinical notes, a doctor sees only their own patients.
- **Produce correct bills** and a trustworthy daily revenue figure from the same data.
- **Be handed over cleanly.** Another developer can set it up in ten minutes from your README and trust it, because it has seed data and automated tests.

How we will know it worked:

| Measure | Target |
| --- | --- |
| Booking an appointment as a receptionist | Under one minute, three screens or fewer |
| Two people booking the same slot at once | Exactly one succeeds, the other sees a friendly message |
| Setup on a clean machine using only the README | Ten minutes or less |
| Automated tests | Pass, and cover the rules that matter (see Evaluation) |

## 3. Scope

### In scope

- Accounts and sign-in for four roles: admin, receptionist, doctor, patient
- Departments, doctor profiles and weekly availability
- Appointment booking with real time slots, cancellation rules and a daily queue
- Patient registration (self-service and walk-in) and a searchable patient record
- Consultations: vitals, diagnosis, notes and a printable prescription
- Billing: invoices, extra line items, discounts, part payments and a printable invoice
- Dashboards and a revenue report with CSV export
- An audit trail of sensitive actions
- Seed data, automated tests and documentation

### Out of scope

These are deliberately **not** part of this project. Do not build them; time spent here earns no marks.

- Real payment gateways, insurance or TPA claims
- Admitted-patient (IPD) care, bed management and operation theatre scheduling
- Pharmacy stock, laboratory and radiology modules
- Sending real SMS, WhatsApp or e-mail (use Laravel's `log` mail driver)
- Multiple hospital branches, mobile apps, video consultations
- Deployment to a server. The application runs in your workspace
- Legal and regulatory compliance work. **This is a learning project: use made-up patients only, never real people's data.**

### Optional extras

Only after every Must and Should item works. They earn credit for polish, not for scope.

- Prescription as a downloadable PDF
- Medicine-name autocomplete from a small seeded list
- A GitHub Actions workflow that runs the tests
- Dark mode, or a patient-facing visit timeline

## 4. Users and roles

| Role | Who they are | What they do |
| --- | --- | --- |
| Admin | Hospital administrator | Manages staff, departments and doctor availability; reads dashboards, reports and the audit log; can void an invoice |
| Receptionist | Front-desk staff | Registers walk-in patients, books and cancels appointments, checks patients in, creates and collects payment on invoices |
| Doctor | Consulting physician | Sees their own queue, records consultations, writes prescriptions |
| Patient | Person seeking care | Registers, books and cancels their own appointments, reads their own records and invoices |

### Who can see and do what

This table is the heart of the security requirement. **Every cell must be enforced on the server**, not just hidden in the menu.

| Data or action | Admin | Receptionist | Doctor | Patient |
| --- | --- | --- | --- | --- |
| Staff accounts, departments, weekly availability | Yes | No | No | No |
| Block a leave date | Yes | No | Own dates | No |
| Patient demographics (name, phone, allergies) | Yes | Yes | Own patients only | Own only |
| Book or cancel an appointment | Yes | Yes | No | Own only, with the 2-hour rule |
| Check in, mark no-show | Yes | Yes | No | No |
| **Clinical data** (vitals, diagnosis, notes, prescriptions) | **No** | **No** | Own patients only | Own only |
| Invoices and payments | Yes | Yes | No | Own invoices, read only |
| Dashboards, revenue report, audit log | Yes | Day dashboard only | No | No |

*Why admins and receptionists cannot read clinical data:* they do not need it to do their jobs, and health information should be visible to as few people as possible. "Least privilege" is a design principle you will be graded on.

## 5. Functional requirements

Each requirement has an ID, so you can refer to it in commits, tests and your README. **Must** items are required. **Should** items are expected from a strong submission. **Could** items are optional.

### 5.1 Accounts and access (AUTH)

| ID | The system shall | Priority |
| --- | --- | --- |
| `AUTH-1` | Let a visitor register as a patient with name, email, phone and password (at least 8 characters). Registration creates the user and a linked patient record. | Must |
| `AUTH-2` | Let users sign in with email and password and sign out. A wrong email or wrong password gives the same generic message, so it never reveals which emails exist. | Must |
| `AUTH-3` | Support four roles. Each role sees only its own navigation, and every route is protected on the server by role and, where the table above says "own", by ownership. | Must |
| `AUTH-4` | Let an admin create, edit and deactivate staff accounts (doctors and receptionists). A deactivated user cannot sign in. | Must |
| `AUTH-5` | Give new staff a temporary password and force them to change it at first sign-in. | Should |
| `AUTH-6` | Throttle sign-in: after 5 failed attempts in a minute for the same email and IP, show "try again in N seconds". | Should |
| `AUTH-7` | Let a user edit their profile and change their password (current password required). | Should |

### 5.2 Departments and doctors (DOC)

| ID | The system shall | Priority |
| --- | --- | --- |
| `DOC-1` | Let an admin manage departments (name, description). A department that has doctors cannot be deleted. | Must |
| `DOC-2` | Keep a doctor profile: department, specialization, qualification, consultation fee in rupees, slot length (10, 15, 20 or 30 minutes) and an active flag. | Must |
| `DOC-3` | Let an admin set a doctor's weekly availability as one or more time blocks per weekday (for example Monday 10:00 to 13:00 and 16:00 to 18:00). Blocks on one day must not overlap and must end after they start. | Must |
| `DOC-4` | Let an admin, or the doctor for themselves, block a whole date (leave). No slots are offered on a blocked date, and a date that already has confirmed appointments cannot be blocked until they are cancelled. | Should |
| `DOC-5` | Let signed-in patients browse active doctors, filter by department and search by name. | Must |

### 5.3 Appointments (APT)

| ID | The system shall | Priority |
| --- | --- | --- |
| `APT-1` | Let a patient choose a doctor, then a date from today up to 30 days ahead, see the available slots for that date and book one. | Must |
| `APT-2` | Offer a slot only if it follows the slot rules in section 6.1 (inside an availability block, not already booked, not on a blocked date, at least 60 minutes in the future). | Must |
| `APT-3` | Guarantee that a doctor can never have two active appointments at the same start time. This must be enforced by the **database**, not only by application code, and a lost race must show a friendly "that slot was just taken" message. | Must |
| `APT-4` | Show a patient their upcoming and past appointments with status. | Must |
| `APT-5` | Let a patient cancel a booked appointment up to 2 hours before it starts. Closer than that, only staff can cancel. A cancelled slot becomes bookable again. | Must |
| `APT-6` | Let a receptionist book, cancel and reschedule for any patient using the same slot logic. | Must |
| `APT-7` | Refuse a booking if the patient already has an active appointment that overlaps in time, with any doctor. | Should |
| `APT-8` | Store the doctor's consultation fee on the appointment at the moment of booking (see 6.3). | Must |
| `APT-9` | Reschedule in one step: the old slot is released only if the new slot was secured. | Should |
| `APT-10` | Accept an optional reason for the visit (up to 300 characters). | Should |

### 5.4 Front desk and patient records (PAT)

| ID | The system shall | Priority |
| --- | --- | --- |
| `PAT-1` | Let a receptionist register a walk-in patient with no e-mail needed: name, date of birth, gender, phone, address, blood group, known allergies and an emergency contact. Each patient gets a unique hospital number (UHID, see 6.7). | Must |
| `PAT-2` | Search patients by name, phone or UHID. Results are paginated. | Must |
| `PAT-3` | Show a patient page with demographics and visit history (appointments, invoices) to the roles allowed to see them. | Must |
| `PAT-4` | Let a receptionist check a patient in on the appointment date. The status becomes `checked_in` and the patient gets the next queue token for that doctor and day (see 6.6). | Must |
| `PAT-5` | Let a receptionist mark a booked appointment as `no_show` once its start time has passed. Every status change must follow the lifecycle in 6.2. | Must |
| `PAT-6` | Warn when registering a patient whose phone and date of birth match an existing record, with a link to that record. | Should |

### 5.5 Consultations and prescriptions (CON)

| ID | The system shall | Priority |
| --- | --- | --- |
| `CON-1` | Show a doctor today's queue: only their own patients, checked-in patients first in token order, then the remaining booked ones. | Must |
| `CON-2` | Let a doctor open a checked-in appointment and record a consultation: complaint, vitals (blood pressure, pulse, temperature, weight), diagnosis, notes and an optional follow-up date. | Must |
| `CON-3` | Let a doctor add, edit and remove prescription lines (medicine, dosage, frequency such as `1-0-1`, duration in days, instructions) until the consultation is completed. | Must |
| `CON-4` | Complete a consultation: the appointment becomes `completed` and the consultation becomes read-only. | Must |
| `CON-5` | Provide a printable prescription page that fits one A4 sheet in the browser's print preview: hospital name, doctor, patient (UHID, age, gender), date, diagnosis, medicines and follow-up date. | Must |
| `CON-6` | Enforce the clinical-data rules in section 4: a doctor can open only patients who have or had an appointment with them; a patient only their own; admin and receptionist never. | Must |
| `CON-7` | Show the patient's known allergies prominently at the top of the consultation screen, with their previous consultations with this doctor beneath. | Should |
| `CON-8` | Let a doctor add a dated addendum to a completed consultation without altering the original. | Should |

### 5.6 Billing and payments (BIL)

| ID | The system shall | Priority |
| --- | --- | --- |
| `BIL-1` | Create exactly one invoice when a consultation is completed, with a consultation line at the fee captured at booking. Completing twice (for example a double click) must not create a second invoice. | Must |
| `BIL-2` | Let a receptionist add and remove extra line items (description, quantity, unit price) and apply one discount, either a flat amount or a percentage, with a reason, while the invoice is not fully paid. | Must |
| `BIL-3` | Store every amount as an integer number of paise and compute all totals on the server (see 6.4). No floating-point money. | Must |
| `BIL-4` | Let a receptionist record payments against an invoice (amount, method: cash, card or UPI, optional reference). Refuse an overpayment. The invoice status (`unpaid`, `partial`, `paid`) always agrees with its payments. | Must |
| `BIL-5` | Give every invoice a unique number in the form `INV-2026-000042` (see 6.7). | Must |
| `BIL-6` | Provide a printable invoice: items, discount, total, payments received and balance due. | Must |
| `BIL-7` | Let a patient view their own invoices and balances, read only. | Should |
| `BIL-8` | Let an admin void an invoice with a reason. A voided invoice stays visible and is excluded from revenue. | Should |

### 5.7 Dashboards and reports (RPT)

| ID | The system shall | Priority |
| --- | --- | --- |
| `RPT-1` | Show an admin dashboard: today's appointments by status, new patients this month, revenue collected today and this month, and the top 5 doctors by completed consultations this month. Revenue means payments received, not invoices issued, and excludes voided invoices. | Must |
| `RPT-2` | Show a receptionist dashboard: today's appointments across all doctors with a status filter and a one-click check-in. | Must |
| `RPT-3` | Provide a revenue report for a date range, with a total per day and per payment method, and a CSV export. | Should |
| `RPT-4` | Load list pages without N+1 queries (eager-load relations; paginate at 15 rows). | Should |

### 5.8 Audit trail (AUD)

| ID | The system shall | Priority |
| --- | --- | --- |
| `AUD-1` | Record who did what and when for: staff changes, appointment cancellations, consultation completion and addenda, a doctor opening a consultation, payments and invoice voids. Keep user, action, entity, IP address and time. | Should |
| `AUD-2` | Let an admin browse the audit log with filters (user, action, date) and pagination. Nobody can edit or delete entries through the application. | Should |

## 6. Business rules

These rules remove guesswork. Each has a worked example, and the reviewer will test exactly these cases.

### 6.1 Slots

A doctor's availability block is cut into slots of the doctor's slot length, starting at the block's start time. A slot is offered only if it **ends inside** the block.

*Example.* Dr. Rao works Monday 10:00 to 12:00 and 16:00 to 17:00 with 20-minute slots. That gives 6 slots in the morning (10:00, 10:20, 10:40, 11:00, 11:20, 11:40) and 3 in the afternoon (16:00, 16:20, 16:40): **9 slots**. If a block were 10:00 to 10:50, the slots would be 10:00 and 10:20 only, because a 10:40 slot would end at 11:00, after the block.

A slot also disappears when it is already booked, when the date is blocked, or when it starts less than **60 minutes** from now.

*Example.* It is Monday 10:30. Slots from 11:30 onward are bookable, so the first one offered is **11:40**.

### 6.2 Appointment lifecycle

| From | To | Who | Condition |
| --- | --- | --- | --- |
| booked | checked_in | Receptionist, admin | On the appointment date |
| booked | cancelled | Patient | At least 2 hours before the start |
| booked | cancelled | Receptionist, admin | Any time before the start |
| booked | no_show | Receptionist, admin | After the start time has passed |
| checked_in | completed | The treating doctor | By completing the consultation |
| checked_in | cancelled | Receptionist, admin | Any time |
| completed, cancelled, no_show | none | Nobody | Final states |

### 6.3 Fee snapshot

The fee is copied onto the appointment when it is booked. *Example.* Dr. Rao's fee is Rs 600 when Asha books. Next day an admin changes it to Rs 700. Asha's invoice still says Rs 600; the next booking uses Rs 700.

### 6.4 Billing arithmetic

Work in paise (1 rupee = 100 paise). *Example.*

| Line | Calculation | Amount |
| --- | --- | --- |
| Consultation | 1 x Rs 600.00 | Rs 600.00 |
| ECG | 1 x Rs 400.00 | Rs 400.00 |
| Dressing | 2 x Rs 150.00 | Rs 300.00 |
| **Subtotal** | | **Rs 1,300.00** |
| Discount 10 % | 10 % of 1,300.00 | - Rs 130.00 |
| **Total** | | **Rs 1,170.00** |

Asha pays Rs 500.00 in cash: status **partial**, balance Rs 670.00. A payment of Rs 700.00 is **refused** (more than the balance). She then pays Rs 670.00 by UPI: status **paid**, balance Rs 0.00.

Percentage discounts are calculated in paise and rounded half up to the nearest paisa. *Example.* 7.5 % of Rs 333.33 (33,333 paise) is 2,499.975 paise, which rounds to **2,500 paise = Rs 25.00**. A discount can never exceed the subtotal.

### 6.5 Dates and time

Use one time zone everywhere: set `APP_TIMEZONE=Asia/Kolkata`. Show times in 12-hour format with AM/PM (10:20 AM) and dates as `12 Mar 2026`. Show money as `Rs 1,170.00` or `₹1,170.00`, consistently across the whole application.

### 6.6 Queue tokens

Tokens start at 1 for each doctor each day and increase in check-in order. A token is never reused on the same day, even if that appointment is cancelled after check-in.

### 6.7 Identifiers

- **UHID:** `UHID-` followed by the patient's id padded to 6 digits. Patient 42 is `UHID-000042`.
- **Invoice number:** `INV-`, the year the invoice was created, then the invoice id padded to 6 digits. Invoice 42 created in 2026 is `INV-2026-000042`. Deriving it from the id guarantees two invoices never share a number.

### Engineering notes

- A plain unique index on `(doctor_id, starts_at)` would also block re-booking a **cancelled** slot. Decide how to make the rule apply only to active appointments. SQLite supports partial unique indexes, and a nullable "slot key" column that is cleared when an appointment ends also works. Explain your choice in the README.
- Wrap booking, completion and payment in database transactions, and think about what happens if two requests arrive at once.
- Put authorization in policies or gates, validation in Form Requests, and keep controllers thin.

## 7. Non-functional requirements

- **Security:** passwords hashed, CSRF protection on every form, output escaped, mass assignment guarded, authorization on every route and every record lookup (opening `/appointments/17` for someone else's appointment must return 403 or 404), no secrets in the repository.
- **Privacy:** follow the access table in section 4. Never put clinical data in a URL, log message or error page.
- **Data integrity:** foreign keys, unique constraints and sensible `NOT NULL` columns in the database itself, not only in PHP.
- **Validation:** every input validated on the server, with clear messages shown next to the field. Old input is kept after an error.
- **Usability:** the main task of each role is reachable in two clicks from its dashboard. Empty states say what to do next ("No appointments yet. Book one."). Destructive actions ask for confirmation.
- **Responsive and accessible:** works from a 360 px phone to a desktop, every form control has a label, the whole app can be used with the keyboard, and text meets WCAG AA contrast.
- **Errors:** friendly 403, 404 and 419 pages. A 500 never shows a stack trace (`APP_DEBUG=false` in `.env.example`).
- **Performance:** list pages paginate at 15 rows and stay under 20 queries each.
- **Maintainability:** follow Laravel conventions, run `vendor/bin/pint` before committing, and keep business rules out of Blade views.

**Definition of done for every feature:** validated input, authorization checked, a success or error message, an empty state, usable on a phone, and a test if it implements a business rule from section 6.

## 8. Data model

Model at least these entities. Column names are suggestions; the relationships and constraints are the requirement.

| Table | Key columns | Notes |
| --- | --- | --- |
| users | name, email (unique), phone, password, role, is_active, must_change_password | Role is one of admin, receptionist, doctor, patient |
| departments | name (unique), description | |
| doctors | user_id (unique), department_id, specialization, qualification, consultation_fee_paise, slot_minutes, is_active | One doctor profile per doctor user |
| doctor_availabilities | doctor_id, weekday (0 to 6), starts_at, ends_at | Several blocks per day allowed |
| doctor_leaves | doctor_id, date | Unique on doctor and date |
| patients | user_id (nullable, unique), name, date_of_birth, gender, phone, email (nullable), address, blood_group, allergies, emergency_contact_name, emergency_contact_phone | Walk-in patients have no user |
| appointments | patient_id, doctor_id, starts_at, ends_at, status, reason, fee_paise, token_number, checked_in_at, cancelled_at, cancelled_by | Fee is a snapshot (6.3). Index on doctor_id and starts_at |
| consultations | appointment_id (unique), complaint, bp_systolic, bp_diastolic, pulse, temperature_c, weight_kg, diagnosis, notes, follow_up_on, completed_at | Clinical data |
| consultation_addenda | consultation_id, doctor_id, note | For CON-8 |
| prescription_items | consultation_id, medicine, dosage, frequency, duration_days, instructions | |
| invoices | patient_id, appointment_id (nullable, unique), number (unique), discount_type, discount_value, discount_reason, voided_at, void_reason | Totals are computed, never typed in |
| invoice_items | invoice_id, description, quantity, unit_price_paise | |
| payments | invoice_id, amount_paise, method, reference, paid_at, received_by | |
| audit_logs | user_id, action, entity_type, entity_id, ip_address, meta (json), created_at | Append only |

Describe the relationships in your README with a diagram (a Mermaid `erDiagram` block is enough).

## 9. Interfaces

Server-rendered Blade pages. The paths below are recommendations: reviewers judge behaviour, not spelling, with one exception. **`/login` must exist** so the reviewer can start.

| Method and path | Who | Purpose |
| --- | --- | --- |
| GET, POST `/register` | Visitor | Patient self-registration |
| GET, POST `/login`, POST `/logout` | Everyone | Sign in and out |
| GET `/dashboard` | All | Redirects to the dashboard for the user's role |
| GET `/doctors` | Patient | Browse and filter doctors |
| GET `/doctors/{doctor}/slots?date=` | Patient, receptionist | Available slots for a date |
| POST `/appointments` | Patient, receptionist | Book |
| GET `/my/appointments` | Patient | Own appointments |
| POST `/appointments/{appointment}/cancel` | Patient, receptionist, admin | Cancel |
| POST `/appointments/{appointment}/reschedule` | Receptionist, patient | Move to another slot |
| GET, POST `/patients` | Receptionist, admin | Search, register a walk-in |
| GET `/patients/{patient}` | Receptionist, admin, doctor (own), patient (self) | Patient page |
| POST `/appointments/{appointment}/check-in` | Receptionist, admin | Check in and issue a token |
| POST `/appointments/{appointment}/no-show` | Receptionist, admin | Mark no-show |
| GET `/doctor/queue` | Doctor | Today's queue |
| GET, POST `/appointments/{appointment}/consultation` | Doctor | Record the consultation |
| POST `/consultations/{consultation}/complete` | Doctor | Complete it |
| GET `/consultations/{consultation}/prescription` | Doctor, patient | Printable prescription |
| GET `/invoices`, GET `/invoices/{invoice}` | Receptionist, admin | List and open invoices |
| POST `/invoices/{invoice}/items`, DELETE `/invoices/{invoice}/items/{item}` | Receptionist | Edit line items |
| POST `/invoices/{invoice}/discount`, POST `/invoices/{invoice}/payments` | Receptionist | Discount and payments |
| GET `/invoices/{invoice}/print` | Receptionist, admin, patient (own) | Printable invoice |
| GET `/my/invoices` | Patient | Own invoices |
| Resource `/admin/departments`, `/admin/staff` | Admin | Manage departments and staff |
| GET, PUT `/admin/doctors/{doctor}/availability` | Admin | Weekly availability |
| GET `/admin/reports/revenue`, `.csv` | Admin | Revenue report and export |
| GET `/admin/audit-log` | Admin | Audit trail |

## 10. Technology, constraints and your workspace

**Required stack**

- **Laravel** (the latest stable version that `composer create-project` installs) on **PHP 8.3**
- **SQLite** as the database (already installed; no server to start)
- **Blade** templates with **Tailwind CSS** (via Vite). No single-page-app framework is needed
- **PHPUnit or Pest** through `php artisan test`

**Allowed:** Laravel Breeze (Blade) as a starting point for sign-in screens, Laravel Pint, and one PDF package for the optional extras. **Not allowed:** ready-made hospital systems, and admin-panel generators such as Filament, Nova, Voyager or Backpack. They would build the project for you, and the point is that you do. Roles and authorization are yours to design either way.

### How you work in the workspace

This project is about **writing the code yourself**, so the editor is set up to help you do exactly that:

- **You can** read documentation, search the web, ask questions and switch windows whenever you like.
- **You can** copy and paste *inside* your workspace: a whole file into another folder, a line from one file to another, something from the terminal.
- **You can** paste the commands in the `bash` code blocks of this SOW, such as the setup commands just below.
- **You cannot** paste text you copied from outside the workspace (another tab, a chat, a website, another app). It is refused with a short notice: type it instead.
- **You cannot** drag in code files, install extra editor extensions, or open extra editor windows. Images, fonts and PDFs can be added.

Your reviewer sees a short summary of how the code was written: how many pastes from outside were refused (counts and sizes only, never what you copied), typing patterns, and your commit history. Commit often, with messages that say what you did: a history that grows over several days is the best evidence that the work is yours.

### Getting started in your workspace

This SOW is also in your workspace at `.aptrun/SOW.md` for quick reference. Open the terminal in VS Code (`` Ctrl+` ``) and run:

```bash
cd ~
composer create-project laravel/laravel hospital-management-system
cd hospital-management-system
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git init
git add -A
git commit -m "Initial Laravel project"
php artisan serve --host=0.0.0.0 --port=8000
```

Then open **Preview** at the top of the page and enter port **8000**. The first `composer create-project` takes a minute or two.

Four things that are specific to this environment:

- **Always bind to `0.0.0.0`.** `php artisan serve` on its own listens on `127.0.0.1` and the preview cannot reach it.
- **Trust the preview proxy.** In `bootstrap/app.php`, inside `->withMiddleware(...)`, add `$middleware->trustProxies(at: '*');`. Without it Laravel can build `http://` links while the preview is served over `https://`, and the browser blocks them.
- **Build assets instead of running the Vite dev server.** Run `npm install` once and then `npm run build` after changing CSS or JavaScript. The hot-reload server cannot be reached through Preview.
- **Mail goes to the log.** Set `MAIL_MAILER=log` and read `storage/logs/laravel.log`. Workspaces cannot send real e-mail.

Your files are saved between sessions. The workspace stops after 15 minutes without the project page open; your work stays, and `php artisan serve` has to be started again.

## 11. Deliverables

Everything lives in one folder in your workspace, submitted from Project Lab.

- **Source code** for the whole application, with a meaningful git history (at least 10 commits)
- **`README.md`** with: what the project is, setup steps, the demo accounts, a database diagram, and a "Decisions" section for every place you interpreted this SOW
- **`.env.example`** listing every setting. The real `.env` is never committed
- **Migrations and seeders.** `php artisan migrate:fresh --seed` must give a ready-to-demo system
- **Automated tests** that pass with `php artisan test`

### Demo data the seeder must create

Use the password `Password@123` for every demo account. These accounts exist so the reviewer can sign in; they are fine for a demo and must never be used like this in a real system.

| Email | Role | Notes |
| --- | --- | --- |
| admin@hms.test | Admin | |
| reception@hms.test | Receptionist | |
| dr.rao@hms.test | Doctor | Cardiology, fee Rs 600, 20-minute slots, Monday to Friday 10:00 to 13:00 and 16:00 to 18:00 |
| dr.iyer@hms.test | Doctor | Paediatrics, fee Rs 500, 15-minute slots, Monday to Saturday 09:00 to 13:00 |
| patient@hms.test | Patient | Asha Verma, with at least one past completed visit and one upcoming appointment |

Also seed at least 3 departments, 5 doctors in total, 15 patients, about 25 appointments across all statuses and several dates, and 6 invoices with a mix of unpaid, partial and paid. **One appointment must start about 90 minutes from the time of seeding** so the reviewer can test the cancellation rule.

## 12. Evaluation

Your submission is scored out of **100**. A reviewer first sets it up from your README, runs the tests, walks through the application, and then reads the code.

| Category | Points | What is looked at |
| --- | --- | --- |
| Meets the acceptance criteria | 40 | Each milestone's criteria below, weighted by its hours. Missing Must items cost the most |
| Code quality and structure | 25 | Laravel conventions and thin controllers (8), schema design, constraints and indexes (7), automated tests (10) |
| Security and validation | 20 | Authorization with no way to read someone else's data (8), validation and escaping (4), authentication hygiene and no secrets in git (4), audit trail and privacy rules (4) |
| Documentation and setup | 15 | README quality (5), clean setup with `migrate:fresh --seed` (5), git history (3), `.env.example` (2) |

**To be approved** a submission needs **70 or more**, with no failure in the access rules (AUTH-3, CON-6). Otherwise the reviewer asks for changes; your workspace reopens, you fix them and resubmit.

### The reviewer's walkthrough

This is the exact path the reviewer follows. Practise it yourself before you submit.

1. Follow your README on a clean checkout: install, `.env`, key, `migrate:fresh --seed`, serve. Sign in as each demo account.
2. As a new patient: register, sign in, book Dr. Rao tomorrow at the first free slot.
3. In a private window as another patient, try to book that same slot. It must fail politely.
4. As `patient@hms.test`, try to cancel the appointment that starts in about 90 minutes (blocked), then cancel one further ahead (allowed) and book that slot again.
5. As the receptionist: register a walk-in patient, search them by phone, check in an appointment and note the token.
6. As Dr. Rao: open the queue, record a consultation with vitals and two medicines, complete it, and print the prescription.
7. As the receptionist: open the new invoice, add an ECG at Rs 400, apply a 10 % discount, pay part in cash, try to overpay (must fail), pay the rest by UPI, print the invoice.
8. Access attacks: as a patient open another patient's appointment, invoice and consultation URLs. As the receptionist open a consultation URL. As a doctor open a patient who is not theirs. Submit a form with a tampered CSRF token. All must be refused.
9. As admin: check the dashboard numbers against what you just did, export the revenue CSV and find your actions in the audit log.
10. Run `php artisan test`, then read the code for structure and security.

### Common reasons for lost marks

- Authorization only hides menu items instead of checking on the server
- Double-booking prevented in PHP only, with no database constraint
- Money stored as floats, or totals sent from the browser
- A README that skips a step, so setup fails on a clean machine
- `.env`, keys or other secrets committed to git
- One giant commit called "final"

## 13. Assumptions

- One hospital, one branch, outpatient visits only
- All amounts are in Indian rupees; all times are Indian Standard Time
- At most about 10 doctors and a few hundred appointments a day, so no special scaling work is needed
- Patients are made up. No real personal or health data is ever entered
- The latest Chrome, Edge or Firefox is used
- Your workspace can reach the internet to install packages from Composer and npm

## 14. Resources

- Laravel: [Authorization (gates and policies)](https://laravel.com/docs/authorization), [Validation and Form Requests](https://laravel.com/docs/validation), [Migrations](https://laravel.com/docs/migrations), [Eloquent relationships](https://laravel.com/docs/eloquent-relationships), [Database transactions](https://laravel.com/docs/database#database-transactions), [HTTP tests](https://laravel.com/docs/http-tests)
- SQLite: [Partial indexes](https://sqlite.org/partialindex.html)
- Tailwind CSS: [Documentation](https://tailwindcss.com/docs), including its print variant for the prescription and invoice
- OWASP: [A01 Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/), the most common web vulnerability and the one this project tests hardest
