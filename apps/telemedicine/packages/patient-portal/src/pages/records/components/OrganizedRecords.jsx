import React, { useState } from "react";
import { Card } from "design-system";
import { FolderPlus } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { CategoryDetailModal } from "./CategoryDetailModal";
import { AddCategoryModal } from "./AddCategoryModal";

function formatCount(category, filedCount) {
  if (category.countLabel) {
    return filedCount > 0 ? `${category.countLabel} · +${filedCount} filed` : category.countLabel;
  }
  const total = (category.baseCount || 0) + filedCount;
  return `${total} ${category.unit}`;
}

export function OrganizedRecords({ categories, allRecords, onAddCategory, onAssign, onUnassign, onCreateRecord, onDeleteCategory }) {
  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const openCategory = categories.find((c) => c.id === openCategoryId) || null;

  return (
    <section>
      <SectionTitle>Organized Records</SectionTitle>
      <p className="sabi-organized-sub">
        Your records, sorted into categories. Click a category to see what's filed, add an existing record to it, or
        remove one — or create a new category for anything that doesn't fit yet.
      </p>

      <div className="sabi-category-grid">
        {categories.map((category) => {
          const filedCount = allRecords.filter((r) => r.categoryId === category.id).length;
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
                <category.icon size={20} />
              </div>
              <div className="sabi-category-label">{category.label}</div>
              <div className="sabi-category-count">{formatCount(category, filedCount)}</div>
              <span className="sabi-category-bar" />
            </Card>
          );
        })}

        <button type="button" className="sabi-category-add" onClick={() => setShowAddCategory(true)}>
          <FolderPlus size={20} />
          Add Category
        </button>
      </div>

      {openCategory && (
        <CategoryDetailModal
          category={openCategory}
          allRecords={allRecords}
          onClose={() => setOpenCategoryId(null)}
          onAssign={(recordId) => onAssign(recordId, openCategory.id)}
          onUnassign={onUnassign}
          onCreate={(record) => onCreateRecord(openCategory.id, record)}
          onDeleteCategory={onDeleteCategory}
        />
      )}

      {showAddCategory && (
        <AddCategoryModal
          onClose={() => setShowAddCategory(false)}
          onCreate={(newCategory) => {
            onAddCategory(newCategory);
            setShowAddCategory(false);
          }}
        />
      )}
    </section>
  );
}

export default OrganizedRecords;
