import { useEffect, useRef, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import {
  MapPin,
  Navigation,
  RotateCcw,
  Search,
} from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import {
  calculateMalaysiaRoute,
  reverseMalaysiaLocation,
  searchMalaysiaLocations,
} from '../../services/mapService'

const KUALA_LUMPUR_CENTER = [3.139, 101.6869]

const MALAYSIA_BOUNDS = [
  [0.8, 99.5],
  [7.6, 119.5],
]

function MapClickHandler({ onClick }) {
  useMapEvents({
    click(event) {
      onClick({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      })
    },
  })

  return null
}

function FitJourney({
  origin,
  destination,
  routeCoordinates,
}) {
  const map = useMap()

  useEffect(() => {
    if (routeCoordinates.length > 0) {
      map.fitBounds(routeCoordinates, {
        padding: [35, 35],
      })
      return
    }

    const selected = destination || origin

    if (selected) {
      map.flyTo(
        [selected.lat, selected.lng],
        13,
        {
          duration: 0.8,
        },
      )
    }
  }, [map, origin, destination, routeCoordinates])

  return null
}

export default function MalaysiaMapPicker({
  onJourneyChange,
}) {
  const callbackRef = useRef(onJourneyChange)

  const [selecting, setSelecting] = useState('origin')
  const [origin, setOrigin] = useState(null)
  const [destination, setDestination] = useState(null)
  const [routeCoordinates, setRouteCoordinates] =
    useState([])

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [message, setMessage] = useState(
    'Select Origin, then search or click the map.',
  )
  const [error, setError] = useState('')

  useEffect(() => {
    callbackRef.current = onJourneyChange
  }, [onJourneyChange])

  useEffect(() => {
    if (!origin || !destination) {
      return
    }

    const controller = new AbortController()

    async function loadRoute() {
      setRouteLoading(true)
      setError('')
      setMessage('Calculating route...')

      try {
        const route = await calculateMalaysiaRoute(
          origin,
          destination,
        )

        if (controller.signal.aborted) return

        setRouteCoordinates(route.coordinates)
        setMessage(
          `Route found: ${route.distanceKm} km, approximately ${route.durationMinutes} minutes.`,
        )

        callbackRef.current?.({
          origin,
          destination,
          distanceKm: route.distanceKm,
          durationMinutes: route.durationMinutes,
        })
      } catch (routeError) {
        if (controller.signal.aborted) return

        setRouteCoordinates([])
        setError(routeError.message)

        callbackRef.current?.({
          origin,
          destination,
          distanceKm: 0,
          durationMinutes: 0,
        })
      } finally {
        if (!controller.signal.aborted) {
          setRouteLoading(false)
        }
      }
    }

    loadRoute()

    return () => controller.abort()
  }, [origin, destination])

  function selectLocation(location) {
    setSearchResults([])
    setQuery('')
    setError('')

    if (selecting === 'origin') {
      setOrigin(location)
      setRouteCoordinates([])
      setSelecting('destination')
      setMessage(
        'Origin selected. Now select the destination.',
      )
      callbackRef.current?.({
        origin: location,
        destination: null,
        distanceKm: 0,
        durationMinutes: 0,
      })
    } else {
      setDestination(location)
      setMessage('Destination selected.')
    }
  }

  async function handleMapClick(point) {
    setError('')
    setMessage('Checking the selected location...')

    try {
      const location = await reverseMalaysiaLocation(
        point.lat,
        point.lng,
      )

      selectLocation(location)
    } catch (locationError) {
      setError(locationError.message)
    }
  }

  async function handleSearch(event) {
    event.preventDefault()

    const cleanQuery = query.trim()

    if (cleanQuery.length < 2) {
      setError('Enter at least 2 characters.')
      return
    }

    setSearching(true)
    setError('')
    setSearchResults([])

    try {
      const results =
        await searchMalaysiaLocations(cleanQuery)

      setSearchResults(results)

      if (results.length === 0) {
        setError('No matching Malaysian location was found.')
      }
    } catch (searchError) {
      setError(searchError.message)
    } finally {
      setSearching(false)
    }
  }

  function resetJourney() {
    setSelecting('origin')
    setOrigin(null)
    setDestination(null)
    setRouteCoordinates([])
    setQuery('')
    setSearchResults([])
    setError('')
    setMessage(
      'Select Origin, then search or click the map.',
    )

    callbackRef.current?.({
      origin: null,
      destination: null,
      distanceKm: 0,
      durationMinutes: 0,
    })
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-800">
            Select Journey Locations
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Search for a Malaysian location or click the map.
          </p>
        </div>

        <button
          type="button"
          onClick={resetJourney}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setSelecting('origin')
            setMessage('Select the starting location.')
          }}
          className={`rounded-xl border-2 p-3 text-left ${
            selecting === 'origin'
              ? 'border-green-500 bg-green-50'
              : 'border-slate-100 bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Navigation
              size={16}
              className="text-green-500"
            />
            Origin
          </span>

          <span className="mt-1 block truncate text-xs text-slate-500">
            {origin?.name || 'Not selected'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelecting('destination')
            setMessage('Select the destination.')
          }}
          className={`rounded-xl border-2 p-3 text-left ${
            selecting === 'destination'
              ? 'border-orange-500 bg-orange-50'
              : 'border-slate-100 bg-slate-50'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <MapPin
              size={16}
              className="text-orange-500"
            />
            Destination
          </span>

          <span className="mt-1 block truncate text-xs text-slate-500">
            {destination?.name || 'Not selected'}
          </span>
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        className="relative mb-3"
      >
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder={
                selecting === 'origin'
                  ? 'Search origin in Malaysia'
                  : 'Search destination in Malaysia'
              }
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-green-500"
            />
          </div>

          <button
            type="submit"
            disabled={searching}
            className="rounded-xl bg-green-500 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[1000] mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
            {searchResults.map((location) => (
              <button
                type="button"
                key={location.id}
                onClick={() =>
                  selectLocation(location)
                }
                className="block w-full rounded-lg px-3 py-2 text-left text-xs text-slate-600 hover:bg-green-50"
              >
                {location.name}
              </button>
            ))}
          </div>
        )}
      </form>

      <div className="h-80 overflow-hidden rounded-xl border border-slate-200">
        <MapContainer
          center={KUALA_LUMPUR_CENTER}
          zoom={12}
          minZoom={6}
          maxBounds={MALAYSIA_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapClickHandler onClick={handleMapClick} />

          <FitJourney
            origin={origin}
            destination={destination}
            routeCoordinates={routeCoordinates}
          />

          {origin && (
            <CircleMarker
              center={[origin.lat, origin.lng]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#22c55e',
                fillOpacity: 1,
              }}
            >
              <Popup>Origin: {origin.name}</Popup>
            </CircleMarker>
          )}

          {destination && (
            <CircleMarker
              center={[
                destination.lat,
                destination.lng,
              ]}
              radius={9}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#f97316',
                fillOpacity: 1,
              }}
            >
              <Popup>
                Destination: {destination.name}
              </Popup>
            </CircleMarker>
          )}

          {routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates}
              pathOptions={{
                color: '#16a34a',
                weight: 5,
                opacity: 0.8,
              }}
            />
          )}
        </MapContainer>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {!error && (
        <p
          className={`mt-3 rounded-lg p-3 text-sm ${
            routeLoading
              ? 'bg-blue-50 text-blue-700'
              : routeCoordinates.length > 0
                ? 'bg-green-50 text-green-700'
                : 'bg-slate-50 text-slate-600'
          }`}
        >
          {message}
        </p>
      )}
    </section>
  )
}
