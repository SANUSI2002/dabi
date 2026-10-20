import { render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import AiKnowledgePage from "./AiKnowledgePage";
import { CcProvider } from "./kit";
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("./api", () => ({ ccGet: mocks.get, ccPost: mocks.post }));
it("never loads a catalogue or upload control for an unauthorised platform user", () => {
  render(
    <CcProvider
      me={{
        id: "qa",
        name: "QA",
        email: "qa@test.invalid",
        roles: ["SABI_SUPPORT"],
        permissions: ["platform.ops.read"],
        twoStepVerification: true,
      }}
    >
      <AiKnowledgePage />
    </CcProvider>,
  );
  expect(
    screen.queryByRole("button", { name: "Add document" }),
  ).not.toBeInTheDocument();
  expect(mocks.get).not.toHaveBeenCalled();
});
