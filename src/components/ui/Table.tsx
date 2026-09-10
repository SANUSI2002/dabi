import { type ReactNode, type KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Table({
  columns,
  children,
  className,
  caption,
}: {
  columns: (string | ReactNode)[];
  children: ReactNode;
  className?: string;
  /** accessible description of the table — visually hidden, read by screen readers */
  caption?: string;
}) {
  return (
    <div className={cn("card overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-mist-200 bg-mist-50/70">
            <tr>
              {columns.map((column, index) => (
                <th key={index} scope="col" className="th">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Row({
  children,
  onClick,
  index = 0,
  active,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  index?: number;
  active?: boolean;
  className?: string;
}) {
  const interactive = Boolean(onClick);
  function onKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  }
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.25 }}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        "transition-colors",
        interactive
          ? "cursor-pointer hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
          : "hover:bg-mist-50/50",
        active && "bg-brand-50",
        className,
      )}
    >
      {children}
    </motion.tr>
  );
}

export const Cell = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("td", className)}>{children ?? <span className="text-mist-300">—</span>}</td>
);

/** A single full-width row for an in-table empty / message state. */
export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="td py-8 text-center text-sm text-mist-400">
        {children}
      </td>
    </tr>
  );
}
