import { useState } from "react";
import { Radiation, Plus, ImageOff, GitCompareArrows } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { Provenance } from "@/components/clinical/Provenance";
import { useRadiology } from "@/store/useRadiology";
import { useEmr } from "@/store/useEmr";
import { useIdentity } from "@/store/useIdentity";
import { IMAGING_MODALITIES, type ImagingStudy } from "@/data/radiology";
import { dateTime, shortDate } from "@/lib/format";

export default function Radiology() {
  const { studies, requestStudy, scheduleStudy, performStudy, addReport, verifyReport, addAddendum, cancelStudy, priorStudiesFor, setCompareStudy } = useRadiology();
  const { patientById } = useEmr();
  const currentUser = useIdentity((state) => state.user.name);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ patientId: "", modality: IMAGING_MODALITIES[0], bodySite: "", laterality: "N/A" as ImagingStudy["laterality"], indication: "", priority: "Routine" as ImagingStudy["priority"], preparation: "", externalStudy: false });

  const [detailId, setDetailId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [seriesDraft, setSeriesDraft] = useState<{ description: string; bodyPart: string; imageCount: string }[]>([{ description: "", bodyPart: "", imageCount: "" }]);
  const [reportForm, setReportForm] = useState({ findings: "", impression: "" });
  const [addendumNote, setAddendumNote] = useState("");
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  const detail = studies.find((study) => study.id === detailId) ?? null;
  const worklist = studies.filter((study) => ["Requested", "Scheduled"].includes(study.status));
  const reporting = studies.filter((study) => study.status === "Performed");
  const verified = studies.filter((study) => study.status === "Verified" || study.status === "Amended");

  function openDetail(study: ImagingStudy) {
    setScheduleDate(study.scheduledFor?.slice(0, 10) ?? "");
    setSeriesDraft(study.series.length ? study.series.map((series) => ({ description: series.description, bodyPart: series.bodyPart, imageCount: String(series.imageCount ?? "") })) : [{ description: "", bodyPart: study.bodySite, imageCount: "1" }]);
    setReportForm({ findings: study.report?.findings ?? "", impression: study.report?.impression ?? "" });
    setAddendumNote("");
    setDetailId(study.id);
  }

  const renderTable = (list: ImagingStudy[], caption: string) => (
    <Table columns={["Patient", "Accession", "Modality / site", "Priority", "Requested", "Status", ""]} caption={caption}>
      {list.length === 0 && <EmptyRow colSpan={7}>Nothing here.</EmptyRow>}
      {list.map((study, index) => {
        const patient = patientById(study.patientId);
        return (
          <Row key={study.id} index={index} onClick={() => openDetail(study)}>
            <Cell><PatientLink patient={patient} /></Cell>
            <Cell className="font-mono text-xs">{study.accessionNumber}</Cell>
            <Cell className="font-medium">{study.modality} — {study.bodySite}{study.laterality && study.laterality !== "N/A" ? ` (${study.laterality})` : ""}</Cell>
            <Cell><Badge tone={study.priority === "Routine" ? "mist" : "action"}>{study.priority}</Badge></Cell>
            <Cell className="text-mist-400">{shortDate(study.requestedAt)}</Cell>
            <Cell><ClinicalStatusBadge kind="imaging" status={study.status} /></Cell>
            <Cell><span className="text-xs text-brand-600">Open</span></Cell>
          </Row>
        );
      })}
    </Table>
  );

  const priorStudies = detail ? priorStudiesFor(detail.patientId, detail.bodySite, detail.id) : [];

  return (
    <div>
      <PageHeader
        title="Radiology"
        subtitle="Patient → Study → Series → Report — no PACS/DICOM viewer is connected to this build"
        actions={<Button onClick={() => { setRequestForm({ patientId: "", modality: IMAGING_MODALITIES[0], bodySite: "", laterality: "N/A", indication: "", priority: "Routine", preparation: "", externalStudy: false }); setRequestOpen(true); }}><Plus size={15} /> Request imaging</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Worklist" value={worklist.length} tone="amber" icon={<Radiation size={18} />} />
        <StatCard label="Awaiting report" value={reporting.length} tone="action" delay={0.05} />
        <StatCard label="Verified" value={verified.length} tone="brand" delay={0.1} />
        <StatCard label="All studies" value={studies.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Worklist", "Reporting", "Verified", "All studies"]} label="Radiology">
        {(tab) =>
          tab === "Worklist" ? renderTable(worklist, "Requested and scheduled imaging")
          : tab === "Reporting" ? renderTable(reporting, "Performed studies awaiting a report")
          : tab === "Verified" ? renderTable(verified, "Verified and amended reports")
          : renderTable(studies, "All imaging studies")
        }
      </Tabs>

      {/* Request */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request imaging"
        wide
        footer={<><Button variant="ghost" onClick={() => setRequestOpen(false)}>Cancel</Button>
          <Button disabled={!requestForm.patientId || !requestForm.bodySite.trim() || !requestForm.indication.trim()} onClick={() => { requestStudy(requestForm); setRequestOpen(false); }}>Request</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={requestForm.patientId} onChange={(id) => setRequestForm({ ...requestForm, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Modality"><Select value={requestForm.modality} onChange={(event) => setRequestForm({ ...requestForm, modality: event.target.value as never })} options={[...IMAGING_MODALITIES]} /></Field>
            <Field label="Priority"><Select value={requestForm.priority} onChange={(event) => setRequestForm({ ...requestForm, priority: event.target.value as never })} options={["Routine", "Urgent", "Emergency"]} /></Field>
            <Field label="Body site"><Input value={requestForm.bodySite} onChange={(event) => setRequestForm({ ...requestForm, bodySite: event.target.value })} placeholder="e.g. Chest, Left ankle" /></Field>
            <Field label="Laterality"><Select value={requestForm.laterality} onChange={(event) => setRequestForm({ ...requestForm, laterality: event.target.value as never })} options={["N/A", "Left", "Right", "Bilateral"]} /></Field>
          </Grid>
          <Field label="Indication"><Textarea value={requestForm.indication} onChange={(event) => setRequestForm({ ...requestForm, indication: event.target.value })} /></Field>
          <Field label="Preparation (optional)"><Input value={requestForm.preparation} onChange={(event) => setRequestForm({ ...requestForm, preparation: event.target.value })} placeholder="e.g. Full bladder, nil by mouth" /></Field>
          <Checkbox label="Performed at another facility — reference only, no local images" checked={requestForm.externalStudy} onChange={(event) => setRequestForm({ ...requestForm, externalStudy: event.target.checked })} />
        </div>
      </Modal>

      {/* Detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.accessionNumber} — ${patientById(detail.patientId)?.firstName} ${patientById(detail.patientId)?.lastName}` : ""}
        wide
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ClinicalStatusBadge kind="imaging" status={detail.status} />
              <Badge tone="mist">{detail.modality}</Badge>
              <Badge tone={detail.priority === "Routine" ? "mist" : "action"}>{detail.priority}</Badge>
              {detail.externalStudy && <Badge tone="mist">External study — reference only</Badge>}
            </div>
            <p className="text-sm text-mist-600"><b>Study:</b> {detail.bodySite}{detail.laterality && detail.laterality !== "N/A" ? ` (${detail.laterality})` : ""} — {detail.indication}</p>
            {detail.preparation && <p className="text-xs text-mist-500">Preparation: {detail.preparation}</p>}
            <Provenance info={{ author: detail.requestedBy, recordedAt: detail.requestedAt, source: "Imaging request" }} />

            {detail.status === "Requested" && !detail.externalStudy && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Schedule</p>
                <Field label="Date"><Input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} /></Field>
                <Button className="mt-2" disabled={!scheduleDate} onClick={() => scheduleStudy(detail.id, new Date(scheduleDate).toISOString())}>Schedule</Button>
              </div>
            )}

            {(detail.status === "Scheduled" || (detail.status === "Requested" && !detail.externalStudy)) && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Series performed</p>
                {seriesDraft.map((series, index) => (
                  <Grid cols={3} key={index}>
                    <Field label="Description"><Input value={series.description} onChange={(event) => setSeriesDraft(seriesDraft.map((entry, i) => (i === index ? { ...entry, description: event.target.value } : entry)))} /></Field>
                    <Field label="Body part"><Input value={series.bodyPart} onChange={(event) => setSeriesDraft(seriesDraft.map((entry, i) => (i === index ? { ...entry, bodyPart: event.target.value } : entry)))} /></Field>
                    <Field label="Image count"><Input type="number" value={series.imageCount} onChange={(event) => setSeriesDraft(seriesDraft.map((entry, i) => (i === index ? { ...entry, imageCount: event.target.value } : entry)))} /></Field>
                  </Grid>
                ))}
                <div className="mt-2 flex gap-2">
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => setSeriesDraft([...seriesDraft, { description: "", bodyPart: detail.bodySite, imageCount: "1" }])}>Add series</Button>
                  <Button
                    disabled={!seriesDraft.some((series) => series.description.trim())}
                    onClick={() => performStudy(detail.id, seriesDraft.filter((series) => series.description.trim()).map((series) => ({ seriesNumber: 0, description: series.description, bodyPart: series.bodyPart, imageCount: Number(series.imageCount) || undefined })).map((series, index) => ({ ...series, seriesNumber: index + 1 })))}
                  >
                    Mark performed
                  </Button>
                </div>
              </div>
            )}

            {detail.series.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Series ({detail.series.length})</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {detail.series.map((series) => (
                    <div key={series.id} className="flex items-center gap-3 rounded-xl border border-mist-200 p-2.5">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-mist-100 text-mist-400"><ImageOff size={20} /></div>
                      <div className="min-w-0 text-sm">
                        <p className="truncate font-medium text-mist-800">Series {series.seriesNumber} — {series.description}</p>
                        <p className="text-[11px] text-mist-400">{series.bodyPart}{series.imageCount ? ` · ${series.imageCount} image(s)` : ""}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-mist-400">Viewer unavailable — no PACS/DICOM viewer is integrated with this facility build. Thumbnails above are placeholders only.</p>
              </div>
            )}

            {detail.status === "Performed" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Report</p>
                <Field label="Findings"><Textarea value={reportForm.findings} onChange={(event) => setReportForm({ ...reportForm, findings: event.target.value })} className="min-h-[80px]" /></Field>
                <Field label="Impression"><Textarea value={reportForm.impression} onChange={(event) => setReportForm({ ...reportForm, impression: event.target.value })} /></Field>
                <Button className="mt-2" disabled={!reportForm.findings.trim() || !reportForm.impression.trim()} onClick={() => addReport(detail.id, reportForm.findings.trim(), reportForm.impression.trim())}>Save report</Button>
              </div>
            )}

            {detail.status === "Reported" && detail.report && (
              <div className="rounded-xl border border-mist-200 p-4">
                <p className="text-sm text-mist-700"><b>Findings:</b> {detail.report.findings}</p>
                <p className="mt-1 text-sm text-mist-700"><b>Impression:</b> {detail.report.impression}</p>
                <Provenance className="mt-2" info={{ author: detail.report.author, recordedAt: detail.report.authoredAt, source: "Draft report" }} />
                <Button className="mt-3" onClick={() => verifyReport(detail.id, currentUser)}>Verify report</Button>
              </div>
            )}

            {(detail.status === "Verified" || detail.status === "Amended") && detail.report && (
              <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
                <p className="text-sm text-mist-700"><b>Findings:</b> {detail.report.findings}</p>
                <p className="mt-1 text-sm text-mist-700"><b>Impression:</b> {detail.report.impression}</p>
                <Provenance className="mt-2" info={{ author: detail.report.author, recordedAt: detail.report.authoredAt, verifiedBy: detail.report.verifiedBy, verifiedAt: detail.report.verifiedAt }} />
                {detail.report.addenda && detail.report.addenda.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-brand-100 pt-2 text-[11px] text-mist-500">
                    {detail.report.addenda.map((addendum, index) => (
                      <p key={index}>Addendum by {addendum.by} · {dateTime(addendum.at)} — {addendum.note}</p>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <Input className="h-8 text-xs" placeholder="Addendum" value={addendumNote} onChange={(event) => setAddendumNote(event.target.value)} />
                  <Button variant="ghost" className="px-2.5 py-1 text-xs" disabled={!addendumNote.trim()} onClick={() => { addAddendum(detail.id, addendumNote.trim()); setAddendumNote(""); }}>Add addendum</Button>
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><GitCompareArrows size={13} /> Comparison with prior studies</p>
              {priorStudies.length === 0 ? (
                <p className="text-xs text-mist-400">No prior verified study of {detail.bodySite} on file for this patient.</p>
              ) : (
                <div className="space-y-1">
                  {priorStudies.map((prior) => (
                    <label key={prior.id} className="flex items-center gap-2 text-sm text-mist-600">
                      <input type="radio" name="compare" checked={detail.compareToStudyId === prior.id} onChange={() => setCompareStudy(detail.id, prior.id)} />
                      {prior.accessionNumber} — {shortDate(prior.performedAt ?? prior.requestedAt)} — {prior.report?.impression ?? "No report on file"}
                    </label>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-mist-400">Side-by-side image comparison is unavailable without a viewer — this lists prior reports for reference only.</p>
            </div>

            {!["Verified", "Amended", "Cancelled"].includes(detail.status) && (
              cancelReason !== null ? (
                <div className="rounded-xl border border-action-200 bg-action-50/50 p-3">
                  <Field label="Reason for cancelling"><Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></Field>
                  <div className="mt-2 flex gap-2">
                    <Button variant="action" disabled={!cancelReason.trim()} onClick={() => { cancelStudy(detail.id, cancelReason.trim()); setCancelReason(null); setDetailId(null); }}>Confirm cancel</Button>
                    <Button variant="ghost" onClick={() => setCancelReason(null)}>Back</Button>
                  </div>
                </div>
              ) : (
                <button className="text-xs text-action-600 underline" onClick={() => setCancelReason("")}>Cancel this study</button>
              )
            )}
          </div>
        )}
      </Modal>

      {studies.length === 0 && (
        <div className="mt-5">
          <EmptyState variant="empty" title="No imaging requested" hint="Request an X-ray, ultrasound or other study from a consultation or from here." />
        </div>
      )}
    </div>
  );
}
