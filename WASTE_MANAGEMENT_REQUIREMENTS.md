# EcoGuard Waste Management Module Requirements

This document fixes the Phase 1 scope and acceptance rules for UC004, **Manage Waste Collection and Analyse Waste Data**. It should be treated as the implementation contract for the waste-management module.

## 1. Scope decisions

- EcoGuard is a student assignment; no physical smart-bin or IoT integration is required.
- The existing browser-generated environmental readings are acceptable when every simulated value is clearly labelled `Simulated`.
- Simulated readings are stored in `location_metrics` with `source = 'simulated'`.
- Waste collection schedules and completed collection records are operational data and must be stored separately from simulated readings.
- Waste reports must be exportable as both CSV and PDF.
- Dates are stored in Supabase as `timestamptz` values and displayed in the user's local time. For the project demonstration, the expected local timezone is Asia/Kuala_Lumpur.
- Waste quantities use kilograms (`kg`) with at most two decimal places.

## 2. Actors and permissions

| Capability | Super administrator | Location administrator | Tourist |
| --- | --- | --- | --- |
| View simulated readings | All locations | Assigned location | Safe aggregated indicators only |
| Configure waste thresholds | All locations | Assigned location | No |
| Create or update schedules | All locations | Assigned location | No |
| Record a collection | All locations | Assigned location | No |
| View collection history | All locations | Assigned location | No |
| Export CSV/PDF reports | All locations | Assigned location | No |
| View internal notes or assigned teams | All locations | Assigned location | No |

Supabase Row Level Security is the authorization boundary. Frontend filtering is only a user-interface safeguard.

## 3. Domain definitions

### Simulated environmental reading

A timestamped estimate of current location conditions, including waste quantity and recycled quantity. It is not proof that a collection happened and must not be counted as a completed collection.

### Collection schedule

A planned period during which a waste collection team should service one ecological location. Two active schedules conflict when their time ranges overlap at the same location.

### Collection record

The historical result of a collection attempt. It records the actual or simulated-for-demonstration quantity collected and may optionally refer to one schedule.

### Waste threshold

Three location-specific quantity boundaries used to classify the latest simulated waste reading as Normal, Moderate, High Risk, or Critical.

### Report export record

An audit entry showing who generated a CSV or PDF report, when it was generated, which period/location was selected, and how many collection records were included.

## 4. Controlled values

### Waste types

- `mixed`
- `recyclable`
- `organic`
- `hazardous`

### Schedule statuses

- `scheduled`
- `completed`
- `cancelled`
- `missed`

### Collection statuses

- `completed`
- `partial`
- `missed`

### Collection data sources

- `manual`
- `simulated_sensor`

### Warning levels

- `Normal`: below the moderate threshold
- `Moderate`: at or above the moderate threshold and below the high-risk threshold
- `High Risk`: at or above the high-risk threshold and below the critical threshold
- `Critical`: at or above the critical threshold

## 5. Business rules

1. Only `super_admin` and `location_admin` accounts can access operational waste data.
2. A location administrator can access only records linked to their trusted `location_id` claim.
3. New active schedules must start in the future and end after they start.
4. Two `scheduled` records for the same location must not have overlapping time ranges.
5. Completed, cancelled, and missed schedules do not block a replacement schedule.
6. Collection quantities must be non-negative.
7. A completed or partial collection must have `total_kg > 0`.
8. A missed collection must have zero total and recycled quantities.
9. `recycled_kg` must not exceed `total_kg`.
10. `landfill_kg` is derived as `total_kg - recycled_kg`; users do not enter it independently.
11. If a collection refers to a schedule, both records must have the same `location_id`.
12. A schedule may have at most one collection record.
13. Thresholds must follow `0 < Moderate < High Risk < Critical`.
14. Simulated data must never be described as actual or official sensor data.
15. If the simulator is unavailable, the module displays the latest stored simulated reading and keeps schedules/history available.
16. Trend analysis requires at least two valid collection records. With fewer records, the UI displays the available facts without claiming a trend.
17. CSV and PDF exports use the same active location/date/status/type filters as the history view.
18. Export actions must be auditable.
19. Operational schedules, collection records, and export audit rows are not hard-deleted through the browser. A schedule is cancelled and historical records are preserved.
20. Collection records are immutable after insertion. A later correction workflow must preserve the original record instead of silently rewriting history.
21. Deactivating a location is preferred to deleting a location with waste history.
22. Collection timestamps cannot be in the future; this is enforced in both the form and the database.

## 6. Required workflows

### Open Waste Management

1. Verify the signed-in administrator and their location scope.
2. Load allowed locations, current schedules, latest stored simulated readings, thresholds, and recent collections.
3. Display a clear no-data state for any unavailable dataset.

### Create or update a schedule

1. Administrator selects an allowed location, start/end time, waste type, assigned team, and optional notes.
2. The system validates required fields, future time, time order, status, and authorization.
3. Supabase rejects any unresolved overlapping active schedule.
4. The UI displays a specific conflict message and preserves the form values for correction.

### Record a collection

1. Administrator opens an existing schedule or chooses an unscheduled collection.
2. Administrator enters collection status, quantities, source, collection time, and optional notes.
3. The system validates quantities and location ownership.
4. For a scheduled collection, creating the record and completing/missing the schedule must be one atomic operation.
5. Overview, history, analytics, and reports refresh from persisted records.

### Analyse waste data

1. Administrator selects an allowed location and date period.
2. The system calculates total collected, total recycled, landfill quantity, recycling rate, completed/missed counts, average per collection, and peak period.
3. Charts are produced only from persisted collection records.
4. Insufficient or missing data is stated explicitly.

### Export a report

1. Administrator applies history filters.
2. The system refuses export when no records match.
3. CSV contains the filtered detail rows.
4. PDF contains report scope, generated time, summary statistics, charts, source labels, and a collection-history table.
5. A successful export creates an audit row without modifying source records.

## 7. Acceptance criteria

- **WM-AC-01:** Super administrators can manage schedules and collections for every location.
- **WM-AC-02:** A location administrator cannot read or mutate another location's waste data through either the UI or direct Supabase requests.
- **WM-AC-03:** Tourists cannot read operational schedules, collection history, internal notes, or export audits.
- **WM-AC-04:** An administrator can create, edit, cancel, complete, and mark a schedule missed.
- **WM-AC-05:** Overlapping active schedules at one location are rejected, including concurrent submissions.
- **WM-AC-06:** Invalid quantities and statuses are rejected by both UI validation and database constraints.
- **WM-AC-07:** Every displayed simulated value and simulated collection source is visibly labelled.
- **WM-AC-08:** Collection history can be filtered by location, period, waste type, source, and status.
- **WM-AC-09:** Analytics are calculated from persisted collection records and do not modify those records.
- **WM-AC-10:** Missing and insufficient data states do not display misleading charts or statistics.
- **WM-AC-11:** The latest stored simulated reading remains visible when the simulator is unavailable.
- **WM-AC-12:** CSV and PDF exports contain only records allowed by the administrator's location scope and active filters.
- **WM-AC-13:** Successful CSV/PDF exports create an audit record.
- **WM-AC-14:** Schedule and collection history remains preserved when a schedule is cancelled or a user account later changes.

## 8. Implementation progress

- Phases 1-2: requirements and Supabase data/RLS design completed.
- Phases 3-4: frontend services, validation, navigation, and persisted read views completed.
- Phase 5: threshold settings and labelled online/offline simulated-sensor fallback completed.
- Phase 6: schedule creation, editing, cancellation, overdue state, and overlap protection completed.
- Phase 7: scheduled/unscheduled collection recording and immutable filterable history completed.
- Phase 8: persisted analytics, trends, breakdowns, and insufficient-data states completed.
- Phase 9: filtered CSV/PDF generation and export auditing completed.
- Phase 10: tourist-safe aggregate indicators and role/navigation integration completed.
- Phase 11: automated utility tests, setup documentation, RLS demonstration guide, and idempotent demo data completed.

## 9. Out of scope

- Physical smart-bin hardware, MQTT, or third-party IoT services
- Official real-time sensor claims
- Route optimization for collection vehicles
- Staff payroll or fleet management
- Tourist access to operational collection details
- Automatic email/SMS delivery unless added by a later warning-notification phase
