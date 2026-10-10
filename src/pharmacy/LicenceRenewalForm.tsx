import { type FormEvent } from "react";
import { writeLive, type PharmacyBranch, type LivePharmacy } from "./liveApi";

const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cfe0d8] bg-white px-3 py-2";
export default function LicenceRenewalForm({
  pharmacy,
  branch,
  busy,
  perform,
}: {
  pharmacy: LivePharmacy;
  branch?: PharmacyBranch;
  busy: boolean;
  perform: (action: () => Promise<unknown>, message: string) => Promise<void>;
}) {
  const details = pharmacy.registrationDetails;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const expiry = new Date(
      `${data.get("expiry")}T23:59:59.999Z`,
    ).toISOString();
    const values = branch
      ? {
          name: data.get("name"),
          address: data.get("address"),
          latitude: Number(data.get("latitude")),
          longitude: Number(data.get("longitude")),
          premisesLicenceNumber: data.get("licence"),
          licenceExpiresAt: expiry,
          version: branch.version,
        }
      : {
          superintendentName: data.get("name"),
          superintendentRegistrationNumber: data.get("licence"),
          superintendentLicenceExpiresAt: expiry,
        };
    await perform(
      () =>
        writeLive(
          `/api/v1/pharmacy-portal/${branch ? `branches/${branch.id}` : "superintendent"}`,
          { ...values, reason: data.get("reason") },
          "PATCH",
        ),
      "Licence details updated. Upload replacement evidence and resubmit your application; marketplace selling is paused until reapproval.",
    );
  }
  return (
    <details className="rounded-xl border border-[#dbe9e2] p-4">
      <summary className="min-h-11 cursor-pointer font-semibold">
        {branch
          ? "Update premises or renew licence"
          : "Update superintendent or renew licence"}
      </summary>
      <p className="mt-2 text-sm text-[#5b766a]">
        Changes pause marketplace selling and require new documents and
        independent approval. Existing orders retain their original financial
        records.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          {branch ? "Branch name" : "Superintendent name"}
          <input
            name="name"
            required
            minLength={3}
            maxLength={120}
            defaultValue={branch?.name || details?.superintendentName}
            className={input}
          />
        </label>
        <label className="text-sm font-semibold">
          {branch ? "PCN premises licence number" : "PCN registration number"}
          <input
            name="licence"
            required
            minLength={3}
            maxLength={100}
            defaultValue={
              branch?.premisesLicenceNumber ||
              details?.superintendentRegistrationNumber
            }
            className={input}
          />
        </label>
        <label className="text-sm font-semibold">
          Licence expiry
          <input
            name="expiry"
            type="date"
            required
            defaultValue={(
              branch?.licenceExpiresAt ||
              details?.superintendentLicenceExpiresAt
            )?.slice(0, 10)}
            className={input}
          />
        </label>
        {branch && (
          <>
            <label className="text-sm font-semibold">
              Address
              <input
                name="address"
                required
                minLength={5}
                maxLength={300}
                defaultValue={branch.address}
                className={input}
              />
            </label>
            <label className="text-sm font-semibold">
              Latitude
              <input
                name="latitude"
                required
                type="number"
                step="any"
                min={-90}
                max={90}
                defaultValue={branch.latitude}
                className={input}
              />
            </label>
            <label className="text-sm font-semibold">
              Longitude
              <input
                name="longitude"
                required
                type="number"
                step="any"
                min={-180}
                max={180}
                defaultValue={branch.longitude}
                className={input}
              />
            </label>
          </>
        )}
        <label className="text-sm font-semibold sm:col-span-2">
          Reason for change
          <textarea
            name="reason"
            required
            minLength={10}
            maxLength={1000}
            className={input}
          />
        </label>
        <button
          disabled={busy}
          className="min-h-11 rounded-xl bg-[#0d2c22] px-4 font-semibold text-white disabled:opacity-50"
        >
          Save renewal details
        </button>
      </form>
    </details>
  );
}
