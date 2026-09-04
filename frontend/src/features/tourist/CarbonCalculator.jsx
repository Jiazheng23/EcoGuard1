import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Bike,
  Bus,
  Car,
  Check,
  Footprints,
  Leaf,
  MapPin,
  Navigation,
  Train,
  TrendingDown,
} from 'lucide-react'
import { createTrip } from '../../services/tripService'
import { calculateMalaysiaRoute } from '../../services/mapService'
import {
  CAR_POWERTRAINS,
  CAR_POWERTRAIN_OPTIONS,
  calculateTripEnvironmentalImpact,
  getMixedRouteEmissionFactorG,
  recommendedModeForDistance,
} from '../../utils/tripEnvironmentalRules'
import MalaysiaMapPicker from './MalaysiaMapPicker'

const modes = [
  { id: 'car', label: 'Car', icon: Car, color: '#ef4444', tip: 'Choose petrol or electricity to use the correct car emission factor.' },
  { id: 'motorcycle', label: 'Motorcycle', icon: Bike, color: '#f97316', tip: 'Petrol motorcycles emit 41.57 g CO₂e per passenger-km.' },
  { id: 'bus', label: 'Bus', icon: Bus, color: '#f59e0b', tip: 'Diesel buses are the recommended motorised option for longer routes.' },
  { id: 'mrt', label: 'LRT / MRT', icon: Train, color: '#22c55e', tip: 'Transit rail uses 70 g CO₂e/passenger-km.' },
  { id: 'mixed', label: 'Mixed', icon: Navigation, color: '#8b5cf6', tip: 'Combines car access, walking, bus, LRT and MRT when available.' },
  { id: 'walking', label: 'Walking', icon: Footprints, color: '#14b8a6', tip: 'Walking produces no direct transport emissions.' },
  { id: 'bicycle', label: 'Bicycle', icon: Bike, color: '#0ea5e9', tip: 'Cycling produces no direct transport emissions.' },
]

const impact = [
  { max: 1, label: 'Very Low Impact', color: '#22c55e', text: 'Excellent! Your trip has minimal environmental impact.' },
  { max: 5, label: 'Low Impact', color: '#84cc16', text: 'Good choice. Your emissions are below average.' },
  { max: 15, label: 'Moderate Impact', color: '#f59e0b', text: 'Consider a lower-carbon alternative for future trips.' },
  { max: 50, label: 'High Impact', color: '#f97316', text: 'Your trip produces significant carbon emissions.' },
  { max: Infinity, label: 'Very High Impact', color: '#ef4444', text: 'Consider using a bus or sharing a car when possible.' },
]

const card = 'rounded-2xl border border-slate-100 bg-white p-5 shadow-sm'

export default function CarbonCalculator({
  user,
  initialDestination = null,
  onTripSaved,
}) {
  const [step, setStep] = useState(1)
  const [modeId, setModeId] = useState('car')
  const [carPowertrain, setCarPowertrain] = useState(CAR_POWERTRAINS.petrol)
  const [recommendedModeId, setRecommendedModeId] = useState(null)
  const [distance, setDistance] = useState('0')
  const [roundTrip, setRoundTrip] = useState(false)
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [journeyCoordinates, setJourneyCoordinates] = useState({
    origin: null,
    destination: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')
  const [routeUpdating, setRouteUpdating] = useState(false)
  const [routeLegs, setRouteLegs] = useState([])
  const [routeError, setRouteError] = useState('')

  const mode = modes.find((item) => item.id === modeId)
  const isPublicTransport = ['bus', 'mrt', 'mixed'].includes(modeId)
  const km = Math.max(0, Number(distance) || 0)
  const pax = 1
  const mixedFactorG = useMemo(
    () => getMixedRouteEmissionFactorG(routeLegs, carPowertrain),
    [routeLegs, carPowertrain],
  )
  const environmentalImpact = calculateTripEnvironmentalImpact({
    mode: modeId,
    distanceKm: km,
    passengers: pax,
    roundTrip,
    carPowertrain,
    factorGOverride: modeId === 'mixed' ? mixedFactorG : undefined,
  })
  const perPassenger = environmentalImpact.carbonEmissionKg
  const total = environmentalImpact.totalEmissionKg
  const ecoPoints = environmentalImpact.ecoPoints
  const rating = impact.find((item) => perPassenger <= item.max) || impact.at(-1)

  const comparison = useMemo(
    () =>
      modes
        .filter((item) => !['walking', 'bicycle', 'mixed'].includes(item.id))
        .map((item) => ({
          name: item.label,
          emission: calculateTripEnvironmentalImpact({
            mode: item.id,
            distanceKm: km,
            passengers: pax,
            roundTrip,
            carPowertrain,
          }).carbonEmissionKg,
          color: item.color,
        })),
    [carPowertrain, km, pax, roundTrip],
  )

  const greener = calculateTripEnvironmentalImpact({
    mode: 'bus',
    distanceKm: km,
    passengers: pax,
    roundTrip,
    carPowertrain,
  }).carbonEmissionKg

  useEffect(() => {
    if (step !== 2 || !journeyCoordinates.origin || !journeyCoordinates.destination) return
    const controller = new AbortController()

    async function refreshRouteForMode() {
      setRouteUpdating(true)
      setRouteError('')

      try {
        const route = await calculateMalaysiaRoute(
          journeyCoordinates.origin,
          journeyCoordinates.destination,
          modeId,
        )
        if (!controller.signal.aborted) {
          setDistance(String(route.distanceKm || 0))
          setRouteLegs(route.legs || [])
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setDistance('0')
          setRouteLegs([])
          setRouteError(error.message || 'Unable to calculate this transport route.')
        }
      } finally {
        if (!controller.signal.aborted) setRouteUpdating(false)
      }
    }

    refreshRouteForMode()
    return () => controller.abort()
  }, [modeId, step, journeyCoordinates])

  function handleJourneyChange({
    origin: selectedOrigin,
    destination: selectedDestination,
    distanceKm,
    routeLegs: selectedRouteLegs = [],
  }) {
    setOrigin(selectedOrigin?.name || '')
    setDestination(selectedDestination?.name || '')
    setDistance(String(distanceKm || 0))
    setRouteLegs(selectedRouteLegs)
    setJourneyCoordinates({
      origin: selectedOrigin,
      destination: selectedDestination,
    })
    setSaveMessage('')
    setSaveError('')
    setRouteError('')
    if (distanceKm > 0) {
      const recommendation = recommendedModeForDistance(distanceKm)
      setRecommendedModeId(recommendation)
    }
  }

  function startNewCalculation() {
    setStep(1)
    setModeId('car')
    setRecommendedModeId(null)
    setDistance('0')
    setRoundTrip(false)
    setOrigin('')
    setDestination(initialDestination?.name || '')
    setJourneyCoordinates({
      origin: null,
      destination: initialDestination,
    })
    setRouteError('')
    setRouteUpdating(false)
    setRouteLegs([])
    setSaveMessage('')
    setSaveError('')
  }

  async function saveTrip() {
    setSaveMessage('')
    setSaveError('')

    if (modeId === 'mixed') {
      setSaveError('Mixed routes are calculated only and are not saved to trip history.')
      return
    }

    if (!user) {
      setSaveError('You must be logged in to save a trip.')
      return
    }

    if (!journeyCoordinates.origin || !journeyCoordinates.destination) {
      setSaveError('Please select the origin and destination.')
      return
    }

    if (km <= 0) {
      setSaveError('Wait for a valid route and distance before saving.')
      return
    }

    setIsSaving(true)

    try {
      const savedTrip = await createTrip({
        tourist_id: user.id,
        starting_location: origin,
        destination,
        transport_mode: mode.id,
        ...(mode.id === 'car' ? { car_powertrain: carPowertrain } : {}),
        distance_km: km,
        passengers: pax,
        round_trip: roundTrip,
        carbon_emission: Number(perPassenger.toFixed(2)),
        total_emission: Number(total.toFixed(2)),
        eco_points: ecoPoints,
        origin_lat: journeyCoordinates.origin.lat,
        origin_lng: journeyCoordinates.origin.lng,
        destination_lat: journeyCoordinates.destination.lat,
        destination_lng: journeyCoordinates.destination.lng,
      })

      const savedPoints = Number(savedTrip.eco_points) || 0
      setSaveMessage(`Trip saved successfully. Eco Score changed by ${formatSignedPoints(savedPoints)}.`)
      onTripSaved?.(savedTrip)
    } catch (error) {
      setSaveError(error.message || 'Unable to save this trip.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="tourist-calculator mx-auto flex max-w-7xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Carbon Footprint Calculator
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Search for your journey in Malaysia and calculate its environmental impact
        </p>
      </header>

      <div className="tourist-stepper flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <StepIndicator number="1" label="Select origin" active={step === 1} complete={step === 2} />
        <div className="h-px flex-1 bg-slate-200" />
        <StepIndicator number="2" label="Review journey" active={step === 2} />
      </div>

      {step === 1 ? (
        <>
          {initialDestination && (
            <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
              <MapPin size={18} />
              <p>Destination selected from Eco Monitoring: <b>{initialDestination.name}</b>. Select only your origin below.</p>
            </div>
          )}
          <MalaysiaMapPicker
            onJourneyChange={handleJourneyChange}
            initialDestination={initialDestination}
            lockDestination={Boolean(initialDestination)}
            mode="car"
          />
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!journeyCoordinates.origin || !journeyCoordinates.destination || km <= 0}
            className="self-end rounded-xl bg-green-500 px-8 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next: Review Journey
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={() => setStep(1)} className="self-start text-sm font-semibold text-green-700">
            ← Change origin
          </button>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <section className={`${card} space-y-5 sm:p-6`}>
            <h2 className="font-bold text-slate-800">Journey Details</h2>

            <ReadOnlyField
              label="Origin"
              icon={Navigation}
              value={origin}
              placeholder="Search or select on the map"
              iconClass="text-green-500"
            />

            <ReadOnlyField
              label="Destination"
              icon={MapPin}
              value={destination}
              placeholder="Search or select on the map"
              iconClass="text-orange-500"
            />

            <ReadOnlyNumberField label={routeUpdating ? 'Updating Route Distance...' : 'Route Distance'} value={distance} />

            <button
              type="button"
              onClick={() => setRoundTrip((current) => !current)}
              className="mt-2 flex items-center gap-3 text-sm text-slate-600"
            >
              <span
                className={`relative h-5 w-10 rounded-full transition ${
                  roundTrip ? 'bg-green-500' : 'bg-slate-200'
                }`}
              >
                <i
                  className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition ${
                    roundTrip ? 'left-5' : 'left-0.5'
                  }`}
                />
              </span>
              Round trip
            </button>
          </section>

          <section className={`${card} sm:p-6`}>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800">Transport Mode</h2>
                <p className="mt-0.5 text-xs text-slate-400">Choose how you want to travel</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {modes.length} options
              </span>
            </div>
            {recommendedModeId && (
              <p className="mb-3 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                Recommended for this {km.toFixed(1)} km route: <b>{modes.find((item) => item.id === recommendedModeId)?.label}</b>. You may choose another mode below.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {modes.map((item) => {
                const Icon = item.icon
                const active = item.id === modeId

                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id !== modeId && journeyCoordinates.origin && journeyCoordinates.destination) {
                        setDistance('0')
                        setRouteLegs([])
                        setRouteUpdating(true)
                      }
                      setModeId(item.id)
                      setSaveMessage('')
                      setRouteError('')
                    }}
                    className="group relative flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 p-3 text-xs transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                    style={{
                      borderColor: active ? item.color : '#f1f5f9',
                      color: active ? item.color : '#64748b',
                      background: active ? `${item.color}10` : '#f8fafc',
                    }}
                    key={item.id}
                  >
                    {active && (
                      <span
                        className="absolute right-2 top-2 grid size-4 place-items-center rounded-full text-white"
                        style={{ backgroundColor: item.color }}
                      >
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className="grid size-9 place-items-center rounded-full transition group-hover:scale-105"
                      style={{ backgroundColor: active ? `${item.color}1f` : '#eef2f7' }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="text-center font-semibold leading-tight">{item.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
              <b style={{ color: mode.color }}>{mode.label}:</b> {mode.tip}
            </p>

            {modeId === 'car' && (
              <fieldset className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                <legend className="px-1 text-xs font-semibold text-red-800">
                  Car power source
                </legend>
                <div className="mt-1 grid gap-2 sm:grid-cols-2">
                  {CAR_POWERTRAIN_OPTIONS.map((option) => {
                    const active = carPowertrain === option.id

                    return (
                      <button
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setCarPowertrain(option.id)
                          setSaveMessage('')
                        }}
                        className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                          active
                            ? 'border-red-500 bg-white text-red-800 shadow-sm'
                            : 'border-red-200 text-red-700 hover:border-red-400'
                        }`}
                        key={option.id}
                      >
                        <b className="block">{option.label}</b>
                        {option.factorG} g CO₂e/passenger-km
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}

            {isPublicTransport && (
              <div className="mt-4">
                {routeUpdating ? (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-700">Finding the public-transport journey...</p>
                ) : routeError ? (
                  <p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600" role="alert">{routeError}</p>
                ) : routeLegs.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 bg-white px-3 py-2">
                      <p className="text-xs font-bold text-slate-700">Journey directions</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Follow these legs in order</p>
                    </div>
                    <ol className="divide-y divide-slate-200">
                      {routeLegs.map((leg, index) => {
                        const walking = leg.mode === 'walk' || leg.mode === 'foot'
                        const rail = ['rail', 'subway', 'tram', 'metro', 'monorail'].includes(leg.mode)
                        const driving = leg.mode === 'car'
                        const LegIcon = walking ? Footprints : rail ? Train : driving ? Car : Bus
                        const vehicle = leg.transportLabel || (rail ? 'LRT / MRT' : driving ? 'Car' : 'Bus')
                        const label = walking ? 'Walk' : `${vehicle}${leg.route ? ` ${leg.route}` : ''}`

                        return (
                          <li className="flex gap-3 px-3 py-3" key={`${leg.mode}-${leg.route || 'leg'}-${index}`}>
                            <span className={`grid size-8 shrink-0 place-items-center rounded-full ${walking ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                              <LegIcon size={15} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <b className="text-xs text-slate-700">{index + 1}. {label}</b>
                                <span className="text-[11px] text-slate-400">{leg.distanceKm.toFixed(2)} km · {leg.durationMinutes} min</span>
                              </div>
                              <p className="mt-1 truncate text-[11px] text-slate-500">{leg.from || 'Selected origin'} → {leg.to || 'Selected destination'}</p>
                              {!walking && leg.headsign && <p className="mt-0.5 text-[11px] text-amber-700">Towards {leg.headsign}</p>}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ) : null}
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  Routes provided by{' '}
                  <a className="font-semibold text-green-700 underline" href="https://transitous.org/sources/" target="_blank" rel="noreferrer">
                    Transitous and its data sources
                  </a>.
                </p>
              </div>
            )}

            {!isPublicTransport && routeError && (
              <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600" role="alert">{routeError}</p>
            )}
          </section>

        </div>

        <div className="space-y-5">
          <section
            className={`${card} border-2`}
            style={{ borderColor: `${rating.color}40` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  CO₂ Per Passenger
                </p>
                <p
                  className="mt-1 text-5xl font-bold leading-none"
                  style={{ color: rating.color }}
                >
                  {perPassenger.toFixed(2)}
                  <span className="text-base font-normal text-slate-400">
                    {' '}kg CO₂
                  </span>
                </p>
              </div>

              <span
                className="rounded-xl px-3 py-1.5 text-sm font-bold"
                style={{
                  color: rating.color,
                  background: `${rating.color}15`,
                }}
              >
                {rating.label}
              </span>
            </div>

            <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              {rating.text}
            </p>

            <div className="mt-5 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <ResultItem
                label="Group Total"
                value={`${total.toFixed(2)} kg`}
                color="#0f172a"
              />
              <ResultItem
                label="Trees to Offset"
                value={`${Math.ceil(perPassenger / 21.77)} trees/yr`}
                color="#22c55e"
              />
              <ResultItem
                label="Emission Factor"
                value={`${environmentalImpact.factorG} g CO₂e/passenger-km`}
                color="#64748b"
              />
            </div>

            <div className="mt-5 flex gap-3 rounded-xl border border-green-200 bg-green-50 p-3.5 text-sm text-green-700">
              <Leaf className="mt-0.5 shrink-0" size={17} />
              <p>{mode.tip}</p>
            </div>

            <div className={`mt-4 rounded-xl border p-4 ${ecoPoints < 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Eco Score effect
                  </p>
                  <p className={`mt-1 text-2xl font-bold ${ecoPoints < 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {formatSignedPoints(ecoPoints)} points
                  </p>
                </div>
                {environmentalImpact.isRecommended && (
                  <span className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
                    Recommended +3
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <ScoreRule label="Mode & distance" value={environmentalImpact.breakdown.modeDistancePoints} />
                <ScoreRule label="Emission level" value={environmentalImpact.breakdown.emissionPoints} />
                <ScoreRule label="Recommendation" value={environmentalImpact.breakdown.recommendationPoints} />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Walking is recommended up to 2 km, bicycle up to 10 km, and bus above 10 km. Emissions above 5 kg start reducing points; above 15 kg has the strongest penalty.
              </p>
            </div>

            {!['bus', 'mrt', 'mixed', 'walking', 'bicycle'].includes(modeId) &&
              km > 0 && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3.5">
                  <p className="text-sm text-blue-700">
                    <b>Greener alternative</b>
                    <br />
                    Bus: <b>{greener.toFixed(2)} kg CO₂</b> — saves{' '}
                    <b>{Math.max(0, perPassenger - greener).toFixed(2)} kg</b>
                  </p>
                  <TrendingDown className="text-blue-500" size={21} />
                </div>
              )}

            <div className="mt-5">
              {saveError && (
                <p
                  className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-600"
                  role="alert"
                >
                  {saveError}
                </p>
              )}

              {saveMessage && (
                <p
                  className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700"
                  role="status"
                >
                  {saveMessage}
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={startNewCalculation}
                  className="rounded-xl border border-green-600 bg-white px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  Calculate New Trip
                </button>

                <button
                  type="button"
                  onClick={saveTrip}
                  disabled={
                    isSaving ||
                    modeId === 'mixed' ||
                    !user ||
                    !journeyCoordinates.origin ||
                    !journeyCoordinates.destination ||
                    km <= 0
                  }
                  className="rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {modeId === 'mixed'
                    ? 'Mixed Route — Calculation Only'
                    : isSaving
                    ? 'Saving Trip...'
                    : `Save Trip — Optional (${formatSignedPoints(ecoPoints)} Eco Score)`}
                </button>
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-4 font-bold text-slate-800">
              Mode Comparison{' '}
              <span className="font-normal text-slate-400">(one traveller)</span>
            </h2>

            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={comparison} margin={{ left: -20 }}>
                <CartesianGrid
                  stroke="#f1f5f9"
                  strokeDasharray="3 3"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [`${value} kg CO₂`, 'Per passenger']}
                />
                <Bar dataKey="emission" radius={[4, 4, 0, 0]}>
                  {comparison.map((item) => (
                    <Cell
                      fill={item.color}
                      opacity={item.name === mode.label ? 1 : 0.45}
                      key={item.name}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        </div>
      </div>
        </>
      )}
    </div>
  )
}

function ReadOnlyField({
  label,
  icon: Icon,
  value,
  placeholder,
  iconClass,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <span className="relative block">
        <Icon
          className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${iconClass}`}
          size={14}
        />
        <input
          readOnly
          value={value}
          placeholder={placeholder}
          className="w-full truncate rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs text-slate-600 outline-none"
        />
      </span>
    </label>
  )
}

function ReadOnlyNumberField({ label, value }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-slate-500">
        {label}
      </span>
      <div className="relative">
        <input
          readOnly
          value={value}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pr-10 text-sm text-slate-600 outline-none"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
          km
        </span>
      </div>
    </label>
  )
}

function StepIndicator({ number, label, active, complete = false }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${active || complete ? 'text-green-700' : 'text-slate-400'}`}>
      <span className={`grid size-7 place-items-center rounded-full ${active || complete ? 'bg-green-500 text-white' : 'bg-slate-100'}`}>
        {complete ? '✓' : number}
      </span>
      {label}
    </div>
  )
}

function ResultItem({ label, value, color }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <b className="mt-1 block text-sm" style={{ color }}>
        {value}
      </b>
    </div>
  )
}

function ScoreRule({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2">
      <span>{label}</span>
      <b className={value < 0 ? 'text-red-600' : 'text-green-700'}>
        {formatSignedPoints(value)}
      </b>
    </div>
  )
}

function formatSignedPoints(value) {
  const points = Number(value) || 0
  return points > 0 ? `+${points}` : String(points)
}
