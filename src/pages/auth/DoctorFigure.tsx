import { motion } from "framer-motion";

/** Stylised doctor walking up and pushing the door. */
export function DoctorFigure({ phase }: { phase: "approach" | "push" | "open" | "form" }) {
  const armPush = phase === "push" || phase === "open";
  return (
    <motion.svg
      viewBox="0 0 120 220"
      className="h-full w-auto drop-shadow-[0_20px_25px_rgba(4,40,26,0.35)]"
      initial={{ x: -180, opacity: 0 }}
      animate={
        phase === "approach"
          ? { x: -10, opacity: 1 }
          : phase === "push"
            ? { x: 6, opacity: 1 }
            : phase === "open"
              ? { x: 30, opacity: 1 }
              : { x: 90, opacity: 0, scale: 0.9 }
      }
      transition={{ duration: phase === "approach" ? 1.4 : 0.9, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* subtle body bob while approaching */}
      <motion.g
        animate={phase === "approach" ? { y: [0, -3, 0] } : { y: 0 }}
        transition={{ repeat: phase === "approach" ? Infinity : 0, duration: 0.6 }}
      >
        {/* legs */}
        <motion.g
          animate={phase === "approach" ? { rotate: [6, -6, 6] } : { rotate: 0 }}
          transition={{ repeat: phase === "approach" ? Infinity : 0, duration: 0.6 }}
          style={{ transformOrigin: "60px 150px" }}
        >
          <rect x="49" y="148" width="10" height="52" rx="5" fill="#0a4f32" />
          <rect x="61" y="148" width="10" height="52" rx="5" fill="#0a603b" />
          <rect x="45" y="196" width="18" height="8" rx="4" fill="#012c1c" />
          <rect x="59" y="196" width="18" height="8" rx="4" fill="#012c1c" />
        </motion.g>

        {/* white coat / torso */}
        <path d="M40 92c0-11 9-20 20-20s20 9 20 20v56H40V92z" fill="#f4faf6" />
        <path d="M60 74v74" stroke="#d3e9db" strokeWidth="2" />
        {/* stethoscope */}
        <path d="M52 80c-6 8-4 20 4 24M68 80c6 8 4 20-4 24" stroke="#0fc06d" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="60" cy="108" r="4" fill="#059a57" />
        {/* scrub collar */}
        <path d="M50 76l10 10 10-10-4-6h-12z" fill="#2fdd8a" />

        {/* pushing arm */}
        <motion.g
          style={{ transformOrigin: "44px 96px" }}
          animate={{ rotate: armPush ? -58 : -8 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
        >
          <rect x="30" y="92" width="16" height="9" rx="4.5" fill="#f4faf6" />
          <circle cx="30" cy="96" r="6" fill="#e8b98c" />
        </motion.g>
        {/* other arm */}
        <rect x="74" y="94" width="9" height="34" rx="4.5" fill="#f4faf6" />
        <circle cx="78" cy="128" r="5" fill="#e8b98c" />

        {/* head */}
        <circle cx="60" cy="56" r="16" fill="#e8b98c" />
        <path d="M44 52c2-12 12-18 16-18s14 6 16 18c-6-6-10-7-16-7s-12 1-16 7z" fill="#2c2016" />
        {/* head mirror */}
        <circle cx="60" cy="46" r="5" fill="#eafff4" stroke="#0fc06d" strokeWidth="2" />
      </motion.g>
    </motion.svg>
  );
}
