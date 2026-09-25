import React, { useState } from "react";
import { Button } from "design-system";
import { Plus } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import {
  StatsRow,
  VitalInfoCard,
  RecordsSection,
  RecentActivityCard,
  HealthInsightCard,
  OrganizedRecords,
  DocumentsCard,
  RecordFormModal,
} from "./components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import { createCategory, createRecord, deleteCategory, fileRecord, listCategories, listDocuments, listRecords } from "../../api/recordsApi";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import "../dashboard/Dashboard.css";
import "./Records.css";

export function Records() {
  const [zoom] = useZoom();
  const records = useApiData(listRecords, []);
  const categories = useApiData(listCategories, []);
  const documents = useApiData(listDocuments, []);
  const [showNewRecord, setShowNewRecord] = useState(false);

  // Folder counts are computed by the server, so any change to filing reloads both lists.
  const refreshRecords = () => Promise.all([records.reload(), categories.reload()]);

  const handleCreateRecord = async (fields) => {
    await createRecord(fields);
    await refreshRecords();
  };
  const handleFile = async (recordId, categoryId) => {
    await fileRecord(recordId, categoryId);
    await refreshRecords();
  };
  const handleAddCategory = async ({ label, icon }) => {
    await createCategory(label, icon);
    await categories.reload();
  };
  const handleDeleteCategory = async (categoryId) => {
    await deleteCategory(categoryId);
    await categories.reload();
  };

  const loading = (records.loading && !records.data) || (categories.loading && !categories.data);
  const error = records.error || categories.error;
  const allRecords = records.data || [];

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-records-header sabi-records-header-row">
          <div>
            <h1>Medical Records</h1>
            <p>Securely access and manage your complete health history. Your records are encrypted and private by default.</p>
          </div>
          <Button variant="primary" onClick={() => setShowNewRecord(true)}>
            <Plus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Add Record
          </Button>
        </div>

        <LoadState loading={loading} error={error} onRetry={refreshRecords} label="Loading your records…">
          <StatsRow records={allRecords} documents={documents.data || []} />

          <div className="sabi-grid sabi-records-grid">
            <div className="sabi-col">
              <RecordsSection records={allRecords} documents={documents} />
              <OrganizedRecords
                categories={categories.data || []}
                allRecords={allRecords}
                onAddCategory={handleAddCategory}
                onFile={handleFile}
                onCreateRecord={handleCreateRecord}
                onDeleteCategory={handleDeleteCategory}
              />
              <DocumentsCard documents={documents} records={allRecords} />
            </div>

            <div className="sabi-col">
              <VitalInfoCard />
              <RecentActivityCard records={allRecords} documents={documents.data || []} />
              <HealthInsightCard />
            </div>
          </div>
        </LoadState>
      </div>

      {showNewRecord && (
        <RecordFormModal
          categories={categories.data || []}
          onClose={() => setShowNewRecord(false)}
          onSave={async (fields) => {
            await handleCreateRecord(fields);
            setShowNewRecord(false);
          }}
        />
      )}
    </div>
  );
}

export default Records;
