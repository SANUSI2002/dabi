import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-mist-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={`relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-pop sm:max-h-[calc(100dvh-3rem)] ${
              wide ? "max-w-3xl" : "max-w-lg"
            }`}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-mist-100 px-5 py-4">
              <h3 className="truncate font-display text-lg font-bold text-mist-900">{title}</h3>
              <button
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 rounded-lg p-1.5 text-mist-400 hover:bg-mist-100 hover:text-mist-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-mist-100 bg-mist-50/60 px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
