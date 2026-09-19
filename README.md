# EcoGuard EEWS

EcoGuard is a web-based ecological early-warning and sustainable-tourism system for Malaysian destinations. It combines a React frontend, an Express API, and Supabase for authentication, data storage, realtime updates, and role-based access.

## Features

### Tourist

- Calculate estimated trip emissions for car, motorcycle, bicycle, walking, bus, rail, and mixed transport.
- Search for Malaysian places, select points on a Leaflet map, and request road or public-transport routes.
- Save trips, track an Eco Score, view trip history, and earn achievement badges.
- View environmental indicators and active tourist advisories.
- Report environmental incidents with photo evidence.

### Location administrator

- Work with one assigned ecological location.
- Monitor sensor readings, warnings, incidents, advisories, and thresholds.
- Manage waste-collection schedules and records.
- View analytics and export reports for the assigned location.

### Super administrator

- Manage all locations, administrator applications, sensors, thresholds, incidents, advisories, and waste operations.
- Approve or reject location-administrator applications.
- View system-wide environmental, travel, and waste reports.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, Tailwind CSS, Recharts |
| Maps | Leaflet, React Leaflet, OpenStreetMap/Nominatim |
| Routing | OSRM-compatible services and Transitous |
| Backend | Node.js, Express 5 |
| Platform | Supabase Auth, PostgreSQL, Realtime, Storage, and RLS |

## Prerequisites

- Node.js `^20.19.0` or `>=22.12.0` (required by Vite 8)
- npm
- An existing Supabase project configured with the EcoGuard database schema, functions, storage buckets, and Row Level Security policies
- A contact email for requests to the public map services

> [!IMPORTANT]
> This repository does **not** contain the Supabase SQL migrations. An empty Supabase project is not enough to run the complete application. Obtain the matching database setup from the project owner before attempting to use data-backed features. The frontend currently uses live Supabase incident and advisory services, not their mock implementations.

## Local setup

### 1. Install dependencies

From the repository root:

```powershell
npm ci --prefix backend
npm ci --prefix frontend
```

The root `package.json` is not used to start either application, so a root-level `npm install` is unnecessary.

### 2. Configure the environment

Create `.env.local` in the repository root. You can copy the template first:

```powershell
Copy-Item .env.example .env.local
```

Then set the following values:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key

# Backend only. Never expose this through a VITE_ variable.
SUPABASE_SECRET_KEY=your_supabase_secret_key

# Identifies this application to Nominatim and Transitous.
MAP_CONTACT_EMAIL=you@example.com

# Must be 5000 because frontend/vite.config.js proxies /api to this port.
PORT=5000

# Optional overrides; the backend has public defaults.
TRANSITOUS_API_URL=https://api.transitous.org/api/v6/plan
OSRM_DRIVING_URL=https://router.project-osrm.org/route/v1/driving
OSRM_CYCLING_URL=https://routing.openstreetmap.de/routed-bike/route/v1/driving
OSRM_WALKING_URL=https://routing.openstreetmap.de/routed-foot/route/v1/driving
```

The publishable key is used by both applications. `SUPABASE_SECRET_KEY` is server-only and is required for privileged onboarding and administrator-application operations. Never commit `.env.local`.

### 3. Start the application

Open two terminals in the repository root.

Terminal 1 — backend:

```powershell
npm run dev --prefix backend
```

Terminal 2 — frontend:

```powershell
npm run dev --prefix frontend
```

Open <http://localhost:5173>. To confirm that the backend is running, visit <http://localhost:5000/api/health>.

Both processes must be running for registration, location-admin onboarding, map search, reverse geocoding, and route calculation. Restart the backend after changing `.env.local`.

## Supabase requirements

EcoGuard expects the connected Supabase project to provide the following resources. This is a compatibility checklist, not a database installation guide.

### Roles

- `tourist`
- `pending_location_admin`
- `location_admin`
- `super_admin`

Application routes are role-aware, but database permissions must be enforced by Supabase Row Level Security. A location administrator should be restricted to the `location_id` assigned in their profile. Public registration must not be allowed to create a super administrator.

### Database objects

The code reads or writes these tables:

```text
profiles
ecological_locations
location_admin_applications
trips
crowd_thresholds
location_metrics
environmental_metric_history
location_sensor_controls
early_warning_alerts
early_warning_alert_reads
environmental_incidents
tourist_advisories
waste_thresholds
waste_collection_schedules
waste_collection_records
waste_report_exports
```

It also calls these PostgreSQL functions:

```text
get_tourist_environmental_indicators
record_waste_collection
complete_waste_collection
publish_tourist_advisory
withdraw_tourist_advisory
attach_incident_photo
attach_incident_resolution
remove_incident_resolution
review_environmental_incident
save_incident_response
submit_incident_for_audit
review_incident_audit
```

Required Storage buckets include:

- `company-documents` for private administrator-application documents
- `profile-avatars` for profile images
- `location-images` for ecological-location images
- `incident-evidence` for private incident and resolution evidence

The schema must include the columns, triggers, grants, RLS policies, and Realtime publication settings expected by the application. Matching object names alone are not sufficient.

### Authentication configuration

Email/password authentication is supported. Add the following password-recovery redirect in **Supabase Dashboard > Authentication > URL Configuration**:

```text
http://localhost:5173/reset-password
```

Add the equivalent production URL when deploying the frontend.

Google sign-in is also implemented. To use it, enable the Google provider in Supabase and add:

```text
http://localhost:5173/auth/callback
```

to the permitted redirect URLs. Production deployments need their own callback URL as well.

## Application routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/login` | Sign in |
| `/register` | Register |
| `/forgot-password` | Request a password reset |
| `/reset-password` | Set a recovered password |
| `/auth/callback` | Google OAuth callback |
| `/tourist/:page` | Tourist workspace |
| `/location_admin/:page` | Location-administrator workspace |
| `/super_admin/:page` | Super-administrator workspace |

Main dashboard URLs are `/tourist/dashboard`, `/location_admin/dashboard`, and `/super_admin/dashboard`. The legacy `/admin/dashboard` URL redirects to the location-administrator dashboard.

## Available commands

### Frontend

```powershell
npm run dev --prefix frontend       # development server
npm run build --prefix frontend     # production build
npm run preview --prefix frontend   # preview the production build
npm run lint --prefix frontend      # ESLint
npm test --prefix frontend          # utility tests
```

### Backend

```powershell
npm run dev --prefix backend        # server with Node watch mode
npm start --prefix backend          # server without watch mode
npm test --prefix backend           # backend tests
```

## Verification

Run the automated checks from the repository root:

```powershell
npm run lint --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend
npm test --prefix backend
```

These checks do not validate the remote Supabase schema, RLS policies, Storage policies, OAuth configuration, Realtime setup, or third-party routing availability. Test those integrations with separate tourist, location-admin, and super-admin accounts in a non-production Supabase project.

## Project structure

```text
EcoGuard1/
|-- .env.example
|-- README.md
|-- backend/
|   |-- index.js
|   |-- package.json
|   `-- src/
|       |-- config/
|       |-- controllers/
|       |-- routes/
|       `-- services/
`-- frontend/
    |-- package.json
    |-- vite.config.js
    |-- public/
    `-- src/
        |-- components/
        |-- features/
        |   |-- auth/
        |   |-- landing/
        |   |-- tourist/
        |   |-- location_admin/
        |   `-- super_admin/
        |-- hooks/
        |-- services/
        `-- utils/
```

## External-service notes

- Nominatim, public OSRM instances, and Transitous are third-party services with their own availability and usage policies.
- Public-transport results are suggested itineraries and should be confirmed before travel.
- Carbon values are estimates; actual emissions vary with traffic, vehicle efficiency, occupancy, and service conditions.
- Walking and cycling are treated as having zero direct operational transport emissions.
- The environmental sensor workflow in this application is simulated data, not a physical IoT connection.
