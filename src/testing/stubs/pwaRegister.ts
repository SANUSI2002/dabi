// Test stand-in for vite-plugin-pwa's `virtual:pwa-register`, which only exists inside a Vite
// build with the PWA plugin. Tests replace it with vi.mock; this keeps the import resolvable.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
