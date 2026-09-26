import React from "react";
import { Sidebar, Topbar } from "../dashboard/components";
import { StatsRow, VitalInfoCard, RecordsSection, RecentActivityCard, HealthInsightCard, OrganizedRecords } from "./components";
import { iconName, sortCategories, toUiCategory, toUiRecord } from "./data";
import { useApiData } from "../../api/useApiData";
import { createCategory, createRecord, deleteCategory, fileRecord, listCategories, listRecords } from "../../api/recordsApi";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import "../dashboard/Dashboard.css";
import "./Records.css";

const loadRecords = async () => (await listRecords()).map(toUiRecord);
const loadCategories = async () => sortCategories((await listCategories()).map(toUiCategory));

// "Jul 17, 2026" (or blank) -> yyyy-mm-dd; blank or unreadable dates are recorded as today.
const toDateInput = (text) => {
  const parsed = new Date(text);
  const d = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Saves to the Sabi API, then reloads; failures are shown to the patient.
const run = (action, reload) => action().then(reload, (err) => alert(err.message));

export function Records() {
  const [zoom] = useZoom();
  const recordsData = useApiData(loadRecords, []);
  const categoriesData = useApiData(loadCategories, []);
  const records = recordsData.data || [];
  const categories = categoriesData.data || [];
  const reloadAll = () => Promise.all([recordsData.reload(), categoriesData.reload()]);

  const timelineRecords = records.filter((r) => r.isTimelineEntry);

  const handleAddCategory = ({ label, icon }) => run(() => createCategory(label, iconName(icon)), categoriesData.reload);

  const handleAssign = (recordId, categoryId) => run(() => fileRecord(recordId, categoryId), reloadAll);

  const handleUnassign = (recordId) => run(() => fileRecord(recordId, null), reloadAll);

  const handleCreateRecord = (categoryId, fields) =>
    run(() => createRecord({ title: fields.title, recordType: "OTHER", date: toDateInput(fields.date), notes: fields.notes, categoryId }), reloadAll);

  // Deleting a category only removes the folder itself — it's only
  // ever allowed once every record has been taken out of it first
  // (enforced in CategoryDetailModal), so no record is ever touched
  // here. Records are never deletable by the patient at all.
  const handleDeleteCategory = (categoryId) => run(() => deleteCategory(categoryId), categoriesData.reload);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-records-header">
          <h1>Medical Records</h1>
          <p>Securely access and manage your complete health history. Your records are encrypted and private by default.</p>
          {(recordsData.error || categoriesData.error) && <p role="alert">We couldn't load your records. Please refresh to try again.</p>}
        </div>

        <StatsRow records={records} />

        <div className="sabi-grid sabi-records-grid">
          <div className="sabi-col">
            <RecordsSection records={timelineRecords} />
            <OrganizedRecords
              categories={categories}
              allRecords={records}
              onAddCategory={handleAddCategory}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onCreateRecord={handleCreateRecord}
              onDeleteCategory={handleDeleteCategory}
            />
          </div>

          <div className="sabi-col">
            <VitalInfoCard />
            <RecentActivityCard records={records} />
            <HealthInsightCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Records;
