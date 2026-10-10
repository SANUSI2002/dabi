import {
  Bike,
  CheckCircle2,
  MapPin,
  Package,
  ShieldCheck,
} from "lucide-react";
import { RIDER_JOIN_URL, RIDER_SIGN_IN_URL } from "./ecosystemLinks";
import { Action, Eyebrow, Reveal, TextLink } from "./ui";

export default function RiderSection() {
  return (
    <section
      id="riders"
      aria-labelledby="riders-heading"
      className="scroll-mt-[72px] bg-[#f6f9f5] px-5 py-16 sm:px-8 lg:px-10 lg:py-24"
    >
      <div className="mx-auto grid max-w-[1200px] items-center gap-10 overflow-hidden rounded-[28px] border border-[#d8e5d8] bg-[#eaf2e5] p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:p-12">
        <Reveal>
          <Eyebrow>The last mile of care</Eyebrow>
          <h2
            id="riders-heading"
            className="font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.04em] sm:text-[44px]"
          >
            From the pharmacy.
            <br />
            <span className="text-brand-700">Into the right hands.</span>
          </h2>
          <p className="mt-5 max-w-[440px] text-base leading-7 text-[#405c48]">
            Sabi riders connect partner pharmacies with patients. A pharmacy
            code confirms collection. A separate patient code confirms delivery.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Action href={RIDER_SIGN_IN_URL}>
              Rider sign in
            </Action>
            <TextLink href={RIDER_JOIN_URL}>Join the rider network</TextLink>
          </div>
          <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#405c48]">
            <ShieldCheck size={16} aria-hidden="true" /> Rider access is
            activated by Sabi operations.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div
            className="relative mx-auto max-w-[420px] rounded-[24px] border border-white/90 bg-white/60 p-5 sm:p-7"
            aria-label="Pharmacy collection and patient delivery are confirmed with different codes"
          >
            <div className="flex items-center justify-between border-b border-[#d5e2d2] pb-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#34563b]">
                <Bike size={20} aria-hidden="true" /> SABI RIDER
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-[#34563b]">
                Care, connected
              </span>
            </div>
            <div
              aria-hidden="true"
              className="relative flex min-h-[200px] items-center justify-center"
            >
              <div className="absolute h-[150px] w-[150px] rounded-full border border-dashed border-[#9db699]" />
              <div className="relative grid h-[120px] w-[120px] place-items-center rounded-full bg-[#d8e8ce] text-[#315c3c]">
                <Bike size={76} strokeWidth={1.25} />
              </div>
            </div>
            <ol className="grid gap-3">
              <li className="flex items-center gap-3 rounded-2xl border border-[#dce6d6] bg-white p-4">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4e8] text-[#3a603f]"
                >
                  <Package size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Pharmacy collection</p>
                  <p className="mt-0.5 text-xs text-[#536b54]">
                    Pharmacy's code verifies pickup
                  </p>
                </div>
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-brand-700"
                />
              </li>
              <li className="flex items-center gap-3 rounded-2xl border border-[#dce6d6] bg-white p-4">
                <span
                  aria-hidden="true"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#edf4e8] text-[#3a603f]"
                >
                  <MapPin size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">Patient delivery</p>
                  <p className="mt-0.5 text-xs text-[#536b54]">
                    Patient's code verifies handover
                  </p>
                </div>
                <ShieldCheck
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-brand-700"
                />
              </li>
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
