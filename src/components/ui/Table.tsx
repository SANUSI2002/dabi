import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export function Table({
  columns,
  children,
  className,
}: {
  columns: (string | ReactNode)[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-mist-200 bg-mist-50/60">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="th">
                  {c}
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
}: {
  children: ReactNode;
  onClick?: () => void;
  index?: number;
  active?: boolean;
}) {
  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.4) }}
      onClick={onClick}
      className={cn(
        "transition-colors",
        onClick && "cursor-pointer hover:bg-brand-50/50",
        active && "bg-brand-50",
      )}
    >
      {children}
    </motion.tr>
  );
}

export const Cell = ({ children, className }: { children?: ReactNode; className?: string }) => (
  <td className={cn("td", className)}>{children ?? <span className="text-mist-300">—</span>}</td>
);
