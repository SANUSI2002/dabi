import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEmr } from "@/store/useEmr";
import { VitalsModal } from "./VitalsModal";

const initialQueue = useEmr.getState().queue;
const initialVitals = useEmr.getState().vitals;

afterEach(() => useEmr.setState({ queue: initialQueue, vitals: initialVitals }));

describe("vitals and routing", () => {
  it("retains observations and the selected queue priority", () => {
    const patient = useEmr.getState().patients[0];
    useEmr.setState({ queue: [{ id: "test-queue", patientId: patient.id, station: "Vital", priority: "Normal", status: "Waiting", enqueuedAt: new Date().toISOString(), waitMins: 0 }], vitals: {} });

    render(<VitalsModal patientId={patient.id} queueId="test-queue" open onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Vitals notes"), { target: { value: "Patient reports dizziness" } });
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "Urgent" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & Route" }));

    expect(useEmr.getState().vitals[patient.id]?.[0].notes).toBe("Patient reports dizziness");
    expect(useEmr.getState().queue[0].priority).toBe("Urgent");
  });
});
