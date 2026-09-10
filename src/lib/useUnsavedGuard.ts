import { useEffect } from "react";

// Warns before the tab is closed / reloaded while there is unsaved work.
// This app uses a non-data <BrowserRouter>, so in-app navigation blocking is
// handled explicitly by each screen (e.g. a confirm before switching patient).
export function useUnsavedGuard(dirty: boolean, message = "You have unsaved clinical notes. Leave without saving?") {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, message]);
}

/** confirm before running `action` when there is unsaved work */
export function confirmIfDirty(dirty: boolean, action: () => void, message = "Discard the unsaved clinical note?") {
  if (!dirty || window.confirm(message)) action();
}
