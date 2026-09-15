import { create } from "zustand";
import { persisted } from "@/platform/persist";
import type { RoadmapPublicDTO } from "./domain";
import { seedPublicRoadmap } from "./publicSeed";

type PublicRoadmapState = {
  items: RoadmapPublicDTO[];
  setPublishedSnapshot: (items: RoadmapPublicDTO[]) => void;
};

export const usePublicRoadmap = create<PublicRoadmapState>(
  persisted<PublicRoadmapState>("public-product-roadmap-v1", (set) => ({
    items: seedPublicRoadmap,
    setPublishedSnapshot: (items) => set({ items }),
  }), {
    scope: "global",
    pick: (state) => ({ items: state.items }),
    merge: (base, saved) => {
      const savedItems = saved.items ?? [];
      const seedById = new Map(seedPublicRoadmap.map((item) => [item.id, item]));
      const savedIds = new Set(savedItems.map((item) => item.id));
      return { ...base, ...saved, items: [...savedItems.map((item) => ({ ...seedById.get(item.id), ...item })), ...seedPublicRoadmap.filter((item) => !savedIds.has(item.id))] };
    },
  }),
);
