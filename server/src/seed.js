import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

// Realistic lightweight SVG data-URLs for offline reliability
const potholeSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%232b2e35"/><path d="M50 300 L550 300" stroke="%23f7b928" stroke-dasharray="25 15" stroke-width="6"/><ellipse cx="300" cy="240" rx="140" ry="70" fill="%2314161a" stroke="%233a3e47" stroke-width="8"/><ellipse cx="290" cy="245" rx="100" ry="45" fill="%230b0d10"/><path d="M180 230 Q 220 280 290 270 Q 380 260 420 225" stroke="%23686d76" stroke-width="4" fill="none"/><text x="30" y="50" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold">CIVICPULSE NAGPUR · ROAD DAMAGE SURVEY</text><text x="30" y="80" fill="%23f7b928" font-family="sans-serif" font-size="14">AI SCAN: Deep Asphalt Crater (Depth: 18cm · High Hazard)</text></svg>`

const streetlightSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%23111827"/><circle cx="300" cy="120" r="40" fill="%23374151" stroke="%23ef4444" stroke-width="4"/><path d="M300 160 L300 380" stroke="%236b7280" stroke-width="12"/><path d="M250 380 L350 380" stroke="%239ca3af" stroke-width="14"/><text x="30" y="50" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold">CIVICPULSE NAGPUR · STREETLIGHT AUDIT</text><text x="30" y="80" fill="%23ef4444" font-family="sans-serif" font-size="14">STATUS: Outage Reported near Wadi Bus Stop · Dark Zone Risk</text></svg>`

const waterLeakSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%231e293b"/><path d="M0 320 Q 150 290 300 320 T 600 320" fill="%230284c7" fill-opacity="0.4"/><ellipse cx="280" cy="280" rx="160" ry="60" fill="%230ea5e9" fill-opacity="0.8"/><text x="30" y="50" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold">OCW PIPELINE SENSOR · MAIN ROAD BREACH</text><text x="30" y="80" fill="%2338bdf8" font-family="sans-serif" font-size="14">Sub-base erosion detected on Katol Road Corridor</text></svg>`

const resolvedPavementSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="100%" height="100%" fill="%231f2937"/><path d="M0 200 L600 200" stroke="%2310b981" stroke-dasharray="30 20" stroke-width="8"/><rect x="180" y="160" width="240" height="120" rx="12" fill="%23374151" stroke="%2310b981" stroke-width="5"/><text x="30" y="50" fill="%23ffffff" font-family="sans-serif" font-size="20" font-weight="bold">NMC WORKS · RESOLUTION VERIFIED</text><text x="30" y="80" fill="%2310b981" font-family="sans-serif" font-size="14">Bituminous Cold-Mix Patchwork Completed & Compaction Certified</text></svg>`

const userSchema = new mongoose.Schema({ name: String, email: String, password: String, role: String }, { timestamps: true })
const issueSchema = new mongoose.Schema({
  issueId: String,
  title: String,
  description: String,
  category: String,
  images: [String],
  resolutionPhoto: String,
  resolutionNotes: String,
  address: String,
  ward: String,
  status: String,
  severity: String,
  priorityScore: Number,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  timeline: [{ label: String, at: Date, actor: String, notes: String }],
  reportedBy: mongoose.Schema.Types.ObjectId,
  department: String,
  agency: String,
  channels: [String],
  communityConfirmations: [mongoose.Schema.Types.ObjectId],
  nearSchoolOrHospital: Boolean,
  riskContext: String,
  dueAt: Date,
  citizenConfirmed: Boolean,
  citizenFeedback: String
}, { timestamps: true })

const recentWorkSchema = new mongoose.Schema({
  workId: String,
  agency: String,
  department: String,
  title: String,
  description: String,
  address: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  startDate: Date,
  endDate: Date,
  roadResurfacedAt: Date,
  moratoriumUntil: Date,
  status: String,
  permitRef: String
}, { timestamps: true })

const departmentSchema = new mongoose.Schema({ name: String, code: String, agency: String, active: Boolean }, { timestamps: true })
const fieldTeamSchema = new mongoose.Schema({ name: String, department: mongoose.Schema.Types.ObjectId, lead: mongoose.Schema.Types.ObjectId, ward: String, active: Boolean }, { timestamps: true })

const incidentSchema = new mongoose.Schema({
  incidentId: String,
  type: String,
  title: String,
  description: String,
  roadName: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  severity: String,
  status: String,
  radius: Number,
  startTime: Date,
  endTime: Date,
  createdBy: mongoose.Schema.Types.ObjectId,
  eventName: String,
  expectedVisitors: Number,
  congestionLevel: String,
  sourceIssueId: mongoose.Schema.Types.ObjectId,
  isSimulation: Boolean
}, { timestamps: true })

const parkingSchema = new mongoose.Schema({
  parkingId: String,
  name: String,
  location: { type: { type: String, default: 'Point' }, coordinates: [Number] },
  address: String,
  capacity: Number,
  availableSpaces: Number,
  status: String,
  nearLandmark: String
}, { timestamps: true })

issueSchema.index({ location: '2dsphere' })
recentWorkSchema.index({ location: '2dsphere' })
incidentSchema.index({ location: '2dsphere' })
parkingSchema.index({ location: '2dsphere' })

const User = mongoose.model('User', userSchema)
const Issue = mongoose.model('Issue', issueSchema)
const RecentWork = mongoose.model('RecentWork', recentWorkSchema)
const Department = mongoose.model('Department', departmentSchema)
const FieldTeam = mongoose.model('FieldTeam', fieldTeamSchema)
const Incident = mongoose.model('Incident', incidentSchema)
const Parking = mongoose.model('Parking', parkingSchema)

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/civicpulse'
await mongoose.connect(mongoUri)
console.log(`Connected to MongoDB for seeding: ${mongoUri}`)
await Issue.createIndexes()
await RecentWork.createIndexes()
await Incident.createIndexes()
await Parking.createIndexes()

const password = await bcrypt.hash('CivicPulse2026!', 12)
const authorityPassword = await bcrypt.hash('admin', 12)

await User.deleteMany({ email: { $in: ['citizen@demo.com', 'authority@demo.com', 'worker@demo.com', 'admin@demo.com'] } })
const users = await User.insertMany([
  { name: 'Arjun Sharma', email: 'citizen@demo.com', password, role: 'CITIZEN' },
  { name: 'Meera Joshi (EE, Nagpur Works)', email: 'authority@demo.com', password: authorityPassword, role: 'AUTHORITY' },
  { name: 'Ravi Patil (Ward Supervisor)', email: 'worker@demo.com', password, role: 'FIELD_WORKER' },
  { name: 'NMC Command Admin', email: 'admin@demo.com', password: authorityPassword, role: 'ADMIN' },
])

await Department.deleteMany({})
const departments = await Department.insertMany([
  { name: 'Road Maintenance', code: 'ROAD_MAINTENANCE', agency: 'Nagpur Municipal Corporation (NMC)', active: true },
  { name: 'Water & Drainage', code: 'WATER_DRAINAGE', agency: 'Orange City Water (OCW) / NMC', active: true },
  { name: 'Electrical Services', code: 'ELECTRICAL_SERVICES', agency: 'NMC Electrical / MSEDCL', active: true },
  { name: 'Sanitation', code: 'SANITATION', agency: 'NMC Solid Waste Management', active: true },
])

await FieldTeam.deleteMany({})
await FieldTeam.insertMany([
  { name: 'NMC Rapid Road Repair Squad (Zone 3)', department: departments[0]._id, lead: users[2]._id, ward: 'Laxmi Nagar & Dharampeth', active: true },
  { name: 'OCW Pipeline Emergency Cell', department: departments[1]._id, lead: users[2]._id, ward: 'Katol Road & West Ward', active: true },
  { name: 'MSEDCL / NMC Streetlight Quick Response', department: departments[2]._id, lead: users[2]._id, ward: 'Wadi & Hingna Corridor', active: true },
])

// TASK 5: Seed Recent Works & Road Resurfacing Digging Moratoriums
await RecentWork.deleteMany({})
const now = new Date()
const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000)
const fiveMonthsLater = new Date(now.getTime() + 140 * 24 * 60 * 60 * 1000)
const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

await RecentWork.insertMany([
  {
    workId: 'WRK-NGP-2026-08',
    agency: 'Nagpur Municipal Corporation (NMC)',
    department: 'Road Maintenance',
    title: 'Katol Road Full Bituminous Resurfacing',
    description: 'Fresh multi-layer asphalt resurfacing completed 40 days ago. 180-day Excavation Moratorium in effect.',
    address: 'Katol Road, Chhaoni to Gittikhadan, Nagpur',
    location: { type: 'Point', coordinates: [79.0552, 21.1685] },
    startDate: fortyDaysAgo,
    endDate: fortyDaysAgo,
    roadResurfacedAt: fortyDaysAgo,
    moratoriumUntil: fiveMonthsLater,
    status: 'COMPLETED',
    permitRef: 'NMC-PW-2026-904'
  },
  {
    workId: 'WRK-OCW-2026-14',
    agency: 'Orange City Water (OCW)',
    department: 'Water & Drainage',
    title: 'Dharampeth Trunk Pipeline Upgradation',
    description: 'Scheduled underground trenching for 600mm potable feeder main.',
    address: 'Inner Lanes, Dharampeth West, Nagpur',
    location: { type: 'Point', coordinates: [79.0620, 21.1350] },
    startDate: now,
    endDate: twoWeeksLater,
    status: 'ACTIVE',
    permitRef: 'OCW-UTIL-881'
  },
  {
    workId: 'WRK-MSEDCL-2026-22',
    agency: 'MSEDCL (Maharashtra State Electricity)',
    department: 'Electrical Services',
    title: 'Wadi 33kV Underground Power Cable Ducting',
    description: 'Underground conduit laying adjacent to national highway corridor.',
    address: 'Near Wadi Bus Stop, Amravati Road, Nagpur',
    location: { type: 'Point', coordinates: [79.0089, 21.1492] },
    startDate: now,
    endDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    permitRef: 'MSEDCL-PWR-412'
  }
])

// Seed Nagpur Problem Statement Scenarios
await Issue.deleteMany({})

const dueCritical = new Date(now.getTime() + 18 * 60 * 60 * 1000) // 18h remaining
const dueOverdue = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000) // 4 days overdue!
const dueMedium = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

await Issue.insertMany([
  // Scenario 1: Deep crater near school gate (Problem Statement: High-risk crater near school gate gets 1 complaint, high vulnerability)
  {
    issueId: 'CIV-NGP-101',
    title: 'Severe crater near School Gate (Somalwar School)',
    description: 'Deep 22cm road crater directly outside the school entrance gate. Multiple two-wheeler skids and near-misses during morning drop-off.',
    category: 'POTHOLE',
    images: [potholeSvg],
    address: 'Somalwar School Gate, Khamla Road, Laxmi Nagar Zone, Nagpur',
    ward: 'Zone 3 (Laxmi Nagar)',
    status: 'REPORTED',
    severity: 'CRITICAL',
    priorityScore: 9.8,
    department: 'Road Maintenance',
    agency: 'Nagpur Municipal Corporation (NMC Works)',
    location: { type: 'Point', coordinates: [79.0722, 21.1189] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id],
    channels: ['App'],
    nearSchoolOrHospital: true,
    riskContext: 'High Vulnerability: School Transit Corridor with high student & two-wheeler footfall',
    dueAt: dueCritical,
    citizenConfirmed: false,
    timeline: [
      { label: 'Reported', at: new Date(now.getTime() - 6 * 60 * 60 * 1000), actor: 'Arjun Sharma (Citizen)', notes: 'AI flagged critical risk score 9.8 due to school proximity.' }
    ]
  },

  // Scenario 2: Laxmi Nagar Multi-Channel Deduplication Incident (Problem Statement: 1 pothole reported 5 times across app, helpline, social, letter, WhatsApp)
  {
    issueId: 'CIV-NGP-102',
    title: 'Waterlogged Pothole Cluster · Laxmi Nagar Square',
    description: 'Expanding pothole cluster causing acute traffic congestion at Laxmi Nagar square junction post first June monsoon showers.',
    category: 'POTHOLE',
    images: [potholeSvg],
    address: 'Laxmi Nagar Square, 8th Cross, Ward 14, Nagpur',
    ward: 'Zone 3 (Laxmi Nagar)',
    status: 'IN_PROGRESS',
    severity: 'HIGH',
    priorityScore: 9.5,
    department: 'Road Maintenance',
    agency: 'Nagpur Municipal Corporation (NMC Works)',
    location: { type: 'Point', coordinates: [79.0684, 21.1215] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id, users[1]._id, users[2]._id, users[3]._id],
    channels: ['App', 'WhatsApp (+91-NMC-BOT)', 'Helpline (1800-NMC-ROADS)', 'Social Media (X / @NagpurCorp)', 'Physical Letter / Ward Walk-in'],
    nearSchoolOrHospital: false,
    riskContext: 'Multi-Channel Public Signal: 5 civic channels merged into single geo-cluster to eliminate duplicate tickets',
    dueAt: dueMedium,
    citizenConfirmed: false,
    timeline: [
      { label: 'Initial Report via NMC Citizen App', at: new Date(now.getTime() - 48 * 60 * 60 * 1000), actor: 'Arjun Sharma', notes: 'Reported via mobile app.' },
      { label: 'Merged WhatsApp Grievance', at: new Date(now.getTime() - 36 * 60 * 60 * 1000), actor: 'WhatsApp Gateway', notes: 'Automated 50m spatial cluster merge.' },
      { label: 'Merged Helpline 1800 Ticket', at: new Date(now.getTime() - 28 * 60 * 60 * 1000), actor: 'Call Center Operator', notes: 'Deduplicated into CIV-NGP-102.' },
      { label: 'Merged Social Media (X/Twitter) Mention', at: new Date(now.getTime() - 14 * 60 * 60 * 1000), actor: 'CivicPulse Social Monitor', notes: 'Geo-tagged tweet matched coordinates.' },
      { label: 'Assigned to Road Response Alpha', at: new Date(now.getTime() - 8 * 60 * 60 * 1000), actor: 'Meera Joshi (EE)', notes: 'Crew dispatched with bituminous premix.' }
    ]
  },

  // Scenario 3: Wadi Bus Stop Streetlight Outage (Problem Statement: Streetlight fault near Wadi bus stop stays unresolved for 12 days because filed under wrong dept)
  {
    issueId: 'CIV-NGP-103',
    title: 'Dark Zone Streetlight Failure near Wadi Bus Stop',
    description: 'High-mast street fixture malfunctioning on national highway bypass adjacent to Wadi passenger bus stop. Creates severe pedestrian safety risk at night.',
    category: 'STREETLIGHT',
    images: [streetlightSvg],
    address: 'Opposite Wadi Bus Stop, Amravati Highway Road, Nagpur',
    ward: 'Zone 1 (Wadi & West Outer)',
    status: 'REPORTED',
    severity: 'HIGH',
    priorityScore: 8.6,
    department: 'Electrical Services',
    agency: 'Electrical Services (NMC Power / MSEDCL)',
    location: { type: 'Point', coordinates: [79.0095, 21.1498] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id],
    channels: ['Helpline (1800-NMC-ROADS)'],
    nearSchoolOrHospital: false,
    riskContext: 'Transit Hub Vulnerability: Bus stop commuter safety during evening hours',
    dueAt: dueOverdue, // OVERDUE by 4 days to highlight the SLA escalation!
    citizenConfirmed: false,
    timeline: [
      { label: 'Originally filed under Road Maintenance (Misrouted)', at: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000), actor: 'Citizen Helpline', notes: 'Unresolved for 12 days due to wrong department allocation.' },
      { label: 'Auto Re-routed to Electrical Services', at: new Date(now.getTime() - 2 * 60 * 60 * 1000), actor: 'CivicPulse Smart Router', notes: 'Corrected to NMC Power & MSEDCL with SLA Escalation Alert.' }
    ]
  },

  // Scenario 4: Katol Road Resurfaced Stretch (Problem Statement: Road resurfaced 40 days ago conflicting with utility pipeline digging)
  {
    issueId: 'CIV-NGP-104',
    title: 'Water Main Leakage & Trenching Conflict · Katol Road',
    description: 'Pipeline leakage requiring excavation on Katol Road. Warning: Road was resurfaced 40 days ago and has an active 180-day Digging Moratorium.',
    category: 'WATER_LEAKAGE',
    images: [waterLeakSvg],
    address: 'Katol Road, near Gittikhadan Police Station, Nagpur',
    ward: 'Zone 2 (Katol Road / West)',
    status: 'REPORTED',
    severity: 'HIGH',
    priorityScore: 8.9,
    department: 'Water & Drainage',
    agency: 'Orange City Water (OCW)',
    location: { type: 'Point', coordinates: [79.0558, 21.1689] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id],
    channels: ['App'],
    nearSchoolOrHospital: false,
    riskContext: 'Excavation Moratorium Conflict: Pavement completed 40 days ago. Requires trenchless drilling or joint utility committee approval.',
    dueAt: dueMedium,
    citizenConfirmed: false,
    timeline: [
      { label: 'Reported', at: new Date(now.getTime() - 10 * 60 * 60 * 1000), actor: 'Arjun Sharma', notes: 'Cross-Agency warning triggered: NMC Moratorium active until Dec 2026.' }
    ]
  },

  // Scenario 5: Kamptee Road Monsoon Damage
  {
    issueId: 'CIV-NGP-105',
    title: 'Monsoon Road Damage & Subgrade Ruts · Kamptee Road',
    description: 'Extensive rutting and multiple road fissures following first torrential June rainfall. Heavy truck and bus corridor.',
    category: 'ROAD_DAMAGE',
    images: [potholeSvg],
    address: 'Kamptee Road, Near Automotive Square, Nagpur',
    ward: 'Zone 5 (Asi Nagar / Kamptee Corridor)',
    status: 'IN_PROGRESS',
    severity: 'HIGH',
    priorityScore: 8.7,
    department: 'Road Maintenance',
    agency: 'Nagpur Municipal Corporation (NMC Works)',
    location: { type: 'Point', coordinates: [79.1124, 21.1925] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id],
    channels: ['App', 'Social Media'],
    nearSchoolOrHospital: false,
    riskContext: 'High-Volume Freight Corridor: Heavy commercial vehicles at risk of axel failure',
    dueAt: dueMedium,
    citizenConfirmed: false,
    timeline: [
      { label: 'Reported', at: new Date(now.getTime() - 20 * 60 * 60 * 1000), actor: 'Arjun Sharma', notes: 'Rainfall damage report.' },
      { label: 'Work Order Issued', at: new Date(now.getTime() - 6 * 60 * 60 * 1000), actor: 'NMC Engineer', notes: 'Assigned to Road Response Squad.' }
    ]
  },

  // Scenario 6: Resolved Issue with Dual Proof-of-Work (Before & After Photo + Citizen Verification)
  {
    issueId: 'CIV-NGP-106',
    title: 'Manish Nagar Inner Lane Pothole · Fixed & Verified',
    description: 'Inner lane pothole near Manish Nagar railway crossing patched and leveled.',
    category: 'POTHOLE',
    images: [potholeSvg],
    resolutionPhoto: resolvedPavementSvg,
    resolutionNotes: 'Standard cold-mix asphalt patch laid with mechanical vibratory plate compaction. Work order audited by NMC Assistant Engineer.',
    address: 'Inner Ring Road, Manish Nagar, Nagpur',
    ward: 'Zone 4 (Manish Nagar & Somalwada)',
    status: 'RESOLVED',
    severity: 'MEDIUM',
    priorityScore: 6.2,
    department: 'Road Maintenance',
    agency: 'Nagpur Municipal Corporation (NMC Works)',
    location: { type: 'Point', coordinates: [79.0815, 21.0995] },
    reportedBy: users[0]._id,
    communityConfirmations: [users[0]._id, users[2]._id],
    channels: ['App'],
    nearSchoolOrHospital: false,
    riskContext: 'Neighborhood access road',
    dueAt: dueMedium,
    citizenConfirmed: true,
    citizenFeedback: 'Pothole has been filled smoothly and road is safe for scooters now. Thanks NMC team!',
    timeline: [
      { label: 'Reported', at: new Date(now.getTime() - 72 * 60 * 60 * 1000), actor: 'Arjun Sharma', notes: 'Citizen reported via App.' },
      { label: 'Assigned', at: new Date(now.getTime() - 48 * 60 * 60 * 1000), actor: 'Meera Joshi', notes: 'Assigned to Ward 12 repair crew.' },
      { label: 'Resolved with Proof-of-Work Photo', at: new Date(now.getTime() - 12 * 60 * 60 * 1000), actor: 'Contractor / Field Team', notes: 'Uploaded geotagged resolution photo.' },
      { label: 'Citizen Confirmed Resolution', at: new Date(now.getTime() - 2 * 60 * 60 * 1000), actor: 'Arjun Sharma', notes: 'Citizen marked resolution as verified.' }
    ]
  }
])

// Seed Dynamic Incident-Aware Routing: Initial Incidents for 3 Hackathon Scenarios
await Incident.deleteMany({})
await Incident.insertMany([
  {
    incidentId: 'INC-NGP-01',
    type: 'ROAD_CLOSURE',
    title: 'Wardha Flyover Closed for Structural Expansion',
    description: 'Structural inspection and girder repair on Wardha Road Flyover. Carriageway closed between Ajni and Chhatrapati Square. Normal traffic redirected to outer corridors.',
    roadName: 'Wardha Road Flyover Corridor',
    location: { type: 'Point', coordinates: [79.0750, 21.1120] },
    severity: 'CRITICAL',
    status: 'ACTIVE',
    radius: 450,
    startTime: now,
    endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    createdBy: users[1]._id,
    isSimulation: false
  },
  {
    incidentId: 'INC-NGP-02',
    type: 'FLOODED_ROAD',
    title: 'Manish Nagar Railway Underpass Flooded',
    description: 'Heavy monsoon cloudburst submerged underpass with 2.5ft of standing water. Danger of engine hydro-lock. Road marked as blocked/unsafe for all vehicular transit.',
    roadName: 'Manish Nagar Railway Underpass Road',
    location: { type: 'Point', coordinates: [79.0815, 21.0995] },
    severity: 'HIGH',
    status: 'ACTIVE',
    radius: 380,
    startTime: now,
    endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdBy: users[1]._id,
    isSimulation: false
  },
  {
    incidentId: 'INC-NGP-03',
    type: 'EVENT_CONGESTION',
    title: 'Annual Mega Gathering at Deekshabhoomi',
    description: 'High-density cultural gathering with over 25,000 expected pilgrims. Surrounding radius closed to private vehicular transit; traffic routed to designated perimeter parking hubs.',
    roadName: 'Deekshabhoomi Perimeter & South Ambazari Road',
    location: { type: 'Point', coordinates: [79.0689, 21.1278] },
    severity: 'HIGH',
    status: 'ACTIVE',
    radius: 800,
    startTime: now,
    endTime: new Date(now.getTime() + 72 * 60 * 60 * 1000),
    eventName: 'Deekshabhoomi Mahotsav',
    expectedVisitors: 25000,
    congestionLevel: 'HIGH',
    createdBy: users[1]._id,
    isSimulation: false
  }
])

// Seed Event Parking Guidance Locations
await Parking.deleteMany({})
await Parking.insertMany([
  {
    parkingId: 'PRK-NGP-01',
    name: 'Deekshabhoomi North Gate Multi-Level Parking',
    location: { type: 'Point', coordinates: [79.0682, 21.1292] },
    address: 'North Gate Entrance, Deekshabhoomi, Nagpur',
    capacity: 500,
    availableSpaces: 124,
    status: 'OPEN',
    nearLandmark: 'Deekshabhoomi'
  },
  {
    parkingId: 'PRK-NGP-02',
    name: 'Laxmi Nagar Ground Event Parking Hub',
    location: { type: 'Point', coordinates: [79.0665, 21.1225] },
    address: 'Municipal Sports Ground, Laxmi Nagar, Nagpur',
    capacity: 300,
    availableSpaces: 78,
    status: 'OPEN',
    nearLandmark: 'Deekshabhoomi / Laxmi Nagar'
  },
  {
    parkingId: 'PRK-NGP-03',
    name: 'Ramdaspeth South Municipal Lot',
    location: { type: 'Point', coordinates: [79.0740, 21.1350] },
    address: 'Central Bazar Road, Ramdaspeth, Nagpur',
    capacity: 250,
    availableSpaces: 42,
    status: 'OPEN',
    nearLandmark: 'Ramdaspeth'
  },
  {
    parkingId: 'PRK-NGP-04',
    name: 'Airport Long-Stay Transit Parking',
    location: { type: 'Point', coordinates: [79.0610, 21.0915] },
    address: 'Terminal Approach Road, Sonegaon, Nagpur',
    capacity: 400,
    availableSpaces: 185,
    status: 'OPEN',
    nearLandmark: 'Airport'
  }
])

console.log('✅ Nagpur Urban Infrastructure & Dynamic Routing Seed data successfully inserted!')
console.log('Credentials:')
console.log('  Citizen: citizen@demo.com / CivicPulse2026!')
console.log('  Authority: authority@demo.com / admin')
console.log('  Admin: admin@demo.com / admin')

await mongoose.disconnect()
