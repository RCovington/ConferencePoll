# Conference Talk Poll — April 2026 General Conference

A web-based polling app that lets participants vote for their favorite talks from the April 2026 General Conference. An admin dashboard provides real-time results, QR code generation, and poll management.

## Features

- **Voter interface** — browse all 34 conference talks sorted by session, title, or speaker name; select up to N favorites and submit
- **Admin dashboard** — password-protected panel showing ranked results, total voter count, and per-talk vote counts
- **QR code generation** — generate a scannable QR code so participants can quickly open the poll on their phones
- **Poll reset** — clear all votes and start a new round; optionally change the max votes per person
- **CSV export & print** — save results as CSV or print directly from the admin panel
- **Cookie-based duplicate prevention** — each voter is tracked via a cookie so they can only submit once per poll generation

## Project Structure

```
├── server.js              # Standalone Express server (local development)
├── firebase.json          # Firebase Hosting + Functions config
├── package.json           # Root dependencies (local server)
├── functions/
│   ├── index.js           # Cloud Function entry point (Express app exported as "api")
│   └── package.json       # Function dependencies (includes firebase-functions)
└── public/
    ├── index.html          # Voter UI
    ├── admin.html          # Admin dashboard UI
    └── style.css           # Shared styles
```

## How It Works

The app runs an Express server that serves two pages:

| Route | Purpose |
|-------|---------|
| `/` | Voter-facing poll — lists talks, lets users pick favorites and submit |
| `/admin` | Admin dashboard — login with a password to view results, reset polls, generate QR codes |

All state (votes, voter tracking, admin sessions) is held **in memory** — there is no database. Restarting the server or redeploying the function clears all votes.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/talks` | — | Get talk list and poll settings |
| `GET` | `/api/voter/status` | — | Check if current voter has already voted |
| `POST` | `/api/vote` | — | Submit votes (array of talk IDs) |
| `POST` | `/api/admin/login` | — | Authenticate and receive admin token |
| `POST` | `/api/admin/logout` | Admin | End admin session |
| `GET` | `/api/admin/results` | Admin | Get ranked results |
| `POST` | `/api/admin/reset` | Admin | Reset poll (optionally set new maxVotes) |
| `POST` | `/api/admin/change-password` | Admin | Change admin password |
| `GET` | `/api/admin/qrcode` | Admin | Generate QR code data URL |

## Local Development

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the server:**

   ```bash
   npm start
   ```

3. Open `http://localhost:3000` for the voter poll and `http://localhost:3000/admin` for the dashboard.

The default admin password is set via the `ADMIN_PASSWORD` environment variable (falls back to the value in `server.js`).

## Deploying to Firebase

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- [Firebase CLI](https://firebase.google.com/docs/cli) — install with `npm install -g firebase-tools`
- A Firebase project (the project ID in `.firebaserc` or passed via `--project`)

### Steps

1. **Login to Firebase:**

   ```bash
   firebase login
   ```

2. **Install function dependencies:**

   ```bash
   cd functions
   npm install
   cd ..
   ```

3. **Deploy:**

   ```bash
   firebase deploy
   ```

   This deploys both **Hosting** (the `public/` folder) and the **Cloud Function** (`functions/`). Firebase Hosting rewrites `/api/**` requests to the Cloud Function named `api`.

4. Once deployed, the URL will be printed in the terminal — share it or generate a QR code from the admin panel.

### Configuration

- **`firebase.json`** — defines the hosting public directory, URL rewrites, and functions runtime
- **Runtime** — currently set to `nodejs22`
- **Admin password** — can be set via the `ADMIN_PASSWORD` environment variable on the Cloud Function. To set it:

  ```bash
  firebase functions:secrets:set ADMIN_PASSWORD
  ```

  Or use a `.env` file in the `functions/` directory for local emulator usage.

### Troubleshooting Deployment

If you see **"User code failed to load. Cannot determine backend specification. Timeout"**:

1. Make sure dependencies are installed in `functions/` (`cd functions && npm install`)
2. Ensure `firebase-functions` is up to date: `npm install --save firebase-functions@latest` (run inside `functions/`)
3. Make sure the `engines.node` field in `functions/package.json` matches the `runtime` in `firebase.json`
