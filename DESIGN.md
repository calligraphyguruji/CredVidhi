# UI/UX Design Specification (DESIGN.md)
## System: Loan Approval Processing System (LAPS)

- **Document Version:** 1.0.0
- **Status:** Approved for Implementation
- **Style Archetype:** Modern Fintech / Precision Financial Engineering

---

## 1. Design Philosophy & Aesthetic Principles

The Loan Approval Processing System is an institutional-grade financial workflow tool. The interface must inspire trust, precision, speed, and regulatory compliance.

### Core Tenets
1. **Clarity Over Flash:** Financial data, interest calculations, and risk metrics must be instantly legible. Decorative flourishes that impede scanning or density are prohibited.
2. **Dense, Structured Information:** Underwriters and loan officers process high volumes of information; layouts must provide clean high-density views without feeling cramped.
3. **Deterministic Visual Status:** Every application state has a dedicated, universally consistent badge, icon, and tone.
4. **Data Privacy by Default:** High-sensitivity personal data (Tax IDs, bank account details) is masked with reveal-on-demand interaction protected by role privilege.
5. **Zero Ambiguity Form Flows:** Long-form applications are structured in clear, stepped workflows with persistent validation, autosave indicators, and progress calculation.

---

## 2. Color System & Theming

The color palette is calibrated for institutional fintech: deep navy foundations, crisp slate neutrals, high-contrast semantic indicators, and restrained primary accents.

### 2.1 Primary & Neutral Palette
| Token | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#F8FAFC` (Slate 50) | `#0B0F17` (Deep Obsidian) | Page background canvas |
| `--bg-surface` | `#FFFFFF` (White) | `#131B2B` (Navy Zinc) | Cards, Modals, Popovers |
| `--bg-subtle` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Table headers, muted panels |
| `--border-default` | `#E2E8F0` (Slate 200) | `#26354A` (Navy Border) | Standard card & component borders |
| `--border-focus` | `#2563EB` (Blue 600) | `#60A5FA` (Blue 400) | Form input focus ring |
| `--text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Primary headers, body text |
| `--text-secondary`| `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Subtitles, helper text, labels |
| `--text-muted` | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | Placeholders, inactive captions |
| `--primary-default`| `#1D4ED8` (Blue 700) | `#3B82F6` (Blue 500) | Primary CTA buttons, active state |
| `--primary-hover` | `#1E40AF` (Blue 800) | `#2563EB` (Blue 600) | Hovered primary buttons |

### 2.2 Semantic & State Color Tokens
| State / Semantic | Foreground Token | Background Fill | Border Token | Status Application |
| :--- | :--- | :--- | :--- | :--- |
| **Draft / Inactive** | `#64748B` (Slate 500) | `#F1F5F9` (Slate 100) | `#CBD5E1` (Slate 300) | `DRAFT`, `CANCELLED` |
| **Pending / Under Review** | `#D97706` (Amber 600) | `#FFFBEB` (Amber 50) | `#FCD34D` (Amber 300) | `SUBMITTED`, `UNDER_REVIEW` |
| **Action Required** | `#EA580C` (Orange 600) | `#FFF7ED` (Orange 50) | `#FDBA74` (Orange 300) | `DOCUMENTS_PENDING` |
| **Verified / In Progress** | `#2563EB` (Blue 600) | `#EFF6FF` (Blue 50) | `#93C5FD` (Blue 300) | `DOCUMENTS_VERIFIED`, `RISK_ASSESSED` |
| **Approved / Success** | `#059669` (Emerald 600) | `#ECFDF5` (Emerald 50) | `#6EE7B7` (Emerald 300) | `APPROVED`, `DISBURSED` |
| **Rejected / Critical Alert** | `#DC2626` (Red 600) | `#FEF2F2` (Red 50) | `#FCA5A5` (Red 300) | `REJECTED`, System Error |

---

## 3. Typography & Spacing

### 3.1 Font Stack
- **Primary Sans:** Inter, `-apple-system`, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif.
- **Tabular / Monospace:** JetBrains Mono, "SFMono-Regular", Consolas, Menlo, monospace (Mandatory for Reference Numbers, Currency, DTI %, and Risk Scores).

### 3.2 Scale & Hierarchy
| Level | Font Size | Line Height | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Heading 1** | 28px (1.75rem) | 36px | 700 (Bold) | -0.02em | Main Dashboard Page Headers |
| **Heading 2** | 22px (1.375rem) | 28px | 600 (Semibold) | -0.015em | Modal titles, major section headers |
| **Heading 3** | 18px (1.125rem) | 24px | 600 (Semibold) | -0.01em | Card titles, group dividers |
| **Body (Base)**| 14px (0.875rem) | 20px | 400 (Regular) | Normal | Standard table text, form inputs |
| **Body (Medium)**| 14px (0.875rem)| 20px | 500 (Medium) | Normal | Interactive labels, active table cells |
| **Caption / Small**| 12px (0.75rem)| 16px | 500 (Medium) | +0.01em | Badges, timestamps, helper footnotes |
| **Metric Large**| 32px (2.0rem) | 40px | 700 (Bold) | -0.02em | KPI dashboard summary metrics |

### 3.3 Spacing & Grid System
- 8-point spatial grid: standard spacing tokens are `4px` (0.5), `8px` (1), `12px` (1.5), `16px` (2), `24px` (3), `32px` (4), `48px` (6).
- Maximum application container width: `1440px`.

---

## 4. UI Component Specifications

### 4.1 Navigation & Shell
- **Staff Shell (Officer/Analyst/Admin):**
  - Left Collapsible Sidebar (`240px` expanded, `64px` collapsed) with section groupings: *Overview*, *Application Queues*, *Risk Analytics*, *Audit Logs*, *System Settings*.
  - Top Utility Bar (`56px` height) with global breadcrumbs, environment pill, quick full-text search (`⌘K`), in-app notification popover, theme toggle (Light/Dark), and user avatar menu.
- **Applicant Shell:**
  - Streamlined Top Navigation bar (`64px`) with Brand Logo, *My Applications*, *Help / Support*, Notification Bell, and Profile Dropdown.

### 4.2 Application Queue Table (Staff View)
- Density: Compact / High-efficiency.
- Columns:
  1. `Ref ID` (Monospace, e.g., `APP-2026-0891`)
  2. `Applicant Name & Contact`
  3. `Product` (Badge, e.g., `Personal Loan`)
  4. `Requested Amount & Tenor` (Right-aligned, tabular numbers)
  5. `DTI / Risk Tier` (Pill, e.g., `32.4% / LOW`)
  6. `Status Badge` (Standardized semantic badge)
  7. `Submission Date`
  8. `Assigned To` (Avatar + Name)
  9. `Actions` (Review, Quick Assign)
- Features: Sticky header, row hover highlighting, multi-column sorting, filter drawer, zero-layout-shift pagination controls.

### 4.3 Multi-Step Loan Application Wizard (Applicant View)
Progressive 4-Step Stepper Header:
1. **Loan Specifications:** Amount slider, tenor picker, estimated monthly repayment preview card (live dynamic calculation).
2. **Personal & Identity:** Legal name, date of birth, contact details, residential address, masked tax ID.
3. **Employment & Financials:** Salaried vs. Self-employed toggle, employer details, gross monthly income, existing debt commitments, rent/mortgage payments.
4. **Document Upload & Consent:** Drag-and-drop file upload zones with accepted MIME badges, live virus/type check indicators, consent checkboxes, and digital declaration.

### 4.4 Document Verification Split-Screen Workspace (Officer View)
- 50/50 Dual-Pane Interface:
  - **Left Pane:** Tabbed Document Viewer (PDF viewer with zoom, rotate, download controls) displaying submitted bank statement or ID.
  - **Right Pane:** Side-by-side data comparison card (e.g., declared income vs. payslip net income), with immediate verification action buttons (`Mark Verified [✓]`, `Reject Document [✕]`).
  - If rejected, an inline modal requires a reason from a preset dropdown + comments.

### 4.5 Risk Assessment & Underwriting Dashboard (Analyst View)
- **Top Summary Cards:**
  - Total Requested Amount vs. Max Recommended Limit.
  - Calculated Debt-to-Income (DTI) with dynamic visual gauge (Green: $<35\%$, Yellow: $35\%-45\%$, Red: $>45\%$).
  - Estimated EMI and Disposable Income Cushion.
  - Proprietary Risk Score Gauge ($0-1000$) with Tier classification (`LOW`, `MEDIUM`, `HIGH`).
- **Rule Breakdown Table:** Granular list of underwriting rule criteria, evaluated value, threshold, and status (`PASS`, `FLAG`, `FAIL`).
- **Decision Drawer:**
  - `Approve Loan`: Form inputs for Final Approved Amount, Interest Rate (APR), Tenor, and Disbursal Conditions.
  - `Reject Loan`: Mandatory Rejection Reason Code select (e.g., `DTI_EXCEEDED`, `UNSATISFACTORY_CREDIT_RECORD`, `INCOMPLETE_DOCUMENTATION`) + Underwriter Audit Rationale text area.

---

## 5. Micro-Interactions, Feedback & States

### 5.1 Empty States
- Custom illustrated vector iconography with neutral tones.
- Direct, actionable messaging: e.g., "No applications pending review in your queue. [Refresh Queue] or [View Completed Reviews]".

### 5.2 Loading States
- Skeleton loaders matching the exact geometric layout of tables, cards, and metric boxes (no full-page spinners).
- Shimmer animation: 1.5s ease-in-out infinite.

### 5.3 Error States
- **Form Fields:** In-line helper text in `--text-error` (`#DC2626`) directly below the input with an exclamation icon. Input border turns red with a 2px subtle red glow.
- **Global Toast Alerts:** Upper right floating toast container with auto-dismiss (5s) for transient feedback, persistent for server errors.

### 5.4 Confirmation Dialogs
- High-stakes actions (`Reject Application`, `Cancel Application`, `Disburse Funds`) require an explicit 2-step confirmation modal.
- "Destructive" confirmations require typing a confirmation keyword or checking a safety declaration before the submit button is enabled.

---

## 6. Accessibility & Responsiveness (WCAG 2.1 AA)

- **Color Contrast:** All text elements meet or exceed 4.5:1 contrast ratio against their background in both light and dark modes.
- **Keyboard Navigation:** Full focus trap on open modals, tab indexing on data tables, accessible arrow-key navigation in dropdown menus.
- **Screen Reader Support:** Accessible ARIA attributes (`aria-expanded`, `aria-haspopup`, `aria-live="polite"` for dynamic calculation updates).
- **Responsive Breakpoints:**
  - Mobile (`< 640px`): Single-column stack, bottom navigation bar for applicants.
  - Tablet (`640px - 1024px`): Collapsible sidebar, horizontal scrollable data tables with sticky primary column.
  - Desktop (`> 1024px`): Full multi-column split-pane review views.
