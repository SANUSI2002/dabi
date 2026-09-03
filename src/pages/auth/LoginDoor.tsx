import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldPlus, ArrowRight, Loader2 } from "lucide-react";
import { useAuth } from "@/store/useAuth";
import { DoctorFigure } from "./DoctorFigure";
import { FACILITY } from "@/data/mock";

type Phase = "approach" | "push" | "open" | "form";

export default function LoginDoor() {
  const [phase, setPhase] = useState<Phase>("approach");
  const [busy, setBusy] = useState(false);
  const signIn = useAuth((s) => s.signIn);
  const nav = useNavigate();

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("push"), 1600);
    const t2 = setTimeout(() => setPhase("open"), 2500);
    const t3 = setTimeout(() => setPhase("form"), 3500);
    return () => [t1, t2, t3].forEach(clearTimeout);
  }, []);

  const doorsOpen = phase === "open" || phase === "form";

  function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setTimeout(() => {
      signIn();
      nav("/", { replace: true });
    }, 650);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#04281a]">
      {/* ambient light behind the doors */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_40%,rgba(47,221,138,0.25),transparent_70%)]" />

      {/* skip */}
      {phase !== "form" && (
        <button
          onClick={() => setPhase("form")}
          className="absolute right-5 top-5 z-40 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur hover:bg-white/20"
        >
          Skip intro
        </button>
      )}

      {/* ===== The hospital facade + doors ===== */}
      <div
        className="absolute inset-0 grid place-items-center"
        style={{ perspective: "1400px" }}
      >
        <div className="relative h-[560px] w-[440px] max-w-[92vw]">
          {/* facade header sign */}
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="absolute -top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-brand-gradient px-5 py-2.5 text-white shadow-glow"
          >
            <ShieldPlus size={18} />
            <span className="font-display text-lg font-extrabold tracking-tight">SABI HEALTH</span>
          </motion.div>

          {/* door frame */}
          <div className="absolute inset-x-0 bottom-0 top-8 rounded-t-[28px] bg-[#0a3a26] p-3 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
            <div
              className="relative h-full w-full overflow-hidden rounded-t-[18px] bg-[#052a1b]"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* interior glow (revealed behind doors) */}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#eafff4_0%,#cdffe4_45%,#9ff9cb_100%)]" />
              <motion.div
                className="absolute inset-0"
                animate={{ opacity: doorsOpen ? 0.0 : 0.0 }}
              />

              {/* left door */}
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 origin-left border-r border-white/20 bg-[linear-gradient(135deg,rgba(47,221,138,0.35),rgba(10,79,50,0.55))] backdrop-blur-[2px]"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: doorsOpen ? -105 : 0 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <DoorGlass side="left" />
              </motion.div>

              {/* right door */}
              <motion.div
                className="absolute inset-y-0 right-0 w-1/2 origin-right border-l border-white/20 bg-[linear-gradient(225deg,rgba(47,221,138,0.35),rgba(10,79,50,0.55))] backdrop-blur-[2px]"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: doorsOpen ? 105 : 0 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <DoorGlass side="right" />
              </motion.div>

              {/* ===== Login card revealed behind doors ===== */}
              <AnimatePresence>
                {phase === "form" && (
                  <motion.div
                    className="absolute inset-0 grid place-items-center p-5"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 220, damping: 24 }}
                  >
                    <LoginCard busy={busy} onSubmit={submit} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* the doctor */}
          <div className="absolute -bottom-2 left-1/2 z-20 h-[300px] -translate-x-1/2">
            <DoctorFigure phase={phase} />
          </div>
        </div>
      </div>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-center text-[11px] text-white/40">
        {FACILITY.name} · {FACILITY.code} · Electronic Medical Records
      </p>
    </div>
  );
}

function DoorGlass({ side }: { side: "left" | "right" }) {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-3 rounded-lg border border-white/25" />
      <div className="absolute inset-x-3 top-1/2 h-px bg-white/20" />
      {/* handle */}
      <div
        className={`absolute top-1/2 h-16 w-1.5 -translate-y-1/2 rounded-full bg-white/70 ${
          side === "left" ? "right-2" : "left-2"
        }`}
      />
      {/* sheen */}
      <motion.div
        className="absolute inset-0 bg-[linear-gradient(115deg,transparent_40%,rgba(255,255,255,0.35)_50%,transparent_60%)]"
        animate={{ x: ["-60%", "60%"] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
      />
    </div>
  );
}

function LoginCard({ busy, onSubmit }: { busy: boolean; onSubmit: (e: FormEvent) => void }) {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-pop ring-1 ring-white/60 backdrop-blur">
      <div className="mb-5 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-gradient text-white shadow-glow">
          <ShieldPlus size={20} />
        </div>
        <div>
          <p className="font-display text-xl font-extrabold text-mist-900">
            Sabi<span className="text-gradient">EMR</span>
          </p>
          <p className="text-xs text-mist-400">Welcome back, please sign in</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <span className="label">Username</span>
          <input defaultValue="adaeze.okonjo" className="input" autoComplete="username" />
        </div>
        <div>
          <span className="label">Password</span>
          <input type="password" defaultValue="demo1234" className="input" autoComplete="current-password" />
        </div>
        <label className="flex items-center gap-2 pt-1 text-xs text-mist-500">
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-mist-300 text-brand-600" />
          Keep me signed in on this device
        </label>
        <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
          {busy ? "Opening…" : "Enter Hospital"}
        </button>
      </form>

      <p className="mt-4 text-center text-[11px] text-mist-400">
        Protected under NDPR · all activity is audited
      </p>
    </div>
  );
}
