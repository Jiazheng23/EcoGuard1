# EcoGuard Waste Management Test and Demonstration Guide

## 1. One-time setup

Apply these scripts in Supabase SQL Editor in this order:

1. `supabase/admin_location_scope.sql`
2. `supabase/waste_management.sql`
3. Optional: `supabase/waste_demo_data.sql`

The optional demonstration script uses up to three existing active locations. It adds eight historical records per location, thresholds, a recent labelled simulated snapshot, and a future schedule when a non-conflicting slot is available. It does not delete records and avoids adding its labelled rows twice.

## 2. Start the application

Use two terminals and keep both processes running:

```powershell
npm run dev --prefix backend
```

```powershell
npm run dev --prefix frontend
```

Open the Vite URL, normally `http://localhost:5173`.

## 3. Administrator demonstration

1. Sign in as a super administrator or approved location administrator.
2. Open **Waste Management > Overview**.
3. Save Moderate, High Risk, and Critical thresholds.
4. Show that every live-looking value is labelled **Simulated data**.
5. Select **Simulate offline**. Confirm that the latest stored snapshot remains visible, or that an honest no-fallback state appears.
6. Open **Collection Schedules** and create a future schedule.
7. Try a second overlapping period. Confirm that the form or database rejects it.
8. Edit the future schedule, then demonstrate cancellation on a disposable schedule. Confirm that the row remains in history as cancelled.
9. Select **Record** on an active schedule. Save a completed, partial, or missed result and confirm the schedule status changes atomically.
10. Open **Collection History**. Demonstrate date, type, source, and status filters and show that records have no edit/delete actions.
11. Open **Analytics & Reports**. Confirm its filters match Collection History, its totals come only from persisted records, and fewer than two successful records produce an insufficient-data message.
12. Export CSV and PDF. Open both files, confirm simulated records are labelled, and confirm a new export-audit row appears.

## 4. Tourist privacy demonstration

1. Sign in as a tourist and open **Eco Monitoring**.
2. Confirm destination cards show only aggregate waste status such as Normal, Moderate, High Risk, or Critical.
3. Open a managed destination. Confirm the page explains that quantities, schedules, collection history, staff assignments, and notes are administrator-only.
4. Verify the tourist cannot open the administrator Waste Management module.

The tourist RPC returns only status bands, estimated recycling percentage, data-source category, and update time. It does not return `waste_collection_schedules`, `waste_collection_records`, internal notes, or exact waste quantities.

## 5. Role and RLS checks

- Super administrator: can manage every location.
- Location administrator: sees only the assigned `location_id` and receives an RLS error for another location.
- Tourist: cannot select or mutate operational waste tables.
- Anonymous user: cannot execute the tourist aggregate RPC or access waste tables.
- Collection records and export audits cannot be updated or deleted through authenticated browser requests.

For a strong security demonstration, use Supabase REST or the browser console while signed in as a location administrator and attempt an insert with another `location_id`. The operation must fail even if the UI is bypassed.

## 6. Automated verification

```powershell
npm run test --prefix frontend
npm run lint --prefix frontend
npm run build --prefix frontend
node --check backend/index.js
node --check backend/src/controllers/authController.js
```

The frontend tests cover validation, overlap detection, analytics/filter calculations, CSV escaping and simulated labels, PDF structure, and report filenames.

## 7. Expected assignment evidence

- Screenshots of online and offline simulated-sensor states
- Threshold validation and warning-level screenshots
- Schedule conflict rejection
- Completed and missed collection examples
- Filtered history and persisted analytics
- Opened CSV and PDF output
- Export audit row
- Tourist aggregate status and privacy disclosure
- Supabase RLS rejection for an unauthorized location
