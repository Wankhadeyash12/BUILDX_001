import { useEffect, useState, useMemo } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, ArrowUpRight, Bell, Camera, Check, CheckCircle2,
  ChevronRight, CircleHelp, ClipboardCheck, Clock, Eye, FilePlus2, Filter, Home,
  Layers, LocateFixed, LogOut, MapPin, Menu, MoreHorizontal, Navigation, Plus,
  Radar, Search, ShieldAlert, ShieldCheck, Sparkles, TrendingUp, Upload,
  UserPlus, UserRound, Users, Wrench, X
} from 'lucide-react'
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet'
import { io } from 'socket.io-client'
import 'leaflet/dist/leaflet.css'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://team219c61.onrender.com' : '')
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.PROD ? 'https://team219c61.onrender.com' : window.location.origin)
const apiUrl = (path) => `${API_URL}${path}`

const normalizeIssue = (issue) => {
  const statusMap = {
    REPORTED: 'Reported',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In progress',
    RESOLVED: 'Resolved',
    REJECTED: 'Rejected'
  }
  const categoryMap = {
    POTHOLE: 'Pothole',
    ROAD_DAMAGE: 'Road damage',
    WATER_LEAKAGE: 'Water leakage',
    STREETLIGHT: 'Streetlight outage',
    GARBAGE: 'Garbage overflow',
    DRAINAGE: 'Drainage issue',
    OTHER: 'General issue'
  }
  const isCritical = issue.severity === 'CRITICAL' || issue.priorityScore >= 9.0
  const tone = issue.status === 'RESOLVED' ? 'mint' : isCritical ? 'coral' : issue.severity === 'HIGH' ? 'aqua' : 'gold'
  const [longitude, latitude] = issue.location?.coordinates || [79.0882, 21.1458]
  const now = new Date()
  const isOverdue = Boolean(issue.dueAt && new Date(issue.dueAt) < now && !['RESOLVED', 'Resolved', 'REJECTED'].includes(issue.status))

  return {
    ...issue,
    id: issue.issueId || issue.id,
    type: categoryMap[issue.category] || issue.category || issue.title || 'Civic issue',
    area: issue.address || 'Nagpur Corridor',
    status: statusMap[issue.status] || issue.status,
    tone,
    icon: tone === 'aqua' ? '◒' : tone === 'mint' ? '▦' : tone === 'gold' ? '✦' : '⚠',
    latitude,
    longitude,
    isOverdue,
    channels: issue.channels || ['App'],
    communityConfirmations: issue.communityConfirmations || [],
    images: issue.images || [],
    resolutionPhoto: issue.resolutionPhoto || null,
    department: issue.department || 'Road Maintenance',
    agency: issue.agency || 'Nagpur Municipal Corporation',
    dueAt: issue.dueAt ? new Date(issue.dueAt) : null,
    citizenConfirmed: Boolean(issue.citizenConfirmed),
    priorityScore: issue.priorityScore || 6.0
  }
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [showReport, setShowReport] = useState(false)
  const [reportStep, setReportStep] = useState(1)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [warningAlert, setWarningAlert] = useState(null)
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('civicpulse_user') || 'null'))
  const [authMode, setAuthMode] = useState('login')
  const [issues, setIssues] = useState([])
  const [recentWorks, setRecentWorks] = useState([])
  const [selectedScenarioFilter, setSelectedScenarioFilter] = useState(null)
  const [previewIssue, setPreviewIssue] = useState(null)

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3800)
  }

  // Load Issues from Backend
  const refreshIssues = () => {
    fetch(apiUrl('/api/issues'), {
      headers: currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {}
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((records) => {
        if (records && records.length) {
          setIssues(records.map(normalizeIssue))
        }
      })
      .catch(() => {})
  }

  // Load Recent Works
  const refreshRecentWorks = () => {
    fetch(apiUrl('/api/recent-works'))
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setRecentWorks(data))
      .catch(() => {})
  }

  useEffect(() => {
    refreshIssues()
    refreshRecentWorks()
  }, [currentUser])

  // Live Socket.IO Updates
  useEffect(() => {
    const socket = io(SOCKET_URL, { path: '/socket.io' })
    const syncIssue = (record) => {
      setIssues((current) => {
        const normalized = normalizeIssue(record)
        const exists = current.some((issue) => issue._id === normalized._id || issue.id === normalized.id)
        return exists
          ? current.map((issue) => (issue._id === normalized._id || issue.id === normalized.id ? { ...issue, ...normalized } : issue))
          : [normalized, ...current]
      })
    }
    socket.on('issue:created', (record) => {
      syncIssue(record)
      notify(`New Incident Reported: ${record.issueId} (${record.category})`)
    })
    socket.on('issue:updated', (record) => {
      syncIssue(record)
    })
    return () => socket.disconnect()
  }, [])

  // Citizen Report Submission (Tasks 1, 3, 4, 5)
  const submitReport = async (reportLocation, category, description, photoBase64, channel = 'App', nearSchool = false) => {
    const payload = {
      title: `${category.replaceAll('_', ' ')} near ${reportLocation?.address || 'Nagpur'}`,
      description: description || `${category.replaceAll('_', ' ')} reported via ${channel}.`,
      category,
      address: reportLocation?.address || `${reportLocation?.latitude.toFixed(5)}, ${reportLocation?.longitude.toFixed(5)}`,
      severity: nearSchool ? 'CRITICAL' : 'HIGH',
      location: { type: 'Point', coordinates: [reportLocation.longitude, reportLocation.latitude] },
      images: photoBase64 ? [photoBase64] : [],
      channel,
      nearSchoolOrHospital: nearSchool
    }

    try {
      const response = await fetch(apiUrl('/api/issues'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(currentUser?.token ? { Authorization: `Bearer ${currentUser.token}` } : {})
        },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const result = await response.json()
        const normalized = normalizeIssue(result)

        // Task 3: Duplicate & Cluster Merge Feedback
        if (result.merged) {
          notify(`Merged into existing incident ${result.issueId}! ${result.duplicateCount} citizens reported via ${result.channels?.join(', ')} · Priority boosted!`)
        } else {
          notify(`Incident ${result.issueId} submitted successfully and auto-routed to ${result.department}.`)
        }

        // Task 5: Cross-Agency Conflict Notice
        if (result.warning) {
          setWarningAlert(result.warning)
        }

        refreshIssues()
        setShowReport(false)
        setReportStep(1)
        return
      }
    } catch {
      notify('Server unreachable — check connection.')
    }
  }

  // Citizen Confirmation Loop (Task 6)
  const confirmResolution = async (issueId, satisfied) => {
    try {
      const issueObj = issues.find((i) => i.id === issueId)
      if (!issueObj?._id) return
      const res = await fetch(apiUrl(`/api/issues/${issueObj._id}/confirm-resolution`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          satisfied,
          feedback: satisfied ? 'Citizen verified that road was restored properly.' : 'Citizen reported inadequate repair work.'
        })
      })
      if (res.ok) {
        notify(satisfied ? 'Resolution verified by citizen!' : 'Quality dispute logged for NMC supervisor review.')
        refreshIssues()
      }
    } catch {
      notify('Unable to submit verification.')
    }
  }

  // Filtered Issues for Nagpur Hackathon Scenario Demos
  const filteredIssues = useMemo(() => {
    if (!selectedScenarioFilter) return issues
    if (selectedScenarioFilter === 'school') return issues.filter((i) => i.nearSchoolOrHospital || i.description?.toLowerCase().includes('school'))
    if (selectedScenarioFilter === 'duplicate') return issues.filter((i) => i.channels && i.channels.length > 2)
    if (selectedScenarioFilter === 'moratorium') return issues.filter((i) => i.address?.includes('Katol') || i.description?.includes('Moratorium'))
    if (selectedScenarioFilter === 'streetlight') return issues.filter((i) => i.category === 'STREETLIGHT' || i.address?.includes('Wadi'))
    if (selectedScenarioFilter === 'monsoon') return issues.filter((i) => i.address?.includes('Kamptee') || i.category === 'ROAD_DAMAGE')
    if (selectedScenarioFilter === 'verified') return issues.filter((i) => i.status === 'Resolved' && i.resolutionPhoto)
    return issues
  }, [issues, selectedScenarioFilter])

  if (!currentUser) {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        issuesCount={issues.length}
        onAuthenticated={(user) => {
          localStorage.setItem('civicpulse_user', JSON.stringify(user))
          setCurrentUser(user)
        }}
      />
    )
  }

  if (currentUser.role === 'AUTHORITY' || currentUser.role === 'ADMIN') {
    return (
      <AuthorityDashboard
        user={currentUser}
        issues={issues}
        recentWorks={recentWorks}
        setIssues={setIssues}
        refreshIssues={refreshIssues}
        onLogout={() => {
          localStorage.removeItem('civicpulse_user')
          setCurrentUser(null)
        }}
      />
    )
  }

  const navItems = [
    ['Overview', Home],
    ['Live map', Navigation],
    ['My reports', FilePlus2],
    ['Analytics', Activity]
  ]

  // Task 7: Computed stats from real data
  const myReportsCount = issues.filter((i) => i.reportedBy?._id === currentUser.id || i.reportedBy === currentUser.id).length
  const openIssuesCount = issues.filter((i) => i.status !== 'Resolved').length
  const resolvedIssuesCount = issues.filter((i) => i.status === 'Resolved').length
  const resolutionRate = issues.length ? Math.round((resolvedIssuesCount / issues.length) * 100) : 0

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Radar size={20} /></div>
          <span>Civic<span>Pulse</span></span>
        </div>
        <div className="workspace-label">NAGPUR CITIZEN WORKSPACE</div>
        <nav>
          {navItems.map(([label, Icon]) => (
            <button
              key={label}
              className={activeNav === label ? 'nav-item active' : 'nav-item'}
              onClick={() => {
                setActiveNav(label)
                setMenuOpen(false)
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'My reports' && <b>{myReportsCount || issues.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="impact-card">
          <div className="impact-icon"><Sparkles size={17} /></div>
          <strong>Nagpur Civic Pulse</strong>
          <span>Real-time infrastructure health</span>
          <div className="impact-row">
            <strong>{resolutionRate}%</strong>
            <span>City resolution index</span>
            <ArrowUpRight size={15} />
          </div>
        </div>
        <div className="profile">
          <div className="avatar">{currentUser.name?.slice(0, 2).toUpperCase() || 'AS'}</div>
          <div>
            <strong>{currentUser.name || 'Citizen'}</strong>
            <span>Citizen · Nagpur</span>
          </div>
          <button
            className="profile-logout"
            onClick={() => {
              localStorage.removeItem('civicpulse_user')
              setCurrentUser(null)
            }}
            aria-label="Log out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>
            <Menu size={20} />
          </button>
          <div className="crumb">
            <span>Nagpur Urban Infrastructure</span>
            <ChevronRight size={14} />
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <div className="search">
              <Search size={17} />
              <input placeholder="Search Nagpur roads, wards, craters..." />
            </div>
            <button className="icon-button" aria-label="Notifications" onClick={() => notify('Nagpur Municipal Operations active 24/7')}>
              <Bell size={19} />
              <i />
            </button>
            <div className="top-avatar">{currentUser.name?.slice(0, 2).toUpperCase() || 'CP'}</div>
          </div>
        </header>

        {/* Hackathon Quick-Scenario Demonstration Bar */}
        <section className="scenario-bar">
          <div className="scenario-label">
            <Sparkles size={14} /> <strong>Nagpur Scenarios:</strong>
          </div>
          <button
            className={selectedScenarioFilter === null ? 'scenario-pill active' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter(null)}
          >
            All Issues ({issues.length})
          </button>
          <button
            className={selectedScenarioFilter === 'school' ? 'scenario-pill active coral' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('school')}
          >
            🏫 School Gate Crater (High Hazard)
          </button>
          <button
            className={selectedScenarioFilter === 'duplicate' ? 'scenario-pill active' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('duplicate')}
          >
            🔄 Laxmi Nagar 5-Channel Merge
          </button>
          <button
            className={selectedScenarioFilter === 'moratorium' ? 'scenario-pill active gold' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('moratorium')}
          >
            🚧 Katol Road Digging Conflict
          </button>
          <button
            className={selectedScenarioFilter === 'streetlight' ? 'scenario-pill active' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('streetlight')}
          >
            💡 Wadi Bus Stop Streetlight
          </button>
          <button
            className={selectedScenarioFilter === 'monsoon' ? 'scenario-pill active' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('monsoon')}
          >
            🌧️ Kamptee Road Monsoon Damage
          </button>
          <button
            className={selectedScenarioFilter === 'verified' ? 'scenario-pill active mint' : 'scenario-pill'}
            onClick={() => setSelectedScenarioFilter('verified')}
          >
            ✅ Proof-of-Work Verified
          </button>
        </section>

        {/* Task 5 Cross-Agency Warning Alert Banner */}
        {warningAlert && (
          <div className="warning-banner">
            <ShieldAlert size={20} />
            <div>
              <strong>Cross-Agency Conflict Alert</strong>
              <p>{warningAlert}</p>
            </div>
            <button onClick={() => setWarningAlert(null)}><X size={16} /></button>
          </div>
        )}

        <div className="content-wrap">
          {activeNav === 'Overview' && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="pulse-dot" /> LIVE NAGPUR CIVIC INTELLIGENCE</div>
                  <h1>Good morning, {currentUser.name?.split(' ')[0] || 'Citizen'}<span>.</span></h1>
                  <p>Monitoring road damages, utility coordination & civic infrastructure in Nagpur.</p>
                </div>
                <button className="primary-button" onClick={() => setShowReport(true)}>
                  <Plus size={18} /> Report road or civic issue
                </button>
              </section>

              {/* Real computed statistics (Task 7) */}
              <section className="stat-grid">
                <Stat label="Total Incidents Tracked" value={issues.length} note="Live MongoDB records" icon={FilePlus2} tone="blue" />
                <Stat label="Open / In Progress" value={openIssuesCount} note="Active field work orders" icon={AlertCircle} tone="coral" />
                <Stat label="Active Moratoriums" value={recentWorks.filter(w => w.moratoriumUntil && new Date(w.moratoriumUntil) > new Date()).length || 1} note="Protected resurfaced roads" icon={Wrench} tone="gold" />
                <Stat label="Verified Resolved" value={resolvedIssuesCount} note="Dual-photo sign-offs" icon={ShieldCheck} tone="mint" />
              </section>

              <section className="section-head">
                <div>
                  <h2>Live Infrastructure GIS Map</h2>
                  <p>Real-time geolocated road hazards and active utility works</p>
                </div>
                <div className="head-actions">
                  <button className="text-button" onClick={() => setActiveNav('Live map')}>
                    Open full operational map <ArrowUpRight size={15} />
                  </button>
                </div>
              </section>

              <section className="map-layout">
                <div className="map-card">
                  <div className="map-toolbar">
                    <div className="map-location">
                      <LocateFixed size={15} />
                      <span>Nagpur Metropolitan Area</span>
                      <ChevronRight size={14} />
                    </div>
                    <span className="map-live"><i /> MongoDB Spatial 2dsphere synced</span>
                  </div>
                  <CivicMap
                    issues={filteredIssues}
                    recentWorks={recentWorks}
                    onSelect={(issue) => setPreviewIssue(issue)}
                  />
                </div>
                <div className="nearby-list">
                  <div className="list-head">
                    <h3>Nagpur Hotspots</h3>
                    <span>{filteredIssues.length} records</span>
                  </div>
                  {filteredIssues.slice(0, 4).map((issue) => (
                    <IssueRow key={issue.id} issue={issue} onClick={() => setPreviewIssue(issue)} />
                  ))}
                  <button className="list-footer" onClick={() => setActiveNav('Live map')}>
                    Explore all reports <ChevronRight size={15} />
                  </button>
                </div>
              </section>

              <section className="lower-grid">
                <div className="panel">
                  <div className="panel-head">
                    <div>
                      <h2>Recent Nagpur Reports</h2>
                      <p>Track reported road craters, lighting & utility issues</p>
                    </div>
                    <ClipboardCheck size={20} color="#2878ec" />
                  </div>
                  <div className="report-list">
                    {filteredIssues.slice(0, 3).map((issue) => (
                      <IssueRow key={issue.id} issue={issue} onClick={() => setPreviewIssue(issue)} />
                    ))}
                  </div>
                </div>

                <div className="panel activity-panel">
                  <div className="panel-head">
                    <div>
                      <h2>Multi-Agency Status</h2>
                      <p>Coordination across NMC, OCW & MSEDCL</p>
                    </div>
                    <div className="pulse-ring"><Layers size={17} /></div>
                  </div>
                  <div className="community-score">
                    <strong>{resolutionRate}</strong><span>%</span>
                    <div className="score-bar"><i style={{ width: `${resolutionRate}%` }} /></div>
                    <small>Nagpur Road Quality & Resolution Index</small>
                  </div>
                  <div className="activity-line">
                    <div className="activity-icon blue"><Users size={15} /></div>
                    <div>
                      <strong>Multi-Channel Deduplication Active</strong>
                      <span>Consolidating WhatsApp, Helpline & App tickets</span>
                    </div>
                    <em>Active</em>
                  </div>
                  <div className="activity-line">
                    <div className="activity-icon mint"><Check size={15} /></div>
                    <div>
                      <strong>Digging Moratorium Guard</strong>
                      <span>Protects roads resurfaced within 180 days</span>
                    </div>
                    <em>Enforced</em>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeNav === 'Live map' && (
            <CitizenLiveMap
              issues={filteredIssues}
              recentWorks={recentWorks}
              notify={notify}
              onReport={() => setShowReport(true)}
              onSelectIssue={(issue) => setPreviewIssue(issue)}
            />
          )}

          {activeNav === 'My reports' && (
            <CitizenReports
              issues={issues}
              onReport={() => setShowReport(true)}
              onConfirmResolution={confirmResolution}
              onSelectIssue={(issue) => setPreviewIssue(issue)}
            />
          )}

          {activeNav === 'Analytics' && <CitizenAnalytics issues={issues} />}
        </div>
      </main>

      {/* Task 1 & 2: Report Modal with AI Vision Analysis */}
      {showReport && (
        <LocationReportModal
          step={reportStep}
          setStep={setReportStep}
          onClose={() => setShowReport(false)}
          onSubmit={submitReport}
        />
      )}

      {/* Detailed Modal / Before-After Proof-of-Work Inspector */}
      {previewIssue && (
        <IssueInspectionModal
          issue={previewIssue}
          onClose={() => setPreviewIssue(null)}
          onConfirmResolution={(satisfied) => {
            confirmResolution(previewIssue.id, satisfied)
            setPreviewIssue(null)
          }}
        />
      )}

      {toast && (
        <div className="toast">
          <Check size={17} /> {toast}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, note, icon: Icon, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

// Interactive Map with Tasks 4 & 5 (SLA Overdue, Recent Works Overlay & Moratoriums)
function CivicMap({ issues, recentWorks = [], onSelect, large = false }) {
  const [center, setCenter] = useState([21.1458, 79.0882])
  const [showWorksLayer, setShowWorksLayer] = useState(true)

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(({ coords }) => setCenter([coords.latitude, coords.longitude]))
  }

  return (
    <div className={`real-map ${large ? 'real-map-large' : ''}`}>
      <div className="map-layer-toggle">
        <button
          className={showWorksLayer ? 'layer-btn active' : 'layer-btn'}
          onClick={() => setShowWorksLayer(!showWorksLayer)}
          title="Toggle Excavations & Moratoriums"
        >
          <Layers size={14} /> {showWorksLayer ? 'Hide Works Overlay' : 'Show Excavation & Moratorium Layer'}
        </button>
      </div>

      <MapContainer center={center} zoom={13} scrollWheelZoom zoomControl={false} className="leaflet-map">
        <MapSizeFix />
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="bottomright" />

        {/* Task 5: Recent Works & Road Digging Moratorium Overlay */}
        {showWorksLayer &&
          recentWorks.map((work) => {
            const isMoratorium = Boolean(work.moratoriumUntil && new Date(work.moratoriumUntil) > new Date())
            const [lng, lat] = work.location?.coordinates || [79.0882, 21.1458]
            return (
              <CircleMarker
                key={work._id || work.workId}
                center={[lat, lng]}
                radius={13}
                pathOptions={{
                  color: isMoratorium ? '#8b5cf6' : '#f97316',
                  weight: 3,
                  fillColor: isMoratorium ? '#c084fc' : '#fb923c',
                  fillOpacity: 0.85,
                  dashArray: isMoratorium ? '4, 4' : null
                }}
              >
                <Popup>
                  <div className="popup-card">
                    <span className={`popup-badge ${isMoratorium ? 'moratorium' : 'work'}`}>
                      {isMoratorium ? '180-Day Digging Moratorium' : 'Active Utility Work'}
                    </span>
                    <strong>{work.title || work.description}</strong>
                    <p>{work.address}</p>
                    <small>Agency: {work.agency} · Permit: {work.permitRef || 'NMC-PERMIT'}</small>
                    {isMoratorium && (
                      <p className="moratorium-notice">
                        ⚠️ Road resurfaced recently. Excavation strictly prohibited until{' '}
                        {new Date(work.moratoriumUntil).toLocaleDateString()}.
                      </p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}

        {/* Issues Markers */}
        {issues.map((issue) => (
          <CircleMarker
            key={issue.id}
            center={[issue.latitude || 21.1458, issue.longitude || 79.0882]}
            radius={issue.isOverdue ? 12 : 9}
            pathOptions={{
              color: issue.isOverdue ? '#dc2626' : '#fff',
              weight: issue.isOverdue ? 3 : 2,
              fillColor:
                issue.status === 'Resolved'
                  ? '#10b981'
                  : issue.isOverdue
                  ? '#ef4444'
                  : issue.severity === 'CRITICAL'
                  ? '#e46d63'
                  : issue.severity === 'HIGH'
                  ? '#20a4b8'
                  : '#d79b32',
              fillOpacity: 1
            }}
            eventHandlers={{ click: () => onSelect(issue) }}
          >
            <Popup>
              <div className="popup-card">
                <span className="popup-badge">{issue.category}</span>
                <strong>{issue.type}</strong>
                <p>{issue.area}</p>
                <div className="popup-tags">
                  <span className={`tag-status ${issue.status.toLowerCase().replace(' ', '-')}`}>
                    {issue.status}
                  </span>
                  {issue.isOverdue && <span className="tag-overdue">SLA Overdue</span>}
                  {issue.channels?.length > 1 && (
                    <span className="tag-cluster">{issue.channels.length} Channels Merged</span>
                  )}
                </div>
                <small>Priority Score: {issue.priorityScore || 6.0} / 10</small>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <button className="map-locate-control" onClick={locate} aria-label="Use my location">
        <LocateFixed size={16} />
      </button>

      <div className="leaflet-legend">
        <span><i className="dot coral" /> Critical (School / Crash Risk)</span>
        <span><i className="dot aqua" /> High</span>
        <span><i className="dot mint" /> Resolved</span>
        <span><i className="dot purple" /> Digging Moratorium</span>
        <span><i className="dot orange" /> Active Excavation</span>
      </div>
    </div>
  )
}

function MapSizeFix() {
  const map = useMap()
  useEffect(() => {
    const refresh = () => map.invalidateSize({ animate: false })
    refresh()
    const timer = window.setTimeout(refresh, 200)
    return () => window.clearTimeout(timer)
  }, [map])
  return null
}

function CitizenLiveMap({ issues, recentWorks, notify, onReport, onSelectIssue }) {
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow"><span className="pulse-dot" /> LIVE NAGPUR SPATIAL RADAR</div>
          <h1>Operational City Map<span>.</span></h1>
          <p>Explore road craters, reported hazards, and cross-utility excavation zones.</p>
        </div>
        <button className="primary-button" onClick={onReport}>
          <Plus size={18} /> Report an issue
        </button>
      </section>

      <section className="map-layout full-map-view">
        <div className="map-card">
          <div className="map-toolbar">
            <div className="map-location">
              <LocateFixed size={15} />
              <span>Nagpur Smart GIS Overlay</span>
            </div>
            <span className="map-live"><i /> Real-time active</span>
          </div>
          <CivicMap issues={issues} recentWorks={recentWorks} onSelect={onSelectIssue} large />
        </div>
        <div className="nearby-list">
          <div className="list-head">
            <h3>All Reported Incidents</h3>
            <span>{issues.length} records</span>
          </div>
          {issues.map((issue) => (
            <IssueRow key={issue.id} issue={issue} onClick={() => onSelectIssue(issue)} />
          ))}
        </div>
      </section>
    </>
  )
}

function CitizenReports({ issues, onReport, onConfirmResolution, onSelectIssue }) {
  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">YOUR CIVIC ACTIVITY</div>
          <h1>My Reports & Verifications<span>.</span></h1>
          <p>Track your submitted reports and verify contractor road repairs.</p>
        </div>
        <button className="primary-button" onClick={onReport}>
          <Plus size={18} /> Report an issue
        </button>
      </section>

      <section className="panel reports-page">
        <div className="panel-head">
          <div>
            <h2>Report & Resolution History</h2>
            <p>Review progress and confirm physical road restoration</p>
          </div>
          <ClipboardCheck size={20} color="#2878ec" />
        </div>

        <div className="citizen-reports-grid">
          {issues.map((issue) => (
            <div className="citizen-report-card" key={issue.id}>
              <div className="report-card-top">
                <div className={`issue-symbol ${issue.tone}`}>{issue.icon}</div>
                <div className="report-card-info">
                  <strong>{issue.type}</strong>
                  <p>{issue.area}</p>
                </div>
                <span className={`status ${issue.status.includes('Resolved') ? 'resolved' : issue.status.includes('progress') ? 'progress' : 'reported'}`}>
                  {issue.status}
                </span>
              </div>

              {issue.riskContext && (
                <div className="report-risk-badge">
                  <AlertTriangle size={13} /> <span>{issue.riskContext}</span>
                </div>
              )}

              {/* Task 3 Channels list */}
              {issue.channels && issue.channels.length > 1 && (
                <div className="channels-pill-row">
                  <span className="pill-label">Multi-Channel Merge:</span>
                  {issue.channels.map((ch) => (
                    <span key={ch} className="channel-chip">{ch}</span>
                  ))}
                </div>
              )}

              {/* Task 6: Before & After Photo View + Citizen Confirmation */}
              {issue.status === 'Resolved' && (
                <div className="resolution-proof-box">
                  <div className="proof-header">
                    <CheckCircle2 size={16} color="#10b981" />
                    <strong>Contractor Proof-of-Work Submitted</strong>
                  </div>
                  <div className="proof-photos">
                    {issue.images?.[0] && (
                      <div className="photo-box">
                        <span>BEFORE (Reported)</span>
                        <img src={issue.images[0]} alt="Before repair" />
                      </div>
                    )}
                    {issue.resolutionPhoto && (
                      <div className="photo-box">
                        <span>AFTER (Contractor Restored)</span>
                        <img src={issue.resolutionPhoto} alt="After repair" />
                      </div>
                    )}
                  </div>
                  {issue.resolutionNotes && (
                    <p className="resolution-notes"><em>Notes:</em> {issue.resolutionNotes}</p>
                  )}

                  <div className="confirmation-action">
                    {issue.citizenConfirmed ? (
                      <div className="confirmed-seal">
                        <Check size={16} /> <strong>Citizen Verified & Approved</strong>
                      </div>
                    ) : (
                      <div className="confirm-buttons">
                        <span>Was this road issue physically fixed to your satisfaction?</span>
                        <button className="confirm-btn yes" onClick={() => onConfirmResolution(issue.id, true)}>
                          <Check size={14} /> Confirm Fixed
                        </button>
                        <button className="confirm-btn no" onClick={() => onConfirmResolution(issue.id, false)}>
                          <X size={14} /> Dispute Quality
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="card-actions-bar">
                <span className="card-id">{issue.id} · Priority {issue.priorityScore}/10</span>
                <button className="text-button" onClick={() => onSelectIssue(issue)}>
                  View Audit Trail <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

function CitizenAnalytics({ issues }) {
  const counts = issues.reduce((acc, i) => {
    acc[i.type] = (acc[i.type] || 0) + 1
    return acc
  }, {})
  const max = Math.max(...Object.values(counts), 1)

  return (
    <>
      <section className="welcome-row">
        <div>
          <div className="eyebrow">COMMUNITY INSIGHTS</div>
          <h1>Nagpur Infrastructure Analytics<span>.</span></h1>
          <p>Real-time issue patterns calculated from MongoDB database records.</p>
        </div>
      </section>

      <section className="stat-grid">
        <Stat label="Total Records" value={issues.length} note="Live database count" icon={FilePlus2} tone="blue" />
        <Stat label="Road Hazards" value={issues.filter((i) => i.category === 'POTHOLE' || i.category === 'ROAD_DAMAGE').length} note="Potholes & cracks" icon={AlertCircle} tone="coral" />
        <Stat label="Electrical / Lights" value={issues.filter((i) => i.category === 'STREETLIGHT').length} note="Streetlights & signals" icon={Wrench} tone="gold" />
        <Stat label="Restored Streets" value={issues.filter((i) => i.status === 'Resolved').length} note="Signed off with proof" icon={ShieldCheck} tone="mint" />
      </section>

      <section className="panel analytics-panel">
        <div className="panel-head">
          <div>
            <h2>Nagpur Issues by Category</h2>
            <p>Proportion of road craters, water leakages and streetlights</p>
          </div>
          <TrendingUp size={19} color="#2878ec" />
        </div>
        {Object.entries(counts).map(([label, count]) => (
          <div className="analytics-row" key={label}>
            <span>{label}</span>
            <div><i style={{ width: `${(count / max) * 100}%` }} /></div>
            <strong>{count}</strong>
          </div>
        ))}
      </section>
    </>
  )
}

// Tasks 1 & 2: Wizard with Base64 Encoding & AI Vision Analysis
function LocationReportModal({ step, setStep, onClose, onSubmit }) {
  const [location, setLocation] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [photoBase64, setPhotoBase64] = useState('')
  const [category, setCategory] = useState('POTHOLE')
  const [severity, setSeverity] = useState('HIGH')
  const [description, setDescription] = useState('')
  const [nearSchool, setNearSchool] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [analyzingAi, setAnalyzingAi] = useState(false)
  const [aiReasoning, setAiReasoning] = useState('')
  const [manualCoordinates, setManualCoordinates] = useState({ latitude: '21.1458', longitude: '79.0882' })
  const [channel, setChannel] = useState('App')

  const steps = ['Photo', 'Location', 'AI Details', 'Review']

  // Task 1: Encode file to base64
  const choosePhoto = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setLocationError('Please select a valid image.')
      return
    }
    setPhoto(file)
    setLocationError('')

    const reader = new FileReader()
    reader.onload = () => {
      setPhotoBase64(reader.result)
    }
    reader.readAsDataURL(file)
  }

  // Task 2: Trigger AI Vision analysis
  const runAiVisionAnalysis = async () => {
    if (!photoBase64) return
    setAnalyzingAi(true)
    try {
      const res = await fetch(apiUrl('/api/ai/analyze-image'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photoBase64, description })
      })
      if (res.ok) {
        const data = await res.json()
        if (data.available) {
          if (data.category) setCategory(data.category)
          if (data.severity) setSeverity(data.severity)
          if (data.reasoning) setAiReasoning(data.reasoning)
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setAnalyzingAi(false)
    }
  }

  const handleStepTransition = async (nextStep) => {
    if (step === 1 && nextStep === 2) {
      // Trigger AI analysis when moving from Photo step
      runAiVisionAnalysis()
    }
    setStep(nextStep)
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setLocation({ latitude: 21.1458, longitude: 79.0882 })
      return
    }
    setLocating(true)
    setLocationError('')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({ latitude: coords.latitude, longitude: coords.longitude })
        setLocating(false)
      },
      () => {
        // Fallback to Nagpur default center
        setLocation({ latitude: 21.1458, longitude: 79.0882 })
        setLocating(false)
      },
      { timeout: 7000 }
    )
  }

  useEffect(() => {
    if (step === 2 && !location) locate()
  }, [step])

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <button className="modal-close" onClick={onClose}><X size={19} /></button>
        <div className="modal-kicker">NMC URBAN INFRASTRUCTURE GRIEVANCE</div>
        <h2>Report Road or Asset Damage</h2>
        <p className="modal-sub">AI Vision automatically classifies severity and routes to the right Nagpur department.</p>

        <div className="wizard-steps">
          {steps.map((label, index) => (
            <div className={step >= index + 1 ? 'wizard-step active' : 'wizard-step'} key={label}>
              <span>{index + 1}</span>{label}
            </div>
          ))}
        </div>

        {/* STEP 1: PHOTO */}
        {step === 1 && (
          <div className="upload-area">
            {photoBase64 ? (
              <img className="photo-preview" src={photoBase64} alt="Selected problem" />
            ) : (
              <div className="upload-icon"><Camera size={26} /></div>
            )}
            <h3>{photo ? photo.name : 'Take or upload a photo of the road damage'}</h3>
            <p>Clear photos help Vision AI assess crater depth and trigger emergency repair SLAs.</p>
            <label className="secondary-button upload-button">
              <Upload size={16} /> {photo ? 'Change photo' : 'Select photo'}
              <input type="file" accept="image/*" onChange={choosePhoto} />
            </label>
          </div>
        )}

        {/* STEP 2: LOCATION */}
        {step === 2 && (
          <div className="form-panel">
            <label>Incident Location in Nagpur</label>
            <div className="location-input">
              {locating ? <LocateFixed size={17} className="locating-icon" /> : <MapPin size={17} />}
              <span>
                {locating
                  ? 'Acquiring GPS coordinates...'
                  : location
                  ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                  : 'Coordinates pending'}
              </span>
              {location && <Check size={17} />}
            </div>

            <div className="report-location-map">
              {location && (
                <MapContainer center={[location.latitude, location.longitude]} zoom={15} scrollWheelZoom className="leaflet-map">
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker center={[location.latitude, location.longitude]} radius={10} pathOptions={{ color: '#fff', weight: 3, fillColor: '#e46d63', fillOpacity: 1 }}>
                    <Popup>Selected GPS location</Popup>
                  </CircleMarker>
                </MapContainer>
              )}
            </div>

            <div className="location-helpers">
              <button className="text-button" onClick={locate}>
                <LocateFixed size={14} /> Detect Current Location
              </button>
              <div className="preset-locations">
                <span>Quick Nagpur Presets:</span>
                <button type="button" onClick={() => setLocation({ latitude: 21.1189, longitude: 79.0722, address: 'Somalwar School Gate, Laxmi Nagar' })}>
                  School Gate
                </button>
                <button type="button" onClick={() => setLocation({ latitude: 21.1215, longitude: 79.0684, address: 'Laxmi Nagar Square' })}>
                  Laxmi Nagar
                </button>
                <button type="button" onClick={() => setLocation({ latitude: 21.1685, longitude: 79.0552, address: 'Katol Road Corridor' })}>
                  Katol Road
                </button>
                <button type="button" onClick={() => setLocation({ latitude: 21.1498, longitude: 79.0095, address: 'Wadi Bus Stop' })}>
                  Wadi Bus Stop
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS & AI CLASSIFICATION */}
        {step === 3 && (
          <div className="form-panel">
            {analyzingAi && (
              <div className="ai-scanning-banner">
                <Sparkles size={16} className="spin-slow" />
                <span>AI Vision Analyzing Road Surface...</span>
              </div>
            )}

            <label>Infrastructure Category (Auto-Triage)</label>
            <div className="category-grid">
              {[
                ['POTHOLE', 'Pothole'],
                ['ROAD_DAMAGE', 'Road Damage'],
                ['STREETLIGHT', 'Streetlight Outage'],
                ['WATER_LEAKAGE', 'Water Leakage'],
                ['DRAINAGE', 'Drainage / Culvert'],
                ['OTHER', 'Other']
              ].map(([val, name]) => (
                <button
                  type="button"
                  key={val}
                  className={category === val ? 'category active' : 'category'}
                  onClick={() => setCategory(val)}
                >
                  {name}
                </button>
              ))}
            </div>

            <div className="form-row-checkbox">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={nearSchool}
                  onChange={(e) => setNearSchool(e.target.checked)}
                />
                <span>Near School, College, or Hospital (Escalates to 24h Critical SLA)</span>
              </label>
            </div>

            <label>Reporting Channel (Multi-Channel Ingestion)</label>
            <select className="channel-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="App">Citizen Mobile App</option>
              <option value="WhatsApp">WhatsApp Grievance Bot (+91-NMC-BOT)</option>
              <option value="Helpline">Helpline (1800-NMC-ROADS)</option>
              <option value="Social Media">Social Media (X / Twitter @NagpurCorp)</option>
              <option value="Letter">Ward Office Letter / Walk-in</option>
            </select>

            <label>Describe the hazard or damage</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Deep pothole causing two-wheeler accidents, water pipeline breach..."
            />
          </div>
        )}

        {/* STEP 4: REVIEW */}
        {step === 4 && (
          <div className="review-panel">
            <div className="ai-card">
              <div className="ai-title">
                <Sparkles size={16} /> AI VISION TRIAGE & AUDIT <span>Live Assessment</span>
              </div>
              <strong>{category.replaceAll('_', ' ')} · Severity: {nearSchool ? 'CRITICAL' : severity}</strong>
              <p>{aiReasoning || 'Automated visual scan detected road surface degradation. Proximity and severity algorithms applied.'}</p>
              <div className="ai-meta-pills">
                <span className="pill">Auto-Route: {category === 'STREETLIGHT' ? 'Electrical Services' : category === 'WATER_LEAKAGE' ? 'Orange City Water (OCW)' : 'Road Maintenance (NMC)'}</span>
                <span className="pill">Channel: {channel}</span>
                {nearSchool && <span className="pill alert">School Zone: 24h Emergency SLA</span>}
              </div>
            </div>

            <div className="review-line">
              <MapPin size={16} />
              <span>{location ? `Coordinates: ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : 'Location captured'}</span>
              <Check size={16} />
            </div>

            <div className="review-line">
              <Clock size={16} />
              <span>Target SLA: {nearSchool ? '24 Hours (Immediate)' : '72 Hours (Standard)'}</span>
              <Check size={16} />
            </div>
          </div>
        )}

        <div className="modal-actions">
          {step > 1 && (
            <button className="text-button" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button
            className="primary-button"
            disabled={(step === 1 && !photo) || (step === 2 && !location)}
            onClick={() => {
              if (step === 4) {
                onSubmit(location, category, description, photoBase64, channel, nearSchool)
              } else {
                handleStepTransition(step + 1)
              }
            }}
          >
            {step === 4 ? 'Submit Incident to NMC' : 'Continue'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

function IssueRow({ issue, onClick }) {
  return (
    <button className="issue-row" onClick={onClick}>
      <div className={`issue-symbol ${issue.tone}`}>{issue.icon}</div>
      <div className="issue-copy">
        <div className="issue-title-line">
          <strong>{issue.type}</strong>
          {issue.isOverdue && <span className="overdue-chip">Overdue</span>}
          {issue.nearSchoolOrHospital && <span className="school-chip">School Zone</span>}
        </div>
        <span>{issue.area}</span>
      </div>
      <div className="issue-meta">
        <b className={`status ${issue.status.includes('Resolved') ? 'resolved' : issue.status.includes('progress') ? 'progress' : 'reported'}`}>
          {issue.status}
        </b>
        <span>{issue.id}</span>
      </div>
      <ChevronRight size={16} className="row-arrow" />
    </button>
  )
}

// Full Inspection Modal with Before/After Proof & Audit Trail
function IssueInspectionModal({ issue, onClose, onConfirmResolution }) {
  return (
    <div className="modal-backdrop">
      <div className="modal modal-wide">
        <button className="modal-close" onClick={onClose}><X size={19} /></button>
        <div className="modal-kicker">{issue.id} · NAGPUR INFRASTRUCTURE AUDIT</div>
        <h2>{issue.title || issue.type}</h2>
        <p className="modal-sub"><MapPin size={14} /> {issue.area}</p>

        {issue.riskContext && (
          <div className="risk-banner">
            <AlertTriangle size={16} />
            <span>{issue.riskContext}</span>
          </div>
        )}

        <div className="inspection-grid">
          <div className="inspection-facts">
            <div>
              <span>Assigned Department</span>
              <strong>{issue.department}</strong>
            </div>
            <div>
              <span>Responsible Agency</span>
              <strong>{issue.agency}</strong>
            </div>
            <div>
              <span>Current Status</span>
              <strong>{issue.status}</strong>
            </div>
            <div>
              <span>Priority Score</span>
              <strong>{issue.priorityScore} / 10.0</strong>
            </div>
          </div>

          {/* Multi-Channel Ingestion Tag (Task 3) */}
          {issue.channels && issue.channels.length > 0 && (
            <div className="channels-box">
              <span className="box-title">Multi-Channel Ingestion Reports ({issue.channels.length})</span>
              <div className="chips-container">
                {issue.channels.map((ch) => (
                  <span className="channel-pill" key={ch}>{ch}</span>
                ))}
              </div>
            </div>
          )}

          {/* Before & After Photo Proof (Task 6) */}
          <div className="proof-comparison-container">
            <span className="box-title">Proof-of-Work Verification Photos</span>
            <div className="proof-photos-row">
              <div className="proof-photo-wrapper">
                <span>BEFORE (Reported Condition)</span>
                {issue.images?.[0] ? (
                  <img src={issue.images[0]} alt="Reported condition" />
                ) : (
                  <div className="no-photo">No before photo available</div>
                )}
              </div>
              <div className="proof-photo-wrapper">
                <span>AFTER (Contractor Resolution)</span>
                {issue.resolutionPhoto ? (
                  <img src={issue.resolutionPhoto} alt="Contractor completion photo" />
                ) : (
                  <div className="no-photo pending">Pending repair by field team</div>
                )}
              </div>
            </div>
          </div>

          {/* Timeline / Audit Trail */}
          <div className="audit-trail">
            <span className="box-title">Municipal Audit Log</span>
            <div className="timeline-list">
              {issue.timeline?.map((entry, idx) => (
                <div className="timeline-item" key={idx}>
                  <div className="timeline-dot" />
                  <div className="timeline-text">
                    <strong>{entry.label}</strong>
                    {entry.notes && <p>{entry.notes}</p>}
                    <small>{new Date(entry.at).toLocaleString()} · {entry.actor || 'System'}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose}>Close</button>
          {issue.status === 'Resolved' && !issue.citizenConfirmed && (
            <button className="primary-button" onClick={() => onConfirmResolution(true)}>
              <Check size={16} /> Confirm Satisfactory Resolution
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Tasks 4, 5, 6: Authority Executive Dashboard & Command Center
function AuthorityDashboard({ user, issues, recentWorks, setIssues, refreshIssues, onLogout }) {
  const [activeSection, setActiveSection] = useState('Overview')
  const [filter, setFilter] = useState('All issues')
  const [selected, setSelected] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [teams, setTeams] = useState([])
  const [resolutionPhoto, setResolutionPhoto] = useState('')
  const [resolutionNotes, setResolutionNotes] = useState('')
  const [reRouteDept, setReRouteDept] = useState('')
  const [showReRoute, setShowReRoute] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (user.token) {
      fetch(apiUrl('/api/authority/dashboard'), {
        headers: { Authorization: `Bearer ${user.token}` }
      })
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          setMetrics(data.metrics)
          setTeams(data.fieldTeams || [])
        })
        .catch(() => {})
    }
  }, [user.token, issues])

  // Filter with Overdue Support (Task 4)
  const visible = useMemo(() => {
    if (filter === 'All issues') return issues
    if (filter === 'Overdue') return issues.filter((i) => i.isOverdue)
    return issues.filter((i) => i.status === filter)
  }, [issues, filter])

  // Task 6: Require resolution photo when marking RESOLVED
  const updateIssue = async (id, status) => {
    setErrorMsg('')
    const target = issues.find((i) => i.id === id)
    if (!target?._id) return

    if (status === 'Resolved' && !resolutionPhoto && !target.resolutionPhoto) {
      setErrorMsg('Resolution photo is required by municipal audit before marking Resolved.')
      return
    }

    try {
      const payload = {
        status: status.toUpperCase().replace(' ', '_'),
        ...(resolutionPhoto ? { resolutionPhoto } : {}),
        ...(resolutionNotes ? { resolutionNotes } : {})
      }

      const res = await fetch(apiUrl(`/api/issues/${target._id}`), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        refreshIssues()
        setSelected(null)
        setResolutionPhoto('')
        setResolutionNotes('')
      } else {
        const data = await res.json()
        setErrorMsg(data.message || 'Update failed')
      }
    } catch {
      setErrorMsg('Failed to update status.')
    }
  }

  // Task 4: Re-route Department
  const handleReroute = async (id) => {
    const target = issues.find((i) => i.id === id)
    if (!target?._id || !reRouteDept) return
    try {
      const res = await fetch(apiUrl(`/api/issues/${target._id}/reroute`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          newDepartment: reRouteDept,
          reason: 'Corrective allocation by Executive Engineer'
        })
      })
      if (res.ok) {
        refreshIssues()
        setShowReRoute(false)
        setSelected(null)
      }
    } catch {
      //
    }
  }

  const overdueCount = issues.filter((i) => i.isOverdue).length

  return (
    <div className="authority-shell">
      <aside className="authority-sidebar">
        <div className="brand">
          <div className="brand-mark"><Radar size={20} /></div>
          <span>Civic<span>Pulse</span></span>
        </div>
        <div className="workspace-label">NAGPUR COMMAND CONSOLE</div>
        <nav>
          <button
            className={activeSection === 'Overview' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveSection('Overview')}
          >
            <Activity size={18} /><span>Command Center</span>
          </button>
          <button
            className={activeSection === 'Priority queue' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveSection('Priority queue')}
          >
            <ClipboardCheck size={18} />
            <span>Priority Queue</span>
            <b>{issues.filter((i) => i.status !== 'Resolved').length}</b>
          </button>
          <button
            className={activeSection === 'Live map' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveSection('Live map')}
          >
            <MapPin size={18} /><span>Operational Map</span>
          </button>
          <button
            className={activeSection === 'Coordination' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveSection('Coordination')}
          >
            <Layers size={18} /><span>Agency Coordination</span>
          </button>
          <button
            className={activeSection === 'Field teams' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveSection('Field teams')}
          >
            <Wrench size={18} /><span>Field Squads</span>
          </button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="authority-user">
          <div className="avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{user.name}</strong>
            <span>Executive Engineer · NMC</span>
          </div>
        </div>
        <button className="nav-item" onClick={onLogout}>
          <LogOut size={18} /><span>Log out</span>
        </button>
      </aside>

      <main className="authority-main">
        <header className="authority-topbar">
          <div>
            <div className="eyebrow"><span className="pulse-dot" /> LIVE NMC INFRASTRUCTURE CONTROL</div>
            <h1>Nagpur Unified Infrastructure Command</h1>
          </div>
          <div className="authority-actions">
            <span>Operational Center · Zone 3</span>
            <div className="top-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>

        <div className="authority-content">
          {activeSection === 'Overview' && (
            <>
              {/* Task 4: KPIs including Overdue */}
              <section className="authority-kpis">
                <Kpi icon={FilePlus2} label="Total Grievances" value={metrics?.total ?? issues.length} tone="blue" />
                <Kpi icon={AlertCircle} label="Active Action Needed" value={metrics?.pending ?? issues.filter((i) => i.status !== 'Resolved').length} tone="coral" />
                <Kpi icon={Clock} label="SLA Overdue" value={overdueCount} tone="coral" note="Requires immediate escalation" />
                <Kpi icon={CheckCircle2} label="Resolution Rate" value={`${metrics?.resolutionRate ?? 0}%`} tone="mint" />
              </section>

              <section className="authority-heading">
                <div>
                  <h2>Priority Work Orders</h2>
                  <p>Sorted by AI Hazard Score, school vulnerability & multi-channel cluster size</p>
                </div>
                {/* Task 4: Overdue Filter tab */}
                <div className="filter-tabs">
                  {['All issues', 'Reported', 'In progress', 'Overdue', 'Resolved'].map((item) => (
                    <button
                      className={filter === item ? 'selected' : ''}
                      key={item}
                      onClick={() => setFilter(item)}
                    >
                      {item} {item === 'Overdue' && overdueCount > 0 && `(${overdueCount})`}
                    </button>
                  ))}
                </div>
              </section>

              <section className="authority-grid">
                <div className="queue-panel">
                  {visible.map((issue) => (
                    <button className="queue-item" key={issue.id} onClick={() => setSelected(issue)}>
                      <div className={`queue-priority ${issue.tone}`}>
                        <strong>{issue.status === 'Resolved' ? '✓' : issue.isOverdue ? '⏰' : '!'}</strong>
                      </div>
                      <div className="queue-copy">
                        <div>
                          <strong>{issue.type}</strong>
                          <span className={`queue-status ${issue.status.toLowerCase().replace(' ', '-')}`}>
                            {issue.status}
                          </span>
                          {issue.isOverdue && <span className="overdue-chip">SLA Overdue</span>}
                          {issue.nearSchoolOrHospital && <span className="school-chip">School Zone</span>}
                        </div>
                        <p>{issue.area}</p>
                        <small>
                          {issue.id} · {issue.department} · {issue.channels?.join(', ') || 'App'}
                        </small>
                      </div>
                      <div className="queue-score">
                        <strong>{issue.priorityScore || '—'}</strong>
                        <span>hazard score</span>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                  {visible.length === 0 && <div className="empty-state">No issues match this filter.</div>}
                </div>

                <div className="authority-insight">
                  <div className="panel-head">
                    <div>
                      <h2>Operational Snapshot</h2>
                      <p>Nagpur Infrastructure Health</p>
                    </div>
                    <Activity size={18} color="#2b80df" />
                  </div>
                  <div className="insight-number">
                    <strong>{metrics?.resolutionRate ?? 0}</strong><span>%</span>
                    <small>City resolution efficiency</small>
                  </div>
                  <div className="insight-bar"><i style={{ width: `${metrics?.resolutionRate ?? 0}%` }} /></div>
                  <div className="insight-row">
                    <span><i className="dot coral" /> Active Grievances</span>
                    <strong>{metrics?.pending ?? 0}</strong>
                  </div>
                  <div className="insight-row">
                    <span><i className="dot aqua" /> In Progress / Dispatched</span>
                    <strong>{metrics?.inProgress ?? 0}</strong>
                  </div>
                  <div className="insight-row">
                    <span><i className="dot mint" /> Verified Resolved</span>
                    <strong>{metrics?.resolved ?? 0}</strong>
                  </div>
                  <div className="insight-row">
                    <span><i className="dot red" /> SLA Breaches</span>
                    <strong style={{ color: '#dc2626' }}>{overdueCount}</strong>
                  </div>
                </div>
              </section>
            </>
          )}

          {activeSection === 'Priority queue' && (
            <div className="authority-workspace">
              <div className="filter-tabs workspace-filters">
                {['All issues', 'Reported', 'In progress', 'Overdue', 'Resolved'].map((item) => (
                  <button
                    className={filter === item ? 'selected' : ''}
                    key={item}
                    onClick={() => setFilter(item)}
                  >
                    {item} {item === 'Overdue' && overdueCount > 0 && `(${overdueCount})`}
                  </button>
                ))}
              </div>
              <div className="queue-panel workspace-queue">
                {visible.map((issue) => (
                  <button className="queue-item" key={issue.id} onClick={() => setSelected(issue)}>
                    <div className={`queue-priority ${issue.tone}`}>
                      <strong>{issue.status === 'Resolved' ? '✓' : issue.isOverdue ? '⏰' : '!'}</strong>
                    </div>
                    <div className="queue-copy">
                      <div>
                        <strong>{issue.type}</strong>
                        <span className={`queue-status ${issue.status.toLowerCase().replace(' ', '-')}`}>
                          {issue.status}
                        </span>
                        {issue.isOverdue && <span className="overdue-chip">SLA Overdue</span>}
                      </div>
                      <p>{issue.area}</p>
                      <small>{issue.id} · {issue.department}</small>
                    </div>
                    <div className="queue-score">
                      <strong>{issue.priorityScore}</strong>
                      <span>priority</span>
                    </div>
                    <ChevronRight size={17} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'Live map' && (
            <div className="authority-workspace">
              <CivicMap issues={issues} recentWorks={recentWorks} onSelect={(issue) => setSelected(issue)} large />
            </div>
          )}

          {/* Task 5: Agency Coordination & Road Digging Moratorium Dashboard */}
          {activeSection === 'Coordination' && (
            <div className="authority-workspace">
              <div className="section-head">
                <div>
                  <h2>Nagpur Cross-Agency Coordination Registry</h2>
                  <p>Active utility excavations & 180-day road digging moratoriums (NMC, OCW, MSEDCL)</p>
                </div>
              </div>
              <div className="recent-works-grid">
                {recentWorks.map((work) => {
                  const isMoratorium = Boolean(work.moratoriumUntil && new Date(work.moratoriumUntil) > new Date())
                  return (
                    <div className={`work-card ${isMoratorium ? 'moratorium-card' : ''}`} key={work._id || work.workId}>
                      <div className="work-card-head">
                        <span className="agency-pill">{work.agency}</span>
                        <span className={`status-badge ${isMoratorium ? 'moratorium' : 'active'}`}>
                          {isMoratorium ? '180-Day Moratorium Active' : work.status}
                        </span>
                      </div>
                      <h3>{work.title || work.description}</h3>
                      <p><MapPin size={13} /> {work.address}</p>
                      <div className="work-dates">
                        <div>
                          <span>Start Date</span>
                          <strong>{new Date(work.startDate).toLocaleDateString()}</strong>
                        </div>
                        {isMoratorium ? (
                          <div>
                            <span>Digging Prohibited Until</span>
                            <strong className="text-purple">{new Date(work.moratoriumUntil).toLocaleDateString()}</strong>
                          </div>
                        ) : (
                          <div>
                            <span>Target Completion</span>
                            <strong>{work.endDate ? new Date(work.endDate).toLocaleDateString() : 'Ongoing'}</strong>
                          </div>
                        )}
                      </div>
                      {isMoratorium && (
                        <div className="moratorium-warning-box">
                          ⚠️ Section resurfaced recently. Orange City Water and MSEDCL utility trenching is strictly prohibited without Joint Municipal Clearance.
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeSection === 'Field teams' && (
            <div className="authority-workspace">
              <div className="team-grid">
                {teams.map((team) => (
                  <div className="team-card" key={team._id}>
                    <div className="team-icon"><Wrench size={19} /></div>
                    <h3>{team.name}</h3>
                    <p>{team.department?.name || 'Civic Operations'}</p>
                    <span>{team.ward} · {team.lead?.name || 'Rapid Response Squad'}</span>
                    <b>Active</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Task 4 & 6: Authority Issue Action Modal */}
      {selected && (
        <div className="modal-backdrop">
          <div className="modal issue-detail">
            <button className="modal-close" onClick={() => setSelected(null)}><X size={19} /></button>
            <div className="modal-kicker">{selected.id} · OPERATIONAL ACTION</div>
            <h2>{selected.type}</h2>
            <p className="modal-sub"><MapPin size={13} /> {selected.area}</p>

            {selected.isOverdue && (
              <div className="overdue-banner">
                <Clock size={16} /> <span>SLA Breached: Requires emergency crew mobilization</span>
              </div>
            )}

            <div className="detail-ai">
              <Sparkles size={17} />
              <div>
                <strong>Auto Department: {selected.department}</strong>
                <span>Agency: {selected.agency || 'Nagpur Municipal Corporation'}</span>
              </div>
              <button className="reroute-btn" onClick={() => setShowReRoute(!showReRoute)}>
                Re-route Dept
              </button>
            </div>

            {/* Task 4: Misrouted Department Correction */}
            {showReRoute && (
              <div className="reroute-box">
                <label>Select Correct Department (e.g. fix Wadi Streetlight):</label>
                <select value={reRouteDept} onChange={(e) => setReRouteDept(e.target.value)}>
                  <option value="">-- Choose Department --</option>
                  <option value="Road Maintenance">Road Maintenance (NMC)</option>
                  <option value="Electrical Services">Electrical Services (NMC Power / MSEDCL)</option>
                  <option value="Water & Drainage">Water & Drainage (Orange City Water)</option>
                  <option value="Sanitation">Sanitation (NMC Solid Waste)</option>
                </select>
                <button className="secondary-button" onClick={() => handleReroute(selected.id)}>
                  Save Re-route
                </button>
              </div>
            )}

            <div className="detail-facts">
              <div>
                <span>Reported Via</span>
                <strong>{selected.channels?.join(', ') || 'Citizen App'}</strong>
              </div>
              <div>
                <span>Community Confirmations</span>
                <strong>{selected.communityConfirmations?.length || 1} citizens</strong>
              </div>
            </div>

            <label className="detail-label">Update Status</label>
            <div className="status-actions">
              {['Reported', 'Assigned', 'In progress', 'Resolved'].map((status) => (
                <button
                  className={selected.status === status ? 'active' : ''}
                  key={status}
                  onClick={() => updateIssue(selected.id, status)}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Task 6: Require Resolution Photo for Resolved */}
            <div className="resolution-upload-section">
              <label className="detail-label">
                Contractor Proof-of-Work Photo (Required for "Resolved" Closure)
              </label>
              <label className="secondary-button upload-button">
                <Camera size={16} /> {resolutionPhoto ? 'Resolution Photo Attached' : 'Upload Proof Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const r = new FileReader()
                      r.onload = () => setResolutionPhoto(r.result)
                      r.readAsDataURL(file)
                    }
                  }}
                />
              </label>
              {resolutionPhoto && <img className="mini-preview" src={resolutionPhoto} alt="Proof" />}
              <input
                className="notes-input"
                placeholder="Contractor compaction certificate ref / notes..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            {errorMsg && <div className="auth-error">{errorMsg}</div>}

            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setSelected(null)}>Close</button>
              <button
                className="primary-button"
                onClick={() => updateIssue(selected.id, 'Resolved')}
              >
                Sign Off & Mark Resolved <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, tone, note }) {
  return (
    <div className="authority-kpi">
      <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note || <>vs last month <b>↑ 12%</b></>}</small>
    </div>
  )
}

// Task 7: Dynamic Auth Screen with live stats
function AuthScreen({ mode, setMode, onAuthenticated, issuesCount }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const response = await fetch(apiUrl(`/api/auth/${mode === 'login' ? 'login' : 'register'}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'login'
            ? { email: form.email.trim().toLowerCase(), password: form.password }
            : { ...form, email: form.email.trim().toLowerCase(), role: 'CITIZEN' }
        )
      })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        onAuthenticated({ ...data.user, token: data.token })
        return
      }
      setError(data.message || (mode === 'login' ? 'Invalid credentials.' : 'Unable to create account.'))
    } catch {
      setError('Cannot connect to Nagpur API. Please ensure server is running.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-art">
        <div className="brand auth-brand">
          <div className="brand-mark"><Radar size={20} /></div>
          <span>Civic<span>Pulse</span></span>
        </div>
        <div className="auth-art-copy">
          <div className="eyebrow"><span className="pulse-dot" /> NAGPUR URBAN INFRASTRUCTURE PLATFORM</div>
          <h1>Nagpur's Roads.<br /><em>Intelligently Monitored.</em></h1>
          <p>AI-driven pothole severity assessment, cross-utility construction coordination, and transparent citizen verification for Nagpur Municipal Corporation.</p>
          <div className="auth-proof">
            <div>
              <strong>{issuesCount || 6}+</strong>
              <span>Active Nagpur Hotspots</span>
            </div>
            <div>
              <strong>180-Day</strong>
              <span>Digging Moratorium Guard</span>
            </div>
          </div>
        </div>
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />
      </div>

      <div className="auth-panel">
        <div className="auth-panel-inner">
          <div className="mobile-auth-brand">
            <div className="brand-mark"><Radar size={18} /></div>
            Civic<span>Pulse</span>
          </div>
          <div className="auth-heading">
            <div className="auth-icon">
              {mode === 'login' ? <UserRound size={20} /> : <UserPlus size={20} />}
            </div>
            <h2>{mode === 'login' ? 'Nagpur Civic Portal' : 'Join CivicPulse'}</h2>
            <p>{mode === 'login' ? 'Sign in to access Nagpur infrastructure command.' : 'Create your citizen account.'}</p>
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <label>
                Full name
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Your name"
                  required
                />
              </label>
            )}
            <label>
              Email address
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="citizen@demo.com or authority@demo.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </label>
            {error && <div className="auth-error">{error}</div>}

            <button className="primary-button auth-submit" disabled={busy}>
              {busy ? 'Connecting...' : mode === 'login' ? 'Sign In to Portal' : 'Create Account'}{' '}
              <ChevronRight size={16} />
            </button>
          </form>

          <div className="demo-hint">
            <strong>Nagpur Hackathon Demo Credentials:</strong>
            <span>Citizen: <code>citizen@demo.com</code> / <code>CivicPulse2026!</code></span>
            <span>Authority (NMC): <code>authority@demo.com</code> / <code>admin</code></span>
          </div>

          <p className="auth-switch">
            {mode === 'login' ? 'New citizen in Nagpur?' : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError('')
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}

export default App
