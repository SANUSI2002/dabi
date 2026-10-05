import React, { useEffect, useState } from "react";
export default function SaveNotice() {
 const [failed, setFailed] = useState(false);
 useEffect(() => { const show = () => setFailed(true); window.addEventListener("sabi-save-failed", show); return () => window.removeEventListener("sabi-save-failed", show); }, []);
 return failed ? <div role="alert" className="dp-save-notice">Changes could not be saved. Check browser storage and retry before leaving.<button className="dp-text-btn" onClick={() => setFailed(false)}>Dismiss</button></div> : null;
}
