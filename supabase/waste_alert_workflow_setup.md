# Waste alert response workflow

## Deploy

Run `waste_alert_workflow.sql` in the project's Supabase SQL Editor after the existing `waste_management.sql` and `early_warning_notifications.sql` scripts have been installed. Apply this migration last if re-running the base scripts, since it replaces the collection-completion function. No new environment variables or npm packages are needed.

The migration is transactional and re-runnable. It adds nullable `alert_id` foreign keys to schedules and collection records, validation triggers, and Realtime publication membership for schedules/records when the Supabase publication exists. It preserves existing records without guessing which historical alert they addressed.

The SQL file must be deployed to enable response linking. Frontend lint, unit tests and a production build do not verify a deployed database or its RLS policies.

## Behaviour

- **Waste → Alert History:** read persisted waste alerts for the selected accessible location, newest first. Search, level and sensor-status filters combine; the visible record count follows those filters. Location administrators remain restricted to their assigned location. Super administrators can switch accessible locations.
- **Alert responses:** schedule a new collection, link an existing active unlinked schedule, or record an immediate unscheduled collection. There can be at most one active schedule per alert, even if multiple administrators act concurrently.
- **Traceability:** alert details show linked schedules, teams, collection quantities, outcomes and action notes. Schedule and collection rows link back to the alert. Existing links cannot be replaced or removed, and closed schedules/collection results remain history.
- **Overdue schedules:** an active schedule is upcoming before its start, due during its collection window, and overdue at or after its end. Badges, an overdue reminder/count, elapsed time and status filtering update every 15 seconds while the page is open. Overdue is derived from the stored timestamp, not a new persisted status or an automatic missed outcome.
- **Missed attempts:** the administrator must record zero quantities and a reason after the scheduled window ends. Saving through the existing completion RPC inserts the record and updates the schedule atomically. Direct authenticated record inserts with a schedule also use these rules. A partial collection retains its partial outcome in history and completes that attempt's schedule; a follow-up may be scheduled if the alert remains unresolved.
- **Sensor status is separate:** saving a collection does not change sensor readings or force an alert to resolve. The existing monitoring trigger closes an alert when the condition clears **or changes severity**. A resolved historical alert therefore does not, by itself, prove the current waste level is safe. An already-linked schedule can still be completed after its original alert resolves.
- **Refresh:** Realtime changes refresh the module; a 60-second polling fallback also refreshes stored data. This does not introduce email/SMS/push overdue notifications or a background scheduler.

## Verification on a test project

Use actual test accounts to exercise RLS; the SQL Editor's owner role bypasses RLS and is not an authorization test. Do not fabricate backdated operational records in the production project just to demonstrate overdue behaviour.

1. Sign in as a location administrator: confirm only the assigned location is visible. Repeat with a super administrator. Attempt a direct API read/write against another location as the location administrator; it must be denied or return no rows.
2. Open an unresolved waste alert and create a short future collection window. Confirm the saved schedule contains its `alert_id`. Refresh or use a second browser session; confirm the link remains visible.
3. Try to create another active schedule for the same alert. Also try linking to a crowd alert or an alert from another location. Database validation must reject each invalid request.
4. Allow the window to start and end. Confirm upcoming → due → overdue without reloading. Check the overdue count, elapsed label and filter. Completed/cancelled/missed schedules must never turn overdue.
5. Try to mark a future schedule missed or submit a missed attempt without a reason. Expect validation errors. After the window ends, submit a reason with zero quantities; verify a missed record, missed schedule status and the inherited alert ID.
6. Plan a follow-up for the still-unresolved alert and record a partial or completed collection. Confirm both attempts remain visible, and refresh to verify persistence. Double-submit from two browser sessions: there must be only one collection result for the schedule.
7. Link an existing active schedule from the same location. Verify its eventual record inherits the link. Cancel a linked schedule and confirm it remains in alert details and allows a new follow-up.
8. Record an immediate collection for an unresolved alert without an active schedule. A timestamp before the alert must fail. Attempt an immediate record when the alert already has an active schedule; the database must require that schedule instead.
9. Complete an already-linked schedule after its alert resolves; it should still succeed. Do not allow a new response link to an already-resolved alert. Check that recording any collection does not alter `location_metrics` or the alert's `resolved_at`.
10. Exercise combined alert filters, empty results and more than one table page. Verify collection reports still match saved quantities and missed attempts contribute zero kilograms.

Automated frontend checks from `frontend/`: `npm run lint`, `npm test`, `npm run build`.
