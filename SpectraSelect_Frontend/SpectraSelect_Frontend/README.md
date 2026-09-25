# SpectraSelect Frontend

## Run the complete connected project
1. Start MySQL.
2. Run the SQL file from `SpectraSelect_Backend/SpectraSelect_Backend/sql/spectraselect.sql` in MySQL Workbench.
3. Configure the backend `.env`.
4. Start the backend with `npm start` or `START_BACKEND.bat`.
5. Verify `http://localhost:4000/api/health` returns `database: connected`.
6. Open this frontend `index.html` with VS Code Live Server.

### Architecture
**Frontend → Node.js/Express API → MySQL database**

The Compute Recommendation Matrix button now uses the backend/MySQL result only. There is no browser fallback.
