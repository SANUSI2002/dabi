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
import { useAcctControl } from "@/store/accounting/useAcctControl";
import { useAR } from "@/store/accounting/useAR";
import { useAP } from "@/store/accounting/useAP";
import { useExpenses } from "@/store/accounting/useExpenses";
import { useBanking } from "@/store/accounting/useBanking";
import { useFixedAssets } from "@/store/accounting/useFixedAssets";
import { useBudgets } from "@/store/accounting/useBudgets";
import { useInventoryAccounting } from "@/store/accounting/useInventoryAccounting";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";

useLedger.getState();
useTax.getState();
useAcctControl.getState();
useAccountingSettings.getState();
useAR.getState();
useAP.getState();
useExpenses.getState();
useBanking.getState();
useFixedAssets.getState();
useBudgets.getState();
useInventoryAccounting.getState();
