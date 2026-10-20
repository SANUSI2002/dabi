import { useEffect, useState } from "react";
import {
  CommandButton,
  CommandInput,
  Panel,
  PanelHeader,
} from "../components/ui";
import { ccGet, ccPost, qs } from "./api";
import {
  ActionDialog,
  Empty,
  ErrorBox,
  Loading,
  Table,
  Td,
  useCc,
  useFormat,
  useLoad,
  type ActionDialogProps,
} from "./kit";
type Settings = Record<string, string | number>;
type Policy = {
  version: number;
  settings: Settings;
  nextWindows?: { requestEnd: string; tokenEnd: string };
};
type Balance = {
  userId: string;
  accountVersion: number;
  plan: string;
  overrides: { dailyRequests: number | null; tokenAllowance: number | null };
  requests: {
    limit: number;
    used: number;
    remaining: number;
    resetsAt: string;
  };
  tokens: {
    allocated: number;
    used: number;
    reserved: number;
    remaining: number;
    resetsAt: string;
    status: string;
  };
  ledger?: {
    id: string;
    type: string;
    usedDelta: number;
    reservedDelta: number;
    bonusDelta: number;
    createdAt: string;
  }[];
  uncertainReservations?: { id: string; reservedTokens: number }[];
};
type Account = {
  id: string;
  email: string | null;
  full_name: string | null;
  accountStatus: string;
  allowance: Balance;
};
const fields: [string, string, number, number][] = [
  ["personalDailyRequests", "Personal requests per day", 0, 10000],
  ["personalTokenAllowance", "Personal tokens per period", 0, 10000000],
  ["professionalDailyRequests", "Professional requests per day", 0, 10000],
  ["professionalTokenAllowance", "Professional tokens per period", 0, 10000000],
  ["maxTokensPerRequest", "Maximum total tokens per request", 128, 64000],
  ["maxOutputTokens", "Maximum output tokens per response", 128, 2048],
  ["globalDailyRequests", "Shared service requests per day", 0, 1000000],
  ["globalTotalRequests", "Cumulative service request limit", 0, 10000000],
  ["warningPercent", "Low-token warning threshold (%)", 1, 99],
  ["monthlyResetDay", "Monthly reset day", 1, 28],
];
const control =
  "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";
const number = (n: number) => n.toLocaleString("en-NG");
export default function AiAllocationPanel() {
  const { can } = useCc();
  const format = useFormat();
  const manage = can("platform.settings.manage");
  const policy = useLoad(() => ccGet<Policy>("/ai/allowances"), []);
  const [draft, setDraft] = useState<Settings | null>(null),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  useEffect(() => {
    if (policy.data?.settings) {
      setDraft(policy.data.settings);
      setErrors({});
    }
  }, [policy.data]);
  function validate(s: Settings) {
    const e: Record<string, string> = {};
    for (const [k, label, min, max] of fields)
      if (!Number.isInteger(s[k]) || Number(s[k]) < min || Number(s[k]) > max)
        e[k] = `${label}: enter a whole number from ${min} to ${number(max)}.`;
    if (Number(s.maxOutputTokens) > Number(s.maxTokensPerRequest))
      e.maxOutputTokens =
        "Output limit cannot exceed the total per-request limit.";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.resetTime)))
      e.resetTime = "Choose a valid reset time.";
    return e;
  }
  function numeric(k: string) {
    const [, label, min, max] = fields.find(([key]) => key === k)!;
    return (
      <label
        key={k}
        htmlFor={`allocation-${k}`}
        className="grid content-start gap-2 text-sm font-semibold"
      >
        {label}
        <input
          id={`allocation-${k}`}
          className={control}
          type="number"
          min={min}
          max={max}
          step="1"
          required
          disabled={!manage}
          value={Number.isNaN(draft?.[k]) ? "" : (draft?.[k] ?? "")}
          aria-invalid={!!errors[k]}
          aria-describedby={errors[k] ? `allocation-error-${k}` : undefined}
          onChange={(e) =>
            setDraft(
              (old) =>
                old && {
                  ...old,
                  [k]: e.target.value === "" ? NaN : Number(e.target.value),
                },
            )
          }
          onBlur={() => draft && setErrors(validate(draft))}
        />
        {errors[k] && (
          <span
            id={`allocation-error-${k}`}
            className="font-normal text-red-700"
          >
            {errors[k]}
          </span>
        )}
      </label>
    );
  }
  function save() {
    if (!draft || !policy.data) return;
    const e = validate(draft);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`allocation-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    const settings = { ...draft },
      expectedVersion = policy.data.version;
    setDialog({
      title: "Publish AI allocation settings?",
      confirm: "Publish allocation policy",
      fields: [],
      description: `Personal: ${settings.personalTokenAllowance} tokens, ${settings.personalDailyRequests} requests/day. Professional: ${settings.professionalTokenAllowance} tokens, ${settings.professionalDailyRequests} requests/day. Token reset: ${settings.tokenResetCadence} at ${settings.resetTime} (${settings.timeZone}). Existing usage and open reset boundaries are preserved. New schedules take effect on renewal. No payment is charged.`,
      run: (v) =>
        ccPost("/ai/allowances/policy", {
          expectedVersion,
          settings,
          reason: v.reason,
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        setNotice(
          "AI allocation policy published. Existing usage was preserved.",
        );
        policy.reload();
      },
    });
  }
  return (
    <div className="mt-5 space-y-5">
      <Panel>
        <PanelHeader
          title="Token allocations & reset schedules"
          description="One allowance per Sabi account, shared across every AI workspace."
          action={
            <CommandButton
              className="min-h-11"
              variant="secondary"
              onClick={policy.reload}
            >
              Reload allocation settings
            </CommandButton>
          }
        />
        <ErrorBox error={policy.error} retry={policy.reload} />
        {policy.loading && !draft ? (
          <Loading />
        ) : (
          draft && (
            <form
              className="space-y-6 p-5"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2">
                <legend className="mb-3 text-sm font-bold">
                  Default user allowances
                </legend>
                {fields.slice(0, 4).map(([k]) => numeric(k))}
              </fieldset>
              <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <legend className="mb-3 text-sm font-bold">
                  Renewal schedule
                </legend>
                <label className="grid content-start gap-2 text-sm font-semibold">
                  Token reset frequency
                  <select
                    className={control}
                    value={draft.tokenResetCadence}
                    disabled={!manage}
                    onChange={(e) =>
                      setDraft({ ...draft, tokenResetCadence: e.target.value })
                    }
                  >
                    <option value="DAILY">Daily</option>
                    <option value="MONTHLY">Monthly</option>
                  </select>
                </label>
                <label className="grid content-start gap-2 text-sm font-semibold">
                  Reset time
                  <input
                    className={control}
                    type="time"
                    aria-label="Reset time"
                    aria-describedby="ai-reset-time-hint"
                    required
                    value={draft.resetTime}
                    disabled={!manage}
                    onChange={(e) =>
                      setDraft({ ...draft, resetTime: e.target.value })
                    }
                  />
                  <span id="ai-reset-time-hint" className="text-xs font-normal text-slate-600">
                    Daily requests always reset at this time.
                  </span>
                </label>
                <label className="grid content-start gap-2 text-sm font-semibold">
                  Reset timezone
                  <select
                    className={control}
                    value={draft.timeZone}
                    disabled={!manage}
                    onChange={(e) =>
                      setDraft({ ...draft, timeZone: e.target.value })
                    }
                  >
                    {[
                      "UTC",
                      "Africa/Lagos",
                      "Europe/London",
                      "America/New_York",
                      "Asia/Dubai",
                    ].map((z) => (
                      <option key={z}>{z}</option>
                    ))}
                  </select>
                </label>
                {draft.tokenResetCadence === "MONTHLY" &&
                  numeric("monthlyResetDay")}
              </fieldset>
              <fieldset className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <legend className="mb-3 text-sm font-bold">
                  Request bounds & service safeguards
                </legend>
                {fields.slice(4, 9).map(([k]) => numeric(k))}
              </fieldset>
              <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Tokens include prompts, conversation context, input and
                generated output. Work is reserved before generation and settled
                against provider-reported usage. Failed/cancelled requests use
                the daily request allowance; uncertain provider work stays
                reserved for reconciliation. Unused tokens expire without
                rollover. Zero stops new requests. These limits are not a cloud
                spending cap.
              </p>
              {policy.data?.nextWindows && (
                <p className="text-sm text-slate-600">
                  Current schedule preview — requests:{" "}
                  {format.dateTime(policy.data.nextWindows.requestEnd)}; tokens:{" "}
                  {format.dateTime(policy.data.nextWindows.tokenEnd)} (your
                  display timezone).
                </p>
              )}
              {!!Object.keys(errors).length && (
                <p role="alert" className="text-sm text-red-700">
                  Correct the highlighted fields before publishing.
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
                >
                  {notice}
                </p>
              )}
              {manage && (
                <CommandButton className="min-h-11" type="submit">
                  Review & publish allocations
                </CommandButton>
              )}
            </form>
          )
        )}
      </Panel>
      {manage && <UserAllocations />}
      {dialog && <ActionDialog {...dialog} />}
    </div>
  );
}
function UserAllocations() {
  const [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [selected, setSelected] = useState<string | null>(null);
  const users = useLoad(
    () =>
      ccGet<{ items: Account[]; total: number }>(
        `/ai/allowances/users${qs({ q: search, offset, limit: 20 })}`,
      ),
    [search, offset],
  );
  return (
    <>
      <Panel>
        <PanelHeader
          title="Individual account allocations"
          description="Overrides change AI allowances, never clinical permissions."
        />
        <form
          className="flex flex-wrap gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(query.trim());
            setOffset(0);
            users.reload();
          }}
        >
          <label className="grid min-w-0 flex-1 gap-1 text-sm">
            Name, email or user ID
            <CommandInput
              className="min-h-11 w-full"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find an account"
            />
          </label>
          <CommandButton className="min-h-11 self-end" type="submit">
            Find accounts
          </CommandButton>
        </form>
        <ErrorBox error={users.error} retry={users.reload} />
        {users.loading ? (
          <Loading label="Loading account balances…" />
        ) : users.data?.items.length ? (
          <Table
            head={[
              "Account",
              "Used / allocated",
              "Reserved / remaining",
              "Requests today",
              "State",
              "",
            ]}
          >
            {users.data.items.map((u) => (
              <tr key={u.id}>
                <Td>
                  <p className="font-semibold">
                    {u.full_name || "Sabi account"}
                  </p>
                  <p className="break-all text-xs text-slate-600">
                    {u.email || u.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {u.allowance.plan} · {u.accountStatus}
                  </p>
                </Td>
                <Td>
                  {number(u.allowance.tokens.used)} /{" "}
                  {number(u.allowance.tokens.allocated)}
                </Td>
                <Td>
                  {number(u.allowance.tokens.reserved)} /{" "}
                  {number(u.allowance.tokens.remaining)}
                </Td>
                <Td>
                  {u.allowance.requests.used} / {u.allowance.requests.limit}
                </Td>
                <Td>{u.allowance.tokens.status}</Td>
                <Td>
                  <CommandButton
                    className="min-h-11"
                    variant="secondary"
                    onClick={() => setSelected(u.id)}
                  >
                    Manage allocation
                  </CommandButton>
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="No matching accounts" />
        )}
        {users.data && (
          <div className="flex items-center justify-between gap-3 p-4 text-sm">
            <span>{users.data.total} accounts</span>
            <div className="flex gap-2">
              <CommandButton
                variant="secondary"
                disabled={!offset}
                onClick={() => setOffset((n) => Math.max(0, n - 20))}
              >
                Previous accounts
              </CommandButton>
              <CommandButton
                variant="secondary"
                disabled={offset + 20 >= users.data.total}
                onClick={() => setOffset((n) => n + 20)}
              >
                Next accounts
              </CommandButton>
            </div>
          </div>
        )}
      </Panel>
      {selected && (
        <UserAllocation
          key={selected}
          id={selected}
          onClose={() => setSelected(null)}
          onChanged={users.reload}
        />
      )}
    </>
  );
}
function UserAllocation({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = useLoad(
      () => ccGet<Balance>(`/ai/allowances/users/${id}`),
      [id],
    ),
    format = useFormat();
  const [daily, setDaily] = useState(""),
    [tokens, setTokens] = useState(""),
    [error, setError] = useState(""),
    [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  useEffect(() => {
    if (detail.data) {
      setDaily(detail.data.overrides.dailyRequests?.toString() ?? "");
      setTokens(detail.data.overrides.tokenAllowance?.toString() ?? "");
    }
  }, [detail.data]);
  const done = () => {
    setDialog(null);
    detail.reload();
    onChanged();
  };
  function override() {
    if (!detail.data) return;
    const dailyRequests = daily === "" ? null : Number(daily),
      tokenAllowance = tokens === "" ? null : Number(tokens);
    if (
      (dailyRequests !== null &&
        (!Number.isInteger(dailyRequests) ||
          dailyRequests < 0 ||
          dailyRequests > 10000)) ||
      (tokenAllowance !== null &&
        (!Number.isInteger(tokenAllowance) ||
          tokenAllowance < 0 ||
          tokenAllowance > 10000000))
    ) {
      setError(
        "Use whole numbers within the displayed limits, or leave blank to inherit.",
      );
      return;
    }
    setError("");
    const expectedVersion = detail.data.accountVersion;
    setDialog({
      title: "Save individual AI allocation?",
      confirm: "Save user overrides",
      fields: [],
      description:
        "Blank values inherit the plan. Usage is preserved. Zero stops new requests; already-reserved work can finish.",
      run: (v) =>
        ccPost(`/ai/allowances/users/${id}/override`, {
          expectedVersion,
          dailyRequests,
          tokenAllowance,
          reason: v.reason,
        }),
      onClose: () => setDialog(null),
      onDone: done,
    });
  }
  function adjust() {
    if (!detail.data) return;
    const expectedVersion = detail.data.accountVersion,
      clientRequestId = crypto.randomUUID();
    setDialog({
      title: "Adjust current-period tokens",
      confirm: "Apply token adjustment",
      description:
        "Positive adds tokens; negative removes unused tokens. This is not a payment. It expires at the existing reset time.",
      fields: [
        {
          name: "deltaTokens",
          label: "Token adjustment",
          type: "number",
          required: true,
          hint: "Whole number −1,000,000 to 1,000,000; cannot remove used/reserved tokens.",
        },
      ],
      run: (v) =>
        ccPost(`/ai/allowances/users/${id}/adjust`, {
          expectedVersion,
          clientRequestId,
          deltaTokens: Number(v.deltaTokens),
          reason: v.reason,
        }),
      onClose: () => setDialog(null),
      onDone: done,
    });
  }
  function reconcile(reservationId: string) {
    setDialog({
      title: "Reconcile provider-reported usage",
      confirm: "Record reconciled usage",
      description:
        "Use provider logs/billing evidence. Enter zero only when evidence confirms no generation. This records actual usage and releases the outstanding reservation once.",
      fields: [
        {
          name: "inputTokens",
          label: "Reported input tokens",
          type: "number",
          required: true,
        },
        {
          name: "outputTokens",
          label: "Reported output tokens (including thinking)",
          type: "number",
          required: true,
        },
        {
          name: "totalTokens",
          label: "Reported total tokens",
          type: "number",
          required: true,
        },
        {
          name: "proofReference",
          label: "Provider evidence reference",
          required: true,
        },
      ],
      run: (v) =>
        ccPost(`/ai/allowances/reservations/${reservationId}/reconcile`, {
          usage: {
            inputTokens: Number(v.inputTokens),
            outputTokens: Number(v.outputTokens),
            totalTokens: Number(v.totalTokens),
          },
          proofReference: v.proofReference,
          reason: v.reason,
        }),
      onClose: () => setDialog(null),
      onDone: done,
    });
  }
  return (
    <Panel>
      <PanelHeader
        title="Manage selected account"
        description={id}
        action={
          <CommandButton variant="secondary" onClick={onClose}>
            Close account allocation
          </CommandButton>
        }
      />
      <ErrorBox error={detail.error} retry={detail.reload} />
      {detail.loading ? (
        <Loading />
      ) : (
        detail.data && (
          <div className="space-y-5 p-5">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Tokens used", number(detail.data.tokens.used)],
                ["Tokens reserved", number(detail.data.tokens.reserved)],
                ["Tokens remaining", number(detail.data.tokens.remaining)],
                [
                  "Requests remaining today",
                  number(detail.data.requests.remaining),
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-sm text-slate-600">{label}</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-slate-600">
              Token reset: {format.dateTime(detail.data.tokens.resetsAt)} ·
              Request reset: {format.dateTime(detail.data.requests.resetsAt)}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                User requests per day override
                <input
                  className={control}
                  type="number"
                  min="0"
                  max="10000"
                  step="1"
                  value={daily}
                  onChange={(e) => setDaily(e.target.value)}
                  placeholder="Inherit plan"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                User tokens per period override
                <input
                  className={control}
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  value={tokens}
                  onChange={(e) => setTokens(e.target.value)}
                  placeholder="Inherit plan"
                />
              </label>
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <CommandButton className="min-h-11" onClick={override}>
                Review user overrides
              </CommandButton>
              <CommandButton
                className="min-h-11"
                variant="secondary"
                onClick={adjust}
              >
                Adjust current tokens
              </CommandButton>
            </div>
            {!!detail.data.uncertainReservations?.length && (
              <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-sm font-bold">
                  Provider outcomes needing reconciliation
                </h3>
                {detail.data.uncertainReservations.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <p className="min-w-0 break-all">
                      {r.id} · {number(r.reservedTokens)} tokens held
                    </p>
                    <CommandButton
                      className="min-h-11"
                      variant="secondary"
                      onClick={() => reconcile(r.id)}
                    >
                      Reconcile usage
                    </CommandButton>
                  </div>
                ))}
              </section>
            )}
            <h3 className="text-sm font-bold">Immutable allocation history</h3>
            {detail.data.ledger?.length ? (
              <Table
                head={[
                  "When",
                  "Event",
                  "Used change",
                  "Reserved change",
                  "Allocation change",
                ]}
              >
                {detail.data.ledger.map((r) => (
                  <tr key={r.id}>
                    <Td>{format.dateTime(r.createdAt)}</Td>
                    <Td>{r.type.replaceAll("_", " ")}</Td>
                    <Td>{number(r.usedDelta)}</Td>
                    <Td>{number(r.reservedDelta)}</Td>
                    <Td>{number(r.bonusDelta)}</Td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty title="No allocation history yet" />
            )}
          </div>
        )
      )}
      {dialog && <ActionDialog {...dialog} />}
    </Panel>
  );
}
