import React, { useState } from "react";
import { Card } from "design-system";
import { FolderPlus } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { CategoryDetailModal } from "./CategoryDetailModal";
import { AddCategoryModal } from "./AddCategoryModal";
import { categoryIcon } from "../data";

export function OrganizedRecords({ categories, allRecords, onAddCategory, onFile, onCreateRecord, onDeleteCategory }) {
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const openCategory = categories.find((c) => c.id === openCategoryId) || null;

  return (
    <section>
      <SectionTitle>Organized Records</SectionTitle>
      <p className="sabi-organized-sub">
        Your records, sorted into folders. Open a folder to see what's filed, file an existing record into it, or take one
        out — or create a new folder for anything that doesn't fit yet.
      </p>

      <div className="sabi-category-grid">
        {categories.map((category) => {
          const Icon = categoryIcon(category.icon);
          const count = allRecords.filter((r) => r.categoryId === category.id).length;
          return (
            <Card
              key={category.id}
              className="sabi-category-card"
              onClick={() => setOpenCategoryId(category.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setOpenCategoryId(category.id)}
            >
              <div className="sabi-category-icon">
                <Icon size={20} />
              </div>
              <div className="sabi-category-label">{category.name}</div>
              <div className="sabi-category-count">
                {count} {count === 1 ? "Record" : "Records"}
              </div>
              <span className="sabi-category-bar" />
            </Card>
          );
        })}

        <button type="button" className="sabi-category-add" onClick={() => setShowAddCategory(true)}>
          <FolderPlus size={20} />
          Add Folder
        </button>
      </div>

      {openCategory && (
        <CategoryDetailModal
          category={openCategory}
          allRecords={allRecords}
          onClose={() => setOpenCategoryId(null)}
          onAssign={(recordId) => onFile(recordId, openCategory.id)}
          onUnassign={(recordId) => onFile(recordId, null)}
          onCreate={(fields) => onCreateRecord({ ...fields, categoryId: openCategory.id })}
          onDeleteCategory={onDeleteCategory}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onCreate={async (newCategory) => {
            await onAddCategory(newCategory);
            setShowAddCategory(false);
          }}
        />
      )}
    </section>
  );
}

export default OrganizedRecords;
