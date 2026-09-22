# Patient Portal

This folder contains the patient-facing app.

## Adding a new section (e.g. Appointments, Doctors, Lab Results)

1. Create a new folder under `src/pages/` named after the section, e.g.
   `src/pages/appointments/`.
2. Copy the pattern used in `src/pages/dashboard/Dashboard.jsx`:
   - Import shared pieces from `design-system` (Card, Button, colors).
   - Build the page's own local components inside a `components/` folder
     next to the page if needed.
3. Add the new page to the app's routing (ask the team lead or check
   `src/routes.jsx` once it exists).

Only build the folder for a section when you're actually starting it —
no need to pre-create empty folders for the rest of the sidebar.
