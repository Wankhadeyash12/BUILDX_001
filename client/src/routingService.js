// Dynamic Incident-Aware Routing Engine for Nagpur Metropolitan Region
// Supports OSRM driving API with robust local corridor graph fallback.

export const NAGPUR_LOCATIONS = [
  { id: 'airport', name: 'Dr. Babasaheb Ambedkar Airport (Nagpur)', lat: 21.0922, lng: 79.0617, category: 'Transit Hub' },
  { id: 'wardha_road', name: 'Wardha Road / Chhatrapati Square', lat: 21.1118, lng: 79.0682, category: 'Highway Corridor' },
  { id: 'manish_nagar', name: 'Manish Nagar Railway Crossing', lat: 21.0995, lng: 79.0815, category: 'South Suburb' },
  { id: 'laxmi_nagar', name: 'Laxmi Nagar Square', lat: 21.1215, lng: 79.0684, category: 'Central Junction' },
  { id: 'somalwar_school', name: 'Somalwar School Gate (Khamla)', lat: 21.1189, lng: 79.0722, category: 'School Zone' },
  { id: 'deekshabhoomi', name: 'Deekshabhoomi Monument', lat: 21.1278, lng: 79.0689, category: 'Cultural Landmark' },
  { id: 'dharampeth', name: 'Dharampeth Commercial Market', lat: 21.1390, lng: 79.0620, category: 'West Ward' },
  { id: 'sitabuldi', name: 'Sitabuldi Metro Interchange & Zero Mile', lat: 21.1458, lng: 79.0882, category: 'City Center' },
  { id: 'medical_square', name: 'Medical Square (GMC Hospital)', lat: 21.1340, lng: 79.0965, category: 'Hospital Corridor' },
  { id: 'railway_station', name: 'Nagpur Central Railway Station', lat: 21.1520, lng: 79.0880, category: 'Transit Hub' },
  { id: 'katol_road', name: 'Katol Road / Gittikhadan', lat: 21.1685, lng: 79.0552, category: 'West Corridor' },
  { id: 'wadi', name: 'Wadi Bus Stop (Amravati Road)', lat: 21.1498, lng: 79.0095, category: 'West Outer' },
  { id: 'kamptee_road', name: 'Kamptee Road (Automotive Square)', lat: 21.1925, lng: 79.1124, category: 'North Corridor' },
  { id: 'besa', name: 'Besa Square / Ring Road', lat: 21.0880, lng: 79.0910, category: 'South Outer' }
]

// Haversine distance in meters between two lat/lng points
export function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Distance from point P to line segment AB in meters
export function pointToSegmentDistanceMeters(pLat, pLng, aLat, aLng, bLat, bLng) {
  const lineDist = distanceMeters(aLat, aLng, bLat, bLng)
  if (lineDist === 0) return distanceMeters(pLat, pLng, aLat, aLng)

  // Project point P onto segment AB in equirectangular projection
  const x1 = aLng
  const y1 = aLat
  const x2 = bLng
  const y2 = bLat
  const px = pLng
  const py = pLat

  const dx = x2 - x1
  const dy = y2 - y1
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))

  const projLat = y1 + t * dy
  const projLng = x1 + t * dx
  return distanceMeters(pLat, pLng, projLat, projLng)
}

// Check if a route polyline intersects an incident's affected radius
export function checkRouteIncidentCollision(polyline, incident) {
  if (!polyline || polyline.length < 2 || !incident) return false
  const [incLng, incLat] = incident.location?.coordinates || [incident.longitude, incident.latitude]
  if (!incLat || !incLng) return false

  const radiusMeters = incident.radius || 350

  for (let i = 0; i < polyline.length - 1; i++) {
    const [lat1, lng1] = polyline[i]
    const [lat2, lng2] = polyline[i + 1]
    const dist = pointToSegmentDistanceMeters(incLat, incLng, lat1, lng1, lat2, lng2)
    if (dist <= radiusMeters) {
      return {
        collided: true,
        incident,
        distanceToCenter: Math.round(dist),
        segmentIndex: i
      }
    }
  }
  return false
}

// Generate intermediate interpolation points along corridor
function interpolatePoints(start, end, steps = 5) {
  const points = []
  for (let i = 0; i <= steps; i++) {
    const frac = i / steps
    points.push([
      start[0] + (end[0] - start[0]) * frac,
      start[1] + (end[1] - start[1]) * frac
    ])
  }
  return points
}

// Generate realistic Nagpur corridor polyline
export function generateNagpurCorridorPolyline(startLat, startLng, endLat, endLng, bypassWaypoints = []) {
  if (bypassWaypoints.length > 0) {
    const full = []
    let current = [startLat, startLng]
    for (const wp of bypassWaypoints) {
      const seg = interpolatePoints(current, wp, 4)
      full.push(...seg.slice(0, -1))
      current = wp
    }
    full.push(...interpolatePoints(current, [endLat, endLng], 4))
    return full
  }

  // Check if route traverses Wardha Road corridor (South-North axis)
  const isSouthNorth = Math.abs(startLat - endLat) > 0.03
  if (isSouthNorth) {
    // Standard direct Wardha Road corridor path
    const midLat = (startLat + endLat) / 2
    const midLng = (startLng + endLng) / 2
    return [
      [startLat, startLng],
      [startLat * 0.7 + midLat * 0.3, startLng * 0.7 + midLng * 0.3],
      [midLat, midLng],
      [midLat * 0.3 + endLat * 0.7, midLng * 0.3 + endLng * 0.7],
      [endLat, endLng]
    ]
  }

  return interpolatePoints([startLat, startLng], [endLat, endLng], 8)
}

// Compute dynamic incident-aware route
export async function calculateIncidentAwareRoute({
  start,
  destination,
  activeIncidents = [],
  emergencyMode = false,
  parkings = []
}) {
  const startLat = Number(start.lat)
  const startLng = Number(start.lng)
  const destLat = Number(destination.lat)
  const destLng = Number(destination.lng)

  const directDistance = distanceMeters(startLat, startLng, destLat, destLng)

  // 1. Generate normal/primary route
  let primaryPolyline = generateNagpurCorridorPolyline(startLat, startLng, destLat, destLng)

  // Try fetching real OSRM polyline if reachable
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${destLng},${destLat}?overview=full&geometries=geojson`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const resp = await fetch(osrmUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (resp.ok) {
      const data = await resp.json()
      if (data.routes?.[0]?.geometry?.coordinates) {
        // GeoJSON coordinates are [lng, lat], Leaflet wants [lat, lng]
        primaryPolyline = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
      }
    }
  } catch {
    // Gracefully use local corridor polyline
  }

  // 2. Check collisions with active incidents
  const affectedIncidents = []
  for (const inc of activeIncidents) {
    if (inc.status === 'ACTIVE' || inc.status === 'Active') {
      const hit = checkRouteIncidentCollision(primaryPolyline, inc)
      if (hit) {
        affectedIncidents.push(inc)
      }
    }
  }

  const isAffected = affectedIncidents.length > 0

  // 3. Compute alternative route if affected
  let alternativePolyline = null
  let bypassedWaypoints = []
  let delayMinutes = 0
  let routeWarning = null
  let avoidanceReason = null

  if (isAffected) {
    // Generate avoidance waypoints around incident centers
    for (const inc of affectedIncidents) {
      const [incLng, incLat] = inc.location?.coordinates || [inc.longitude, inc.latitude]
      const radius = (inc.radius || 350) / 111000 // Convert meters to rough degrees
      
      // Determine bypass direction (shift perpendicular to start-end vector)
      const dLat = destLat - startLat
      const dLng = destLng - startLng
      const normalLat = -dLng
      const normalLng = dLat
      const len = Math.sqrt(normalLat * normalLat + normalLng * normalLng) || 1

      // Bypass offset (e.g. 1.8x radius out)
      const offsetFactor = radius * 1.8
      const wp1 = [incLat + (normalLat / len) * offsetFactor, incLng + (normalLng / len) * offsetFactor]
      const wp2 = [incLat - (normalLat / len) * offsetFactor, incLng - (normalLng / len) * offsetFactor]

      // Pick waypoint that doesn't deviate too wildly
      const dist1 = distanceMeters(startLat, startLng, wp1[0], wp1[1]) + distanceMeters(wp1[0], wp1[1], destLat, destLng)
      const dist2 = distanceMeters(startLat, startLng, wp2[0], wp2[1]) + distanceMeters(wp2[0], wp2[1], destLat, destLng)
      
      bypassedWaypoints.push(dist1 < dist2 ? wp1 : wp2)
    }

    alternativePolyline = generateNagpurCorridorPolyline(startLat, startLng, destLat, destLng, bypassedWaypoints)

    // Calculate time impact
    const primaryTimeMin = Math.max(4, Math.round((directDistance / 1000) * 2.2)) // ~27 km/h normal city speed
    delayMinutes = Math.max(3, Math.min(12, Math.round(affectedIncidents.length * 3.5)))
    const alternativeTimeMin = primaryTimeMin + delayMinutes

    const primaryHazard = affectedIncidents[0]
    const typeLabel =
      primaryHazard.type === 'ROAD_CLOSURE'
        ? 'road closure'
        : primaryHazard.type === 'FLOODED_ROAD'
        ? 'severe waterlogging & flooding'
        : primaryHazard.type === 'EVENT_CONGESTION'
        ? 'mega-event congestion zone'
        : 'road obstruction'

    routeWarning = `${primaryHazard.roadName || primaryHazard.title} is currently affected by ${typeLabel}.`
    avoidanceReason = `Rerouted via outer corridor to avoid ${primaryHazard.title || primaryHazard.roadName} (${primaryHazard.severity} severity).`

    // Try OSRM for alternative route via waypoints if online
    if (bypassedWaypoints.length > 0) {
      try {
        const wp = bypassedWaypoints[0]
        const osrmAltUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${wp[1]},${wp[0]};${destLng},${destLat}?overview=full&geometries=geojson`
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 2500)
        const resp = await fetch(osrmAltUrl, { signal: controller.signal })
        clearTimeout(timeout)
        if (resp.ok) {
          const data = await resp.json()
          if (data.routes?.[0]?.geometry?.coordinates) {
            alternativePolyline = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng])
          }
        }
      } catch {
        // Graceful local bypass
      }
    }
  }

  // 4. Emergency Mode Calculation
  const normalDistanceKm = (directDistance / 1000).toFixed(1)
  let normalDurationMin = Math.max(4, Math.round((directDistance / 1000) * 2.2))
  let emergencyDurationMin = Math.max(3, Math.round(normalDurationMin * 0.58)) // High speed green corridor clearance

  if (isAffected) {
    normalDurationMin += delayMinutes
    emergencyDurationMin = Math.max(4, Math.round((normalDurationMin - delayMinutes) * 0.65 + 1.5))
  }

  // 5. Mega Event Parking Guidance
  // If an active event incident exists within 1.2km of destination, provide nearby parking
  let nearbyParkings = []
  let recommendedParking = null
  const eventIncident = activeIncidents.find(
    (inc) => inc.type === 'EVENT_CONGESTION' && (inc.status === 'ACTIVE' || inc.status === 'Active')
  )

  if (eventIncident || parkings.length > 0) {
    const targetLat = eventIncident?.location?.coordinates ? eventIncident.location.coordinates[1] : destLat
    const targetLng = eventIncident?.location?.coordinates ? eventIncident.location.coordinates[0] : destLng

    nearbyParkings = parkings
      .map((p) => {
        const [pLng, pLat] = p.location?.coordinates || [79.068, 21.127]
        const distM = distanceMeters(targetLat, targetLng, pLat, pLng)
        return {
          ...p,
          distanceMeters: Math.round(distM),
          distanceKm: (distM / 1000).toFixed(1)
        }
      })
      .filter((p) => p.distanceMeters <= 3500)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)

    if (nearbyParkings.length > 0) {
      // Recommend parking with available spaces closest to event
      recommendedParking = nearbyParkings.find((p) => (p.availableSpaces || 0) > 0) || nearbyParkings[0]
    }
  }

  return {
    success: true,
    start: { ...start, lat: startLat, lng: startLng },
    destination: { ...destination, lat: destLat, lng: destLng },
    isAffected,
    affectedIncidents,
    primaryRoute: {
      polyline: primaryPolyline,
      distanceKm: normalDistanceKm,
      durationMinutes: isAffected ? normalDurationMin - delayMinutes : normalDurationMin
    },
    recommendedRoute: {
      polyline: isAffected ? alternativePolyline : primaryPolyline,
      distanceKm: isAffected ? (Number(normalDistanceKm) * 1.15).toFixed(1) : normalDistanceKm,
      durationMinutes: isAffected ? normalDurationMin : normalDurationMin,
      isAlternative: isAffected
    },
    blockedRoute: isAffected ? primaryPolyline : null,
    delayMinutes: isAffected ? delayMinutes : 0,
    routeWarning,
    avoidanceReason,
    emergencyMode: {
      active: emergencyMode,
      durationMinutes: emergencyDurationMin,
      avoidedIncidents: affectedIncidents.map((i) => i.title),
      priorityStatus: 'ACTIVE EMERGENCY GREEN CORRIDOR',
      disclaimer: 'Decision-support emergency routing; does not control physical municipal traffic signals.'
    },
    eventParking: {
      hasEvent: Boolean(eventIncident),
      eventName: eventIncident?.eventName || eventIncident?.title || 'Nagpur Civic Event',
      parkings: nearbyParkings,
      recommended: recommendedParking
    }
  }
}
