# Hospital Ordination

Hospital Ordination is a starter repository for coordinating hospital operations with a lightweight Node.js demo that lets you schedule and review ordinations (appointments).

## Stack
- **Backend**: A minimal Node.js server using the native `http` module (no external packages) to serve JSON endpoints and static assets.
- **Frontend**: Static HTML, CSS, and vanilla JavaScript for creating and listing ordinations.
- **Data**: JSON file storage at `data/appointments.json` for persistence on the server.

## Running locally
1. Ensure Node.js is installed (version 18+ recommended for `crypto.randomUUID`).
2. From the repository root, start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in your browser. Use the form to add new ordinations and see them appear in the list. Data is saved to `data/appointments.json`.

### Run the automated checks
Use Node's built-in test runner to exercise the API endpoints end-to-end:

```bash
npm test
```

## Project layout
- `backend/server.js` — Node server with `/api/appointments` endpoints and static file serving.
- `frontend/index.html` — Single-page interface to create and view ordinations.
- `data/appointments.json` — Saved ordination data for the demo environment.

## Next steps
- Replace JSON file storage with a real database (e.g., PostgreSQL or SQLite).
- Add authentication/authorization for staff accounts.
- Deploy to DigitalOcean App Platform or Droplets once you are ready for hosting.
