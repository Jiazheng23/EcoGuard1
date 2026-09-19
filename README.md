# EcoGuard EEWS

EcoGuard is a web-based ecological early-warning and sustainable-tourism platform for Malaysian tourist locations. It combines a React frontend, an Express API, and Supabase services to support tourist carbon calculations, personal Eco Scores, ecological monitoring, waste operations, environmental analytics, administrator workflows, realtime warnings, and critical email alerts.

## Main modules

### Tourist

- **Carbon Footprint Calculator and Recommendation**
  - Search for Malaysian locations or select them from a Leaflet/OpenStreetMap map.
  - Calculate routes for car, motorcycle, bicycle, walking, bus, LRT/MRT, and mixed transport.
  - Compare estimated emissions and receive a distance-based greener-mode recommendation.
  - Review public-transport journey legs returned by Transitous.
  - Calculate freely without saving; Trip History and the stored Eco Score change only after **Save Trip** is selected.
- **Personal Eco Dashboard**
  - View the current Eco Score, trip emissions, transport usage, trends, recommendations, and earned badges.
- **Trip History and Achievements**
  - Search and filter saved journeys, review positive or negative Eco Score changes, and export trip reports.
- **Ecological Monitoring**
  - View tourist-safe environmental indicators, active advisories, location details, and incident reporting features.

### Location administrator

- Access exactly one assigned ecological location.
- View its dashboard, sensor readings, thresholds, alerts, waste workflows, analytics, reports, incidents, advisories, and profile.
- Schedule or record waste collections and review traceable alert-response history.
- Cannot create/delete locations, view global profiles, or access another location's protected data.

### Super administrator

- Manage all locations, administrator applications, sensors, thresholds, warnings, waste operations, incidents, advisories, analytics, reports, and profiles.
- Approve or reject location-administrator applications and assign one unreserved location.
- Pause or resume the five-minute simulated sensor update for individual locations.

## Roles and authorization

EcoGuard uses these profile roles:

- `tourist`
- `pending_location_admin`
- `location_admin`
- `super_admin`

Supabase Row Level Security (RLS), trusted Auth metadata, database functions, and backend checks form the authorization boundary. Hidden navigation items and frontend route guards improve the user experience but are not treated as the security boundary.

A location administrator is restricted to one `location_id`. A super administrator has global access. Public registration never creates a super administrator.

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, Vite, React Router, Tailwind CSS, Recharts |
| Map UI | Leaflet and React Leaflet with OpenStreetMap tiles |
| Backend | Node.js, Express 5 |
| Platform | Supabase Auth, PostgreSQL, PostgREST/RPC, Realtime, Storage, RLS, Cron, Database Webhooks, Edge Functions |
| Location search | Nominatim |
| Road routing | OSRM-compatible driving, cycling, and walking endpoints |
| Public transport | Transitous/MOTIS |
| Critical email | Gmail API through a Supabase Edge Function |

## Carbon Calculator behaviour

The routing APIs provide route information; they do not calculate CO2 emissions.

- Nominatim searches for Malaysian locations and reverse-geocodes map selections.
- OSRM-compatible endpoints calculate car, motorcycle, bicycle, and walking routes.
- Transitous/MOTIS supplies suggested bus, LRT/MRT, and mixed public-transport itineraries.
- Public-transport legs and schedules are recommendations and should be confirmed before travelling.

EcoGuard calculates estimated emissions using:

```text
CO2 per passenger (kg)
= route distance (km) x emission factor (g CO2e/passenger-km)
  x round-trip multiplier / 1000
```

Road-transport factors are based on Muhammad Saifuddin et al. (2019), and the LRT/MRT factor uses the transit-rail value in the MITI i-ESGStart guide. Walking and bicycle are treated as having zero direct operational transport emissions. Actual results can vary with traffic, vehicle efficiency, occupancy, and service conditions.

- [Muhammad Saifuddin et al. (2019)](https://doi.org/10.1088/1755-1315/373/1/012024)
- [MITI i-ESGStart](https://www.miti.gov.my/miti/resources/IESG/Booklet_Stater_Kit.pdf)

## Architecture overview

```text
React presentation layer
        |
        +--> Supabase Auth, database, RPC, Realtime, and Storage
        |
        `--> Express API
                |
                +--> Nominatim
                +--> OSRM-compatible route services
                `--> Transitous/MOTIS

Supabase PostgreSQL
        |
        +--> database functions, triggers, RLS, and Cron
        `--> critical-alert webhook --> Edge Function --> Gmail API
```

## Prerequisites

- Node.js and npm
- A Supabase project
- A database containing the base EcoGuard tables, including `profiles`, `ecological_locations`, `crowd_thresholds`, `location_metrics`, and `trips`
- Supabase Cron enabled when the five-minute sensor simulation is required
- A contact email for Nominatim and Transitous requests

> **Important:** The SQL files in `supabase/` are incremental migrations, not a complete empty-database schema. Back up the target database before applying them. The frontend currently uses live Supabase incident and advisory services (`USE_MOCK_INCIDENTS = false` and `USE_MOCK_ADVISORIES = false`), but the base migrations that create `environmental_incidents`, `tourist_advisories`, their RPCs, and private evidence policies are not present in this repository. Those objects must already exist in the target Supabase project before those two workflows can be used.

## Environment configuration

Create `.env.local` in the repository root:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key

# Backend only. Never expose this value through a VITE_ variable.
SUPABASE_SECRET_KEY=your_server_secret_key

# Required by the map-service usage policies.
MAP_CONTACT_EMAIL=your_email@example.com

# Optional routing overrides. The application uses built-in public endpoints
# when these values are not included in .env.local.
TRANSITOUS_API_URL=https://api.transitous.org/api/v6/plan
OSRM_DRIVING_URL=https://router.project-osrm.org/route/v1/driving
OSRM_CYCLING_URL=https://routing.openstreetmap.de/routed-bike/route/v1/driving
OSRM_WALKING_URL=https://routing.openstreetmap.de/routed-foot/route/v1/driving

# Keep 5000 unless frontend/vite.config.js is updated as well.
PORT=5000
```

The Vite frontend loads its public Supabase values from the root environment file. The Express backend also loads the root `.env.local`. Do not commit real secrets.

`.env.example` is the complete configuration template, while `.env.local` contains the private values for one development machine. `TRANSITOUS_API_URL` is optional because the backend falls back to `https://api.transitous.org/api/v6/plan` when it is not defined. Adding it to `.env.local` is still recommended because it makes the selected endpoint explicit and easier to change later. `MAP_CONTACT_EMAIL` remains required for the map and public-transport requests.

Restart the backend after changing `.env.local` so that Node.js loads the updated values.

## Install and run locally

Install the two applications:

```powershell
npm install --prefix backend
npm install --prefix frontend
```

Run the backend in the first terminal:

```powershell
npm run dev --prefix backend
```

Run the frontend in the second terminal:

```powershell
npm run dev --prefix frontend
```

Default development URLs:

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:5000/api/health`

The frontend proxies `/api` to port `5000`, so both processes must normally be running for map search, route calculation, and protected administrator application endpoints.

Production-style local commands:

```powershell
npm start --prefix backend
npm run build --prefix frontend
npm run preview --prefix frontend
```

## Main application routes

```text
/
/login
/register
/forgot-password
/reset-password
/auth/callback
/tourist/:page
/location_admin/:page
/super_admin/:page
```

Dashboard entry points are:

- `/tourist/dashboard`
- `/location_admin/dashboard`
- `/super_admin/dashboard`

The legacy `/admin/dashboard` route redirects to `/location_admin/dashboard`.

## Supabase database setup

The exact migrations required depend on which features are already installed in the target project. For a project with the base EcoGuard schema, apply the relevant scripts in this dependency order.

### 1. Roles, administrator onboarding, profiles, and location images

1. `supabase/admin_location_scope.sql`
2. `supabase/location_admin_assignment_uniqueness.sql`
3. `supabase/location_admin_rejection_reason.sql`
4. `supabase/profile_details.sql`
5. `supabase/profile_avatar_storage.sql`
6. `supabase/location_images.sql`

Afterward, assign `location_id` values to approved location administrators and synchronize trusted `auth.users.raw_app_meta_data.role` values as described in `admin_location_scope.sql`.

### 2. Trip emissions, Eco Score, LRT/MRT, and mixed transport

1. `supabase/normalize_trip_transport_modes.sql`
2. `supabase/trip_emissions_and_eco_score.sql`
3. `supabase/mixed_trip_transport_support.sql`

The database trigger recalculates saved trip emissions and Eco Score values. The frontend result is a preview; the value returned after saving is the authoritative persisted result.

### 3. Waste, warnings, current sensor rows, and five-minute simulation

1. `supabase/waste_management.sql`
2. `supabase/early_warning_notifications.sql`
3. `supabase/ecological_monitoring_simulation.sql` when seed/demo monitoring data is required
4. `supabase/sensor_current_metrics.sql`
5. Enable Supabase Cron from **Dashboard > Integrations > Cron**
6. `supabase/backend_sensor_automation.sql`
7. `supabase/sensor_location_controls.sql`

The scheduled `ecoguard-sensor-refresh` job runs every five minutes and updates one simulated current `location_metrics` row per enabled location. This is a classroom/backend simulation, not a connection to physical IoT hardware.

### 4. Environmental analytics history

Choose the appropriate history migration:

- `supabase/environmental_analytics_history.sql` creates history storage and archives current/future readings.
- `supabase/environmental_analytics_simulated_backfill.sql` also creates the history support and adds idempotent simulated historical data for demonstrations.

The analytics page can fall back to current readings when history is not installed, but historical day/week/month charts require the history table.

### 5. Waste alert response and collection-to-sensor workflow

1. `supabase/waste_alert_workflow.sql`
2. `supabase/waste_collection_sensor_response.sql`
3. `supabase/waste_collection_server_time.sql`

See:

- [`supabase/waste_alert_workflow_setup.md`](supabase/waste_alert_workflow_setup.md)
- [`supabase/waste_collection_sensor_response_setup.md`](supabase/waste_collection_sensor_response_setup.md)
- [`WASTE_MANAGEMENT_TEST_GUIDE.md`](WASTE_MANAGEMENT_TEST_GUIDE.md)

Optional demonstration records can be added with `supabase/waste_demo_data.sql` after the base waste schema is installed.

## Authentication setup

### Email and password

Sign-in uses email and password; EcoGuard reads the approved profile role and redirects the user automatically. Password recovery returns to `/reset-password` and requires at least eight characters, uppercase, lowercase, and a number.

Add these redirect URLs in **Supabase Dashboard > Authentication > URL Configuration**:

```text
http://localhost:5173/reset-password
https://YOUR-PRODUCTION-DOMAIN/reset-password
```

### Google sign-in

Google OAuth is configured through Supabase. New Google users choose whether to continue as a Tourist or begin the Location Administrator application. Existing users retain their stored role; Google sign-in does not overwrite it.

Follow [`supabase/google_sign_in_setup.md`](supabase/google_sign_in_setup.md) for the Google Cloud client, Supabase provider, callback URL, and redirect configuration.

## Location-administrator application flow

1. Register with email/password or start through Google onboarding.
2. Search for a West Malaysia location, resolve an address, or choose an existing unassigned location.
3. Upload a PDF, JPG, or PNG company document, up to 5 MB.
4. A super administrator reviews the private document and requested location.
5. Approval writes the trusted `location_admin` role and assigned `location_id`; rejection retains the submitted reason.

The backend uses `SUPABASE_SECRET_KEY` only for protected server-side approval and onboarding operations. It must never be exposed to frontend code.

## Critical alert email

The `critical-alert-email` Supabase Edge Function sends a combined email for qualifying critical alerts. It verifies the alert against the database, reads the configured recipient, obtains a Gmail access token from an offline refresh token, and records successful delivery to reduce duplicate emails for one sensor cycle.

Required Edge Function secrets:

```powershell
supabase secrets set GMAIL_CLIENT_ID="...apps.googleusercontent.com"
supabase secrets set GMAIL_CLIENT_SECRET="..."
supabase secrets set GMAIL_REFRESH_TOKEN="..."
supabase secrets set GMAIL_FROM="sender@gmail.com"
```

Then:

1. Run `supabase/critical_alert_email_deliveries.sql`.
2. Deploy the function with `supabase functions deploy critical-alert-email`.
3. Create an `INSERT` Database Webhook on `public.early_warning_alerts`.
4. Send the project's legacy anon JWT in the webhook `Authorization` header while JWT verification remains enabled.
5. Enable Auto Alerts and configure a notification email for the location.

Full instructions and troubleshooting are in [`supabase/critical_alert_email_setup.md`](supabase/critical_alert_email_setup.md).

## Realtime and background behaviour

- Environmental readings, warnings, advisories, incidents, and waste operations use Supabase Realtime where configured.
- Waste operations also use a polling fallback.
- The sensor Cron job updates simulated metrics every five minutes for enabled locations.
- Threshold triggers create or resolve persisted early-warning records.
- The critical-alert webhook reacts to new critical alert rows; updating an existing alert does not behave like a new `INSERT` event.

## Tests and verification

Run frontend checks:

```powershell
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
```

Run backend tests and syntax checks:

```powershell
npm test --prefix backend
node --check backend/index.js
node --check backend/src/controllers/authController.js
node --check backend/src/routes/mapRoutes.js
```

Automated tests do not verify the deployed Supabase database, RLS, Storage policies, Cron, webhooks, OAuth providers, Gmail credentials, or live third-party routing services. Test those integrations on a non-production Supabase project with separate tourist, location-admin, and super-admin accounts. A SQL Editor owner session bypasses RLS and is not a valid authorization test.

## Current project structure

Generated `.git`, `node_modules`, and `frontend/dist` directories are omitted.

```text
EcoGuard1/
|-- .env.example
|-- .env.local                  # local only; do not commit
|-- README.md
|-- WASTE_MANAGEMENT_REQUIREMENTS.md
|-- WASTE_MANAGEMENT_TEST_GUIDE.md
|-- backend/
|   |-- index.js
|   |-- package.json
|   `-- src/
|       |-- config/env.js
|       |-- controllers/authController.js
|       |-- routes/
|       |   |-- authRoutes.js
|       |   `-- mapRoutes.js
|       `-- services/supabase.js
|-- frontend/
|   |-- package.json
|   |-- vite.config.js
|   `-- src/
|       |-- App.jsx
|       |-- components/
|       |-- hooks/
|       |-- services/
|       |-- utils/
|       `-- features/
|           |-- auth/
|           |-- landing/
|           |-- location_admin/
|           |-- profile/
|           |-- super_admin/
|           `-- tourist/
`-- supabase/
    |-- functions/critical-alert-email/index.ts
    |-- *_setup.md
    `-- *.sql
```

## Important limitations

- Public-transport itineraries depend on Transitous coverage and current upstream data. They are recommendations, not guaranteed live schedules.
- OSRM public/demo endpoints and Nominatim are external services with their own availability and usage policies.
- Carbon values are estimates based on configured passenger-kilometre factors.
- The five-minute sensor process is simulated backend data, not physical IoT telemetry.
- Critical email depends on a valid Gmail OAuth refresh token. Google OAuth applications left in Testing can issue refresh tokens with limited lifetimes.
- This repository does not currently include the base incident/advisory database migrations described in the prerequisites section.