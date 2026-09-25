# SpectraSelect API-ready frontend

This project is currently a frontend application. It is structured so a backend/API can be connected later.

API endpoints of SpectraSelect_Backend (see its README):
- POST /api/recommendations/preview   <- used by the Compute button
- POST /api/recommendations           (login required, saves history)
- GET  /api/standards
- POST /api/calculations/fspl
- POST /api/calculations/battery
- POST /api/auth/login, /api/auth/register

The current demo authentication is client-side for easy VS Code testing:
Username: any non-empty value
Access Key: 1234

Chart.js and Leaflet are bundled in the vendor/ folder.
OpenStreetMap tiles and Google Fonts still need internet.
