import { useState } from 'react'
import {
  AlertCircle, AlertOctagon, AlertTriangle, Calendar, Check, CheckCircle2,
  Clock, Edit2, Eye, Filter, Flame, Layers, MapPin, Navigation, Plus,
  RefreshCw, ShieldAlert, Sparkles, Trash2, Users, X, Zap
} from 'lucide-react'
import { NAGPUR_LOCATIONS } from './routingService'

export function IncidentManagement({
  user,
  incidents,
  refreshIncidents,
  notify,
  onViewOnMap
}) {
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [editingIncident, setEditingIncident] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://team219c61.onrender.com' : '')
  const apiUrl = (path) => `${API_URL}${path}`

  // Filtered incidents
  const visibleIncidents = incidents.filter((inc) => {
    if (filterType !== 'ALL' && inc.type !== filterType) return false
    if (filterStatus !== 'ALL' && inc.status !== filterStatus) return false
    return true
  })

  // Toggle status between ACTIVE and RESOLVED
  const toggleStatus = async (incident) => {
    const nextStatus = incident.status === 'ACTIVE' ? 'RESOLVED' : 'ACTIVE'
    try {
      const res = await fetch(apiUrl(`/api/incidents/${incident._id || incident.id}/status`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ status: nextStatus })
      })
      if (res.ok) {
        notify(`Incident status updated to ${nextStatus}`)
        refreshIncidents()
      } else {
        notify('Failed to update incident status')
      }
    } catch {
      notify('Server unreachable')
    }
  }

  // Delete incident
  const deleteIncident = async (id) => {
    try {
      const res = await fetch(apiUrl(`/api/incidents/${id}`), {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      })
      if (res.ok) {
        notify('Incident deleted successfully')
        setDeleteConfirmId(null)
        refreshIncidents()
      } else {
        notify('Failed to delete incident')
      }
    } catch {
      notify('Server unreachable')
    }
  }

  // Hackathon Scenario Quick Triggers
  const triggerSimulation = async (scenario) => {
    setSimulating(true)
    try {
      const res = await fetch(apiUrl('/api/incidents/simulate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ scenario })
      })
      const data = await res.json()
      if (res.ok) {
        notify(data.message || 'Simulation scenario activated!')
        refreshIncidents()
      } else {
        notify(data.message || 'Failed to activate simulation')
      }
    } catch {
      notify('Unable to trigger simulation scenario')
    } finally {
      setSimulating(false)
    }
  }

  const activeCount = incidents.filter((i) => i.status === 'ACTIVE').length
  const closuresCount = incidents.filter((i) => i.type === 'ROAD_CLOSURE' && i.status === 'ACTIVE').length
  const floodCount = incidents.filter((i) => i.type === 'FLOODED_ROAD' && i.status === 'ACTIVE').length
  const eventCount = incidents.filter((i) => i.type === 'EVENT_CONGESTION' && i.status === 'ACTIVE').length

  return (
    <div className="authority-workspace incident-mgmt-workspace">
      {/* Hackathon Scenario Simulation Bar */}
      <section className="simulation-banner">
        <div className="simulation-label">
          <Zap size={16} className="text-gold" />
          <div>
            <strong>HACKATHON EVALUATION SCENARIOS</strong>
            <span>Quick 1-click incident generators for dynamic routing demo</span>
          </div>
          <span className="demo-tag">SIMULATION MODE</span>
        </div>

        <div className="simulation-actions">
          <button
            className="sim-btn sim-closure"
            disabled={simulating}
            onClick={() => triggerSimulation('WARDHA_CLOSURE')}
            title="Simulates Wardha Road Flyover structural closure"
          >
            🚧 Scenario 1: Wardha Flyover Closed
          </button>
          <button
            className="sim-btn sim-flood"
            disabled={simulating}
            onClick={() => triggerSimulation('MANISH_NAGAR_FLOOD')}
            title="Simulates extreme monsoon flooding underpass"
          >
            🌊 Scenario 2: Manish Nagar Road Flooded
          </button>
          <button
            className="sim-btn sim-event"
            disabled={simulating}
            onClick={() => triggerSimulation('DEEKSHABHOOMI_EVENT')}
            title="Simulates mega-event with crowd congestion & parking"
          >
            🎪 Scenario 3: Mega Event at Deekshabhoomi
          </button>
          <button
            className="sim-btn sim-reset"
            disabled={simulating}
            onClick={() => triggerSimulation('RESET')}
            title="Clear all simulated demo incidents"
          >
            <RefreshCw size={13} /> Reset Demos
          </button>
        </div>
      </section>

      {/* KPI Overview */}
      <section className="authority-kpis incident-kpis">
        <div className="authority-kpi">
          <div className="stat-icon coral"><AlertOctagon size={19} /></div>
          <span>Active Disruptions</span>
          <strong>{activeCount}</strong>
          <small>Impacting city routing</small>
        </div>
        <div className="authority-kpi">
          <div className="stat-icon red"><ShieldAlert size={19} /></div>
          <span>Road Closures</span>
          <strong>{closuresCount}</strong>
          <small>Structural / works</small>
        </div>
        <div className="authority-kpi">
          <div className="stat-icon aqua"><AlertTriangle size={19} /></div>
          <span>Flooded Roads</span>
          <strong>{floodCount}</strong>
          <small>Monsoon waterlogging</small>
        </div>
        <div className="authority-kpi">
          <div className="stat-icon purple"><Users size={19} /></div>
          <span>Event Zones</span>
          <strong>{eventCount}</strong>
          <small>With parking guidance</small>
        </div>
      </section>

      {/* Header & Controls */}
      <div className="section-head incident-head">
        <div>
          <h2>Dynamic Incident & Road Closure Registry</h2>
          <p>Create and manage incidents that actively redirect Nagpur transit routes</p>
        </div>
        <button className="primary-button" onClick={() => { setEditingIncident(null); setShowCreateModal(true) }}>
          <Plus size={16} /> Create Road Incident
        </button>
      </div>

      {/* Filters Bar */}
      <div className="incident-filter-bar">
        <div className="filter-group">
          <span>Type:</span>
          <button className={filterType === 'ALL' ? 'active' : ''} onClick={() => setFilterType('ALL')}>All Types</button>
          <button className={filterType === 'ROAD_CLOSURE' ? 'active' : ''} onClick={() => setFilterType('ROAD_CLOSURE')}>Road Closures</button>
          <button className={filterType === 'FLOODED_ROAD' ? 'active' : ''} onClick={() => setFilterType('FLOODED_ROAD')}>Flooded Roads</button>
          <button className={filterType === 'ACCIDENT' ? 'active' : ''} onClick={() => setFilterType('ACCIDENT')}>Accidents</button>
          <button className={filterType === 'EVENT_CONGESTION' ? 'active' : ''} onClick={() => setFilterType('EVENT_CONGESTION')}>Event Zones</button>
        </div>

        <div className="filter-group">
          <span>Status:</span>
          <button className={filterStatus === 'ALL' ? 'active' : ''} onClick={() => setFilterStatus('ALL')}>All</button>
          <button className={filterStatus === 'ACTIVE' ? 'active' : ''} onClick={() => setFilterStatus('ACTIVE')}>Active Only</button>
          <button className={filterStatus === 'RESOLVED' ? 'active' : ''} onClick={() => setFilterStatus('RESOLVED')}>Resolved</button>
        </div>
      </div>

      {/* Incidents Table / Cards */}
      <div className="incident-grid">
        {visibleIncidents.map((inc) => {
          const isRoadClosure = inc.type === 'ROAD_CLOSURE'
          const isFlood = inc.type === 'FLOODED_ROAD'
          const isEvent = inc.type === 'EVENT_CONGESTION'
          const typeClass = isRoadClosure ? 'closure' : isFlood ? 'flood' : isEvent ? 'event' : 'accident'
          const [lng, lat] = inc.location?.coordinates || [inc.longitude, inc.latitude] || [79.088, 21.145]

          return (
            <div className={`incident-card ${typeClass} ${inc.status.toLowerCase()}`} key={inc._id || inc.incidentId}>
              <div className="incident-card-top">
                <div className={`type-badge ${typeClass}`}>
                  {isRoadClosure ? '🚧 Road Closure' : isFlood ? '🌊 Flooded Road' : isEvent ? '🎪 Event Congestion' : '⚠️ Road Blockage'}
                </div>
                <div className="status-toggle-wrap">
                  <span className={`status-pill ${inc.status.toLowerCase()}`}>{inc.status}</span>
                  <button
                    className={`toggle-action-btn ${inc.status === 'ACTIVE' ? 'deactivate' : 'activate'}`}
                    onClick={() => toggleStatus(inc)}
                    title={inc.status === 'ACTIVE' ? 'Resolve/Deactivate this incident' : 'Reactivate this incident'}
                  >
                    {inc.status === 'ACTIVE' ? 'Mark Resolved' : 'Activate'}
                  </button>
                </div>
              </div>

              <h3>{inc.title}</h3>
              <p className="incident-road"><MapPin size={13} /> {inc.roadName || inc.title}</p>
              {inc.description && <p className="incident-desc">{inc.description}</p>}

              {isEvent && inc.expectedVisitors && (
                <div className="event-meta-banner">
                  <span>Expected Attendees: <b>{inc.expectedVisitors.toLocaleString()}</b></span>
                  <span>Congestion: <b className="text-coral">{inc.congestionLevel || 'HIGH'}</b></span>
                </div>
              )}

              <div className="incident-stats-row">
                <div>
                  <span>Severity</span>
                  <strong className={`severity-text ${inc.severity?.toLowerCase()}`}>{inc.severity}</strong>
                </div>
                <div>
                  <span>Impact Radius</span>
                  <strong>{inc.radius || 350}m</strong>
                </div>
                <div>
                  <span>GPS Center</span>
                  <small>{lat?.toFixed(4)}, {lng?.toFixed(4)}</small>
                </div>
              </div>

              <div className="incident-card-actions">
                <span className="incident-id-tag">{inc.incidentId || 'INC-NGP'}</span>
                <div className="action-buttons">
                  <button
                    className="icon-action-btn"
                    title="Edit incident"
                    onClick={() => { setEditingIncident(inc); setShowCreateModal(true) }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    className="icon-action-btn delete"
                    title="Delete incident"
                    onClick={() => setDeleteConfirmId(inc._id || inc.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {deleteConfirmId === (inc._id || inc.id) && (
                <div className="inline-delete-confirm">
                  <span>Confirm deletion of this incident?</span>
                  <button className="confirm-delete-yes" onClick={() => deleteIncident(inc._id || inc.id)}>Yes, Delete</button>
                  <button className="confirm-delete-no" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}

        {visibleIncidents.length === 0 && (
          <div className="empty-state">
            <ShieldAlert size={32} />
            <p>No road incidents match the selected filter.</p>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <IncidentFormModal
          user={user}
          incident={editingIncident}
          onClose={() => { setShowCreateModal(false); setEditingIncident(null) }}
          onSaved={() => {
            setShowCreateModal(false)
            setEditingIncident(null)
            refreshIncidents()
          }}
          notify={notify}
        />
      )}
    </div>
  )
}

export function IncidentFormModal({ user, incident, onClose, onSaved, notify }) {
  const [type, setType] = useState(incident?.type || 'ROAD_CLOSURE')
  const [title, setTitle] = useState(incident?.title || '')
  const [roadName, setRoadName] = useState(incident?.roadName || '')
  const [description, setDescription] = useState(incident?.description || '')
  const [severity, setSeverity] = useState(incident?.severity || 'HIGH')
  const [status, setStatus] = useState(incident?.status || 'ACTIVE')
  const [radius, setRadius] = useState(incident?.radius || 350)
  const [latitude, setLatitude] = useState(
    incident?.location?.coordinates ? incident.location.coordinates[1].toString() : '21.1120'
  )
  const [longitude, setLongitude] = useState(
    incident?.location?.coordinates ? incident.location.coordinates[0].toString() : '79.0750'
  )
  const [eventName, setEventName] = useState(incident?.eventName || '')
  const [expectedVisitors, setExpectedVisitors] = useState(incident?.expectedVisitors || 15000)
  const [congestionLevel, setCongestionLevel] = useState(incident?.congestionLevel || 'HIGH')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://team219c61.onrender.com' : '')
  const apiUrl = (path) => `${API_URL}${path}`

  const applyPreset = (loc) => {
    setLatitude(loc.lat.toString())
    setLongitude(loc.lng.toString())
    if (!roadName) setRoadName(loc.name)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!title.trim()) {
      setErrorMsg('Incident title is required')
      return
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    if (isNaN(lat) || isNaN(lng)) {
      setErrorMsg('Coordinates must be valid numbers')
      return
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setErrorMsg('Latitude must be between -90 and 90; longitude between -180 and 180')
      return
    }

    setSubmitting(true)
    const payload = {
      type,
      title: title.trim(),
      roadName: roadName.trim() || title.trim(),
      description: description.trim(),
      location: { type: 'Point', coordinates: [lng, lat] },
      severity,
      status,
      radius: Number(radius) || 350,
      ...(type === 'EVENT_CONGESTION' ? { eventName, expectedVisitors: Number(expectedVisitors), congestionLevel } : {})
    }

    try {
      const url = incident?._id ? apiUrl(`/api/incidents/${incident._id}`) : apiUrl('/api/incidents')
      const method = incident?._id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        notify(incident?._id ? 'Incident updated successfully' : 'New road incident registered and broadcasted!')
        onSaved()
      } else {
        const data = await res.json()
        setErrorMsg(data.message || 'Submission failed')
      }
    } catch {
      setErrorMsg('Cannot reach server')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide incident-form-modal">
        <button className="modal-close" onClick={onClose}><X size={19} /></button>
        <div className="modal-kicker">NAGPUR MUNICIPAL INFRASTRUCTURE & TRAFFIC CONTROL</div>
        <h2>{incident ? 'Edit Road Incident' : 'Create Dynamic Road Incident'}</h2>
        <p className="modal-sub">Defines temporary disruptions that dynamically modify transit and emergency routing.</p>

        <form onSubmit={handleSubmit} className="incident-form">
          <div className="form-row-2">
            <div>
              <label>Incident Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="ROAD_CLOSURE">🚧 ROAD CLOSURE (Full / Partial)</option>
                <option value="FLOODED_ROAD">🌊 FLOODED ROAD (Monsoon Waterlogging)</option>
                <option value="ACCIDENT">⚠️ ACCIDENT / ROAD BLOCKAGE</option>
                <option value="EVENT_CONGESTION">🎪 EVENT CONGESTION (Mega Gathering)</option>
              </select>
            </div>

            <div>
              <label>Initial Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE (Affects routing immediately)</option>
                <option value="SCHEDULED">SCHEDULED (Planned future closure)</option>
                <option value="RESOLVED">RESOLVED (Cleared / Safe for traffic)</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label>Incident Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wardha Flyover Closed for Joint Repair"
                required
              />
            </div>
            <div>
              <label>Affected Road / Corridor</label>
              <input
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                placeholder="e.g. Wardha Road (Chhatrapati to Ajni Square)"
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div>
              <label>Severity Level</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="CRITICAL">CRITICAL (Mandatory full route diversion)</option>
                <option value="HIGH">HIGH (Strong routing avoidance penalty)</option>
                <option value="MEDIUM">MEDIUM (Moderate delay warning)</option>
                <option value="LOW">LOW (Informational advisory)</option>
              </select>
            </div>

            <div>
              <label>Affected Avoidance Radius: <b>{radius} meters</b></label>
              <input
                type="range"
                min="100"
                max="1500"
                step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Coordinates Picker with Nagpur Presets */}
          <div className="coords-panel">
            <label>Geographic Coordinates (WGS84 Lat / Long)</label>
            <div className="coords-inputs">
              <div>
                <span>Latitude:</span>
                <input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  placeholder="21.1120"
                  required
                />
              </div>
              <div>
                <span>Longitude:</span>
                <input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  placeholder="79.0750"
                  required
                />
              </div>
            </div>

            <div className="location-presets">
              <span>Nagpur Hotspot Presets:</span>
              <div className="preset-chips">
                {NAGPUR_LOCATIONS.slice(0, 6).map((loc) => (
                  <button type="button" key={loc.id} className="preset-chip" onClick={() => applyPreset(loc)}>
                    {loc.name.split('(')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mega Event Specific Fields */}
          {type === 'EVENT_CONGESTION' && (
            <div className="event-extra-fields">
              <h4>🎪 Mega Event Configuration & Parking Integration</h4>
              <div className="form-row-3">
                <div>
                  <label>Event Name</label>
                  <input
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="e.g. Deekshabhoomi Mahotsav"
                  />
                </div>
                <div>
                  <label>Expected Visitors</label>
                  <input
                    type="number"
                    value={expectedVisitors}
                    onChange={(e) => setExpectedVisitors(e.target.value)}
                    placeholder="25000"
                  />
                </div>
                <div>
                  <label>Congestion Level</label>
                  <select value={congestionLevel} onChange={(e) => setCongestionLevel(e.target.value)}>
                    <option value="CRITICAL">CRITICAL (Full pedestrian zone)</option>
                    <option value="HIGH">HIGH (Avoid for transit traffic)</option>
                    <option value="MEDIUM">MEDIUM (Heavy delay expected)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div>
            <label>Description & Advisory Notes</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Precautionary flyover closure due to expansion joint expansion. Motorists advised to use Ring Road."
            />
          </div>

          {errorMsg && <div className="auth-error">{errorMsg}</div>}

          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? 'Saving...' : incident ? 'Save Changes' : 'Activate Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
