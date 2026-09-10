// Work in hundredths of a kilogram to avoid floating-point boundary errors.
export function previewWasteSensorResponse(reading, values) {
  const errors = {}
  if (!reading || reading.waste_kg == null || reading.recycled_kg == null) {
    return { errors: { sensor: 'No stored waste reading is available. Refresh or choose Historical record.' } }
  }
  const cents = (value) => Math.round(Number(value) * 100)
  const waste = cents(reading.waste_kg)
  const recyclable = cents(reading.recycled_kg)
  const total = cents(values.total_kg)
  const recycled = cents(values.recycled_kg)
  if (![waste, recyclable, total, recycled].every(Number.isFinite)) return { errors: { sensor: 'Enter valid quantities and refresh the reading.' } }
  if (total <= 0) errors.total_kg = 'Enter more than zero kilograms.'
  else if (total > waste) errors.total_kg = 'Collected waste exceeds the current waste reading.'
  if (recycled < 0 || recycled > total) errors.recycled_kg = 'Recycled amount must be between zero and the total collected.'
  else if (recycled > recyclable) errors.recycled_kg = 'Recycled amount exceeds the current recyclable material reading.'
  else if (total - recycled > waste - recyclable) errors.recycled_kg = 'Non-recycled collection exceeds available non-recyclable waste. Check the recycled amount.'
  return { errors, wasteAfter: (waste - total) / 100, recycledAfter: (recyclable - recycled) / 100 }
}
