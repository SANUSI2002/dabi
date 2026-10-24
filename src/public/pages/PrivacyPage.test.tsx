import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacyPage from "./PrivacyPage";
import { surfaceForPath } from "@/deployment/surface";

describe("approved public privacy notice", () => {
  it("is a public Health route and includes the real processing disclosures", () => {
    expect(surfaceForPath('/privacy')).toBe('health');
    render(<PrivacyPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sabi Health privacy notice');
    expect(screen.getByText(/Cloudmersive receives file contents/)).toBeInTheDocument();
    expect(screen.getByText(/does not request access to your Gmail/)).toBeInTheDocument();
    expect(screen.getByText(/current AI-document-processing capability is not enabled/)).toBeInTheDocument();
    expect(screen.getByRole('link', {name:'support@sabihealth.org'})).toHaveAttribute('href', 'mailto:support@sabihealth.org');
    expect(screen.queryByText(/draft for owner approval|pending formal approval/i)).not.toBeInTheDocument();
  });
});
