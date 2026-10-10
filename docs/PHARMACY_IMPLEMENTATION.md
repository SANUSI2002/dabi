# Sabi Pharmacy: portal, marketplace and platform oversight

Implementation date: 10 October 2026. This is an implemented, server-backed release, not a browser-fixture marketplace. Deployment confirmation is a separate release check; passing local tests does not prove the hosted environment or regulatory readiness.

## Commercial policies

| Tier | Commission on product subtotal | Delivery radius | Maximum branches |
| --- | ---: | ---: | ---: |
| 1 | 15% | 5 km | 1 |
| 2 | 20% | 7 km | 5 |
| 3 | 30% | 10 km | Uncapped by policy |

These are the owner's requested defaults. Authorized Command Center administrators can change tier name, rate, radius, branch limit, minimum order, delivery/pickup availability and enabled state. A reason and expected policy version are required. Existing orders retain their original commission/rate/version snapshot. Commission excludes delivery; automatic merchant settlement is not implemented in this release. The overlapping branch caps do not imply minimum branch counts: operations assigns the appropriate tier.

## Implemented workflows

### Pharmacy registration and independent approval

1. The pharmacy creates an owner Sabi ID at `/pharmacy/register`, providing business/contact details, requested tier, CAC identifier and superintendent pharmacist particulars. Consent records include a version and timestamp.
2. A single-use, 24-hour email verification link activates that identity. Tokens are hashed in the database; the secret travels in the URL fragment and is removed from browser history. Failed email delivery has a resend path. Passwords are never emailed.
3. The verified owner signs in and adds premises, coordinates, PCN licence number and expiry within its tier's branch cap.
4. Selecting a credential file starts upload automatically. There is no extra “Upload privately” step. Required evidence is CAC certificate, superintendent annual licence, superintendent appointment evidence, and a current PCN premises licence for every branch.
5. PDF/JPEG/PNG credentials enter private Supabase quarantine. The durable database screening queue sends pharmacy credential contents to Cloudmersive under the owner's explicit authorization. Patient records are excluded. Provider outages/quotas leave documents pending or failed, never clean. Attempts, leases, retries and scan provenance persist across restarts.
6. The owner submits and receives an explicit on-screen confirmation. Submission need not wait for malware screening. Staff sees the application and scan status in Command Center.
7. Recent-MFA platform reviewers can preview only clean, latest documents through 60-second signed private URLs. They independently check authenticity and record source, reference, findings and decision. Malware screening is not credential authentication. Failed scans have an audited retry action; infected/rejected files cannot be retried into approval or previewed.
8. Approval checks verified active owner, submission, current superintendent and premises licences, latest clean and authenticated evidence, an enabled tier and branch cap. Own-pharmacy approval is denied. Rejection/suspension has a recorded reason.
9. Licence/premises renewals preserve audit history, pause selling, invalidate old evidence decisions and require replacement documents and reapproval. Existing financial orders are not rewritten.

Pharmacy submission/decision email notices and automated licence-expiry reminders remain follow-up work; do not promise these emails from this release. Registration verification email is implemented.

### Catalogue and inventory

- Owners create branch-scoped stock with product name, optional generic name, NGN price, available quantity, category, description, product class and NAFDAC identifier where applicable.
- Medicines require a batch number and future expiry. Each batch is a separate inventory item; an existing batch's identity/expiry cannot be rewritten. Expired medicine stock is not public/reservable/dispensable.
- A JPEG/PNG product image is mandatory before marketplace submission. Images are decoded with pixel limits, resized/re-encoded and stripped of metadata. SVG, corrupt and oversized images are rejected. Credentials and patient records must never be used as public product images.
- Products start as private drafts. Command Center independently publishes eligible submissions or rejects them with findings. Changing image, product metadata or price returns a listing to draft and requires re-review. Withdrawal removes it from public shopping.
- Positive/negative stock adjustments are recorded with actor, reason, before/after balances, payload hash and idempotency key. Negative balances, stale quantities, mismatched retries and cross-pharmacy mutation are rejected. Held inventory is distinct from available inventory.
- Inventory-view staff invitations use existing Sabi team invitations. General staff has a read-only, tenant-scoped stock workspace; it does not acquire prescribing or dispensing powers.

### Telemedicine marketplace and checkout

- API-configured patient deployments show only the server's published, imaged, active and in-stock products from currently eligible pharmacy branches. There is no fallback to fixture products, ratings or fabricated promotions when the API fails or returns no products.
- Prescription-only medicines are excluded from the public promotional catalogue. They use issued prescriptions and pharmacist quotations.
- Patient storefront/cart uses actual listing and branch IDs. One branch of a pharmacy per checkout is enforced both client-side and server-side. Multiple pharmacies can contribute fulfilments.
- Marketplace stock reservations use the existing payment/order pipeline without fabricating prescriptions. Server-calculated price snapshots, atomic decrements, deterministic locking and idempotency protect concurrent last-unit purchases and client price tampering. Holds last 20 minutes before conversion to an order.
- Checkout revalidates pharmacy/branch/licence/stock eligibility, minimum order, pickup/delivery policy and branch-to-customer delivery radius. Delivery data follows the existing encryption path. Commissions are captured as immutable order fulfilment snapshots.
- Existing Paystack initialization and verified webhook processing determine payment state. Browser success alone never means paid. Real provider/settlement certification is not implied by synthetic tests.

### Prescription requests and dispensing

- An active, separately verified pharmacist is explicitly invited and accepts the pharmacy membership. Organization ownership alone does not grant clinical access.
- Pharmacists see only the prescriptions explicitly requested from their pharmacy, not a patient's entire chart. They quote matching current stock and prescribed quantities; foreign inventory, duplicate prescription lines and invalid totals are rejected.
- Patients receive quotes through the existing prescription quote flow, reserve stock and create priced orders.
- Dispensing approval requires a paid fulfilment, active verified pharmacist membership, current premises/superintendent licences, and safe matching batch stock. Approval, preparation and ready-for-pickup transitions are audited. Suspended profiles, expired stock and non-pharmacist owners are denied.

## Command Center global oversight

`/command-center/users` shows paginated/searchable accounts, account state, platform roles and tenant memberships. Filters cover patient, doctor, pharmacy, hospital and platform users; the all-users directory also includes other professional disciplines. It excludes password hashes, sessions, tokens, storage keys and clinical charts.

User lifecycle actions support suspend, disable, ban and eligible restore. These require `platform.users.manage`, recent MFA, an expected account state and a reason. Self-lockout and removal of the last active platform administrator are denied. Sessions and refresh credentials are revoked; restoring an account never resurrects old sessions. Account suspension is distinct from pharmacy compliance suspension or clinical-professional credential suspension.

## Main API boundaries

| Root | Responsibility |
| --- | --- |
| `/api/v1/pharmacy-portal` | Registration/email verification, workspaces, private owner operations, licences, branch catalogue, stock adjustments, team invitations and pharmacist requests |
| `/api/v1/marketplace` | Public eligible catalogue/images and authenticated patient stock reservations |
| `/api/v1/platform/pharmacies` | MFA-protected tier policies, evidence review, scan retry, compliance decisions and marketplace listing moderation |
| `/api/v1/platform/users` | MFA-protected account directory and lifecycle decisions |
| Existing prescription/reservation/order/payment/fulfilment APIs | Patient quotations, stock holds, payment state and verified pharmacist fulfilment transitions |

The frontend and backend remain in their existing separate repositories. The additive migration is `20261010120000_pharmacy_marketplace`; it seeds tier policies only, never fabricated pharmacies/products or automatic approvals. API-configured deployments use live identity; the existing local-storage demo remains isolated and unchanged.

## Verification and acceptance evidence

Automated tests use fake people, synthetic files and embedded PostgreSQL, never the live database or real payments.

- Backend unit/regression suite: 834 tests passed.
- Frontend regression suite: 434 tests passed, including the five live marketplace cases.
- Embedded PostgreSQL full suite: 230 tests passed before the final end-to-end/staff test additions; focused pharmacy suite subsequently passed all 19 tests.
- Eleven scanner/policy cases cover clean promotion, infected/rejected blocking, hash verification, stale scan leases, provider backoff, image sanitization and invalid image rejection.
- Pharmacy, Command Center and telemedicine production builds succeeded.
- Database cases include exact tier seeding, branch caps, foreign-tenant denial, approval gates, user-directory privacy, self/last-admin protection, session revocation, optimistic updates, required images/POM exclusion, out-of-stock races, client-price tampering, idempotent stock changes, expiry/radius enforcement and mandatory re-review after renewal.
- The end-to-end synthetic prescription case covers pharmacist invitation/acceptance, quote, patient reservation, priced order/commission, unpaid denial, owner denial, expired-stock denial, dispensing approval, preparation and readiness. Paid state is synthetic; no payment provider was called.

## Remaining release work and operational risks

Do not equate this implementation with complete commercial/regulatory certification. Remaining work:

1. Automated merchant payouts, settlement reconciliation and provider-executed refunds. Rejected paid fulfilments currently create refund review cases, not executed refunds.
2. Reconcile abandoned **converted** unpaid orders against Paystack, with late-success handling before releasing stock. Existing active reservation expiry and payment failure webhook release do not cover every abandoned converted-order scenario. Do not implement blind expiry that could sell stock already paid for.
3. Clarification-request resolution and full courier pickup/delivery proof workflows, customer dispute/return controls and corresponding portal actions.
4. Multi-lot FEFO allocation, recall tracking, cold-chain handling and controlled-medicine policies. Separate batch inventory/expiry checks are not a complete dispensary stock-management certification.
5. Approval/rejection/submission email outbox, pharmacy team roster/revocation UX, expiry reminders, opening-hour settings and deeper operational reporting.
6. Global catalogue search/geographic indexing and pagination beyond current page filtering; high-volume clinical queue pagination, images served through dedicated scalable media infrastructure and load testing.
7. Backed-up database, verified restore drill, monitoring/alerts, data retention/deletion schedule, audited document retention, provider contracts and third-party data-processing assessment. The existing hosted database is still the owner's previously approved disposable test release.
8. Resolve remaining dependency audit findings (not by blindly downgrading Prisma), and run hosted end-to-end onboarding/preview and payment-provider sandbox acceptance with authorized accounts.
9. Nigerian legal/regulatory review for operating an internet pharmacy, product classification, permitted promotion and pharmacist responsibilities before claiming legal authorization or a nationwide compliant commercial launch.

## Primary research references

PCN's current [2025 pharmacist and pharmaceutical premises registration guidelines](https://pcn.gov.ng/wp-content/uploads/2025/03/Guidelines_for_Registration_of_Pharmacists_and_Pharmaceutical_Premises.pdf) support checking licensed premises, pharmacist annual licences, CAC/company and superintendent appointment evidence. Sabi's uploaded-document checklist is platform due diligence, not a replacement PCN registration process.

NAFDAC's [medical product advertising guidelines](https://www.nafdac.gov.ng/wp-content/uploads/Files/Resources/Guidelines/DR_And_R_Guidelines/Guidelines-For-Advertisement-Of-Medical-Products-Cosmetics-Veterinary-Products-And-Finished-Chemicals.pdf) inform the non-promotional prescription-only pathway and the need for registered-product and advertising review. Platform publication is not NAFDAC advertisement approval.

PCN's published [Electronic Pharmacy Regulations document](https://pcn.gov.ng/wp-content/uploads/2025/02/Electronic-Pharmacy-Regulations.pdf) is marked draft. It must not be represented as enacted law. Obtain current advice on online dispensing authorization rather than assuming premises registration alone authorizes every online activity.
