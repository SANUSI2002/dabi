import { type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Printer } from "lucide-react";
import { ShieldPlus } from "lucide-react";
import { FACILITY } from "@/data/mock";
import { useIdentity } from "@/store/useIdentity";
import { dateTime } from "@/lib/format";

export function PrintDoc({
  open,
  onClose,
  docTitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  docTitle: string;
  children: ReactNode;
}) {
  const printedBy = useIdentity((s) => s.user.name);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="print-area fixed inset-0 z-50 overflow-y-auto bg-mist-900/50 p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-[820px] items-center justify-between">
            <span className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-mist-700">{docTitle}</span>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="btn-primary">
                <Printer size={15} /> Print / Save as PDF
              </button>
              <button onClick={onClose} className="btn-ghost">
                <X size={15} /> Close
              </button>
            </div>
          </div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="print-page mx-auto max-w-[820px] rounded-xl bg-white p-10 shadow-pop"
          >
            <header className="mb-6 flex items-start justify-between border-b-2 border-brand-600 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-gradient text-white">
                  <ShieldPlus size={22} />
                </div>
                <div>
                  <p className="font-display text-xl font-extrabold text-mist-900">{FACILITY.name}</p>
                  <p className="text-xs text-mist-500">
                    {FACILITY.code} · {FACILITY.lga} LGA, {FACILITY.state} State · Primary Health Care
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-mist-400">
                <p className="font-bold uppercase tracking-wide text-brand-700">{docTitle}</p>
                <p>Generated {dateTime(new Date())}</p>
              </div>
            </header>

            {children}

            <footer className="mt-10 border-t border-mist-200 pt-3 text-[10px] text-mist-400">
              Computer-generated document · SabiEMR · printed by {printedBy} · Confidential medical record — handle
              under NDPR.
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Line({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between border-b border-dashed border-mist-200 py-1.5 text-sm">
      <span className="text-mist-500">{label}</span>
      <span className="font-medium text-mist-900">{value ?? "—"}</span>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-brand-700">{title}</h3>
      {children}
    </section>
  );
}

export function SignRow({ roles }: { roles: string[] }) {
  return (
    <div className="mt-8 grid gap-8" style={{ gridTemplateColumns: `repeat(${roles.length}, 1fr)` }}>
      {roles.map((r) => (
        <div key={r} className="text-center">
          <div className="mb-1 border-t border-mist-400 pt-1 text-[11px] text-mist-500">{r}</div>
        </div>
      ))}
    </div>
  );
}
