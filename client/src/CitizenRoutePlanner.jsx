import { useState, useEffect } from 'react'
import {
  AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight,
  Clock, Compass, LocateFixed, MapPin, Navigation, ParkingCircle,
  RefreshCw, ShieldAlert, ShieldCheck, Siren, Sparkles, Zap
} from 'lucide-react'
import { NAGPUR_LOCATIONS, calculateIncidentAwareRoute } from './routingService'

export function CitizenRoutePlanner({
  incidents = [],
  parkings = [],
  notify,
  onRouteCalculated,
  currentRoute
}) {
  const [startId, setStartId] = useState('airport')
  const [destId, setDestId] = useState('sitabuldi')
  const [emergencyMode, setEmergencyMode] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [routeResult, setRouteResult] = useState(null)
  const [locating, setLocating] = useState(false)

  const activeIncidents = incidents.filter((i) => i.status === 'ACTIVE' || i.status === 'Active')

  // Find start and destination objects
  const startLoc = NAGPUR_LOCATIONS.find((l) => l.id === startId) || NAGPUR_LOCATIONS[0]
  const destLoc = NAGPUR_LOCATIONS.find((l) => l.id === destId) || NAGPUR_LOCATIONS[7]

  // Calculate route
  const handleCalculateRoute = async (customStart = null, customDest = null, emergency = emergencyMode) => {
    setCalculating(true)
    const s = customStart || startLoc
    const d = customDest || destLoc

    try {
      const result = await calculateIncidentAwareRoute({
        start: s,
        destination: d,
        activeIncidents,
        emergencyMode: emergency,
        parkings
      })

      setRouteResult(result)
      if (onRouteCalculated) {
        onRouteCalculated(result)
      }

      if (result.isAffected) {
        notify(`⚠️ Route Alert: Avoiding ${result.affectedIncidents[0]?.title || 'road hazard'} (+${result.delayMinutes} mins alternative)`)
      } else {
        notify('Clear corridor found — no active road closures detected on route.')
      }
    } catch {
      notify('Unable to calculate an alternative route. Please try again.')
    } finally {
      setCalculating(false)
    }
  }

  // Calculate on initial mount or when emergencyMode changes
  useEffect(() => {
    handleCalculateRoute(startLoc, destLoc, emergencyMode)
  }, [emergencyMode, incidents])

  // Swap locations
  const handleSwap = () => {
    const temp = startId
    setStartId(destId)
    setDestId(temp)
    const newStart = NAGPUR_LOCATIONS.find((l) => l.id === destId)
    const newDest = NAGPUR_LOCATIONS.find((l) => l.id === temp)
    handleCalculateRoute(newStart, newDest, emergencyMode)
  }

  // Use GPS location
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      notify('Geolocation is not supported by your browser')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const userLoc = {
          id: 'my_location',
          name: 'My Current Location (GPS)',
          lat: coords.latitude,
          lng: coords.longitude
        }
        setStartId('my_location')
        handleCalculateRoute(userLoc, destLoc, emergencyMode)
        setLocating(false)
      },
      () => {
        notify('Unable to retrieve GPS coordinates. Defaulting to Airport.')
        setLocating(false)
      },
      { timeout: 7000 }
    )
  }

  // One-click demo scenario presets
  const runPresetScenario = (scenario) => {
    if (scenario === 'flyover') {
      setStartId('airport')
      setDestId('sitabuldi')
      const s = NAGPUR_LOCATIONS.find((l) => l.id === 'airport')
      const d = NAGPUR_LOCATIONS.find((l) => l.id === 'sitabuldi')
      handleCalculateRoute(s, d, emergencyMode)
    } else if (scenario === 'flood') {
      setStartId('laxmi_nagar')
      setDestId('besa')
      const s = NAGPUR_LOCATIONS.find((l) => l.id === 'laxmi_nagar')
      const d = NAGPUR_LOCATIONS.find((l) => l.id === 'besa')
      handleCalculateRoute(s, d, emergencyMode)
    } else if (scenario === 'event') {
      setStartId('dharampeth')
      setDestId('deekshabhoomi')
      const s = NAGPUR_LOCATIONS.find((l) => l.id === 'dharampeth')
      const d = NAGPUR_LOCATIONS.find((l) => l.id === 'deekshabhoomi')
      handleCalculateRoute(s, d, emergencyMode)
    }
  }

  // Set parking as destination
  const handleSelectParking = (p) => {
    const [pLng, pLat] = p.location?.coordinates || [79.068, 21.127]
    const parkingDest = {
      id: p.parkingId || p._id,
      name: `🅿️ ${p.name}`,
      lat: pLat,
      lng: pLng
    }
    handleCalculateRoute(startLoc, parkingDest, emergencyMode)
    notify(`Destination updated to parking: ${p.name}`)
  }

  return (
    <div className="route-planner-container">
      {/* Route Configuration Panel */}
      <div className="planner-control-card">
        <div className="planner-card-head">
          <div>
            <span className="eyebrow"><span className="pulse-dot" /> DYNAMIC GIS NAVIGATION</span>
            <h2>Nagpur Incident-Aware Routing</h2>
            <p>Calculates dynamic detour routes avoiding closed flyovers, waterlogged underpasses & event congestion.</p>
          </div>
          <div className="active-incidents-badge">
            <AlertOctagon size={14} />
            <span><b>{activeIncidents.length}</b> Active City Incidents</span>
          </div>
        </div>

        {/* 3 Quick Hackathon Scenario Triggers */}
        <div className="quick-scenario-testbar">
          <span className="testbar-label"><Sparkles size={14} /> Quick Demo Routes:</span>
          <button className="quick-scenario-btn" onClick={() => runPresetScenario('flyover')}>
            🚧 1: Airport → Sitabuldi (Flyover Closure)
          </button>
          <button className="quick-scenario-btn" onClick={() => runPresetScenario('flood')}>
            🌊 2: Laxmi Nagar → Besa (Flooded Underpass)
          </button>
          <button className="quick-scenario-btn" onClick={() => runPresetScenario('event')}>
            🎪 3: Dharampeth → Deekshabhoomi (Mega Event)
          </button>
        </div>

        <div className="route-inputs-grid">
          {/* Start Location */}
          <div className="input-field-box">
            <div className="field-label-row">
              <label><MapPin size={15} color="#10b981" /> Origin / Starting Point</label>
              <button className="locate-me-btn" onClick={handleLocateMe} disabled={locating}>
                <LocateFixed size={12} /> {locating ? 'Acquiring GPS...' : 'Use My GPS'}
              </button>
            </div>
            <select
              value={startId}
              onChange={(e) => {
                setStartId(e.target.value)
                const s = NAGPUR_LOCATIONS.find((l) => l.id === e.target.value)
                handleCalculateRoute(s, destLoc, emergencyMode)
              }}
            >
              {startId === 'my_location' && <option value="my_location">📍 My Current Location (GPS)</option>}
              {NAGPUR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.category})
                </option>
              ))}
            </select>
          </div>

          <button className="swap-locations-btn" onClick={handleSwap} title="Swap Origin & Destination">
            ⇄
          </button>

          {/* Destination */}
          <div className="input-field-box">
            <div className="field-label-row">
              <label><Navigation size={15} color="#2563eb" /> Destination</label>
            </div>
            <select
              value={destId}
              onChange={(e) => {
                setDestId(e.target.value)
                const d = NAGPUR_LOCATIONS.find((l) => l.id === e.target.value)
                handleCalculateRoute(startLoc, d, emergencyMode)
              }}
            >
              {NAGPUR_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.category})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Emergency Mode & Action */}
        <div className="planner-actions-bar">
          <div className={`emergency-toggle-box ${emergencyMode ? 'active' : ''}`}>
            <label className="emergency-label">
              <input
                type="checkbox"
                checked={emergencyMode}
                onChange={(e) => setEmergencyMode(e.target.checked)}
              />
              <div className="emergency-toggle-display">
                <span className="emergency-icon">🚑</span>
                <div>
                  <strong>Emergency Vehicle Priority Mode</strong>
                  <span>Fastest priority corridor avoiding flooded & blocked roads</span>
                </div>
              </div>
            </label>
          </div>

          <button
            className="primary-button recalculate-btn"
            disabled={calculating}
            onClick={() => handleCalculateRoute(startLoc, destLoc, emergencyMode)}
          >
            {calculating ? <RefreshCw size={16} className="spin-slow" /> : <Navigation size={16} />}
            {calculating ? 'Analyzing Incidents...' : 'Calculate Safe Route'}
          </button>
        </div>
      </div>

      {/* Results & Alerts Section */}
      {routeResult && (
        <div className="route-results-section">
          {/* SCENARIO / ROUTE WARNING BANNER */}
          {routeResult.isAffected && (
            <div className="route-alert-card">
              <div className="alert-card-head">
                <div className="alert-icon-wrap"><AlertOctagon size={22} /></div>
                <div>
                  <span className="alert-badge">⚠️ ROUTE DISRUPTION ALERT</span>
                  <h3>{routeResult.routeWarning}</h3>
                  <p>{routeResult.avoidanceReason}</p>
                </div>
              </div>

              <div className="route-comparison-grid">
                <div className="comparison-box blocked">
                  <span>Standard Corridor (Blocked)</span>
                  <strong>{routeResult.primaryRoute?.durationMinutes} mins</strong>
                  <small>Passes through active hazard radius</small>
                </div>
                <div className="comparison-arrow">➔</div>
                <div className="comparison-box recommended">
                  <span>Recommended Safe Detour</span>
                  <strong>{routeResult.recommendedRoute?.durationMinutes} mins</strong>
                  <small>+{routeResult.delayMinutes} mins detour to avoid danger</small>
                </div>
                <div className="comparison-box net-delay">
                  <span>Delay Avoided</span>
                  <strong className="text-coral">+{routeResult.delayMinutes} mins</strong>
                  <small>Bypasses road closure safely</small>
                </div>
              </div>

              <div className="hazard-breakdown-list">
                <span>Active Disruptions on Normal Route:</span>
                {routeResult.affectedIncidents.map((inc) => (
                  <div className="hazard-item-pill" key={inc._id || inc.incidentId}>
                    <span className="hazard-tag">{inc.type.replaceAll('_', ' ')}</span>
                    <strong>{inc.title}</strong>
                    <span>({inc.roadName} · {inc.severity} Severity)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EMERGENCY MODE CARD */}
          {emergencyMode && (
            <div className="emergency-priority-card">
              <div className="emergency-head">
                <div className="siren-wrap"><Siren size={24} className="siren-pulse" /></div>
                <div>
                  <span className="priority-seal">🚑 EMERGENCY GREEN CORRIDOR ACTIVE</span>
                  <h3>Priority Emergency Transit Route</h3>
                  <p>Estimated Priority ETA: <b>{routeResult.emergencyMode?.durationMinutes} minutes</b> (cleared transit speed)</p>
                </div>
              </div>

              <div className="avoided-incidents-block">
                <strong>Protected / Avoided Hazards:</strong>
                <ul>
                  {routeResult.emergencyMode?.avoidedIncidents?.length > 0 ? (
                    routeResult.emergencyMode.avoidedIncidents.map((title, idx) => (
                      <li key={idx}><ShieldCheck size={14} color="#10b981" /> Avoided: {title}</li>
                    ))
                  ) : (
                    <li><ShieldCheck size={14} color="#10b981" /> No active road hazards along priority corridor</li>
                  )}
                </ul>
              </div>
              <small className="emergency-disclaimer">
                ⚠️ <em>{routeResult.emergencyMode?.disclaimer}</em>
              </small>
            </div>
          )}

          {/* CLEAR ROUTE CARD (When no incidents affect path) */}
          {!routeResult.isAffected && !emergencyMode && (
            <div className="route-clear-card">
              <CheckCircle2 size={22} color="#10b981" />
              <div>
                <strong>Direct Corridor Clear & Operational</strong>
                <p>No active road closures or flooded underpasses detected along your selected path.</p>
              </div>
              <div className="clear-stats">
                <span>Estimated Drive: <b>{routeResult.recommendedRoute?.durationMinutes} mins</b></span>
                <span>Distance: <b>{routeResult.recommendedRoute?.distanceKm} km</b></span>
              </div>
            </div>
          )}

          {/* EVENT PARKING GUIDANCE */}
          {routeResult.eventParking?.hasEvent && routeResult.eventParking?.parkings?.length > 0 && (
            <div className="event-parking-card">
              <div className="parking-card-head">
                <div className="parking-icon-wrap"><ParkingCircle size={24} /></div>
                <div>
                  <span className="parking-badge">🅿️ EVENT PARKING GUIDANCE</span>
                  <h3>Nearby Parking for {routeResult.eventParking.eventName}</h3>
                  <p>Surrounding perimeter has restricted vehicle access. Park at a designated lot and use pedestrian walkways.</p>
                </div>
              </div>

              <div className="parking-lots-grid">
                {routeResult.eventParking.parkings.map((p) => {
                  const isRecommended = routeResult.eventParking.recommended?.parkingId === p.parkingId
                  const percentFree = Math.round((p.availableSpaces / p.capacity) * 100)

                  return (
                    <div className={`parking-lot-item ${isRecommended ? 'recommended' : ''}`} key={p._id || p.parkingId}>
                      {isRecommended && <div className="rec-ribbon">⭐ Recommended Nearest Available</div>}
                      <h4>{p.name}</h4>
                      <p><MapPin size={12} /> {p.address || 'Nagpur'}</p>

                      <div className="parking-spaces-bar">
                        <div className="space-numbers">
                          <span>Available: <b>{p.availableSpaces}</b> / {p.capacity}</span>
                          <span className={percentFree < 20 ? 'text-coral' : 'text-mint'}>{percentFree}% Free</span>
                        </div>
                        <div className="meter-bar">
                          <i style={{ width: `${100 - percentFree}%` }} />
                        </div>
                      </div>

                      <div className="parking-action-row">
                        <span className="dist-tag">{p.distanceKm || '0.8'} km away</span>
                        <button className="route-to-parking-btn" onClick={() => handleSelectParking(p)}>
                          Route to This Parking <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
