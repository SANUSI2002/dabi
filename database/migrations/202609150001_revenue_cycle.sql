BEGIN;

CREATE SCHEMA IF NOT EXISTS billing;

CREATE OR REPLACE FUNCTION billing.current_organization_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.organization_id', true), '');
$$;

CREATE OR REPLACE FUNCTION billing.branch_allowed(candidate text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT billing.current_organization_id() IS NOT NULL
    AND NULLIF(current_setting('app.branch_ids', true), '') IS NOT NULL
    AND (
      current_setting('app.branch_ids', true) = '*'
      OR candidate = ANY(string_to_array(current_setting('app.branch_ids', true), ','))
    );
$$;

CREATE TABLE billing.document_sequences (
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  document_kind text NOT NULL CHECK (document_kind IN ('ACCOUNT', 'INVOICE', 'RECEIPT')),
  document_year integer NOT NULL CHECK (document_year BETWEEN 2000 AND 9999),
  last_value bigint NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (organization_id, branch_id, document_kind, document_year)
);

CREATE TABLE billing.patient_accounts (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  number text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  appointment_id text,
  visit_type text NOT NULL,
  attending_provider text,
  payer text NOT NULL,
  currency varchar(3) NOT NULL,
  financial_status text NOT NULL CHECK (financial_status IN (
    'OPEN', 'ACCUMULATING_CHARGES', 'READY_TO_BILL', 'PARTIALLY_INVOICED', 'INVOICED',
    'PARTIALLY_PAID', 'PAID', 'CREDIT_BALANCE', 'ON_HOLD', 'WRITTEN_OFF', 'FINANCIALLY_CLOSED'
  )),
  readiness_reasons jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(readiness_reasons) = 'array'),
  opened_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, branch_id, number),
  UNIQUE (organization_id, encounter_id)
);

CREATE TABLE billing.service_catalog (
  id text NOT NULL,
  organization_id text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(aliases) = 'array'),
  department text NOT NULL,
  category text NOT NULL,
  revenue_account_code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, code)
);

CREATE TABLE billing.price_versions (
  id text NOT NULL,
  organization_id text NOT NULL,
  service_id text NOT NULL,
  price_list_id text NOT NULL,
  payer_type text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency varchar(3) NOT NULL,
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, service_id) REFERENCES billing.service_catalog (organization_id, id),
  CHECK (effective_until IS NULL OR effective_until > effective_from),
  UNIQUE (organization_id, service_id, price_list_id, payer_type, effective_from)
);

CREATE TABLE billing.charge_items (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  account_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN (
    'CONSULTATION', 'LABORATORY', 'PHARMACY', 'RADIOLOGY', 'PROCEDURE', 'WARD',
    'NURSING', 'CONSUMABLE', 'MIGRATION', 'OTHER'
  )),
  source_id text NOT NULL,
  source_event_id text NOT NULL,
  idempotency_key text NOT NULL,
  service_id text NOT NULL,
  service_code text NOT NULL,
  description text NOT NULL,
  department text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor >= 0),
  currency varchar(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('BILLABLE', 'HELD', 'INVOICED', 'PAID', 'VOIDED', 'REVERSED', 'ENTERED_IN_ERROR')),
  performed_by text NOT NULL,
  performed_at timestamptz NOT NULL,
  price_list_id text NOT NULL,
  price_version_id text NOT NULL,
  invoice_id text,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, idempotency_key),
  UNIQUE (organization_id, source_type, source_event_id),
  FOREIGN KEY (organization_id, account_id) REFERENCES billing.patient_accounts (organization_id, id),
  FOREIGN KEY (organization_id, service_id) REFERENCES billing.service_catalog (organization_id, id),
  FOREIGN KEY (organization_id, price_version_id) REFERENCES billing.price_versions (organization_id, id),
  CHECK (gross_amount_minor = unit_price_minor * quantity),
  CHECK (net_amount_minor = gross_amount_minor - discount_amount_minor),
  CHECK (discount_amount_minor <= gross_amount_minor)
);

CREATE TABLE billing.charge_exceptions (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  idempotency_key text NOT NULL,
  source_event_id text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text,
  reason text NOT NULL CHECK (reason IN ('MISSING_PRICE', 'DUPLICATE_SUSPECTED', 'MISSING_ACCOUNT', 'INVALID_SERVICE', 'INVALID_QUANTITY')),
  detail text NOT NULL,
  status text NOT NULL CHECK (status IN ('NEEDS_REVIEW', 'RESOLVED')),
  created_at timestamptz NOT NULL,
  resolved_at timestamptz,
  resolved_by text,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE billing.invoices (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  number text NOT NULL,
  idempotency_key text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  account_id text NOT NULL,
  payer text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED', 'CREDITED')),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  paid_minor bigint NOT NULL DEFAULT 0 CHECK (paid_minor >= 0),
  balance_minor bigint NOT NULL CHECK (balance_minor >= 0),
  currency varchar(3) NOT NULL,
  issued_at timestamptz NOT NULL,
  due_at timestamptz,
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, branch_id, number),
  UNIQUE (organization_id, idempotency_key),
  FOREIGN KEY (organization_id, account_id) REFERENCES billing.patient_accounts (organization_id, id),
  CHECK (total_minor = subtotal_minor - discount_minor + tax_minor),
  CHECK (balance_minor = total_minor - paid_minor),
  CHECK (paid_minor <= total_minor),
  CHECK (due_at IS NULL OR due_at >= issued_at)
);

ALTER TABLE billing.charge_items
  ADD CONSTRAINT charge_items_invoice_fk
  FOREIGN KEY (organization_id, invoice_id) REFERENCES billing.invoices (organization_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE billing.invoice_lines (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  invoice_id text NOT NULL,
  charge_item_id text NOT NULL,
  service_code text NOT NULL,
  description text NOT NULL,
  department text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_minor bigint NOT NULL CHECK (unit_price_minor >= 0),
  gross_amount_minor bigint NOT NULL CHECK (gross_amount_minor >= 0),
  discount_amount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_amount_minor >= 0),
  net_amount_minor bigint NOT NULL CHECK (net_amount_minor >= 0),
  service_date timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, charge_item_id),
  FOREIGN KEY (organization_id, invoice_id) REFERENCES billing.invoices (organization_id, id),
  FOREIGN KEY (organization_id, charge_item_id) REFERENCES billing.charge_items (organization_id, id),
  CHECK (gross_amount_minor = unit_price_minor * quantity),
  CHECK (net_amount_minor = gross_amount_minor - discount_amount_minor)
);

CREATE TABLE billing.payments (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  patient_id text NOT NULL,
  account_id text NOT NULL,
  idempotency_key text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL,
  method text NOT NULL CHECK (method IN ('CASH', 'CARD_POS', 'BANK_TRANSFER', 'MOBILE_MONEY', 'INSURANCE', 'OTHER')),
  payment_date timestamptz NOT NULL,
  reference text,
  receiving_account text NOT NULL,
  notes text,
  received_by text NOT NULL,
  status text NOT NULL CHECK (status IN ('SUCCEEDED', 'REVERSED', 'VOIDED', 'REFUNDED')),
  correlation_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, idempotency_key),
  FOREIGN KEY (organization_id, account_id) REFERENCES billing.patient_accounts (organization_id, id)
);

CREATE TABLE billing.payment_allocations (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  payment_id text NOT NULL,
  invoice_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, payment_id, invoice_id),
  FOREIGN KEY (organization_id, payment_id) REFERENCES billing.payments (organization_id, id),
  FOREIGN KEY (organization_id, invoice_id) REFERENCES billing.invoices (organization_id, id)
);

CREATE TABLE billing.receipts (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  number text NOT NULL,
  payment_id text NOT NULL,
  invoice_id text NOT NULL,
  patient_id text NOT NULL,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency varchar(3) NOT NULL,
  issued_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, branch_id, number),
  UNIQUE (organization_id, payment_id),
  FOREIGN KEY (organization_id, payment_id) REFERENCES billing.payments (organization_id, id),
  FOREIGN KEY (organization_id, invoice_id) REFERENCES billing.invoices (organization_id, id)
);

CREATE TABLE billing.audit_events (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  actor_id text NOT NULL,
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  patient_id text NOT NULL,
  encounter_id text NOT NULL,
  account_id text NOT NULL,
  resource_type text NOT NULL CHECK (resource_type IN ('PATIENT_ACCOUNT', 'CHARGE', 'INVOICE', 'PAYMENT', 'ALLOCATION', 'RECEIPT')),
  resource_id text NOT NULL,
  action text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  occurred_at timestamptz NOT NULL,
  correlation_id text NOT NULL,
  PRIMARY KEY (organization_id, id),
  FOREIGN KEY (organization_id, account_id) REFERENCES billing.patient_accounts (organization_id, id)
);

CREATE TABLE billing.outbox_events (
  id text NOT NULL,
  organization_id text NOT NULL,
  branch_id text NOT NULL,
  aggregate_type text NOT NULL CHECK (aggregate_type IN ('INVOICE', 'PAYMENT')),
  aggregate_id text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('REVENUE_INVOICE_ISSUED', 'REVENUE_PAYMENT_RECORDED')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  correlation_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  last_error text,
  PRIMARY KEY (organization_id, id),
  UNIQUE (organization_id, event_type, aggregate_id)
);

CREATE INDEX patient_accounts_patient_idx ON billing.patient_accounts (organization_id, patient_id, opened_at DESC);
CREATE INDEX charge_items_account_status_idx ON billing.charge_items (organization_id, account_id, status, performed_at);
CREATE INDEX charge_items_encounter_idx ON billing.charge_items (organization_id, encounter_id, performed_at);
CREATE INDEX invoices_account_status_idx ON billing.invoices (organization_id, account_id, status, issued_at DESC);
CREATE INDEX payments_account_date_idx ON billing.payments (organization_id, account_id, payment_date DESC);
CREATE INDEX allocations_invoice_idx ON billing.payment_allocations (organization_id, invoice_id, created_at);
CREATE INDEX audit_patient_time_idx ON billing.audit_events (organization_id, patient_id, occurred_at DESC);
CREATE INDEX audit_resource_idx ON billing.audit_events (organization_id, resource_type, resource_id, occurred_at);
CREATE INDEX outbox_delivery_idx ON billing.outbox_events (status, available_at, occurred_at) WHERE status IN ('PENDING', 'FAILED');

CREATE OR REPLACE FUNCTION billing.next_document_number(
  requested_organization_id text,
  requested_branch_id text,
  requested_kind text,
  requested_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  requested_year integer := extract(year from requested_at)::integer;
  sequence_value bigint;
  prefix text;
BEGIN
  IF requested_organization_id IS DISTINCT FROM billing.current_organization_id()
    OR NOT billing.branch_allowed(requested_branch_id) THEN
    RAISE EXCEPTION 'tenant context does not permit document sequence access' USING ERRCODE = '42501';
  END IF;
  prefix := CASE requested_kind WHEN 'ACCOUNT' THEN 'ACC' WHEN 'INVOICE' THEN 'INV' WHEN 'RECEIPT' THEN 'REC' END;
  IF prefix IS NULL THEN RAISE EXCEPTION 'unsupported document kind: %', requested_kind USING ERRCODE = '22023'; END IF;

  INSERT INTO billing.document_sequences (organization_id, branch_id, document_kind, document_year, last_value)
  VALUES (requested_organization_id, requested_branch_id, requested_kind, requested_year, 1)
  ON CONFLICT (organization_id, branch_id, document_kind, document_year)
  DO UPDATE SET last_value = billing.document_sequences.last_value + 1
  RETURNING last_value INTO sequence_value;

  RETURN prefix || '/' || requested_year || '/' || lpad(sequence_value::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION billing.lock_idempotency_key(requested_organization_id text, idempotency_key text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF requested_organization_id IS DISTINCT FROM billing.current_organization_id() THEN
    RAISE EXCEPTION 'tenant context does not permit idempotency lock access' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_organization_id || ':idem:' || idempotency_key, 0));
END;
$$;

CREATE OR REPLACE FUNCTION billing.lock_encounter_account_key(requested_organization_id text, encounter_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF requested_organization_id IS DISTINCT FROM billing.current_organization_id() THEN
    RAISE EXCEPTION 'tenant context does not permit encounter lock access' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(requested_organization_id || ':encounter:' || encounter_id, 0));
END;
$$;

CREATE OR REPLACE FUNCTION billing.reject_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; create a reversal record instead', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION billing.reject_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'financial records cannot be deleted from %', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER payments_immutable BEFORE UPDATE OR DELETE ON billing.payments FOR EACH ROW EXECUTE FUNCTION billing.reject_change();
CREATE TRIGGER allocations_immutable BEFORE UPDATE OR DELETE ON billing.payment_allocations FOR EACH ROW EXECUTE FUNCTION billing.reject_change();
CREATE TRIGGER receipts_immutable BEFORE UPDATE OR DELETE ON billing.receipts FOR EACH ROW EXECUTE FUNCTION billing.reject_change();
CREATE TRIGGER invoice_lines_immutable BEFORE UPDATE OR DELETE ON billing.invoice_lines FOR EACH ROW EXECUTE FUNCTION billing.reject_change();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON billing.audit_events FOR EACH ROW EXECUTE FUNCTION billing.reject_change();
CREATE TRIGGER patient_accounts_no_delete BEFORE DELETE ON billing.patient_accounts FOR EACH ROW EXECUTE FUNCTION billing.reject_delete();
CREATE TRIGGER charges_no_delete BEFORE DELETE ON billing.charge_items FOR EACH ROW EXECUTE FUNCTION billing.reject_delete();
CREATE TRIGGER invoices_no_delete BEFORE DELETE ON billing.invoices FOR EACH ROW EXECUTE FUNCTION billing.reject_delete();
CREATE TRIGGER exceptions_no_delete BEFORE DELETE ON billing.charge_exceptions FOR EACH ROW EXECUTE FUNCTION billing.reject_delete();
CREATE TRIGGER outbox_no_delete BEFORE DELETE ON billing.outbox_events FOR EACH ROW EXECUTE FUNCTION billing.reject_delete();

ALTER TABLE billing.document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.service_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.patient_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.charge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.charge_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.outbox_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE billing.document_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.service_catalog FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.price_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.patient_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.charge_items FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.charge_exceptions FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.invoice_lines FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.payments FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.payment_allocations FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE billing.outbox_events FORCE ROW LEVEL SECURITY;

CREATE POLICY document_sequences_tenant ON billing.document_sequences USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY service_catalog_tenant ON billing.service_catalog USING (organization_id = billing.current_organization_id()) WITH CHECK (organization_id = billing.current_organization_id());
CREATE POLICY price_versions_tenant ON billing.price_versions USING (organization_id = billing.current_organization_id()) WITH CHECK (organization_id = billing.current_organization_id());
CREATE POLICY patient_accounts_tenant ON billing.patient_accounts USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY charge_items_tenant ON billing.charge_items USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY charge_exceptions_tenant ON billing.charge_exceptions USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY invoices_tenant ON billing.invoices USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY invoice_lines_tenant ON billing.invoice_lines USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY payments_tenant ON billing.payments USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY payment_allocations_tenant ON billing.payment_allocations USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY receipts_tenant ON billing.receipts USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY audit_events_tenant ON billing.audit_events USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));
CREATE POLICY outbox_events_tenant ON billing.outbox_events USING (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id)) WITH CHECK (organization_id = billing.current_organization_id() AND billing.branch_allowed(branch_id));

COMMIT;
