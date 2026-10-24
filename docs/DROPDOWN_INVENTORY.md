# Dropdowns — where each one is configured

Every dropdown in Sabi falls into one of four groups. This file lists the fixed lists (the other two
groups configure themselves) and records the decision for each. Last reviewed 2026-10-22 (batches 1–4 done).

1. **Configurable** — the hospital edits the list under **Settings → Master Data** (or a settings screen
   of its own). The server checks saved values against the hospital's list.
2. **From records** — the options are the hospital's own records: staff, patients, wards and beds,
   accounts, vendors, customers, drugs, lab tests, departments… Change the records, the dropdown follows.
3. **Fixed on purpose** — a national standard, a reporting form, or a rule the system acts on. Making
   these editable would break returns or logic, so they stay in code.
4. **Next batches** — hospital wording still fixed in code, queued to move into Master Data.

## 1. Configurable

| List | Where | Who edits | Used by |
|---|---|---|---|
| Drug Categories | Master Data → EMR | Pharmacy, catalogue managers | Pharmacy catalogue, prescriber drug search |
| Drug Classes | Master Data → EMR | Pharmacy, catalogue managers | Formulary drugs (allergy and same-class checks) |
| Appointment Types | Master Data → EMR | Appointment managers | Appointments (an added type checks in at Vitals) |
| Patient Languages | Master Data → EMR | Catalogue managers | Registration |
| Transfer Reasons | Master Data → EMR | Catalogue managers | Transfers |
| Family Planning — Reasons for Stopping | Master Data → EMR | Catalogue managers | Family Planning ("Removal" is kept: removal visits record it) |
| Store Item Categories | Master Data → EMR | Stores managers | Inventory ("Drugs" posts to the drug inventory accounts) |
| Equipment Categories | Master Data → EMR | Equipment managers | Equipment |
| Prescription Rejection Reasons | Master Data → EMR | Pharmacy | Pharmacy review |
| Specimen Rejection Reasons | Master Data → EMR | Lab catalogue managers | Laboratory |
| NCD Conditions | Master Data → EMR | NCD clinic (ncd.enrol) | NCD programme (starter conditions are counted in NCD reports) |
| Outreach Activity Types | Master Data → EMR | Outreach recorders | Outreach |
| Receiving Accounts | Master Data → EMR | Billing cashiers | Billing payments |
| Inpatient Services | Master Data → EMR | Catalogue managers | Admissions, ward census |
| Policy Categories, Helpdesk Ticket Types, Recruitment Sources, Candidate Rejection Reasons, Talent Pool Skill Zones, Exit Reasons | Master Data → Workforce | HR | HR policies, Helpdesk, Recruitment, Talent Pool, Offboarding |
| Vendor Categories | Master Data → Accounting | Finance | Vendors ("Pharmaceuticals" vendors supply the pharmacy) |
| Letter Categories | Master Data → Platform | HR, hospital admin | Letter templates |
| HRIS role | HR → job positions | HR | HRIS (from records) |
| Ward Types, Bed Types, Lab Sample Types, Lab Stage Types | Master Data → EMR | Catalogue managers | Wards, Lab |
| Leave, Employment, Document, Certification, Query, Vacancy Types; Recruitment Statuses; Handover Items; Loan Types | Master Data → Workforce | HR | HR and Workforce screens |
| Identification Types | Master Data → Platform | Hospital admin | Registration, HR |
| Expense Categories | Master Data → Accounting | Hospital admin | Expenses |
| Diagnoses, patient categories | Settings (EMR catalogues) | Catalogue managers | Consultation, Registration |
| Lab tests | Laboratory → Lab Test Settings | Lab catalogue managers | Lab orders |
| Formulary | Pharmacy → Drug Catalogue | Pharmacy | Prescribing, dispensing |
| Chart of accounts, tax rates, approval rules | Accounting → Setup / Settings | Finance | Accounting |
| Departments, job positions | HR → Departments / Org setup | HR | HR, Workforce |
| Letter templates, terminology, workflows | Settings | Admin / HR | Platform |

## 3. Fixed on purpose

| Dropdown | Screens | Why it stays fixed |
|---|---|---|
| Sex (F/M) | Registration, Labour | NHMIS disaggregation |
| Blood group | Registration, Antenatal | Medical standard (ABO/Rh) |
| Priority (Routine / Urgent / Emergency / STAT); queue priority | Procedures, Radiology, Referrals, Ward round, Vitals, Queue | Drives queue order and alerts |
| Laterality (N/A / Left / Right / Bilateral) | Procedures, Radiology, Examination | Clinical standard |
| Condition and allergy statuses, criticality, reaction severity | Patient chart | FHIR value sets |
| Care-plan and task statuses | Patient chart, Ward round | Workflow states the system acts on |
| Booking status, mode of delivery, maternal and baby outcome | Labour & Delivery | NHMIS delivery register |
| Uterus, lochia, breast and breastfeeding findings | Postnatal | WHO postnatal checklist |
| Infant feeding, oedema grade, appetite test | Child Health, Nutrition | WHO growth and CMAM protocols |
| Family planning methods and visit types | Family Planning | NHMIS family planning register |
| Out-referral reasons, referral outcomes | Referrals | NHMIS referral register and its report |
| NCD control status, AEFI seriousness | NCD, Immunization | National programme reporting |
| Drug routes | Pharmacy | Prescribing safety checks |
| Lab result flags (Normal / Low / High / Critical) | Laboratory | Critical-result workflow |
| Calibration result, fault priority | Equipment | Maintenance rules |
| Payment methods | Billing, Accounting | Each maps to a ledger account |
| Depreciation methods, tax kinds, return types | Accounting | Accounting standards, FIRS returns |
| Who is paying (Out of Pocket, Government Scheme, NHIS, HMO, Corporate) | Registration | Drives billing and the receivables account; all five are now offered |
| Customer type | Accounting customers | Picks the receivables account (NHIS, HMO, patients) |
| Expense payment mode | Expenses | "Reimburse to staff" triggers the claimant rules |
| Mobility | Inpatient nursing | Standard assistance scale used in falls-risk assessment |
| Informant relationship | Birth notification | Statutory birth register |
| Asset return condition, reimbursement type, holiday scope, work location | HR, Workforce | Each drives a rule (asset status, leave encashment, holiday coverage, time policy) |
| Workflow operators and decisions | Workflow Builder | Engine logic |
| Pay frequency, time rounding, attendance source, day status | Workforce settings | Time and pay calculations |

## 4. Next batches

| Dropdown | Screen | Plan |
|---|---|---|
| Care-plan category | Consultation | New Master Data list (waiting: the Consultation screen has other uncommitted work in progress) |
