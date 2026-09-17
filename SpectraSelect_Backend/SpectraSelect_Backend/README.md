# SpectraSelect Backend

Node.js + Express + MySQL backend for the SpectraSelect frontend.

## 1. Requirements
- Node.js installed
- MySQL Server installed
- MySQL Workbench (recommended, but optional)
- VS Code

## 2. Create the database
Open MySQL Workbench and run the complete file:

`sql/spectraselect.sql`

This creates:
- database: `spectraselect`
- table: `users`
- table: `standards`
- table: `recommendation_history`

## 3. Configure environment
Copy `.env.example` to `.env`.

Example:

PORT=4000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=spectraselect
JWT_SECRET=use_a_long_random_secret

If your MySQL root account has no password, leave DB_PASSWORD empty.

## 4. Install packages

Open a terminal inside this backend folder:

npm install

## 5. Start backend

npm start

You should see:

SpectraSelect API running at http://localhost:4000

Test:
http://localhost:4000/

and:
http://localhost:4000/api/health

## 6. Test the API
Register:
POST /api/auth/register

Login:
POST /api/auth/login

Standards:
GET /api/standards

FSPL:
POST /api/calculations/fspl

Battery:
POST /api/calculations/battery

Recommendation:
POST /api/recommendations

Recommendation history:
GET /api/recommendations/history

## 7. Connect the frontend
In your frontend `app.js`, replace client-side login/calculation calls with `fetch()` calls to:

http://localhost:4000/api/...

For login, save the returned token in localStorage:

localStorage.setItem("spectraselect_token", data.token);

Then send it for protected requests:

Authorization: Bearer YOUR_TOKEN

## Important
This backend uses real password hashing and JWT authentication. Do not commit `.env` to GitHub.
