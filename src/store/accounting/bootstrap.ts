// Eagerly instantiate the accounting stores at app startup.
//
// Zustand stores are created lazily on first use. The subledgers (AR, AP, …)
// post journal entries for their seeded, already-issued documents when their
// store is first created — so if nothing touched them, the General Ledger and
// Trial Balance would understate reality until a user happened to open a
// subledger page. Importing this module once (from main.tsx) forces every
// accounting store to hydrate in dependency order, so the GL is complete and
// self-consistent from the first render.

import { useLedger } from "@/store/accounting/useLedger";
import { useTax } from "@/store/accounting/useTax";
import { useAR } from "@/store/accounting/useAR";

useLedger.getState();
useTax.getState();
useAR.getState();
