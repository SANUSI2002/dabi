import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, LogOut, Settings2 } from "lucide-react";
import AiWorkspace from "../../apps/telemedicine/packages/shared-portal/ai/AiWorkspace.jsx";
import {
  restoreLiveIdentity,
  liveSignOut,
  type LiveIdentity,
} from "@/identity/liveIdentity";
import { AiBrand } from "./AiAuth";
import { aiAccountGet, aiRequest, type AiAccount } from "./api";
import "./standalone.css";
export default function AiEntry() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<LiveIdentity | null>(null),
    [account, setAccount] = useState<AiAccount | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let mounted = true;
    document.title = "Your workspace | Sabi AI";
    restoreLiveIdentity()
      .then(async (user) => {
        if (!mounted) return;
        if (!user) {
          navigate("/ai/login", { replace: true });
          return;
        }
        setIdentity(user);
        const a = await aiAccountGet<AiAccount>("/me");
        if (mounted) setAccount(a);
      })
      .catch((e) => setError(e.message));
    return () => {
      mounted = false;
    };
  }, [navigate]);
  if (!identity)
    return (
      <main className="sai-loading">
        <p role={error ? "alert" : "status"}>
          {error || (
            <>
              <Loader2 className="animate-spin" size={20} aria-hidden="true" />
              Opening your Sabi AI space…
            </>
          )}
        </p>
        {error && <Link to="/ai/login">Return to sign in</Link>}
      </main>
    );
  return (
    <div className="sai-workspace">
      <header className="sai-workspace-header">
        <AiBrand />
        <span className="sai-account-kind">
          {account?.category.toLowerCase() || "Your workspace"}
        </span>
        <nav aria-label="Account">
          <Link to="/ai/account">
            <Settings2 size={17} aria-hidden="true" />
            <span>Your account</span>
          </Link>
          <button
            onClick={async () => {
              await liveSignOut();
              navigate("/ai/login", { replace: true });
            }}
          >
            <LogOut size={17} aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </nav>
      </header>
      <AiWorkspace
        request={aiRequest}
        accountName={identity.user.fullName || identity.user.email}
        homeHref="/ai"
        embedded
      />
      {error && (
        <p className="sai-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
