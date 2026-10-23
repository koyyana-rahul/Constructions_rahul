# Builtra — Full Frontend Prompt Pack for Google Stitch

> Generated from a complete read of the `BuildSync-CLIENT` React frontend
> (routes, shell, all dashboards, list/form/detail screens, UI primitives,
> Tailwind theme, brand assets) and the API models that define the states
> displayed in the UI.

---

## 0. How to use this pack with Stitch

1. Create a new **Web** project in Stitch.
2. Open **Theme** and enter the tokens from §2 first. Doing this before
   generating screens keeps every screen on the same visual system.
3. Paste the **Master Prompt** (§1) as the first message. This establishes the
   product, visual direction, shell and component language.
4. Generate the screens in batches of 4–5 using the **Screen Prompts** (§3).
   Keep them in the same project so Stitch reuses the theme and components.
5. Generate the primary screens at **1440 × 900** (desktop). Then ask Stitch for
   a **390 × 844 mobile variant** of the shell, dashboard, list, form and detail
   screens.
6. Use §5 for realistic demo content. Never accept lorem ipsum.
7. Run the final designs through the checklist in §6.

If Stitch only accepts one prompt per generation, use the master prompt plus the
single screen prompt, not the whole document.

**Recommended generation order**

1. Sign in → Admin dashboard (this locks the shell, type and card language).
2. Employees list → Add employee → Employee profile → Employee attendance.
3. Construction sites → Clients → Invite client → Invitation created →
   Client profile.
4. Leave list → Leave detail → Work requests list → Work request detail.
5. Payroll → Salary slips → Daily attendance → Attendance report → Settings.
6. Employee dashboard → My leave → Apply for leave → My salary.
7. Client dashboard → My work requests → New work request.
8. Mobile variants: shell → dashboard → list → form → detail.
9. Optional Benny assistant.

When generating screens 4 onward, attach the approved **Admin dashboard** and
**Employees list** as reference images in Stitch so the visual language does not
drift.

---

## 1. Master Prompt — copy everything inside the block

```text
Design a complete, production-quality responsive web application called
BUILTRA — a construction operations and workforce management platform for
construction companies. Tagline: “From plans to progress.”

This is a working internal operations product, not a marketing website. Start
at the sign-in screen. Do not design a landing page, hero section, pricing page,
blog, or “features” marketing page. Do not invent extra modules such as a kanban
board, chat inbox, file manager, calendar suite or social feed. Design only the
screens and modules described below.

PRODUCT
Builtra gives three roles one connected place to run construction operations:
• Administrator — full workforce, sites, attendance, leave, payroll, client
  accounts, work-request decisions and reporting.
• Employee — own profile, own attendance history, own leave requests, own salary
  slips, own account settings.
• Client — own profile, own work requests, request tracking, own settings.

The product handles: employees, construction sites, attendance, leave, salary
records, client work requests, client invitations, and a floating support
assistant named Benny. Money is Indian Rupees (INR), formatted like ₹1,23,456
and compacted like ₹1.2L on KPI tiles. Dates are day-first, readable, e.g.
“12 Mar 2026” or “12/03/2026”.

VISUAL DIRECTION — “CONSTRUCTION DOCUMENT, NOT SAAS TEMPLATE”
The interface should feel like a precise site office instrument: architectural
drawings, structural grids, stamped paperwork, safety signage. Calm and
data-dense, never playful, never glassy, never purple.

• Primary brand colour: deep construction navy #172554.
• Accent / action colour: construction safety orange #EA580C (hover #C2410C).
• Page background: warm-cool concrete grey #F1F3F5.
• Surfaces: white cards with a hairline border #E4E8EC.
• Secondary navy for raised dark surfaces: #1E3A5F.
• Neutral text: #1A2028 headings, #525C68 body, #6C7785 secondary,
  #9DA7B2 muted metadata.
• Status colours: success green #059669, warning amber #D97706,
  danger red #DC2626, info blue #2563EB.
• Typography: headings, navigation, labels, buttons and KPI numerals use
  “Barlow Condensed” (500/600/700), always uppercase with slight positive
  letter-spacing. Body, form values and table cell content use “Inter”
  (400/500/600).
• Type scale: page title 28–30px display; section/card title 16px display;
  KPI value 30px display, tabular numerals; labels 11–12px uppercase display;
  body 14px Inter; meta 11–12px Inter.
• Radius: 6px default controls, 8px buttons/inputs, 10px cards, 16px maximum.
  Status badges are full pills. Never use 24px+ rounded cards.
• Shadows: layered and navy-tinted, low spread:
  0 1px 2px rgba(23,37,84,.04), 0 1px 3px rgba(23,37,84,.06).
  Popovers use a slightly stronger version. No giant blurry shadows.
• Borders: 1px hairline #E4E8EC on cards, #D0D6DD on inputs.
• Icons: Lucide line icons only, 18–20px, 1.5px stroke, never filled,
  never emoji, never coloured illustrations.
• No gradients on surfaces. The only decorative gradients are soft blurred
  orange/navy orbs behind the navy authentication panel.
• No glassmorphism, no neon, no purple, no 3D blobs, no mascot illustrations.
• A subtle blueprint motif is allowed in the auth panel and empty states:
  thin white grid lines at 7% opacity on navy, 56px spacing.

APP SHELL (desktop, authenticated)
• Fixed left sidebar, 288px wide, deep navy #172554, full viewport height.
  It can collapse to an 80px icon rail.
  - Top: 36px orange rounded-square tile containing a white geometric “B”
    built from a vertical spine and two outlined/filled bays; next to it the
    wordmark “BUILTRA” in white uppercase Barlow Condensed, with “RA” in orange.
    Beneath, the micro-label “CONSTRUCTION OPS” in navy-300, letter-spaced.
  - Navigation grouped under tiny uppercase section labels:
    OVERVIEW, WORKFORCE, OPERATIONS, ACCOUNT (admin), with 18px Lucide icons,
    uppercase links, 40px row height. Inactive links are pale blue-grey #C4D0E9;
    hover is a translucent lighter navy. Active link is #1E3A5F with white
    text and a 2px orange vertical bar on the left edge.
  - Admin nav: Dashboard; Employees; Clients; Construction Sites;
    Leave Requests; Work Requests; Salary; Attendance; Attendance Report;
    Settings.
  - Employee nav: Dashboard; My Profile; Leave Requests; Salary Slips;
    Settings.
  - Client nav: Dashboard; My Profile; Work Requests; Settings.
  - Bottom: a small “Collapse” control with a double-chevron.
• Top bar: sticky, 64px tall, white 95% with subtle backdrop blur, hairline
  bottom border. Left: mobile hamburger (mobile only). Then a two-line block:
  micro uppercase role label (“ADMINISTRATOR”, “SITE EMPLOYEE”, “CLIENT”) and
  below it “Welcome back, {first name}” in navy display type. Right: circular
  avatar (initials fallback on navy-100), user name, chevron. Opens a white
  dropdown with name/email header, “Settings” item, and a red “Sign out” item.
• Main content: concrete-100 background, 20–24px padding, centered max-width
  1600px. Page header at top of every page: breadcrumb trail in 12px grey with
  chevrons, then a large uppercase page title, optional one-line description,
  and right-aligned actions (primary orange button, outline button, or a small
  “Syncing…” text while refreshing). A hairline rule under the header.
• Mobile: sidebar becomes an off-canvas drawer over a navy-tinted blurred
  scrim; top bar keeps the hamburger; content padding drops to 16px.
  Data tables become stacked cards — never a horizontally squeezed table.

CORE COMPONENT LANGUAGE
• Buttons: uppercase Barlow Condensed 600, 12–14px, 40px default height,
  32px small, 44px large. Primary = orange filled; Primary/navy = deep navy;
  Outline = white with concrete border; Ghost = text only; Danger = red.
  Loading shows a small spinning line icon and the label in a busy state.
• Cards: white, 10px radius, 1px concrete border, very subtle navy shadow.
  Card header: title left in uppercase display type, optional description in
  12px grey, optional right-side “View all →” orange link; padding 16–20px.
• Status badges: full pills, uppercase 11–12px display type, colored soft
  background + matching text + 1px inset ring + a 6px status dot.
  - Pending / Applied / Late / Half Day: amber.
  - Under Review: blue.
  - Approved / Completed / Verified / Active / Present / Paid: green.
  - In Progress: orange.
  - Rejected / Absent / Blocked: red.
  - On Hold / Returned for Correction: amber.
  - Assigned / Closed / Natural person: navy.
  - Cancelled / Inactive / Archived / Not marked: neutral grey.
  - Leave / Sick: blue.
  - Legal entity: orange/navy accent.
• KPI / stat cards: white cards, 11–12px uppercase grey label, 30px navy
  display numeral, optional hint underneath, and a 36–44px soft-tinted rounded
  square icon at top right (navy, orange, green, amber or red tint). Four in a
  row on desktop, two on mobile. Values use tabular numerals.
• Tables (desktop): full-width, white, uppercase 11px grey column headers on
  concrete-50, 12–13px row padding, hairline row dividers, row hover
  navy-50/60. First column is a small tabular index “01, 02…”. Last column is a
  compact cluster of ghost icon buttons (eye, pencil, wallet, calendar, archive,
  delete), 32px each, with tooltips. Pagination footer with rows-per-page.
  Above every table: toolbar with a 320px search field (magnifier icon, clear
  ×) and segmented filter chips inside a concrete-100 tray — active chip is
  navy filled with white text and a small orange count; inactive chips are grey.
• Mobile list rows: stacked white rows inside a card, with title + status badge,
  a two-line subtitle, small meta line, and a compact right-side action cluster.
• Forms: centered column max-width 768px. Page header with back button; white
  card; two-column field grid on desktop (single column on mobile); 20px gaps.
  Labels are 11–12px uppercase display type; inputs 40px, 8px radius, leading
  Lucide icon in grey, placeholder grey, focus ring navy. Errors are red 12px
  text under the field with a red border. Helper text is grey 12px.
  Card footer: right-aligned Cancel (outline) and orange submit button; optional
  small note at bottom-left. Photo/file upload shown as a tinted inset panel
  with circular avatar preview and an outlined “Choose image” label-button.
• Detail pages: page header with status badge in the meta row, back button and
  contextual actions; then a 1/3 + 2/3 grid. Left identity card: large circular
  avatar, name, monospace ID or role, badges, then icon-labelled contact rows.
  Right: white card(s) with 2-column definition lists (tiny uppercase label,
  14px value), plus a quoted free-text block on concrete-50 for reason/scope.
• Feedback: inline alert banners (soft tinted background, 1px border, icon,
  optional Dismiss); full-card empty states with a circular grey icon, uppercase
  title, grey description and an action button; shimmering skeleton rows/cards
  while loading; confirmation dialogs with a tinted warning icon and clear
  destructive copy.
• Dialogs: centered modal (or bottom sheet on mobile), white, 10px radius,
  navy scrim at 60% with slight blur, title + description, body, footer actions.
• Progress: slim 6–8px neutral track with a single semantic-color fill, label
  left and value right. No gradient fills.
• Floating assistant: a 48px orange circular launcher at bottom-right with a
  chat glyph. Opens a 384px panel with a navy header (“BENNY / BUILTRA
  ASSISTANT”), refresh and minimise icons, a light chat body with greeting and
  messages, and a white composer with an input and orange circular send arrow.

RESPONSIVE RULES
• Breakpoints: 480 / 768 / 1024 / 1280 / 1536px.
• Desktop-first for data density, but every screen must have a deliberate
  mobile composition. No horizontal scrolling pages.
• Tables → stacked cards under 1024px.
• Sidebar → off-canvas drawer under 1024px.
• Page header actions wrap below the title and may go full-width.
• Forms remain one column on phones; two columns from 640px.
• KPI grids: 2 columns on phones, 4 from 1024px.
• Long names/emails must wrap or truncate without pushing actions off-screen.

CONTENT AND QUALITY
Use realistic construction-company content, not lorem ipsum: real names, site
names, employee IDs, dates, rupee amounts and sensible request descriptions.
Every list screen must show a believable populated state; include an empty-state
variant and a loading skeleton where specified. Use consistent sample data
across screens. Make the design feel shipped, not a wireframe.

Screens to generate (detailed prompts follow):
1 Sign in
2 Activate account / set password
3 Forgot password (request + reset)
4 Admin dashboard overview
5 Employees list
6 Add employee
7 Employee profile
8 Edit employee
9 Employee attendance history
10 Construction sites list
11 Add / edit site
12 Clients list
13 Invite client
14 Invitation created
15 Client profile
16 Edit client
17 Leave requests list
18 Leave request detail
19 Work requests list
20 Work request detail
21 Process payroll / add salary
22 Employee salary slips
23 Daily attendance
24 Attendance report
25 Settings / change password
26 Employee dashboard
27 Employee — my leave requests
28 Apply for leave
29 Employee — my salary slips
30 Client dashboard
31 Client — my work requests
32 New work request
33 Mobile shell and mobile list variants
34 Optional: Benny support assistant
```

---

## 2. Stitch theme setup

Enter these in the Stitch theme editor before generating.

### Colours

| Role                            | Hex       |
| ------------------------------- | --------- |
| Brand navy / sidebar / headings | `#172554` |
| Raised navy / active nav        | `#1E3A5F` |
| Deep navy / modal scrim         | `#0E1935` |
| Accent orange / primary CTA     | `#EA580C` |
| Accent hover                    | `#C2410C` |
| Accent light / icon tile        | `#FFF7ED` |
| Page background                 | `#F1F3F5` |
| Surface / card                  | `#FFFFFF` |
| Card border                     | `#E4E8EC` |
| Input border                    | `#D0D6DD` |
| Muted text                      | `#6C7785` |
| Secondary text                  | `#525C68` |
| Primary text                    | `#1A2028` |
| Success                         | `#059669` |
| Warning                         | `#D97706` |
| Danger                          | `#DC2626` |
| Info                            | `#2563EB` |

### Typography

- Display: **Barlow Condensed**, weights 500/600/700, uppercase.
- Body: **Inter**, weights 400/500/600.
- Numerals: tabular lining.

### Shape and elevation

- Default radius `6px`, controls `8px`, cards `10px`, max `16px`.
- Hairline borders `1px`.
- Card shadow: `0 1px 2px rgba(23,37,84,0.04), 0 1px 3px rgba(23,37,84,0.06)`.
- Popover shadow: `0 10px 15px -3px rgba(23,37,84,0.10), 0 4px 6px -4px rgba(23,37,84,0.10)`.

### Icons

- Lucide line style, 18–20px, stroke 1.5.
- Do not use coloured 3D icons, emoji, or filled glyphs.

---

## 3. Screen-by-screen prompts

Generate these after the master prompt. Each one is self-contained enough to use
on its own in the same project.

---

### 3.01 Sign In

```text
Design the BUILTRA sign-in screen as a split desktop layout, 1440×900.

Left panel, 46–50% width, deep navy #172554:
- A faint 56px blueprint grid in white at 7% opacity across the panel.
- Soft blurred orange orb top-right and navy orb bottom-left behind the grid.
- Top-left: orange rounded-square brand tile with the geometric white “B”,
  then “BUILTRA” wordmark in white + orange, and “CONSTRUCTION OPERATIONS”
  in letterspaced pale blue micro-type.
- Mid-panel, left-aligned: huge uppercase Barlow Condensed headline
  “FROM PLANS” on one line and “TO PROGRESS.” on the next, with the second line
  in orange #FB923C. Under it a two-line grey-blue description:
  “Attendance, leave, work requests, salary and client visibility for
  construction operations — structured around the way sites actually run.”
- Below a hairline divider, three small feature items in a row, each with an
  orange Lucide icon above a tiny uppercase label: “SITE RECORDS” (hard-drive
  icon), “ROLE ACCESS” (shield-check), “CREW TRACKING” (calendar-check).
- Bottom: tiny © 2026 BUILTRA · From plans to progress.

Right panel: concrete #F1F3F5 background, centered form column max-width 420px.
- Heading “SIGN IN” in 30px uppercase navy display type.
- Subtitle: “Access your site, workforce and request workspace.”
- Email field with leading mail icon and placeholder “you@company.com”.
- Password field with leading lock icon, trailing eye icon, placeholder
  “Your password”.
- A right-aligned text link “Forgot password?”.
- Full-width orange “SIGN IN” button with a small sign-in icon.
- Below: “New client accounts are created by your contractor. Received an
  activation link? SET YOUR PASSWORD” with the last part an orange uppercase link.
- A tiny grey note with a user-check icon: “Access is decided by your account
  role. Client accounts are created by your contractor and activated by you —
  no administrator ever chooses your password.”
Show the mobile version separately: brand lockup centered above the form, no
left panel.
Also show one variant with a soft red error banner above the form reading
“Unable to sign in. Please try again.”
```

---

### 3.02 Activate Account / Set Password

```text
Design the “SET YOUR PASSWORD” activation screen using the same split
authentication layout as sign-in (navy brand panel left, concrete form panel
right). Desktop 1440×900 plus a 390×844 mobile variant.

Right panel content:
- Heading “SET YOUR PASSWORD”.
- Subtitle: “Welcome, Ananya Rao. Choose a password to activate your account.”
- Invite identity card: white, hairline border, 36px navy-tinted user icon tile,
  name “Ananya Rao” and email “ananya@meridian.dev”.
- “New password” field with lock icon and eye toggle.
- Live password rules checklist below the field, five rows with small check
  icons: “At least 8 characters”, “One uppercase letter”, “One lowercase
  letter”, “One number”, “One special character”. Passed rules are green,
  unmet are pale grey.
- “Confirm password” field with the same eye toggle.
- Checkbox: “I understand I will use this password to sign in to my client
  account.”
- Full-width orange “ACTIVATE ACCOUNT” button with a lock icon.
- Tiny grey security note with shield icon: “This activation link can be used
  once and expires automatically. Nobody at your contractor knows or can see
  the password you choose here.”
- Footer link: “Already activated? SIGN IN”.

Also design two alternate states as separate frames:
1. “LINK NOT VALID” — an empty-state card with a key icon, explanation, and a
   navy “GO TO SIGN IN” button.
2. “NO ACTIVATION TOKEN” — same empty-state treatment with copy: “This page
   needs the one-time token from your activation link. Ask your contractor to
   resend the invitation.”
```

---

### 3.03 Forgot Password

```text
Design a two-step “RESET YOUR PASSWORD” flow in the same split auth layout.

Step 1 — Request:
- Title “RESET YOUR PASSWORD”.
- Subtitle: “Enter the email address linked to your account and we'll generate
  a reset token.”
- Email field with mail icon, placeholder “you@company.com”.
- Full-width orange button “GENERATE RESET TOKEN” with key icon.
- Footer: “Remembered it? BACK TO SIGN IN”.

Step 2 — Set new password:
- Title “CHOOSE A NEW PASSWORD”.
- Subtitle: “Your reset token has been generated. Set a new password to
  continue.”
- A white inset card containing a read-only “Reset token” field in monospace,
  showing a long token string, with a subtle “read only” appearance.
- “New password” and “Confirm password” fields with lock icons.
- Full-width orange “UPDATE PASSWORD” button.
- Centered grey text button with a back arrow: “Use a different email”.
Show both steps side by side as separate frames, plus an error banner variant:
“Passwords do not match”.
```

---

### 3.04 Admin Dashboard Overview

```text
Design the BUILTRA admin dashboard at 1440×900, inside the shared navy sidebar
and white top bar shell.

Page header:
- Breadcrumb absent.
- Title “DASHBOARD OVERVIEW” (30px uppercase navy display).
- Description: “Live operational summary across your workforce, sites and
  requests.”
- Right action: orange “+ ADD EMPLOYEE” button; “Syncing…” micro text beside it.

KPI row — four equal white stat cards:
1 “TOTAL EMPLOYEES” — 128 — hint “121 active” — navy icon tile with hard-hat.
2 “ACTIVE SITES” — 6 — hint “1 archived” — orange icon tile with building.
3 “PENDING APPROVALS” — 14 — hint “Leave + work requests” — amber icon tile
  with clipboard-check.
4 “PAYROLL COMMITMENT” — ₹42.8L — hint “Configured monthly” — green icon tile
  with wallet.

Second row — two equal pipeline cards:
Left card “LEAVE REQUESTS” with description “Applications awaiting or past a
decision.” and orange “VIEW ALL →”.
- A slim segmented distribution bar: amber Pending, green Approved, red
  Rejected, neutral Cancelled.
- A 4-tile legend grid below: each tile concrete-50, a status badge and a large
  display numeral (Pending 9, Approved 41, Rejected 6, Cancelled 2).
- Footer note: “78% of decided requests approved” with the percentage bold.
Right card “WORK REQUESTS” with description “Full pipeline from submission to
completion.” and “VIEW ALL →”.
- Segmented bar with Pending amber, Under Review blue, Approved green,
  In Progress orange, Completed green, Rejected red.
- 6-tile legend with counts (Pending 5, Under Review 3, Approved 12,
  In Progress 7, Completed 24, Rejected 2).
- Footer: “82% of decided requests approved”.

Third row — two approval queue cards:
Left “PENDING LEAVE” / “Newest applications needing a decision.” / VIEW ALL.
Rows: avatar-less, name in navy display type, status badge, subtitle
“EMP-1042 · Casual Leave”, chevron right. Example rows: Arjun Mehta (Pending),
Priya Nair (Pending), Neha Kapoor (Pending). Divider lines; hover concrete-50.
Right “PENDING WORK REQUESTS” / “Submissions and reviews still open.” / VIEW ALL.
Rows: “Ananya Rao · Second-floor slab pour — North wing · Legal entity”,
“Vikram Shah · Site boundary wall rectification · Legal entity”,
“Suresh Iyer · Electrical conduit layout — Block C · Natural person”, each with
a Pending or Under Review badge.

Fourth row — two cards:
Left “NEEDS ATTENTION” with meta “As of 10:42 AM”. Two concrete-50 rows:
“Approved requests awaiting assignment — 3” and “Attendance not marked today —
11”, values in amber display numerals. (Also show a success variant: green check
“No outstanding operational exceptions.”)
Right “QUICK ACTIONS” with a 2×2 grid of outlined shortcut tiles:
Add Employee, Add Client, Add Site, Attendance — each with a Lucide icon.

Visual requirements: dense but breathable, 24px gaps, no charts other than the
segmented bars, no decorative illustrations. All numbers in tabular numerals.
```

---

### 3.05 Employees List

```text
Design the admin “EMPLOYEES” list screen at 1440×900 inside the BUILTRA shell.

Page header:
- Breadcrumb “Admin / Employees”.
- Title “EMPLOYEES”.
- Description: “Your workforce across all construction sites, with designations
  and site assignments.”
- Right: orange “+ ADD EMPLOYEE” button and a faint “Syncing…” label.

Body: one large white card containing:
- Toolbar: search field placeholder “Search by name, ID, site or designation”,
  and on the right a micro label “128 EMPLOYEES”.
- Table columns: “#”, “EMPLOYEE” (avatar + name with monospace employee ID
  beneath), “SITE” (uppercase navy micro-type), “DESIGNATION”, “DOB”,
  “ACTIONS” (five ghost icon buttons: eye, pencil, wallet, calendar, calendar
  check).
- 8 realistic rows: Arjun Mehta EMP-1042 / Riverside Tower — Phase 2 / Site
  Supervisor / 14/02/1988; Priya Nair EMP-1043 / Marine Link Bridge / Safety
  Officer; Rohan Deshmukh EMP-1044 / Riverside Tower — Phase 2 / Site Engineer;
  Neha Kapoor EMP-1045 / Greenfield Logistics Park / Surveyor; Imran Sheikh
  EMP-1046 / Marine Link Bridge / Foreman; Kavya Menon EMP-1047 / Greenfield
  Logistics Park / Quantity Surveyor; Aditya Bose EMP-1048 / Riverside Tower —
  Phase 2 / Electrician; Meera Joshi EMP-1049 / Marine Link Bridge / Site
  Administrator.
- Pagination footer “Rows per page 10” and page numbers 1 2 3 … 13.
Also show a secondary frame of the empty/search state inside the same card:
hard-hat icon in a grey circle, “NO EMPLOYEES MATCH YOUR SEARCH”, helper text
“Try a different name, employee ID or site.”, and an outline “CLEAR SEARCH”
button.

Mobile variant: stacked employee cards with avatar, name, ID + designation,
Active badge, site and DOB meta, and the action icons on the right.
```

---

### 3.06 Add Employee

```text
Design the admin “ADD EMPLOYEE” form at 1440×900 inside the BUILTRA shell.

Header:
- Breadcrumb “Admin / Employees”.
- Title “ADD EMPLOYEE”.
- Description: “Register a new team member and assign them to a construction
  site.”
- Right: outline “← BACK” button.

Form: centered white card max-width 768px, two-column grid on desktop.
1. Full-width tinted panel at top: circular avatar placeholder with initials,
   label “Profile photo (optional)”, an outlined “CHOOSE IMAGE” label-button with
   image icon, helper “JPG, PNG or WEBP up to 2 MB.”
2. “FULL NAME” input with user icon, placeholder “Employee name”.
3. “EMAIL ADDRESS” input with mail icon, placeholder “name@company.com”.
4. “EMPLOYEE ID” input with hard-hat icon, placeholder “e.g. EMP-1042”.
5. “DATE OF BIRTH” date input with cake icon.
6. “GENDER” select with accessibility icon — options Select gender / Male /
   Female / Other.
7. “MARITAL STATUS” select with heart-handshake icon — Select status / Single /
   Married.
8. “DESIGNATION” input with briefcase icon, placeholder “e.g. Site Supervisor”.
9. “CONSTRUCTION SITE” select with building icon: “Riverside Tower — Phase 2”,
   “Marine Link Bridge”, “Greenfield Logistics Park”; helper “Archived sites are
   not listed — a new hire cannot join a closed site.”
10. “MONTHLY SALARY” number input with banknote icon, placeholder “0.00”.
11. “ROLE” select with shield icon — Employee / Administrator; helper “Controls
    which dashboard this person can access.”
12. Full-width “TEMPORARY PASSWORD” field with lock icon, placeholder “Minimum
    6 characters”; helper “The employee can change this from Settings after
    signing in.”
Card footer: left micro note “Employee ID and email must be unique across the
organisation.”; right “CANCEL” outline and orange “ADD EMPLOYEE” submit.
Show a field-error variant on the email and salary fields with red borders and
12px messages.
```

---

### 3.07 Employee Profile

```text
Design the admin “employee profile” screen at 1440×900 inside the BUILTRA shell.

Header:
- Breadcrumb “Admin / Employees / Profile”.
- Title “ARJUN MEHTA” (the employee’s name).
- Description “Site Supervisor · Riverside Tower — Phase 2”.
- Right: orange “✎ EDIT” button.

Below the header, a full-width white context card:
- Avatar 56px, name “Arjun Mehta” with green Active badge, monospace
  “EMP-1042”, meta line “Site Supervisor · Riverside Tower — Phase 2 ·
  arjun.mehta@builtra-demo.com · +91 98765 43210”, and a right-side outline
  “← EMPLOYEES” button.
- A tab strip on concrete-50 beneath: PROFILE (active navy filled), LEAVE
  REQUESTS, SALARY, ATTENDANCE.

Body: 1/3 + 2/3 grid.
Left identity card (1/3): centered 96px avatar, name “ARJUN MEHTA”, monospace
“EMP-1042”, two pills “Active” and “Married”, then a divider and icon rows:
briefcase “Site Supervisor”, map-pin “Riverside Tower — Phase 2”, mail
“arjun.mehta@builtra-demo.com”, phone “+91 98765 43210”.
Right card (2/3) “EMPLOYMENT DETAILS” with a small “WORKFORCE RECORD”
hard-hat meta label:
- Two-column definition list: Employee ID EMP-1042; Full name Arjun Mehta;
  Email; Phone; Designation Site Supervisor; Construction site Riverside Tower
  — Phase 2; Date of birth 14/02/1988; Gender Male; Marital status Married;
  Monthly salary ₹58,000.
Footer note with user icon: “Salary and leave are managed from the admin
workspace.”
```

---

### 3.08 Edit Employee

```text
Design the “EDIT EMPLOYEE” form at 1440×900 inside the BUILTRA shell. Match the
Add Employee form exactly, but with these differences:

- Header title “EDIT EMPLOYEE”; description “Update this team member's site
  assignment, designation and salary.”; breadcrumb Admin / Employees.
- Fields: Full name “Arjun Mehta”; Marital status “Married”; Designation “Site
  Supervisor”; Construction site “Riverside Tower — Phase 2”; Monthly salary
  “58000”.
- No photo upload, email, employee ID, DOB, gender, role or password fields.
- Footer: “CANCEL” outline and orange “SAVE CHANGES”.
- Show a subtle helper under the site select: archived sites are not listed.
```

---

### 3.09 Employee Attendance History

```text
Design the admin view of one employee’s attendance history at 1440×900 inside
the BUILTRA shell.

Header: breadcrumb “Admin / Employees / Attendance”; title “ATTENDANCE”;
description “Attendance records for this employee, scoped to their own history.”

Context card: avatar, “Arjun Mehta”, Active badge, monospace EMP-1042, meta
“Site Supervisor · Riverside Tower — Phase 2”, “← EMPLOYEES” button, and the tab
strip with ATTENDANCE active.

KPI row, four cards: “RECORDS” 42 (navy), “MARKED” 42 (orange), “PRESENT” 37
(green), “ABSENT” 5 (red), each with a calendar-check icon.

White card toolbar: search “Search by date, site or status”; right micro label
“42 OF 42”.
Table columns: #, DATE, CONSTRUCTION SITE, STATUS. Example rows: 01 / 21/03/2026
/ Riverside Tower — Phase 2 / Present; 02 / 20/03/2026 / Riverside Tower —
Phase 2 / Present; 03 / 19/03/2026 / Riverside Tower — Phase 2 / Absent;
04 / 18/03/2026 / Riverside Tower — Phase 2 / Present. Pagination 10 rows.
Mobile variant: stacked rows with date title, site subtitle, status pill.
```

---

### 3.10 Construction Sites List

```text
Design the admin “CONSTRUCTION SITES” list at 1440×900 inside the BUILTRA shell.

Header: breadcrumb “Admin / Construction Sites”; title “CONSTRUCTION SITES”;
description “Manage the active sites, projects and work locations in your
portfolio.”; right orange “+ ADD SITE” button and faint “Syncing…”.

White card:
- Toolbar: search “Search by site name or description”; segmented filter chips
  “ALL 7” (active navy), “ACTIVE 6”, “ARCHIVED 1”; right micro label “7 SITES”.
- Table columns: #, SITE NAME (uppercase navy display), DESCRIPTION (two-line
  clamp), STATUS, ACTIONS (pencil and archive/restore icons).
- Rows: Riverside Tower — Phase 2 / “42-storey mixed-use tower, north bank.
  Active slab and facade works.” / Active; Marine Link Bridge / “Cable-stayed
  bridge approach and deck works.” / Active; Greenfield Logistics Park /
  “Warehouse shells and hardstanding for a logistics campus.” / Active;
  Harbourfront Residences / “Four residential blocks, phase one handed over.”
  / Archived.
- Pagination.

Also show the archive confirmation dialog: title “ARCHIVE CONSTRUCTION SITE”,
warning icon, copy “Riverside Tower — Phase 2 will close to new work. Employees
assigned to it will be deactivated and lose portal access. Attendance, leave and
payroll records are retained.” Buttons “CANCEL” and red “ARCHIVE SITE”.
```

---

### 3.11 Add / Edit Construction Site

```text
Design the construction-site form at 1440×900 inside the BUILTRA shell, with two
frames: “ADD CONSTRUCTION SITE” and “EDIT CONSTRUCTION SITE”.

Header: breadcrumb Admin / Construction Sites; description “Create a site record
so employees and work requests can be assigned to it.” (edit: “Update this
site's name and description.”); right outline “← BACK”.

Form card max-width 768px:
- “SITE NAME” full-width input with building icon; placeholder
  “e.g. Riverside Tower — Phase 2”; value in edit frame.
- “DESCRIPTION” full-width textarea, 4 rows, placeholder “Scope, location and
  any notes for this site”; helper “Optional. Helps your team identify the site
  at a glance.”
- Footer: “CANCEL” and orange “CREATE SITE” (edit: “SAVE CHANGES”).
Show a red validation state on the site name: “Site name is required”.
```

---

### 3.12 Clients List

```text
Design the admin “CLIENTS” list at 1440×900 inside the BUILTRA shell.

Header: breadcrumb “Admin / Clients”; title “CLIENTS”; description
“Organisations and individuals you contract with, and their request history.”;
right orange “+ INVITE CLIENT” button.

White card:
- Toolbar: search “Search by name, email, phone or organisation”; right micro
  label “24 CLIENTS”.
- Table columns: #, CLIENT (avatar + name + small email), ENTITY (pill “LEGAL
  ENTITY” or “NATURAL PERSON”), ORGANISATION (uppercase navy), PHONE, ACCOUNT
  (“Activated” green pill or “Awaiting setup” amber pill), ACTIONS (eye, pencil,
  send/resend invitation, red delete).
- Rows: Ananya Rao / ananya@meridian.dev / Legal entity / Meridian Developers /
  +91 98200 11223 / Activated; Vikram Shah / vikram@horizonestates.in / Legal
  entity / Horizon Estates / +91 98330 44556 / Activated; Suresh Iyer /
  suresh.iyer@gmail.com / Natural person / — / +91 99670 12345 / Awaiting setup.
- One row shows an inline copied invitation link chip beneath the actions in
  tiny accent text.
- Pagination.

Also show the delete confirmation dialog: “DELETE CLIENT”, “Ananya Rao and
their login account will be permanently removed.”, CANCEL and red DELETE CLIENT.
```

---

### 3.13 Invite Client

```text
Design the admin “INVITE CLIENT” form at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Clients; title “INVITE CLIENT”; description “Create a
client login and send them a one-time activation link. You never set their
password.”; outline “← BACK”.

Form card max-width 768px:
- Full-width tinted upload panel: circular avatar placeholder, label “Logo or
  profile photo (optional)”, outlined “CHOOSE IMAGE” button, helper “JPG, PNG or
  WEBP up to 2 MB.”
- “CONTACT NAME” with user icon, placeholder “Full name of the primary contact”.
- “ORGANISATION NAME” with building icon, placeholder “Company or individual
  name”.
- “EMAIL ADDRESS” with mail icon, placeholder “contact@company.com”; helper
  “The activation link is sent to this address. Must be unique.”
- “PHONE NUMBER” with phone icon, placeholder “+91 98765 43210”.
- Full-width “ENTITY TYPE” select with briefcase icon: “Select an entity type”,
  “Legal entity (registered business)”, “Natural person (individual)”; helper
  “Determines how this client is recorded on work requests and reports.”
- Full-width soft blue info banner with user-plus icon: “The account is created
  without a password. Your client receives a one-time link and chooses their own
  — you will never see or store their password.”
- Footer: “CANCEL” and orange “CREATE INVITATION”.
Show one validation-error variant with contact name and email highlighted.
```

---

### 3.14 Invitation Created

```text
Design the “INVITATION CREATED” success screen at 1440×900 inside the BUILTRA
shell.

Header: breadcrumb Admin / Clients / Invite; title “INVITATION CREATED”;
description “ananya@meridian.dev can now set their own password.”; right
outline “← BACK TO CLIENTS”.

Content column max-width 768px:
- Green success alert: “Invitation created. Share the activation link with
  Ananya Rao.”
- White card with a navy square link icon at top-left:
  Heading “ACTIVATION LINK — SHOWN ONCE”.
  Paragraph “Send this link to ananya@meridian.dev. It lets them choose their
  own password and can only be used once.”
  A long monospace URL in a pale navy inset field, truncated, with an outlined
  “COPY LINK” button beside it (show a “COPIED” state with a check icon).
  Below, a clock icon and “Expires 24/03/2026, 6:30 pm”.
- Soft blue info alert: “No email service is configured, so this link must be
  delivered manually. If it is lost, use Resend invitation on the clients list
  to issue a new one.”
- Actions: orange “DONE” with send icon; outline “INVITE ANOTHER CLIENT”.
```

---

### 3.15 Client Profile

```text
Design the admin client-profile screen at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Clients / Profile; title “ANANYA RAO”; description
“Meridian Developers · Legal entity”; right orange “✎ EDIT”.

Body 1/3 + 2/3:
Left white identity card: 96px avatar, name “ANANYA RAO”, “Meridian
Developers”, pill “LEGAL ENTITY”, divider, icon rows: mail
ananya@meridian.dev; phone +91 98200 11223; briefcase “4 work requests raised”.
Right column, two stacked cards:
1 “CONTACT DETAILS” — two-column definition list: Contact name Ananya Rao;
   Email address ananya@meridian.dev; Phone number +91 98200 11223; Entity type
   Legal entity; Organisation Meridian Developers; Client since 04/01/2026.
2 “WORK REQUEST HISTORY” with outline “VIEW ALL” action. Top row of three pills:
   “4 TOTAL” navy, “2 APPROVED” green, “1 PENDING” amber. Then a list:
   Second-floor slab pour — North wing / Construction · 12/03/2026 / Approved;
   Site boundary wall rectification / Repair · 26/02/2026 / Pending;
   Electrical conduit layout — Block C / MEP · 08/02/2026 / Approved.
Footer note with building icon: “Work requests for this client are managed from
the admin workspace.”
```

---

### 3.16 Edit Client

```text
Design the “EDIT CLIENT” form at 1440×900 inside the BUILTRA shell. Match the
Invite Client form with these changes:

- Header title “EDIT CLIENT”; description “Update this client's contact details
  and entity type.”
- Fields: Contact name “Ananya Rao”; Email address “ananya@meridian.dev”; Phone
  number “+91 98200 11223”; Entity type “Legal entity”.
- No photo upload and no info banner.
- Footer: “CANCEL” and orange “SAVE CHANGES”.
```

---

### 3.17 Leave Requests List (Admin)

```text
Design the admin “LEAVE REQUESTS” queue at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Leave Requests; title “LEAVE REQUESTS”;
description “Review and action leave applications across your workforce.”

White card:
- Toolbar: search “Search by employee, ID, site or type”; filter chips
  “ALL 62” (active), “PENDING 9”, “APPROVED 41”, “REJECTED 6”.
- Table columns: #, EMP ID (monospace), EMPLOYEE, LEAVE TYPE (uppercase navy),
  SITE (uppercase navy), DATES (two dates with an arrow, each date non-breaking),
  DAYS, STATUS, ACTIONS (eye).
- Rows: Priya Nair EMP-1043 / Casual Leave / Marine Link Bridge / 12/03/2026 →
  14/03/2026 / 2 / Pending; Arjun Mehta EMP-1042 / Sick Leave / Riverside Tower
  — Phase 2 / 09/03/2026 → 10/03/2026 / 1 / Approved; Rohan Deshmukh EMP-1044 /
  Annual Leave / Riverside Tower — Phase 2 / 24/03/2026 → 30/03/2026 / 6 /
  Pending; Neha Kapoor EMP-1045 / Casual Leave / Greenfield Logistics Park /
  02/03/2026 → 02/03/2026 / 0 / Rejected.
- Pagination.
Show a mobile stacked variant with type as title, status pill, employee + ID,
date range and days.
```

---

### 3.18 Leave Request Detail

```text
Design the admin leave-request detail page at 1440×900 inside the BUILTRA shell.

Header:
- Breadcrumb Admin / Leave Requests / Detail.
- Title “LEAVE REQUEST”.
- Description “Priya Nair · Casual Leave”.
- A Pending amber status badge in the meta row.
- Actions: outline “← BACK TO LIST”; outline red “✕ REJECT”; orange
  “✓ APPROVE”.

Body 1/3 + 2/3:
Left identity card: 96px avatar for Priya Nair, name, monospace EMP-1043,
a pill “MARINE LINK BRIDGE”, centered.
Right card “REQUEST DETAILS” with calendar icon:
- Two-column definition list: Leave type Casual Leave; Duration 2 day(s);
  Start date 12/03/2026; End date 14/03/2026; Applied on 08/03/2026;
  Construction site Marine Link Bridge.
- “REASON” label and a concrete-50 quote block: “Family function out of town.
  Requesting two days of casual leave; handover notes shared with the site
  engineer.”
Footer note: “This request has already been approved and can no longer be
changed.” (show a second frame with Approved badge and no approve/reject
actions).
Dialog overlay: “APPROVE LEAVE REQUEST”, description “Priya Nair's leave will
be marked as approved.”, CANCEL and orange “APPROVE REQUEST”.
Also show the red rejection variant with title “REJECT LEAVE REQUEST” and
button “REJECT REQUEST”.
```

---

### 3.19 Work Requests List (Admin)

```text
Design the admin “WORK REQUESTS” queue at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Work Requests; title “WORK REQUESTS”; description
“Requests raised by clients, with scope, dates and supporting documents.”

White card:
- Toolbar: search “Search by request or client”; filter chips “ALL 48”
  (active), “PENDING 5”, “APPROVED 12”, “REJECTED 2”.
- Table columns: #, REQUEST (navy display semibold), CLIENT (name + monospace
  phone beneath), ENTITY (pill), DURATION (date → date), APPLIED, STATUS,
  ACTIONS (eye).
- Rows: Second-floor slab pour — North wing / Ananya Rao / +91 98200 11223 /
  Legal entity / 12/03/2026 → 18/03/2026 / 10/03/2026 / Pending; Site boundary
  wall rectification / Vikram Shah / +91 98330 44556 / Legal entity /
  26/02/2026 → 05/03/2026 / 22/02/2026 / Under Review; Electrical conduit
  layout — Block C / Suresh Iyer / +91 99670 12345 / Natural person /
  08/02/2026 → 14/02/2026 / 04/02/2026 / Approved; Terrace waterproofing —
  Tower B / Ananya Rao / +91 98200 11223 / Legal entity / 20/01/2026 →
  28/01/2026 / 16/01/2026 / Completed.
- Pagination.
Mobile variant: request name, status, client + phone, date range, applied date.
```

---

### 3.20 Work Request Detail

```text
Design the admin work-request detail page at 1440×900 inside the BUILTRA shell.

Header:
- Breadcrumb Admin / Work Requests / Detail.
- Title “SECOND-FLOOR SLAB POUR — NORTH WING”.
- Description “Raised by Ananya Rao”.
- Pending amber badge in the meta row.
- Actions: outline “← BACK TO LIST”; outline red “✕ REJECT”; orange
  “✓ APPROVE”.

Body 1/3 + 2/3:
Left identity card: 96px avatar, “ANANYA RAO”, “Meridian Developers”, pills
“LEGAL ENTITY” and “+91 98200 11223”.
Right column:
1 “REQUEST DETAILS” card with clipboard icon. Definition list: Request name;
   Duration 6 day(s); Start date 12/03/2026; End date 18/03/2026; Applied on
   10/03/2026; Entity type Legal entity.
   “SCOPE OF WORK” quote block on concrete-50: “Pour and finish the second-floor
   slab for the north wing, including formwork, reinforcement inspection and
   curing. Access via the north gate; crane booking required for the morning
   shift.”
   “SUPPORTING DOCUMENT” row: outlined white file row with PDF icon, truncated
   filename “slab-pour-method-statement.pdf”, download icon on the right.
2 No second card needed; keep the right column airy.

Reject dialog overlay: “REJECT WORK REQUEST”, copy “"Second-floor slab pour —
North wing" will be marked as rejected. The client sees the reason below.”
Inside: “REASON FOR REJECTION” textarea, placeholder “Explain to the client why
this request cannot proceed”, helper “This is shown to the client in their work
request history.” Footer CANCEL and red “REJECT REQUEST”.
Also show the approve dialog variant: “APPROVE WORK REQUEST” / “This action
cannot be undone.” / orange “APPROVE REQUEST”.
```

---

### 3.21 Process Payroll / Add Salary

```text
Design the admin “PROCESS PAYROLL” screen at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Salary; title “PROCESS PAYROLL”; description “Record
a salary entry for an employee assigned to one of your sites.”; outline “← BACK”.

Form card max-width 768px, two-column:
- “CONSTRUCTION SITE” select with building icon — “Riverside Tower — Phase 2”
  selected.
- “EMPLOYEE” select with hard-hat icon — “EMP-1042 — Arjun Mehta” selected.
- “BASIC SALARY” number field with banknote icon — ₹48,000.
- “ALLOWANCES” number field with plus icon — ₹6,500.
- “DEDUCTIONS” number field with minus icon — ₹4,200.
- “PAY DATE” date field with calendar icon — 31/03/2026.
- Full-width pale navy net-salary summary band: wallet icon + “NET SALARY” on
  the left, “₹50,300.00” in 24px navy display numerals on the right.
- Footer: left micro note “Employees sign in to review their own salary
  records.”; CANCEL and orange “SAVE SALARY ENTRY”.
Show a helper state on the employee field before a site is chosen: disabled
select with hint “Select a construction site first.”
```

---

### 3.22 Employee Salary Slips

```text
Design the admin “EMPLOYEE SALARY SLIPS” page for one employee at 1440×900
inside the BUILTRA shell.

Header:
- Breadcrumb Admin / Employees / Arjun Mehta / Salary.
- Title “EMPLOYEE SALARY SLIPS”.
- Description “Payroll history recorded for this employee.”
- Actions: outline “← BACK TO EMPLOYEES”; faint “Syncing…”.

Employee context card with avatar, name, EMP-1042, meta line, “← EMPLOYEES”
button, and tabs with SALARY active.

KPI row: “LATEST NET SALARY” ₹50,300 (orange wallet icon); “TOTAL RECORDED
(6 ENTRIES)” ₹2,94,600 (navy wallet icon).

White card:
- Toolbar search “Search by pay date”.
- Table columns: #, PAY DATE, BASIC, ALLOWANCES (green “+₹6,500”), DEDUCTIONS
  (red “−₹4,200”), NET SALARY (navy display semibold).
- Rows for 31/03/2026, 28/02/2026, 31/01/2026, 31/12/2025, 30/11/2025 with
  realistic amounts.
- Pagination.
Mobile variant: pay date title, “Pay period ending …” subtitle, meta line with
basic/allowances/deductions, net salary on the right.
```

---

### 3.23 Daily Attendance (Admin)

```text
Design the admin daily attendance marking screen at 1440×900 inside the BUILTRA
shell.

Header:
- Breadcrumb Admin / Attendance.
- Title “DAILY ATTENDANCE”.
- Description “Mark attendance for 21/03/2026 across every construction site.”
- Right orange “▤ ATTENDANCE REPORT” button.

KPI row: “TOTAL EMPLOYEES” 128 (navy calendar-check); “MARKED TODAY” 117
(orange search); “PRESENT” 103 (green check-circle); “ABSENT” 14 (red user-x).

White card:
- Toolbar search “Search by employee, ID or site”; right micro “128 OF 128”.
- Table columns: #, EMPLOYEE (name + monospace ID), CONSTRUCTION SITE, STATUS,
  MARK.
- Status column shows a pill when marked, or neutral “NOT MARKED”.
- MARK column: a compact segmented group of four small tinted buttons with
  icons — green “✓ PRESENT”, red “✕ ABSENT”, blue “♡ SICK”, amber
  “▤ LEAVE”. When already marked, the MARK column is empty or shows a subtle
  “Correct” link.
- Example rows: Arjun Mehta / Riverside Tower — Phase 2 / PRESENT / —;
  Priya Nair / Marine Link Bridge / NOT MARKED / four mark buttons;
  Rohan Deshmukh / Riverside Tower — Phase 2 / NOT MARKED / four mark buttons;
  Neha Kapoor / Greenfield Logistics Park / LEAVE / —.
- Pagination 15 rows.
Mobile stacked variant: name + status, ID + site, full-width 2×2 mark button
grid.
```

---

### 3.24 Attendance Report

```text
Design the admin “ATTENDANCE REPORT” page at 1440×900 inside the BUILTRA shell.

Header: breadcrumb Admin / Attendance / Report; title “ATTENDANCE REPORT”;
description “Historical daily attendance across your workforce, grouped by
date.”; outline “BACK TO MARKING”.

Top white filter card: left date input labelled “FILTER BY DATE”; right micro
“126 RECORD(S) ACROSS 3 DAY(S)” and a ghost “CLEAR” button.

Below: stacked day cards, each with a header and a table.
Day 1 header “21/03/2026” with navy pill “42 EMPLOYEES”.
Table columns: #, EMPLOYEE ID (monospace), NAME, SITE, STATUS.
Rows: 01 EMP-1042 Arjun Mehta Riverside Tower — Phase 2 Present; 02 EMP-1043
Priya Nair Marine Link Bridge Present; 03 EMP-1044 Rohan Deshmukh Riverside
Tower — Phase 2 Absent; 04 EMP-1045 Neha Kapoor Greenfield Logistics Park
Leave; 05 EMP-1046 Imran Sheikh Marine Link Bridge Present.
Day 2 header “20/03/2026” with “41 EMPLOYEES”, a few rows visible.
Day 3 header “19/03/2026” with “40 EMPLOYEES”.
At the bottom, centered outline button “⌄ LOAD MORE DAYS”.
Show an empty variant: file-bar-chart icon, “NO ATTENDANCE RECORDS”,
description and “CLEAR DATE FILTER”.
```

---

### 3.25 Settings / Change Password

```text
Design the shared “SETTINGS” page at 1440×900 inside the BUILTRA shell. Show it
for an administrator, with employee/client variants differing only in the footer
note.

Header: breadcrumb Dashboard / Settings; title “SETTINGS”; description “Manage
your account security and preferences.”

Content max-width 672px:
- White card “CHANGE PASSWORD” with description “Choose a password you do not
  use on any other site.” and a grey shield icon at top right.
- Body: “CURRENT PASSWORD”, “NEW PASSWORD”, “CONFIRM NEW PASSWORD” fields, all
  with lock icons, placeholders and current-password/new-password semantics.
- Footer: right-aligned orange “UPDATE PASSWORD”.
- Below the card, a small grey note with info icon: “Your role is Administrator.
  Contact your organisation administrator if you need your access level
  changed.”
Show a success banner above the card: green “Password updated successfully.”
Show an error banner variant: red “Unable to update your password.”
```

---

### 3.26 Employee Dashboard

```text
Design the employee “MY DASHBOARD” at 1440×900 inside the BUILTRA shell, with
employee navigation only (Dashboard, My Profile, Leave Requests, Salary Slips,
Settings).

Header: title “MY DASHBOARD”; description “Your leave activity and salary
records on this project.”; right orange “+ APPLY FOR LEAVE”.

KPI row: “LEAVE REQUESTS” 12 (navy calendar); “PENDING” 2 (amber clock);
“APPROVED” 9 (green check-circle); “LATEST NET SALARY” ₹50,300 (orange wallet).

Two-column row:
Left card “LEAVE REQUESTS” with “VIEW ALL →”.
- Slim green progress bar labelled “Approved share” with caption
  “9 of 12 decided” and right value “75%”.
- A list of 5 leave rows on concrete-50: Sick Leave / Approved (green text);
  Casual Leave / Pending (amber); Annual Leave / Approved; Casual Leave /
  Rejected (red); Sick Leave / Approved.
Right card “SALARY RECORDS” with “VIEW ALL →”.
- 4 rows separated by hairlines: date “31/03/2026” with
  “Basic ₹48,000 · Allow ₹6,500 · Deduct ₹4,200” beneath, and “₹50,300” on the
  right in navy display; repeat for Feb, Jan, Dec.

Full-width bottom card “QUICK LINKS” with outline buttons “👤 MY PROFILE” and
“CHANGE PASSWORD”.
```

---

### 3.27 Employee — My Leave Requests

```text
Design the employee’s own “MY LEAVE REQUESTS” list at 1440×900 inside the
employee shell.

Header: breadcrumb My Dashboard / Leave Requests; title “MY LEAVE REQUESTS”;
description “Track the status of every leave application you have raised.”;
right orange “+ APPLY FOR LEAVE”.

White card:
- Toolbar: search “Search by leave type or reason”; filter chips “ALL 12”,
  “PENDING 2”, “APPROVED 9”, “REJECTED 1”.
- Table columns: #, LEAVE TYPE, FROM, TO, DAYS, REASON (two-line clamp), STATUS.
- Rows: Casual Leave / 12/03/2026 / 14/03/2026 / 2 / “Family function out of
  town.” / Pending; Sick Leave / 09/03/2026 / 10/03/2026 / 1 / “Viral fever,
  doctor advised rest.” / Approved; Annual Leave / 24/02/2026 / 28/02/2026 / 4 /
  “Family holiday planned in December.” / Approved.
- Pagination.
Empty variant: calendar icon, “YOU HAVE NOT APPLIED FOR LEAVE”, helper, orange
“+ APPLY FOR LEAVE” action.
```

---

### 3.28 Apply for Leave

```text
Design the employee “APPLY FOR LEAVE” form at 1440×900 inside the employee shell.

Header: breadcrumb My Dashboard / Leave Requests; title “APPLY FOR LEAVE”;
description “Submit a leave request for your site manager to review.”; outline
“← BACK”.

Form card max-width 768px:
- Full-width “LEAVE TYPE” select with calendar icon — “Casual Leave” selected;
  options Sick Leave, Casual Leave, Annual Leave.
- “FROM DATE” date input with calendar-plus icon — 12/03/2026.
- “TO DATE” date input with calendar-plus icon — 14/03/2026; helper
  “Duration: 2 day(s)”.
- Full-width “REASON” textarea 4 rows, placeholder “Explain briefly why you need
  this leave”, value “Family function out of town.”, helper “Your site manager
  sees this note when reviewing the request.”
- Footer: left micro note “Requests are reviewed by your administrator.”;
  CANCEL and orange “SUBMIT REQUEST”.
Show a validation variant on the reason field: “Please provide a little more
detail (at least 10 characters)”.
```

---

### 3.29 Employee — My Salary Slips

```text
Design the employee’s own “MY SALARY SLIPS” page at 1440×900 inside the employee
shell. Reuse the salary-slip layout from the admin screen with these changes:

- Header: breadcrumb My Dashboard / Salary Slips; title “MY SALARY SLIPS”;
  description “Your payroll history, as recorded by your administrator.”
- No employee context card and no “Back to employees” action.
- KPI row: “LATEST NET SALARY” ₹50,300; “TOTAL RECORDED (6 ENTRIES)” ₹2,94,600.
- Table and mobile cards identical to the admin salary slips view.
```

---

### 3.30 Client Dashboard

```text
Design the client “CLIENT DASHBOARD” at 1440×900 inside the client shell
(Dashboard, My Profile, Work Requests, Settings).

Header: title “CLIENT DASHBOARD”; description “Track the work requests you have
raised with your contractor.”; right orange “+ NEW WORK REQUEST”.

KPI row: “TOTAL REQUESTS” 4 (navy clipboard); “PENDING” 1 (amber clock);
“APPROVED” 2 (green check); “REJECTED” 1 (red x-circle).

Large white card “RECENT WORK REQUESTS” with “VIEW ALL →”.
- Slim green progress bar “Approved share” with caption “2 of 4 decided” and
  “50%”.
- A 6-row divided list: request name on the left (navy display medium), dates
  beneath in grey; right-aligned status text in green/red/amber:
  Second-floor slab pour — North wing / “From 12/03/2026 to 18/03/2026” /
  Approved; Site boundary wall rectification / “From 26/02/2026 to 05/03/2026” /
  Pending; Electrical conduit layout — Block C / “From 08/02/2026 to
  14/02/2026” / Approved; Terrace waterproofing — Tower B / “From 20/01/2026 to
  28/01/2026” / Rejected.

Bottom “QUICK LINKS” card: outline “👤 MY PROFILE”, “CHANGE PASSWORD”.
```

---

### 3.31 Client — My Work Requests

```text
Design the client’s own “MY WORK REQUESTS” list at 1440×900 inside the client
shell.

Header: breadcrumb Client Dashboard / Work Requests; title “MY WORK REQUESTS”;
description “Track every request you have raised with your contractor.”; right
orange “+ NEW REQUEST”.

White card:
- Toolbar search “Search by request name”; filter chips ALL / PENDING /
  APPROVED / REJECTED.
- Table columns: #, REQUEST, DURATION (date → date), APPLIED, STATUS.
- Rows: Second-floor slab pour — North wing / 12/03/2026 → 18/03/2026 /
  10/03/2026 / Pending; Site boundary wall rectification / 26/02/2026 →
  05/03/2026 / 22/02/2026 / Under Review; Electrical conduit layout — Block C /
  08/02/2026 → 14/02/2026 / 04/02/2026 / Approved; Terrace waterproofing —
  Tower B / 20/01/2026 → 28/01/2026 / 16/01/2026 / Completed.
- Pagination.
Empty variant: clipboard icon, “YOU HAVE NOT RAISED ANY WORK REQUESTS”,
  description “Raise a request with dates and supporting documents to get
  started.”, orange “+ NEW REQUEST”.
```

---

### 3.32 New Work Request

```text
Design the client “NEW WORK REQUEST” form at 1440×900 inside the client shell.

Header: breadcrumb Client Dashboard / Work Requests; title “NEW WORK REQUEST”;
description “Describe the work you need and attach any supporting drawings or
documents.”; outline “← BACK”.

Form card max-width 768px:
- Full-width “REQUEST NAME” with clipboard icon, placeholder
  “e.g. Second-floor slab pour — North wing”.
- “START DATE” and “END DATE” date fields with calendar icons.
- Full-width “SCOPE OF WORK” textarea 5 rows, placeholder “Describe the work,
  materials, access requirements and any constraints”.
- Full-width “SUPPORTING DOCUMENT (OPTIONAL)” file picker: outlined button with
  paperclip icon “ATTACH FILE”; helper “.PDF, .DOC, .DOCX, .TXT, .XLSX UP TO
  5 MB.”; success state with file-text icon and
  “slab-pour-method-statement.pdf (842 KB)”.
- Footer: left note “Your contractor reviews each request and sets its status.”;
  CANCEL and orange “SUBMIT REQUEST”.
```

---

### 3.33 Mobile shell and mobile list variants

```text
Design the mobile versions of BUILTRA at 390×844.

1. Mobile shell — top bar 64px white: hamburger left, two-line role label
   “ADMINISTRATOR” + “Welcome back, Aarav”, avatar right. Concrete page
   background. Navy off-canvas drawer open over a 60% navy scrim with blur:
   brand lockup, grouped navigation, active orange bar, close button, collapse
   control hidden.
2. Mobile dashboard — one-column: page title and description, full-width orange
   primary action, 2×2 KPI grid, stacked pipeline cards with segmented bars and
   legend tiles, stacked approval queue cards.
3. Mobile list — page title + full-width action; search field full width; filter
   chips horizontally scrollable; stacked white cards inside one card container.
   Employee card: avatar, name, status pill, “EMP-1042 · Site Supervisor”
   subtitle, site + DOB meta, action icons right.
   Leave card: leave type title, status pill, reason, date range and days meta.
   Work request card: request name title, status pill, client + phone, dates.
4. Mobile form — single column, full-width fields, 16px page padding, action
   buttons full width in the footer.
5. Mobile detail — header with title and status, full-width actions, identity
   card stacked above details, definition list in one column, dialogs become
   bottom sheets.
Use the same typography, colours and component language as desktop.
```

---

### 3.34 Optional: Benny support assistant

```text
Design the optional floating assistant for BUILTRA.

Collapsed: 48px orange circle fixed 20px from the bottom-right, white chat icon,
soft popover shadow.

Open: 384px panel fixed above the launcher, white/concrete-50, 10px radius,
hairline border, popover shadow.
- Header in navy #172554, 56px: orange rounded-square assistant avatar with the
  white geometric B; title “BENNY” in white display uppercase; subtitle “BUILTRA
  ASSISTANT” in pale navy micro-type; right-side refresh and chevron-down ghost
  icons.
- Body max-height 416px, light concrete background, 16px padding:
  greeting bubble on the left with avatar: “Hey there 👋 How can I help you
  today?” in a white bubble with a small top-left notch.
  Assistant introductory bubble: “I'm Benny, the Builtra assistant. Ask me which
  work requests are overdue, who is present on site today, or which leave
  requests are waiting for approval.”
  User message right-aligned in a deep navy bubble with white text.
  Assistant reply left in a white bordered bubble.
  Show a “Thinking…” assistant bubble.
  Error bubble in soft red with a red border and text.
- Composer: white top border, 40px input “Ask Benny about your projects…”, orange
  square send button with an up arrow.
The assistant feels native to the product, not a third-party chat widget.
```

---

## 4. Shared component prompts (use if Stitch needs them isolated)

### 4.1 Status badge system

```text
Design a cohesive status badge component set for Builtra. Pill shape, 11–12px
uppercase condensed type, 1px inset ring, soft tinted background, matching text,
and a 6px dot. Include these states:
PENDING amber; APPLIED amber; UNDER REVIEW blue; APPROVED green; IN PROGRESS
orange; COMPLETED green; VERIFIED green; CLOSED navy; ASSIGNED navy; REJECTED
red; BLOCKED red; ON HOLD amber; RETURNED FOR CORRECTION amber; CANCELLED grey;
ACTIVE green; INACTIVE grey; ARCHIVED grey; PRESENT green; ABSENT red; SICK blue;
LEAVE blue; NOT MARKED grey; LEGAL ENTITY orange; NATURAL PERSON navy;
AWAITING SETUP amber; ACTIVATED green.
Show them on white and on concrete-50 backgrounds. No two states should share
the same colour if they mean different things.
```

### 4.2 Data table and empty/loading states

```text
Design the Builtra list-card pattern: white card, toolbar with search + filter
chips + count, dense desktop table, pagination, and three alternate body states:
1. Populated — 8 realistic rows, uppercase 11px headers, 14px cells, hairline
dividers, hover navy-50, ghost icon actions.
2. Loading — 6 shimmering skeleton rows.
3. Empty — circular grey icon, uppercase title, grey description, optional
or extension button.
Show the mobile stacking behaviour beside the desktop table.
```

### 4.3 Confirmation dialog

```text
Design a reusable destructive-confirmation dialog for Builtra. Centered white
modal, 10px radius, 60% navy scrim with slight blur, warning triangle in a soft
red circle, uppercase title, two-line description, optional form field, and
right-aligned CANCEL + red confirm button. Include an approve variant with an
orange confirm button and a loading state with a spinner and “WORKING…” label.
```

---

## 5. Realistic demo content

Use this content consistently across screens.

**Company / product**

- Product: Builtra — Construction Operations
- Tagline: From plans to progress.
- Administrator: Aarav Sharma, `aarav@builtra-demo.com`
- Support email: `support@builtra.com`

**Construction sites**

- Riverside Tower — Phase 2 — “42-storey mixed-use tower, north bank. Active slab and facade works.” — Active
- Marine Link Bridge — “Cable-stayed bridge approach and deck works.” — Active
- Greenfield Logistics Park — “Warehouse shells and hardstanding for a logistics campus.” — Active
- Harbourfront Residences — “Four residential blocks, phase one handed over.” — Archived

**Employees**

- Arjun Mehta, EMP-1042, Site Supervisor, Riverside Tower — Phase 2, ₹58,000, Male, Married, 14/02/1988
- Priya Nair, EMP-1043, Safety Officer, Marine Link Bridge, ₹52,000
- Rohan Deshmukh, EMP-1044, Site Engineer, Riverside Tower — Phase 2, ₹46,000
- Neha Kapoor, EMP-1045, Surveyor, Greenfield Logistics Park, ₹44,000
- Imran Sheikh, EMP-1046, Foreman, Marine Link Bridge, ₹38,000
- Kavya Menon, EMP-1047, Quantity Surveyor, Greenfield Logistics Park, ₹49,000
- Aditya Bose, EMP-1048, Electrician, Riverside Tower — Phase 2, ₹32,000
- Meera Joshi, EMP-1049, Site Administrator, Marine Link Bridge, ₹41,000

**Clients**

- Ananya Rao, Meridian Developers, Legal entity, `ananya@meridian.dev`, +91 98200 11223, Activated
- Vikram Shah, Horizon Estates, Legal entity, `vikram@horizonestates.in`, +91 98330 44556, Activated
- Suresh Iyer, individual, Natural person, `suresh.iyer@gmail.com`, +91 99670 12345, Awaiting setup

**Leave requests**

- Priya Nair, Casual Leave, 12/03/2026 → 14/03/2026, Pending, “Family function out of town. Handover notes shared with the site engineer.”
- Arjun Mehta, Sick Leave, 09/03/2026 → 10/03/2026, Approved, “Viral fever, doctor advised rest.”
- Rohan Deshmukh, Annual Leave, 24/03/2026 → 30/03/2026, Pending, “Family holiday planned in December.”
- Neha Kapoor, Casual Leave, 02/03/2026 → 02/03/2026, Rejected, “Personal errand.”
- Imran Sheikh, Sick Leave, 27/02/2026 → 28/02/2026, Approved, “Food poisoning.”
- Kavya Menon, Annual Leave, 18/02/2026 → 22/02/2026, Approved, “Wedding in the family.”
- Aditya Bose, Casual Leave, 11/02/2026 → 11/02/2026, Cancelled, “Appointment rescheduled.”
- Meera Joshi, Sick Leave, 04/02/2026 → 05/02/2026, Approved, “Migraine.”

**Work requests**

- Second-floor slab pour — North wing — Ananya Rao / Meridian Developers — 12/03/2026 → 18/03/2026 — Pending — 10/03/2026 — “Pour and finish the second-floor slab for the north wing, including formwork, reinforcement inspection and curing. Access via the north gate; crane booking required for the morning shift.”
- Site boundary wall rectification — Vikram Shah / Horizon Estates — 26/02/2026 → 05/03/2026 — Under Review — 22/02/2026 — “Rebuild the collapsed boundary wall section along the east access road and reinstate the security fence.”
- Electrical conduit layout — Block C — Suresh Iyer — 08/02/2026 → 14/02/2026 — Approved — 04/02/2026 — “Install conduits and pull points for the ground-floor retail units in Block C.”
- Terrace waterproofing — Tower B — Ananya Rao / Meridian Developers — 20/01/2026 → 28/01/2026 — Completed — 16/01/2026 — “Strip existing membrane, prepare substrate and apply a new waterproofing system to the Tower B terrace.”
- Lift lobby stone cladding — Vikram Shah / Horizon Estates — 15/01/2026 → 24/01/2026 — Rejected — 11/01/2026 — “Supply and fix stone cladding to the ground-floor lift lobby.”
- Site office relocation — Ananya Rao / Meridian Developers — 08/01/2026 → 12/01/2026 — Closed — 05/01/2026 — “Relocate the site office to the north compound and reconnect utilities.”

**Salary slips for Arjun Mehta**

- 31/03/2026 — basic ₹48,000, allowances ₹6,500, deductions ₹4,200, net ₹50,300
- 28/02/2026 — basic ₹48,000, allowances ₹6,000, deductions ₹4,000, net ₹50,000
- 31/01/2026 — basic ₹48,000, allowances ₹6,500, deductions ₹4,200, net ₹50,300
- 31/12/2025 — basic ₹46,000, allowances ₹6,000, deductions ₹3,800, net ₹48,200
- 30/11/2025 — basic ₹46,000, allowances ₹5,500, deductions ₹3,600, net ₹47,900
- 31/10/2025 — basic ₹46,000, allowances ₹5,500, deductions ₹3,600, net ₹47,900

**Attendance**

- 21/03/2026 — 117 of 128 marked: Arjun Mehta Present, Priya Nair Present, Rohan Deshmukh Absent, Neha Kapoor Leave, Imran Sheikh Present.
- 20/03/2026 — 114 marked, 3 not marked.
- 19/03/2026 — 120 marked.

---

## 6. Final design checklist

Before accepting a Stitch screen, verify:

- [ ] It looks like the same product as every other screen: navy sidebar, white
      cards on concrete, orange primary actions, Barlow Condensed uppercase.
- [ ] No landing-page hero, stock photography, purple gradients, glass cards,
      rounded-3xl surfaces, emoji icons or lorem ipsum.
- [ ] Page title, breadcrumb, description and actions all present and aligned.
- [ ] Data is realistic and internally consistent with §5.
- [ ] Status colours match the semantic map (same status = same colour).
- [ ] KPI values use tabular numerals and the correct INR style.
- [ ] Tables include the small index column, uppercase headers and icon action
      cluster; mobile has stacked cards.
- [ ] Forms have label-above-field, leading icons, helper text, validation
      states, and a card footer with Cancel + orange submit.
- [ ] Empty, loading and error states exist for every list and detail page.
- [ ] Dialogs include title, description, safe cancel and a clear confirm.
- [ ] Focus, contrast and touch targets are credible (40px controls,
      visible focus rings).
- [ ] The layout works at 390px without horizontal scrolling.
- [ ] Nothing invents a feature that does not exist in this document.

---

## 7. Quick reference — screen inventory

| #   | Screen                      | Role             | Route in the app                                                                         |
| --- | --------------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| 1   | Sign in                     | Public           | `/login`                                                                                 |
| 2   | Activate account            | Public           | `/activate?token=…`                                                                      |
| 3   | Forgot / reset password     | Public           | `/forgot-password`                                                                       |
| 4   | Admin dashboard             | Admin            | `/admin-dashboard`                                                                       |
| 5   | Employees list              | Admin            | `/admin-dashboard/employees`                                                             |
| 6   | Add employee                | Admin            | `/admin-dashboard/add-employee`                                                          |
| 7   | Employee profile            | Admin / Employee | `/admin-dashboard/employees/:id` · `/employee-dashboard/profile/:id`                     |
| 8   | Edit employee               | Admin            | `/admin-dashboard/employees/edit/:id`                                                    |
| 9   | Employee attendance history | Admin            | `/admin-dashboard/employees/attendance/:id`                                              |
| 10  | Construction sites list     | Admin            | `/admin-dashboard/departments`                                                           |
| 11  | Add / edit site             | Admin            | `/admin-dashboard/add-department` · `/admin-dashboard/department/:id`                    |
| 12  | Clients list                | Admin            | `/admin-dashboard/clients`                                                               |
| 13  | Invite client               | Admin            | `/admin-dashboard/add-client`                                                            |
| 14  | Invitation created          | Admin            | same screen, success state                                                               |
| 15  | Client profile              | Admin / Client   | `/admin-dashboard/clients/:id` · `/client-dashboard/profile/:id`                         |
| 16  | Edit client                 | Admin            | `/admin-dashboard/clients/edit/:id`                                                      |
| 17  | Leave requests list         | Admin            | `/admin-dashboard/leaves`                                                                |
| 18  | Leave request detail        | Admin            | `/admin-dashboard/leaves/:id`                                                            |
| 19  | Work requests list          | Admin            | `/admin-dashboard/work`                                                                  |
| 20  | Work request detail         | Admin            | `/admin-dashboard/work/:id`                                                              |
| 21  | Process payroll             | Admin            | `/admin-dashboard/salary/add`                                                            |
| 22  | Employee salary slips       | Admin            | `/admin-dashboard/employees/salary/:id`                                                  |
| 23  | Daily attendance            | Admin            | `/admin-dashboard/attendance`                                                            |
| 24  | Attendance report           | Admin            | `/admin-dashboard/attendance-report`                                                     |
| 25  | Settings                    | All              | `/admin-dashboard/setting` · `/employee-dashboard/setting` · `/client-dashboard/setting` |
| 26  | Employee dashboard          | Employee         | `/employee-dashboard`                                                                    |
| 27  | My leave requests           | Employee         | `/employee-dashboard/leaves/:id`                                                         |
| 28  | Apply for leave             | Employee         | `/employee-dashboard/add-leave`                                                          |
| 29  | My salary slips             | Employee         | `/employee-dashboard/salary/:id`                                                         |
| 30  | Client dashboard            | Client           | `/client-dashboard`                                                                      |
| 31  | My work requests            | Client           | `/client-dashboard/work/:id`                                                             |
| 32  | New work request            | Client           | `/client-dashboard/add-work`                                                             |
| 33  | Mobile variants             | All              | —                                                                                        |
| 34  | Benny assistant (optional)  | All              | Floating component, currently unmounted                                                  |

---

### Notes on intentional UI details

- The brand wordmark is “BUILTRA”, split “BUILT” + “RA”; “RA” is always orange.
- The logo tile is orange with a white geometric B made from one vertical spine
  and two bays — it should look like an architectural elevation, not a generic
  letter.
- Employee IDs are monospace, dates are tabular, and monetary values are
  right-aligned in tables.
- “Approve” is an orange action because it is something the administrator does;
  the resulting “Approved” badge is green because it is the state the record is
  now in. Do not make Approve green.
- The app intentionally has no dark mode. Only the sidebar and auth panel are
  dark navy.
- The existing chat assistant (“Benny”) is an optional floating widget and is not
  part of the main navigation.
- Do not use oversized marketing headlines anywhere inside the authenticated
  app. The largest display heading is the auth-panel statement.
