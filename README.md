# EcoGuard EEWS

EcoGuard is a React, Express, and Supabase ecological early-warning system for Malaysian tourist locations.

## Roles and access

- `super_admin` can manage every location and all location-linked thresholds and metrics.
- `pending_location_admin` has submitted a company document but has no administrator privileges.
- `location_admin` has the same operational tools but is assigned exactly one `location_id`. It can edit that location, but cannot create/delete locations or access another location's thresholds or metrics.
- `tourist` uses trip, profile, carbon, and ecological-monitoring features.

Supabase Row Level Security (RLS) is the authorization boundary. Routes and hidden buttons are only user-experience safeguards.

## Supabase and administrator setup

1. Back up the affected tables, then run `supabase/admin_location_scope.sql` in Supabase SQL Editor. If that setup was already applied before profile-picture support was added, run only `supabase/profile_avatar_storage.sql`.
2. Run the SQL inside `supabase/profile_details.sql` to add the optional profile gender field. Paste the file contents into SQL Editor, not the file name.
3. Run `supabase/waste_management.sql` to create the waste schedules, immutable collection history, thresholds, export audit data, validation, and location-scoped RLS policies.
4. Enable **Supabase Cron** from Dashboard > Integrations > Cron. Then run `supabase/early_warning_notifications.sql`, `supabase/sensor_current_metrics.sql`, `supabase/backend_sensor_automation.sql`, and finally `supabase/sensor_location_controls.sql`. The backend job refreshes each enabled location's current sensor row every five minutes, publishes changes through Realtime, and evaluates warnings on both inserts and updates.
5. Optionally run `supabase/waste_demo_data.sql` to add idempotent, clearly labelled assignment demonstration records for up to three active locations.
6. Assign a `location_id` to every migrated location administrator returned by the verification query at the end of the administrator-scope script.
7. Synchronize trusted `auth.users.raw_app_meta_data` using the commented example in the administrator-scope SQL script, then validate the pending constraint. Roles must never be stored in user-editable `user_metadata`.
8. Add the server-only values below to `.env.local`. Never prefix secret values with `VITE_` or expose them to frontend code.

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
MAP_CONTACT_EMAIL=
PORT=5000
```

9. Create the first super administrator in Supabase Auth. Set its `profiles` row to `role = 'super_admin'`, `location_id = null`, and its trusted `app_metadata.role` to `super_admin`. Super-admin public registration is intentionally unavailable.

   For legacy accounts where only `profiles.role` was updated, the protected application endpoint verifies that canonical profile and synchronizes the missing Auth `app_metadata.role`. The browser refreshes its session immediately afterward so RLS sees the updated claim.

Location administrators first register with only their full name, email, and password. They are then sent to a protected onboarding page where they can search for a place through OpenStreetMap, paste and resolve an address, or choose an existing unassigned location, before uploading a PDF, JPG, or PNG company document (maximum 5 MB). A super admin reviews the private document and requested location from **Admin Applications**; approval writes the trusted `location_admin` role and assigned location. Super admins cannot be created through public registration.

## Run locally

```powershell
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev --prefix backend
npm run dev --prefix frontend
```

Dashboard routes are `/tourist/dashboard`, `/location_admin/dashboard`, and `/super_admin/dashboard`. The old `/admin/dashboard` redirects to the location-admin route.

Sign-in requires only email and password. The application reads the approved account role and routes the user automatically; role selection appears only during registration.

## Password recovery for every role

Tourists, pending location administrators, approved location administrators, and super administrators use the same self-service recovery flow:

1. Select **Forgot password?** on `/login` and submit the account email.
2. Open the Supabase recovery email.
3. The link returns to `/reset-password`, where EcoGuard verifies the recovery session.
4. Enter a password containing at least 8 characters, uppercase, lowercase, and a number.
5. After the password is updated, existing sessions are globally signed out and the user signs in again. Role and location assignments are unchanged.

In **Supabase Dashboard > Authentication > URL Configuration**, add these redirect URLs:

```text
http://localhost:5173/reset-password
https://YOUR-PRODUCTION-DOMAIN/reset-password
```

Keep the production URL aligned with the domain that hosts the Vite frontend. The reset-request success message intentionally does not reveal whether an email is registered.

## Changes made

- Replaced legacy `admin` handling with `super_admin` and `location_admin`.
- Added `profiles.location_id`, assignment/role constraints, indexes, trusted JWT helpers, table grants, and RLS policies.
- Scoped location-admin access on locations, crowd thresholds, and metrics to one location.
- Prevented the location-admin workspace from requesting global profiles or trips and added assigned-location filtering as defense in depth.
- Reserved location creation/deletion and global profile access for super admins.
- Added private company-document upload and a pending application record during location-admin registration.
- Added user-owned profile-picture uploads through the public `profile-avatars` Storage bucket; `profiles.avatar_url` stores the display URL.
- Added a super-admin review page and protected backend approve/reject endpoints.
- Added location selection during registration and role-aware login redirects.
- Shared the administrator workspace between both roles and removed global create/delete controls for location admins.
- Added the complete Waste Management workflow: simulated fallback monitoring, thresholds, schedules, immutable collection history, persisted analytics, and audited CSV/PDF reports.
- Added a security-definer tourist RPC that returns only aggregate environmental and waste status bands, never operational waste records.

## Current project structure

Generated `.git`, `node_modules`, and `frontend/dist` directories are omitted.

```text
EcoGuard1/
|-- .env.local
|-- README.md
|-- WASTE_MANAGEMENT_REQUIREMENTS.md
|-- WASTE_MANAGEMENT_TEST_GUIDE.md
|-- package.json
|-- package-lock.json
|-- backend/
|   |-- index.js
|   |-- package.json
|   |-- package-lock.json
|   `-- src/
|       |-- config/env.js
|       |-- controllers/authController.js
|       |-- routes/
|       |   |-- authRoutes.js
|       |   `-- mapRoutes.js
|       `-- services/supabase.js
|-- frontend/
|   |-- index.html
|   |-- README.md
|   |-- package.json
|   |-- package-lock.json
|   |-- vite.config.js
|   |-- eslint.config.js
|   |-- postcss.config.js
|   |-- tailwind.config.js
|   |-- public/
|   |   |-- favicon.svg
|   |   `-- icons.svg
|   `-- src/
|       |-- main.jsx
|       |-- App.jsx
|       |-- App.css
|       |-- index.css
|       |-- assets/ (hero.png, react.svg, vite.svg)
|       |-- services/
|       |   |-- authService.js
|       |   |-- adminApplicationService.js
|       |   |-- locationService.js
|       |   |-- mapService.js
|       |   |-- profileService.js
|       |   |-- supabaseClient.js
|       |   |-- tripService.js
|       |   `-- wasteService.js
|       |-- utils/
|       |   |-- tripAnalytics.js
|       |   |-- wasteAnalytics.js
|       |   |-- wasteReport.js
|       |   `-- wasteValidation.js (with focused `*.test.js` files)
|       `-- features/
|           |-- auth/ (AuthPage.jsx, auth.css)
|           |-- landing/ (LandingPage.jsx, landing.css)
|           |-- location_admin/
|           |   |-- LocationAdminWorkspace.jsx
|           |   |-- PendingApprovalPage.jsx
|           |   |-- DashboardPage.jsx
|           |   |-- LocationPage.jsx
|           |   |-- CrowdThresholdsPage.jsx
|           |   |-- WasteManagementPage.jsx
|           |   |-- ReportsPage.jsx
|           |   `-- ProfilePage.jsx
|           |-- super_admin/
|           |   |-- AdminDashboard.jsx
|           |   |-- AdminApplications.jsx
|           |   |-- AdminLayout.jsx
|           |   |-- AdminProfile.jsx
|           |   |-- AdminWorkspace.jsx
|           |   |-- CrowdThresholds.jsx
|           |   |-- DestinationManagement.jsx
|           |   |-- EcologicalLocations.jsx
|           |   |-- EnvironmentalData.jsx
|           |   |-- Reports.jsx
|           |   |-- SystemActivity.jsx
|           |   |-- WarningManagement.jsx
|           |   |-- WasteManagement.jsx
|           |   `-- waste/
|           |       |-- WasteOverview.jsx
|           |       |-- WasteSimulator.jsx
|           |       |-- WasteThresholdSettings.jsx
|           |       |-- WasteScheduleForm.jsx
|           |       |-- WasteScheduleManager.jsx
|           |       |-- WasteCollectionForm.jsx
|           |       |-- WasteCollectionFilters.jsx
|           |       |-- WasteCollectionHistory.jsx
|           |       |-- WasteAnalytics.jsx
|           |       `-- WasteReportExport.jsx
|           `-- tourist/
|               |-- CarbonCalculator.jsx
|               |-- EcologicalMonitoring.jsx
|               |-- MalaysiaMapPicker.jsx
|               |-- TouristDashboard.jsx
|               |-- TouristHistory.jsx
|               |-- TouristLayout.jsx
|               |-- TouristProfile.jsx
|               `-- TouristWorkspace.jsx
`-- supabase/
    |-- admin_location_scope.sql
    |-- backend_sensor_automation.sql
    |-- early_warning_notifications.sql
    |-- profile_details.sql
    |-- sensor_current_metrics.sql
    |-- sensor_location_controls.sql
    |-- waste_management.sql
    `-- waste_demo_data.sql
```

## Verification

After applying the SQL, test separate super-admin, location-admin, and tourist accounts. Also attempt direct REST mutations: a location admin must not be able to read or write a different location even if the browser UI is bypassed.

```powershell
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test --prefix frontend
node --check backend/index.js
node --check backend/src/controllers/authController.js
```

See `WASTE_MANAGEMENT_TEST_GUIDE.md` for the complete administrator, tourist, export, and RLS demonstration walkthrough.
