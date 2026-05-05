# Project Architecture & Setup Overview

## Purpose
High-level guide to how the codebase is organized, initialized, and wired together. Use this as a map before diving into module-level docs.

## Tech Stack
- Runtime: Node.js (ES modules)
- Framework: Express
- DB: MongoDB (native driver)
- Views: Server-rendered HTML/EJS under `modules/*/views`
- Validation: express-validator wrappers in module `validations.mjs`
- Async utilities: `async` (parallel/series helpers)
- HTTP/SOAP: axios, soap

## Top-Level Structure
```
/ (project root)
├── modules/               # Feature modules (admin, common, frontend, api)
├── middleware/            # Shared middlewares (auth, validation wrappers)
├── utils/                 # Cross-cutting utilities (dates, sanitizer, files)
├── config/                # Constants, DB table names, env settings
├── routes/                # Root route loader(s)
├── services/              # Shared services (logging, notifications, uploads)
├── index.mjs              # App entrypoint (Express bootstrap)
└── render.mjs             # Rendering helpers
```

## Initialization Flow (Happy Path)
1) **Process env**: Load `.env` (if present) and `config` constants.
2) **Express app**: `index.mjs` creates the app, attaches JSON/urlencoded parsers, sessions, locale, and static assets.
3) **Database**: Connect to MongoDB; collections accessed via `config/database_tables.mjs` names.
4) **Middleware**: Register auth guards (`checkLoggedInAdmin`, `checkRestaurantLoggedIn`, `authenticateAPIPublicRequest`), validation (`validateRequest`, `applyValidationInterCallFunction`), uploads, sanitizer, cache.
5) **Routes**: `routes`/`init_routes.mjs` dynamically loads module routers. Each module exports `configure(router, { db, ...middlewares })`.
6) **Views**: Each module sets `req.rendering.views` to its `views/` folder; renders HTML/EJS responses where applicable.
7) **Error handling**: Central Express error handler for thrown/returned errors.

## Module Pattern (applies to admin/common/frontend/api)
```
module_name/
├── model/           # Business logic & DB operations (classes)
├── routes.mjs       # Express routes; constructs modulePath; binds handlers
├── validations.mjs  # express-validator chains (optional)
└── views/           # HTML/EJS templates (may include README summarizing)
```
- Models receive `{ db }` and instantiate the collections they need.
- Routes wire HTTP verbs to model methods, applying middleware (auth/validate/upload) as needed.
- Validations define per-route schemas and are invoked via middleware helpers.

## Data & Constants
- **`config/global_constant.mjs`**: Status codes, roles, order states, feature flags, limits, regexes.
- **`config/database_tables.mjs`**: Canonical collection names; models call `db.collection(Tables.X)` to avoid typos.
- **`utils`**: Reusable helpers (date/time, sanitizer, file ops, logging, currency formatting, cache, slugging, geo helpers).

## Cross-Cutting Concerns
- **Authentication**: Dual context (Admin vs Restaurant vs Public API). Middlewares enforce role/type per route.
- **Validation**: express-validator chains + wrapper (`validateRequest`, `applyValidationInterCallFunction`).
- **File handling**: Upload/move/remove helpers; MIME/extension guards from constants.
- **Logging**: `saveOrderStatusLogs`, `saveSystemLogs`, `saveDriverStatusLogs`, `kfg_request_response` for external API calls.
- **Notifications**: Email/SMS/push helpers; inserts into notification collections.
- **Caching**: `myCache` used selectively for frequently read data.

## Dynamic Route Loading
- **Admin/Common/Frontend**: `modules/*/init_routes.mjs` enumerates module folders and imports each `routes.mjs`.
- **API (frontend/api)**: Similar dynamic loader (`init_routes.mjs`) for mobile/public APIs.

## Background & Cron Jobs
- Long-running or scheduled tasks live under `modules/frontend/crons` (documented separately).

## Error & Response Patterns
- Success: `{ status: "success", ...data }`
- Error: `{ status: "error", message, missing_fields? }`
- Errors propagate to Express `next(err)`; most model methods return structured objects the routes send.

## How to Run the App (local)

### Prerequisites
- Node.js installed (v14+ recommended)
- MongoDB installed and running
- All dependencies installed

### Step-by-Step Setup

1) **Install Dependencies**
```bash
npm install
```

2) **Configure Environment Variables**
- Copy the sample environment file to root:
  ```bash
  cp ".env.example" .env
  ```
- Edit `.env` file in the root directory and fill in your actual values:
  - **Required**: `PORT`, `MONGO_URL`, `DATABASE`
  - **Server**: `URL`, `HOST_URL`, `HOST_PORT`, `SERVER_IP`
  - **Google APIs**: `GOOGLE_API_KEY`, `GOOGLE_AUTO_COMPLETE_API_KEY`, `DISTANCE_GOOGLE_API`, `PLACES_GOOGLE_API`, `DIRECTION_GOOGLE_API`
  - **Push Notifications**: `ANDROID_SERVER_KEY`, `API_HEADER_AUTH_KEY`
  - **Other**: `SMTP_AUTH`, `SOCKET_ENABLE`, `TZ`, `CRON_SERVER_URL`, `DEBUG`, `ENV`
- **Important**: Never commit `.env` to version control

3) **Start MongoDB**
```bash
# On Linux/Mac
sudo systemctl start mongod
# Or
mongod

# On Windows
# Start MongoDB service from Services panel
```
- Ensure MongoDB is running and accessible at `MONGO_URL`

4) **Run Server**
```bash
npm start
# Or
node index.mjs
```
- This runs `node index.mjs` (Express entrypoint)
- Server binds to `PORT` from `.env` or falls back to default
- Check console for: "Server is running on port XXXX"
- Check console for: "Database connected successfully"

5) **Access Application**
- Admin Panel: `http://localhost:PORT/admin`
- Frontend: `http://localhost:PORT/`
- API: `http://localhost:PORT/api/`
- Routes are dynamically loaded via each `init_routes.mjs`

6) **Logs & Errors**
- Console output shows startup, DB connect, and any route/load errors

### Troubleshooting

- **Database Connection Errors**:
  - Verify MongoDB is running: `mongosh` or `mongo`
  - Check `MONGO_URL` format: `mongodb://localhost:27017/`
  - Verify database name in `DATABASE` variable

- **Port Already in Use**:
  - Change `PORT` in `.env` file
  - Or stop the process using the port

- **Missing Environment Variables**:
  - Check `.env.example` for all required variables
  - Ensure `.env` file exists in root directory
  - Verify no typos in variable names
  - Copy from `.env.example` if needed: `cp ".env.example" .env`

- **API Integration Errors**:
  - Verify API keys are correct in `.env`
  - Check API service URLs are accessible
  - Review console logs for specific error messages

## Extending the Codebase
- Add a module: create folder with `model/`, `routes.mjs`, optional `validations.mjs`, `views/`, then register in `init_routes.mjs`.
- Add a route: define validator (if needed), apply auth middleware, call model method; ensure constants cover any new statuses/types.
- Add a model method: instantiate needed collections in constructor, reuse utils/constants, return structured responses, log DB mutations.