import { create } from "zustand";

export type ProductContext = "all" | "sabi-os" | "sabi-health";

type ProductContextState = {
  product: ProductContext;
  setProduct: (product: ProductContext) => void;
};

// Which half of the ecosystem the Command Center UI is currently scoped to. Session-only —
// intentionally not persisted, so returning admins always start at the full ecosystem view.
export const useProductContext = create<ProductContextState>((set) => ({
  product: "all",
  setProduct: (product) => set({ product }),
}));
