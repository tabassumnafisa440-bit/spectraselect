# SpectraSelect API-ready frontend

This project is currently a frontend application. It is structured so a backend/API can be connected later.

Recommended API endpoints:
- POST /api/auth/login
- GET /api/standards
- POST /api/recommend
- POST /api/calculators/fspl
- POST /api/calculators/battery

The current demo authentication is client-side for easy VS Code testing:
Username: any non-empty value
Access Key: 1234

External frontend libraries are loaded by CDN:
- Chart.js
- Leaflet
- OpenStreetMap tiles
- Google Fonts
