# Collection-to-sensor response

Apply `waste_collection_sensor_response.sql` in Supabase SQL Editor **after** the existing `waste_alert_workflow.sql`, `sensor_current_metrics.sql` and `sensor_location_controls.sql`. This migration has not been applied automatically. It is transactional, re-runnable and does not adjust existing collection records or readings during installation.

## Behaviour

- New form submissions use `record_waste_collection(jsonb, uuid)`. Existing collection endpoints still work as history-only entry paths.
- **Current collection** (default for completed/partial): the form uses the save time. Within the same transaction, the database locks the latest metric, subtracts collected total/recycled kg, records before/after values, inserts the result, and updates its schedule via the existing workflow trigger. A failed step rolls everything back.
- **Historical record**: enter a past collection time; save history without touching today's reading. Existing seeded rows are not replayed against current readings.
- **Missed**: zero quantities and a required reason; no sensor reduction.
- Current entries older than five minutes or future-dated are rejected by the database. This tolerance covers submission/network delay, not retrospective data entry. Current mode deliberately records time at save; use history mode for backdated records.
- A per-form UUID identifies the request. Retrying the same request returns its saved result without repeating the reduction. The existing one-record-per-schedule constraint also prevents a second result from another session. A separately opened unscheduled form is a new operation, so do not intentionally enter the same physical collection twice.
- The total, recycled and non-recycled portions cannot exceed their corresponding current balances. Quantities are compared at two-decimal precision. Nothing is silently clamped or reset to zero.
- The new Waste value is old waste minus total collected; the new Recyclable material value is old recyclable minus recycled collected. A full collection reaches zero only when those input quantities match the balances.
- Visitors, air quality, water quality and temperature values are unchanged by the collection. `recorded_at` advances because the current metric was updated. Existing metric-history/alert triggers can therefore observe the update.
- Existing threshold logic reevaluates alerts; a warning can stay active, change severity, or clear depending on the remaining quantity. There is no unconditional “resolve alert” write.
- The current sensor job already locks its metric row before computing its next update, so it continues from the adjusted value rather than overwriting it with an earlier snapshot. It still uses bounded random increases/decreases; this change does not implement steadily accumulating waste or physical IoT.
- This is a classroom simulation of a collection response, not an instruction sent to real hardware. A paused sensor can still have its stored balance adjusted by an administrator's current collection.
- The application refreshes the shared metric after saving, in addition to existing Realtime updates. If the follow-up fetch fails, the collection remains saved and Sensors can be refreshed manually.

## Example using the screenshot

With **10.83 kg Waste** and **7.93 kg Recyclable material**, record **5 kg total / 3 kg recycled** in Current collection mode. Expected new readings: **5.83 kg / 4.93 kg**. Recyclable percentage becomes approximately **84.6%** (4.93 / 5.83), even though the absolute recyclable quantity decreased.

Recording 5 kg total / 0 kg recycled is rejected for that snapshot: only 2.90 kg of non-recyclable waste was available. Refresh the preview if a sensor cycle changes the balances while the form is open.

## Deployment/rehearsal tests (use a test location)

1. Confirm the new RPC exists with `select to_regprocedure('public.record_waste_collection(jsonb,uuid)');`. A function signature, not NULL, should be returned.
2. Open a current collection, read the preview and save a valid completed result. Check Waste and Recyclable material on Sensors, the collection's audit values, and the schedule status.
3. Repeat with Partial. Both successful statuses should subtract the entered quantities, not reset all waste.
4. Submit an excessive total, excessive recycled amount, and excessive non-recycled portion. Each must fail without changing any reading, schedule or collection history.
5. Record a historical result, then mark a separate overdue schedule missed with a reason. Neither may reduce current readings.
6. Re-send an identical `record_waste_collection` request with the same UUID in a test API session. It must return the same collection ID and must not subtract twice. Try submitting a second result for the same schedule with a different UUID; it must fail without changing readings.
7. Confirm another location's metric cannot be adjusted by a location administrator, and a tourist cannot call this operation successfully. Owner-role SQL Editor sessions do not verify RLS.
8. Confirm alert behaviour below, between and above the configured boundaries. A still-elevated reading must not be reported safe simply because a collection was saved.
9. Test two concurrent valid collections and a sensor cycle. Row locking must preserve the arithmetic; a second collection that no longer fits the balance must be rejected. Verify unrelated metric values were not altered by the collection itself.
10. Refresh the app after a save and inspect `sensor_waste_before`, `sensor_waste_after`, `sensor_recycled_before`, `sensor_recycled_after`, `apply_to_sensor` and `request_id` on the saved result. Existing records should have `apply_to_sensor = false` and null audit values.

Frontend arithmetic/validation tests, lint and build are separate from these live PostgreSQL/RLS/concurrency checks. Complete this rehearsal after installing the migration.
