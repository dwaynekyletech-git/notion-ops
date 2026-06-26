# Compliance, IP & data handling

Grounded in the Internal Contractor Agreement (effective June 17, 2026) between
AGI Ventures Canada Inc. and Dwayne Joseph. This is an operational summary, not
legal advice — the contract controls in any conflict.

## What belongs in this repo

✅ **Do commit:**
- Worker code, capability definitions, `workers.json` configs
- Shell/Python scripts and runbooks for Notion operations
- Cheatsheets, data maps (IDs/URLs only), architecture notes
- Non-sensitive templates and enablement material scaffolds

❌ **Do NOT commit:**
- Client **Confidential Information** (transcripts, deal terms, pricing,
  personal data, emails)
- Credentials, API tokens, OAuth secrets, `auth.json`
- Raw CRM exports containing personal data
- Third-party IP you don't have rights to

`.gitignore` blocks the common offenders (`.env`, `*.token`, `auth.json`,
`credentials.json`). Don't override it.

## IP ownership (Section 13)

- **Deliverables** — all work product from the engagement — are owned
  **exclusively by AGI Ventures Canada**. The contractor irrevocably assigns
  all rights, and waives moral rights.
- **Company Pre-Existing IP** (internal tools, frameworks, automation scripts,
  agent configs, prompt libraries, eval methodologies, templates, processes)
  remains AGIVC property, including any improvements made during client work.
- **Client Deliverables** belong to AGIVC or the Client per AGIVC's agreement
  with that Client — keep them **clearly separated** from Company Pre-Existing
  IP in this repo (e.g. separate worker folders, clear naming).
- **Contractor Pre-Existing IP**: disclose in writing **before** incorporating
  anything you own into a deliverable; AGIVC then gets an irrevocable,
  worldwide, royalty-free license.

Practical rule: build **reusable workers/tools** here rather than one-off
scripts that can't be handed back to AGIVC.

## Confidentiality (Section 7)

- Protect AGIVC and Client Confidential Information with at least commercially
  reasonable care.
- Use it **only** to perform the Services — never for any other purpose.
- On termination, return or destroy all Confidential Information and certify
  destruction in writing within 2 days.

## AI-assisted tools (Sections 3 & 13)

- AI tools (including coding agents) may be used **if** they don't compromise
  Confidential Information and comply with AGIVC/Client policies.
- The contractor remains responsible for the quality and accuracy of all
  Deliverables produced with AI help.
- **Do not** use AGIVC or Client data, code, prompts, outputs, or Confidential
  Information to train, fine-tune, or improve any third-party AI/ML models.
- Ensure AI tools used do not retain, learn from, or transmit Confidential
  Information in violation of the agreement. Be deliberate about what context
  you paste into agents.

## Security (Section 3)

- Store any login/password info securely and per AGIVC/Client security policies.
- Store Confidential Information, Services, or Deliverables **only** on
  platforms designated by AGIVC or the Client.

## Compensation & timesheet (Section 6)

- CAD$50.00/hr, paid bi-weekly within 5 business days of invoice.
- Invoice on the **1st and 15th** of each month, with a detailed breakdown
  recorded in AGIVC's current timesheet software.
- AGIVC has **audit rights** on invoices/timesheets for the prior 90 days.
- This repo is **not** a timesheet. Keep accurate, contemporaneous time entries
  in AGIVC's designated software.

## Term & notices

- Initial term: June 17, 2026 → September 17, 2026 (extendable by written
  agreement).
- Non-circumvention applies for 12 months post-termination (don't directly
  contract with Clients introduced via AGIVC for competing work without
  consent).
- No public reference of work (portfolios, case studies, social media) without
  AGIVC's prior written approval.
