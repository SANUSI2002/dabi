import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, CheckCircle2, ArrowRight, UserPlus, ShieldCheck, Clock, XCircle, Upload, FileText, FileCheck2, MailWarning } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/form";
import { LetterDoc } from "@/components/print/LetterDoc";
import { useOnboarding } from "@/store/useOnboarding";
import { useLetters } from "@/platform/useLetters";
import { useOrg } from "@/store/useOrg";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { useIdentity } from "@/store/useIdentity";
import { ACCOUNTS } from "@/data/accounts";
import { timeAgo, initials } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function Onboarding() {
  const { stages, tasks, progress, toggleTask, canAdvance, advanceStage, convertToEmployee, uploadTaskDocument, documentsFor, setResumptionDate, setBasicSalary, offerLetterTemplate, setOfferLetterTemplate, outstandingRequiredDocs, raiseMissingDocumentLetter } = useOnboarding();
  const { jobPositionName, departmentName } = useOrg();
  const startWorkflow = useWorkflow((s) => s.start);
  const instanceFor = useWorkflow((s) => s.instanceFor);
  useWorkflow((s) => s.instances); // re-render when any instance changes
  const user = useIdentity((s) => s.user);
  const HR_ADMIN = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator")?.id ?? "s1";
  const letterById = useLetters((s) => s.letterById);
  const templates = useLetters((s) => s.templates);
  const [noticeFor, setNoticeFor] = useState<{ progressId: string; deadline: string } | null>(null);
  const [viewLetterId, setViewLetterId] = useState<string | null>(null);
  const viewLetter = viewLetterId ? letterById(viewLetterId) : null;
  const [convertFor, setConvertFor] = useState<string | null>(null);
  const [cf, setCf] = useState({ role: "", cadre: "" });
  const [newEmployeeId, setNewEmployeeId] = useState<string | null>(null);
  const [uploadFor, setUploadFor] = useState<{ progressId: string; taskId: string; taskTitle: string } | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState(offerLetterTemplate);

  const inProgress = progress.filter((p) => !p.employeeId);
  const converted = progress.filter((p) => p.employeeId);

  return (
    <div>
      <PageHeader
        title="Onboarding"
        subtitle="New-hire checklist, stage by stage — completing sign-off creates the employee record"
        actions={<Button variant="ghost" onClick={() => { setTemplateDraft(offerLetterTemplate); setTemplateOpen(true); }}><FileText size={14} /> Offer letter template</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="In onboarding" value={inProgress.length} tone="brand" icon={<ListChecks size={18} />} />
        <StatCard label="At final sign-off" value={progress.filter((p) => !p.employeeId && stages.find((s) => s.id === p.currentStageId)?.isFinal).length} tone="amber" delay={0.05} />
        <StatCard label="Converted to employee" value={converted.length} tone="brand" delay={0.1} icon={<UserPlus size={18} />} />
        <StatCard label="Checklist stages" value={stages.length} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-4">
        {inProgress.map((p) => {
          const stage = stages.find((s) => s.id === p.currentStageId)!;
          const stageTasks = tasks.filter((t) => t.stageId === stage.id);
          const ready = canAdvance(p.id);
          const inst = instanceFor(p.id);
          const reviewState = !inst || inst.status === "Cancelled" ? "none" : inst.status; // "none" | "Running" | "Approved" | "Rejected"
          const myDocs = documentsFor(p.id);
          const finalReady = ready && !!p.resumptionDate && !!p.basicSalary;
          return (
            <Card key={p.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-xs font-bold text-white">{initials(p.candidateName)}</span>
                  <div>
                    <p className="font-display font-bold text-mist-900">{p.candidateName}</p>
                    <p className="text-[11px] text-mist-400">{jobPositionName(p.jobPositionId)} · {departmentName(p.departmentId)} · started {timeAgo(p.startedAt)}</p>
                  </div>
                </div>
                <Badge tone="amber">{stage.title}</Badge>
              </div>

              {/* stepper */}
              <div className="mb-4 flex items-center gap-1">
                {stages.map((s, i) => (
                  <div key={s.id} className="flex flex-1 items-center gap-1">
                    <div className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                      s.sequence < stage.sequence ? "bg-brand-gradient text-white" : s.id === stage.id ? "bg-amber-400 text-white" : "bg-mist-100 text-mist-400",
                    )}>
                      {s.sequence < stage.sequence ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    {s.sequence < stages.length - 1 && <div className={cn("h-0.5 flex-1", s.sequence < stage.sequence ? "bg-brand-400" : "bg-mist-100")} />}
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                {stageTasks.map((t) => {
                  const doc = myDocs.find((d) => d.taskId === t.id);
                  if (t.requiresUpload) {
                    return (
                      <div key={t.id} className="flex items-center gap-2.5 rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-700">
                        {p.taskDone[t.id] ? <FileCheck2 size={16} className="shrink-0 text-brand-600" /> : <Upload size={16} className="shrink-0 text-mist-400" />}
                        <span className="flex-1">
                          {t.title}
                          {doc && <span className="block text-[11px] text-mist-400">Uploaded: {doc.title}</span>}
                        </span>
                        {t.isRequired && !p.taskDone[t.id] && <span className="text-[10px] font-bold uppercase text-action-500">Required</span>}
                        {!p.taskDone[t.id] && (
                          <button onClick={() => { setUploadTitle(t.title); setUploadFor({ progressId: p.id, taskId: t.id, taskTitle: t.title }); }} className="btn-soft px-2.5 py-1 text-xs">
                            <Upload size={12} /> Upload
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <label key={t.id} className="flex items-center gap-2.5 rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-700">
                      <input type="checkbox" checked={!!p.taskDone[t.id]} onChange={() => toggleTask(p.id, t.id)} className="h-4 w-4 rounded border-mist-300 text-brand-600" />
                      {t.title}
                      {t.isRequired && <span className="ml-auto text-[10px] font-bold uppercase text-action-500">Required</span>}
                    </label>
                  );
                })}
              </div>

              {stage.isFinal && (reviewState === "none" || reviewState === "Rejected") && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Resumption date"><Input type="date" value={p.resumptionDate ?? ""} onChange={(e) => setResumptionDate(p.id, e.target.value)} /></Field>
                  <Field label="Basic salary (per month)"><Input type="number" value={p.basicSalary ?? ""} onChange={(e) => setBasicSalary(p.id, +e.target.value)} placeholder="e.g. 180000" /></Field>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                {outstandingRequiredDocs(p.id).length > 0 && (
                  <Button variant="ghost" onClick={() => setNoticeFor({ progressId: p.id, deadline: "" })}>
                    <MailWarning size={14} /> Outstanding-document notice ({outstandingRequiredDocs(p.id).length})
                  </Button>
                )}
                {stage.isFinal ? (
                  reviewState === "none" || reviewState === "Rejected" ? (
                    <>
                      {reviewState === "Rejected" && <Badge tone="action"><XCircle size={11} /> Review sent back — resubmit below</Badge>}
                      <Button
                        disabled={!finalReady}
                        onClick={() => startWorkflow({ triggerType: "onboarding", subject: `Convert ${p.candidateName} to employee`, reference: p.id, context: { initiatorId: user.id, "roleHolder:HR Administrator": HR_ADMIN } })}
                      >
                        <ShieldCheck size={14} /> Submit for HR review
                      </Button>
                    </>
                  ) : reviewState === "Running" ? (
                    <Badge tone="amber"><Clock size={11} /> Awaiting HR review — see the <Link to="/workflows/inbox" className="underline">Approvals Inbox</Link></Badge>
                  ) : (
                    <Button onClick={() => { setCf({ role: jobPositionName(p.jobPositionId), cadre: "" }); setConvertFor(p.id); }}>
                      <UserPlus size={14} /> Convert to employee
                    </Button>
                  )
                ) : (
                  <Button disabled={!ready} onClick={() => advanceStage(p.id)}>Next stage <ArrowRight size={14} /></Button>
                )}
              </div>
            </Card>
          );
        })}
        {inProgress.length === 0 && <Card className="text-sm text-mist-400">No one is currently onboarding. Hire a candidate from Recruitment to start.</Card>}
      </div>

      {converted.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 font-display font-bold text-mist-900">Recently converted</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {converted.map((p) => (
              <Card key={p.id} className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-mist-900">{p.candidateName}</p>
                  <p className="text-[11px] text-mist-400">{jobPositionName(p.jobPositionId)} · {departmentName(p.departmentId)}</p>
                </div>
                <Link to={`/hr/employees/${p.employeeId}`} className="btn-soft text-xs">Open profile</Link>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={!!convertFor}
        onClose={() => setConvertFor(null)}
        title="Convert to employee"
        footer={<><Button variant="ghost" onClick={() => setConvertFor(null)}>Cancel</Button>
          <Button disabled={!cf.role.trim()} onClick={() => {
            if (!convertFor) return;
            const empId = convertToEmployee(convertFor, cf.role.trim(), cf.cadre.trim());
            setConvertFor(null);
            setNewEmployeeId(empId ?? null);
          }}>Create employee record</Button></>}
      >
        <div className="space-y-4">
          <Field label="Role (used across EMR / Workforce)"><Input value={cf.role} onChange={(e) => setCf({ ...cf, role: e.target.value })} /></Field>
          <Field label="Cadre"><Input value={cf.cadre} onChange={(e) => setCf({ ...cf, cadre: e.target.value })} placeholder="e.g. Grade Level 08" /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
            Creates one staff record shared by HR, Workforce and clinical pickers — the same person everywhere in SabiEMR.
          </p>
        </div>
      </Modal>

      <Modal
        open={!!newEmployeeId}
        onClose={() => setNewEmployeeId(null)}
        title="Employee created"
        footer={<><Button variant="ghost" onClick={() => setNewEmployeeId(null)}>Close</Button>
          {newEmployeeId && <Link to={`/hr/employees/${newEmployeeId}`} className="btn-primary">Open profile <ArrowRight size={14} /></Link>}</>}
      >
        <p className="text-sm text-mist-600">The employee record was created — their onboarding salary, uploaded documents and profile placement carried straight over. Ready for org placement and workforce scheduling.</p>
      </Modal>

      <Modal
        open={!!uploadFor}
        onClose={() => setUploadFor(null)}
        title={`Upload — ${uploadFor?.taskTitle ?? ""}`}
        footer={<><Button variant="ghost" onClick={() => setUploadFor(null)}>Cancel</Button>
          <Button disabled={!uploadTitle.trim()} onClick={() => { if (uploadFor) uploadTaskDocument(uploadFor.progressId, uploadFor.taskId, uploadTitle.trim()); setUploadFor(null); }}>Confirm upload</Button></>}
      >
        <Field label="Document reference / file name"><Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. NIN-Slip-Ngozi-Umeh.pdf" /></Field>
      </Modal>

      <Modal
        open={!!noticeFor}
        onClose={() => setNoticeFor(null)}
        title="Outstanding-document notice"
        footer={<><Button variant="ghost" onClick={() => setNoticeFor(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!noticeFor) return;
            const id = raiseMissingDocumentLetter(noticeFor.progressId, { deadline: noticeFor.deadline || undefined });
            setNoticeFor(null);
            if (id) setViewLetterId(id);
          }}>Generate letter</Button></>}
      >
        <div className="space-y-3">
          <p className="text-sm text-mist-600">
            The following required documents are still outstanding and will be listed in the letter:
          </p>
          <ul className="rounded-xl bg-mist-50 px-4 py-3 text-sm text-mist-700">
            {noticeFor && outstandingRequiredDocs(noticeFor.progressId).map((d) => <li key={d}>• {d}</li>)}
          </ul>
          <Field label="Submission deadline (optional)">
            <Input type="date" value={noticeFor?.deadline ?? ""} onChange={(e) => setNoticeFor((n) => (n ? { ...n, deadline: e.target.value } : n))} />
          </Field>
          <p className="text-xs text-mist-400">The generated letter is logged under Platform → Letters &amp; Documents and can be printed or saved as PDF.</p>
        </div>
      </Modal>

      {viewLetter && (
        <LetterDoc
          open
          onClose={() => setViewLetterId(null)}
          title={viewLetter.title}
          body={viewLetter.rendered}
          signatories={(templates.find((t) => t.key === viewLetter.templateKey)?.signatories ?? []).map((s) =>
            s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => viewLetter.data[k] || "________"),
          )}
          reference={viewLetter.reference}
          date={viewLetter.generatedAt}
        />
      )}

      <Modal
        open={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="Offer letter template"
        wide
        footer={<><Button variant="ghost" onClick={() => setTemplateOpen(false)}>Cancel</Button>
          <Button onClick={() => { setOfferLetterTemplate(templateDraft); setTemplateOpen(false); }}>Save template</Button></>}
      >
        <div className="space-y-3">
          <p className="text-xs text-mist-500">Placeholders: <code>{"{{candidate_name}}"}</code> <code>{"{{job_position}}"}</code> <code>{"{{department}}"}</code> <code>{"{{reporting_manager}}"}</code> <code>{"{{basic_salary}}"}</code> <code>{"{{resumption_date}}"}</code> <code>{"{{date}}"}</code> <code>{"{{company_address}}"}</code></p>
          <Textarea className="min-h-[320px] font-mono text-xs" value={templateDraft} onChange={(e) => setTemplateDraft(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}
