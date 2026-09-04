import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import type { Patient } from "@/data/types";

export function PatientLink({
  patient,
  sub,
  className,
}: {
  patient?: Patient;
  sub?: string;
  className?: string;
}) {
  if (!patient) return <span className="text-mist-300">—</span>;
  return (
    <Link
      to={`/patients/${patient.id}`}
      className={cn("font-semibold text-mist-900 hover:text-brand-700 hover:underline", className)}
    >
      {patient.firstName} {patient.lastName}
      {sub !== undefined && <span className="block text-[11px] font-normal text-mist-400 no-underline">{sub}</span>}
    </Link>
  );
}
