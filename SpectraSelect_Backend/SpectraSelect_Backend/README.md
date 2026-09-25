# SpectraSelect Backend — MySQL connected

## Correct run order
1. Start **MySQL** (XAMPP/WAMP/MySQL service).
2. Open MySQL Workbench and run `sql/spectraselect.sql`. This creates/updates database `spectraselect` and inserts the 7 wireless standards.
3. Copy `.env.example` to `.env` and set your MySQL password. Example:
   `DB_HOST=localhost`
   `DB_USER=root`
   `DB_PASSWORD=YOUR_MYSQL_PASSWORD`
   `DB_NAME=spectraselect`
   `PORT=4000`
   `JWT_SECRET=any_long_random_secret`
4. In this folder run `npm install` once.
5. Run `npm start` (or double-click `START_BACKEND.bat`).
6. Browser test: `http://localhost:4000/` should show **SpectraSelect API is running**.
7. Database test: `http://localhost:4000/api/health` should show `database: connected`.
8. Open the frontend `index.html` with VS Code Live Server.

## Frontend connection
The frontend is now **backend-only for recommendation calculation**. It calls:
`POST http://localhost:4000/api/recommendations/preview`
There is no local calculation fallback. Therefore, if the backend/MySQL is down, the UI clearly reports the backend error instead of silently using browser data.

## Important
- Do not put `.env` in GitHub.
- If `/api/health` says `database: not connected`, fix the MySQL credentials/database first.
- If the page says `Backend not reachable` but `/api/health` works, make sure the frontend is opened through Live Server and that nothing else is using port 4000.
