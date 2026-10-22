# Dropdowns — where each one is configured

Every dropdown in Sabi falls into one of four groups. This file lists the fixed lists (the other two
groups configure themselves) and records the decision for each. Last reviewed 2026-10-22.

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
| Workflow operators and decisions | Workflow Builder | Engine logic |
| Pay frequency, time rounding, attendance source, day status | Workforce settings | Time and pay calculations |

## 4. Next batches

| Dropdown | Screen | Plan |
|---|---|---|
| Payment scheme (Out of Pocket / Government Scheme / NHIS) | Registration | Use the patient categories list |
| Receiving account | Billing invoice | Use Accounting's bank and cash accounts |
| NCD condition | NCD | Use the diagnoses catalogue |
| Cadre | HRIS | Use HR job positions |
| Care-plan category | Consultation | New Master Data list |
| Inpatient service, mobility | Inpatient | New Master Data lists |
| Informant relationship | Labour (birth notification) | New Master Data list |
| Outreach activity type | Outreach | New Master Data list |
| Helpdesk ticket types, policy categories, exit reasons | HR | New lists (policy categories have a database check to lift) |
| Recruitment source, rejection reasons, skill zones | Recruitment | New Master Data lists |
| Asset return condition | Company Assets | New Master Data list |
| Reimbursement types, work locations, holiday scope | Payroll, Workforce | New lists (reimbursement types have a database check to lift) |
| Vendor categories, customer types | Accounting | New lists (both have database checks; customer type drives receivables) |
| Expense payment modes, receipt methods | Accounting | Review with payment methods |
| Letter template categories | Letter Templates | New list (database check to lift) |
