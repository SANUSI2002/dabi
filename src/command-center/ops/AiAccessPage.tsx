import { useState } from "react";
import {
  CommandButton,
  CommandPageHeader,
  Panel,
  PanelHeader,
  StatusPill,
} from "../components/ui";
import { ccGet, ccPost, qs } from "./api";
import {
  ActionDialog,
  Empty,
  ErrorBox,
  Gate,
  Loading,
  useLoad,
  type ActionDialogProps,
} from "./kit";
import type { AiFeatures, AiKind, AiEnrollmentInput } from "@/ai/api";
const labels: Record<keyof AiFeatures, string> = {
  chat: "AI conversations",
  knowledge: "Approved reference grounding",
  documents: "Personal document explanations",
  reminders: "Reminder controls",
  memory: "Saved personal context",
};
const kinds: AiKind[] = ["PERSONAL", "PROFESSIONAL", "BUSINESS"];
type Policy = { version: number; settings: Record<AiKind, AiFeatures> };
type Enrollment = {
  userId: string;
  kind: AiKind;
  status: string;
  version: number;
  details: AiEnrollmentInput;
  featureOverrides: Partial<AiFeatures>;
  user: { full_name: string | null; email: string };
  expiresAt: string | null;
};
export default function AiAccessPage() {
  return (
    <Gate
      any={["platform.settings.manage"]}
      what="AI account and feature management"
    >
      <Access />
    </Gate>
  );
}
function Access() {
  const [offset, setOffset] = useState(0),
    [status, setStatus] = useState("PENDING"),
    [dialog, setDialog] = useState<ActionDialogProps | null>(null),
    [draft, setDraft] = useState<Policy | null>(null);
  const policy = useLoad(() => ccGet<Policy>("/ai/accounts/policy"), []);
  const accounts = useLoad(
    () =>
      ccGet<{ items: Enrollment[]; total: number }>(
        `/ai/accounts${qs({ offset, status })}`,
      ),
    [offset, status],
  );
  const edited = draft || policy.data;
  function save() {
    if (!edited) return;
    setDialog({
      title: "Publish AI feature policy?",
      description:
        "This applies to the selected account categories immediately. It does not grant patient-record or prescribing permissions.",
      confirm: "Publish feature policy",
      run: (values) =>
        ccPost("/ai/accounts/policy", {
          expectedVersion: edited.version,
          settings: edited.settings,
          reason: values.reason,
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        setDraft(null);
        policy.reload();
      },
    });
  }
  function decide(row: Enrollment, next: string) {
    setDialog({
      title: `${next === "APPROVED" ? "Approve" : next === "REJECTED" ? "Reject" : "Suspend"} AI account?`,
      description: `${row.user.full_name || row.user.email} · ${row.kind.toLowerCase()}. Verify their licence or organisation registration independently; this decision is for AI access only.`,
      confirm: "Record decision",
      fields: [
        {
          name: "reference",
          label: "Verification source / reference",
          required: true,
          hint: "Record the issuing body, lookup/report reference and verification date.",
        },
      ],
      run: (values) =>
        ccPost(`/ai/accounts/${row.userId}/decision`, {
          expectedVersion: row.version,
          status: next,
          verificationReference: values.reference,
          reason: values.reason,
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        accounts.reload();
      },
    });
  }
  function overrides(row: Enrollment) {
    setDialog({
      title: "Individual AI feature overrides",
      description:
        "Inherit follows the category policy. Overrides change only existing AI capabilities, never clinical roles.",
      confirm: "Save overrides",
      fields: (Object.keys(labels) as (keyof AiFeatures)[]).map((key) => ({
        name: key,
        label: labels[key],
        type: "select" as const,
        defaultValue:
          row.featureOverrides[key] === undefined
            ? "inherit"
            : String(row.featureOverrides[key]),
        options: [
          { value: "inherit", label: "Inherit category" },
          { value: "true", label: "Enabled" },
          { value: "false", label: "Disabled" },
        ],
      })),
      run: (values) =>
        ccPost(`/ai/accounts/${row.userId}/features`, {
          expectedVersion: row.version,
          reason: values.reason,
          featureOverrides: Object.fromEntries(
            Object.keys(labels)
              .filter((key) => values[key] !== "inherit")
              .map((key) => [key, values[key] === "true"]),
          ),
        }),
      onClose: () => setDialog(null),
      onDone: () => {
        setDialog(null);
        accounts.reload();
      },
    });
  }
  return (
    <>
      <CommandPageHeader
        eyebrow="Sabi AI"
        title="Accounts & feature access"
        description="Manage personal, professional and hospital/business AI access. Professional status is reviewed, never inferred from a signup selection."
      />
      <Panel>
        <PanelHeader title="Category feature policy" />
        {policy.loading ? (
          <Loading />
        ) : policy.error ? (
          <ErrorBox error={policy.error} retry={policy.reload} />
        ) : (
          edited && (
            <div className="p-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <caption className="sr-only">
                    Feature access by Sabi AI account category
                  </caption>
                  <thead>
                    <tr>
                      <th className="py-3">Feature</th>
                      {kinds.map((k) => (
                        <th key={k} className="p-3 capitalize">
                          {k.toLowerCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Object.keys(labels) as (keyof AiFeatures)[]).map(
                      (key) => (
                        <tr className="border-t border-slate-100" key={key}>
                          <th scope="row" className="py-4 font-medium">
                            {labels[key]}
                          </th>
                          {kinds.map((k) => (
                            <td key={k}>
                              <label className="flex min-h-11 items-center gap-2 px-3">
                                <input
                                  className="h-5 w-5 accent-emerald-700"
                                  aria-label={`${k} ${labels[key]}`}
                                  type="checkbox"
                                  checked={edited.settings[k][key]}
                                  onChange={(e) =>
                                    setDraft({
                                      ...edited,
                                      settings: {
                                        ...edited.settings,
                                        [k]: {
                                          ...edited.settings[k],
                                          [key]: e.target.checked,
                                        },
                                      },
                                    })
                                  }
                                />
                                {edited.settings[k][key]
                                  ? "Enabled"
                                  : "Disabled"}
                              </label>
                            </td>
                          ))}
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
              <CommandButton
                className="mt-5 min-h-11"
                disabled={!draft}
                onClick={save}
              >
                Review & publish changes
              </CommandButton>
              <p className="mt-3 text-xs leading-6 text-slate-600">
                Knowledge access means background use of approved evidence. It
                never exposes the knowledge-base module, catalogue, source files
                or upload controls. Patient-specific clinical tools remain
                governed by their existing permissions.
              </p>
            </div>
          )
        )}
      </Panel>
      <Panel className="mt-5">
        <PanelHeader
          title="Account applications"
          action={
            <CommandButton variant="secondary" onClick={accounts.reload}>
              Refresh
            </CommandButton>
          }
        />
        <div className="flex flex-wrap gap-4 p-5">
          <label className="text-sm">
            Application status
            <select
              className="ml-3 min-h-11 rounded-lg border p-2"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              {["PENDING", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        {accounts.loading ? (
          <Loading />
        ) : accounts.error ? (
          <ErrorBox error={accounts.error} retry={accounts.reload} />
        ) : !accounts.data?.items.length ? (
          <Empty title="No applications in this queue" />
        ) : (
          <div className="divide-y">
            {accounts.data.items.map((row) => (
              <article key={row.userId} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="font-semibold">
                    {row.user.full_name || row.user.email}
                  </h2>
                  <StatusPill status={row.status} />
                  <span className="text-xs">{row.kind.toLowerCase()}</span>
                </div>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {row.user.email}
                </p>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  {Object.entries(row.details)
                    .filter(([key]) => !["attestation", "kind"].includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-xs capitalize text-slate-500">
                          {key.replace(/([A-Z])/g, " $1")}
                        </dt>
                        <dd className="mt-1 break-words">{String(value)}</dd>
                      </div>
                    ))}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <CommandButton
                    className="min-h-11"
                    disabled={row.status === "APPROVED"}
                    onClick={() => decide(row, "APPROVED")}
                  >
                    Approve account
                  </CommandButton>
                  <CommandButton
                    variant="secondary"
                    className="min-h-11"
                    onClick={() =>
                      decide(
                        row,
                        row.status === "APPROVED" ? "SUSPENDED" : "REJECTED",
                      )
                    }
                  >
                    {row.status === "APPROVED" ? "Suspend" : "Reject"}
                  </CommandButton>
                  <CommandButton
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => overrides(row)}
                  >
                    Feature overrides
                  </CommandButton>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between p-5">
          <CommandButton
            variant="secondary"
            disabled={!offset}
            onClick={() => setOffset((x) => Math.max(0, x - 25))}
          >
            Previous
          </CommandButton>
          <span className="text-xs">
            {accounts.data?.total || 0} applications
          </span>
          <CommandButton
            variant="secondary"
            disabled={offset + 25 >= (accounts.data?.total || 0)}
            onClick={() => setOffset((x) => x + 25)}
          >
            Next
          </CommandButton>
        </div>
      </Panel>
      {dialog && <ActionDialog {...dialog} />}
    </>
  );
}
