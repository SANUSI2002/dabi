import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import 'leaflet/dist/leaflet.css';
import { registerPwa } from "../../shared-portal/pwa/registerPwa.ts";
import { captureInstallPrompt } from "../../shared-portal/pwa/installPrompt.js";

registerPwa();
// Before React mounts, so the browser's install offer is never missed.
captureInstallPrompt();

const container = document.getElementById("root");
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);