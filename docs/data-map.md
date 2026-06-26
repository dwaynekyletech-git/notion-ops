# Data map (mirror)

> **Source of truth:** `~/.claude/plugins/.../skills/where-to-find-data/SKILL.md`
>
> This file is a **convenience mirror** for the most-used data sources and the
> CRM relationship graph. Always cross-check IDs against the live skill before
> writing — they look similar but are unique, and guessed IDs fail with
> "Invalid Data Source URL".

## Notion access preference

Prefer `ntn` when installed and authenticated:

```bash
command -v ntn && ntn doctor
```

Only fall back to Notion MCP when `ntn` is unavailable, unauthenticated, or
doesn't expose the needed operation. For `ntn datasources query`, strip the
`collection://` prefix from the IDs below.

## Core CRM data sources

| Database | Notion URL | Data source ID (creation) | Purpose |
| --- | --- | --- | --- |
| Opportunities | `https://www.notion.so/2dbffe5c4f7481b8a0c8ceb7a6d0f30e` | `collection://2dbffe5c-4f74-81cb-9b53-000b23acf6c0` | Deals / client projects |
| Contacts | `https://www.notion.so/2dbffe5c4f74812f8711cba5079053a8` | `collection://2dbffe5c-4f74-8107-aafa-000b3c6b869e` | People with emails |
| Companies | `https://www.notion.so/2dbffe5c4f7481d2815cde1959ba73a2` | `collection://2dbffe5c-4f74-81ce-9ac3-000b96f82073` | Organizations (HST %) |
| Company Info (AGIVC) | `https://www.notion.so/44933df344334963b9842058e9a87be2` | `collection://70131795-21d9-4b27-8763-555f71c5c6c6` | AGIVC details (HST, address, banking) |
| Meetings | `https://www.notion.so/2e1ffe5c4f7480eca457cd2147a987ba` | `collection://2e1ffe5c-4f74-80b7-9128-000b1cf00c30` | Transcripts & notes |
| Lessons Learned | `https://www.notion.so/359ffe5c4f7480709eedc6307fe9971e` | `collection://359ffe5c-4f74-8086-ae3e-000b585b80c9` | Concise lessons (Title: `Name`) |
| Docs | `https://www.notion.so/2dbffe5c4f74812ca415e1a6f952edeb` | `collection://2dbffe5c-4f74-8129-be61-000b55ddacf8` | SOWs, proposals, invoices, etc. |
| Opportunity Documents | TBD (fetch from Applied AI > CRM) | TBD | Meeting preps + opp-scoped docs |
| Emails | `https://www.notion.so/218fa0876eec414ea00b0c31145a3a87` | `collection://9fda0d3b-8d55-4145-b2d6-478b1cb980b4` | Gmail threads |
| Invoices | `https://www.notion.so/bc09dc1adbfa40279ff18beff54bd720` | `collection://7c6b468d-d74f-4302-bf47-cc97afc2f6a9` | Invoices to clients |
| Pitches | `https://www.notion.so/2dbffe5c4f7481d5b902dc705ae4fb75` | `collection://2dbffe5c-4f74-8173-b5af-000bf3433fcf` | Shape Up pitches (Oatmeal) |
| Applied AI Tasks | N/A | `collection://2dbffe5c-4f74-81a8-894b-000bee1bf92b` | Tasks linked to pitches |
| Deliverables | `https://www.notion.so/2f4ffe5c4f748080b246f89fa339e991` | `collection://2f4ffe5c-4f74-804c-9c54-000b4f2052c9` | External & internal deadlines |
| Contractors | `https://www.notion.so/2dbffe5c4f748140990fca536ce6cd57` | `collection://2dbffe5c-4f74-8141-99a0-000bea23b87b` | Contractor contacts/rates |
| Contractor Contracts | `https://www.notion.so/6118fdc71aae4d3184a32a306239baaa` | `collection://bd8af39e-2203-4b5e-b2b2-26ff71102094` | Contracts with rates |
| Applied AI Hours | `https://www.notion.so/2f4ffe5c4f74807393e2ebc90348a649` | `collection://2f4ffe5c-4f74-813e-89a1-000b73cac38b` | Weekly internal contractor hours |
| Public Workshops | `https://www.notion.so/2dbffe5c4f748165bf3adf7fa0b2063b` | `collection://2dbffe5c-4f74-8160-a091-000bb711a206` | Workshops (sign-ups, attendees) |
| Revenue Tasks (FDE) | `https://www.notion.so/847aa7ed358d4873a3c1f727b16a8731` | `collection://702ea0e8-44ff-4f79-9100-835bae9cdeb7` | Revenue & FDE action items |
| Content Calendar | `https://www.notion.so/2deffe5c4f74803c9bf1e7403e61b40c` | `collection://2deffe5c-4f74-80dc-922f-000b1796e689` | Content pipeline (YT, LinkedIn, blog) |
| Jobs Description | `https://www.notion.so/2feffe5c4f74803fb0a9ee462f3855fb` | `collection://2feffe5c-4f74-8072-9121-000b4b9be132` | Role definitions + rate bands |
| Candidates | `https://www.notion.so/328ffe5c4f74806094c9cb8cd62ba812` | `collection://328ffe5c-4f74-8042-95c3-000bc1216f02` | Hiring candidates |
| Sprints | `https://www.notion.so/67e3be48e3b949c49a49e815d4b74861` | `collection://80a64a19-007e-4a05-b620-03d5999d24f9` | Applied AI sprint planning |
| Product SKUs | `https://www.notion.so/2fcffe5c4f748054b992fd61c14c2b9b` | `collection://2fcffe5c-4f74-8058-9ec7-000b0eb3b7fd` | AGIVC product lines |
| Goals | `https://www.notion.so/9d114b6cd0e84bd3910c45a0b16fb460` | `collection://df88d5ad-004d-4ef2-ac4f-02cfab942dc1` | Quarterly product goals |
| Ideas | `https://www.notion.so/2dbffe5c4f7481398ee0f5d86fc3a2cb` | `collection://2dbffe5c-4f74-8188-af13-000b1dabbb9a` | Raw product/service ideas |
| Projects | `https://www.notion.so/a98ffe5c4f748248b51a81af4141c0b1` | `collection://a98ffe5c-4f74-8248-b51a-81af4141c0b1` | Project intel (architecture, data flows) |

Applied AI product workspace parent:
`https://www.notion.so/Applied-AI-2dbffe5c4f748120a971c42c6a7476b1`

## CRM relationship graph

```
Companies
└── Contacts (many per company)
    └── Opportunities (contacts ↔ deals)
        ├── Meetings (transcripts, notes)
        ├── Emails (synced from Gmail)
        ├── Lessons Learned (linked to Opps + Meetings)
        ├── Docs (proposals, SOWs, notes)
        ├── Invoices (billing)
        ├── Deliverables (outputs/milestones)
        ├── Projects (architecture, data flows, constraints)
        └── Contractor Contracts (contractors staffed on client work)

Pitches (Shape Up, Applied AI)
└── Deliverables (internal deadlines)

Contractors
└── Contractor Contracts
    ├── → Opportunity (client work)
    └── → Internal Project (AGIVC internal)

Applied AI Hours → internal contractor hours (payment)

Revenue Tasks (action items, NOT deliverables)
├── Deliverables (output this task produces)
├── Meetings
├── Sprints
├── Pitches
├── Ideas
├── Product SKUs
└── Content Calendar

Content Calendar → Product SKUs
Product SKUs → Pitches, Opportunities, Ideas, Content
Goals ↔ Sprints
Sprints → Pitches, Goals, Meetings
Ideas → Product SKUs, Meetings
```

## Key operational rules (from the live skill)

- **Bugs = pitches.** No separate Bugs DB; write bugs as Shape Up pitches in
  the Pitches DB. Pitch naming: `Pitch: Oatmeal - [Feature]`.
- **Meeting preps ≠ Deliverables ≠ Docs.** Save meeting preps to the
  **Opportunity Documents DB** with title
  `[MEETING PREP] Company - Title - Date`, Doc Type `Meeting Prep`.
- **Deliverables vs Revenue Tasks:** hand to a client → Deliverable. A step to
  get work done → Revenue Task.
- **Recent meetings:** fetch the Meetings DB directly sorted by Created time;
  don't rely on the Opportunity's Meetings relation (new meetings land there
  before being linked).
- **Set Owner** on every new record (task, content, deliverable) unless told
  otherwise.
- **Look people up in the CRM first** before asking the user who someone is.
- **MCP can't archive/delete** — that's manual in Notion UI. (`ntn pages trash`
  can trash a page.)
- **Document URL fields** (Invoices/Docs): use permanent links (e.g. Google
  Drive). Never temporary Zapier hydrate links, local paths, or S3 pre-signed
  URLs.
