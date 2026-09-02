(() => {
if (window.__argosOneUiBooted) return;
window.__argosOneUiBooted = true;

const app = document.querySelector("#app");
const sheetLayer = document.querySelector("#sheet-layer");
const toast = document.querySelector("#toast");
const scrollCue = document.querySelector("#scroll-cue");
const photoInput = document.querySelector("#photo-input");
const vinCameraInput = document.querySelector("#vin-camera-input");
const dictationDock = document.querySelector("#dictation-dock");
let sheetCloseTimer;
let sheetReturnFocus = null;
let lockedScrollY = null;
let activeDictationButton = null;
let activeDictationTarget = null;
let dictationDockHideTimer;
let activeMediaRecorder = null;
let activeAudioStream = null;
let recordedAudioChunks = [];
let vinDecodeTimer;
let repairAutosaveTimer;
let libraryRepairSearchTimer;
let repairAutosaveInFlight = false;
let animateNextScreen = false;
let pendingMatchCarouselRestore = null;
let lastResearchResult = null;
const photoGestureStates = new WeakMap();
const BUILD_VERSION = window.__ARGOS_BUILD_VERSION__ || "dev-local";
let updateAvailable = false;
let updateCheckInFlight = false;
const assetBase = window.location.pathname.startsWith("/dashboard") ? "/argos-ui" : "";
const isPersistedJobId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""));

const state = {
  route: "home",
  step: 1,
  activeJobId: null,
  selectedJobId: null,
  jobFilter: "all",
  jobSearch: "",
  staffSearch: "",
  librarySearch: "",
  libraryBrand: null,
  libraryProfiles: [],
  libraryStatus: "loading",
  libraryRepairMatches: [],
  libraryRepairQuery: "",
  activeProfile: null,
  activeProfileId: null,
  profileTab: "notes",
  profileStatus: "idle",
  profileNoteDraft: "",
  profileNoteEditDrafts: {},
  profileNoteEditDeleted: new Set(),
  profileVariantFilter: "",
  resolvedReturn: { route: "jobs" },
  currentJobId: null,
  backendStatus: "loading",
  catalog: { makes: [], models: [], variants: [] },
  profile: null,
  shop: null,
  bays: [],
  technicians: [],
  settingsPage: null,
  settingsTrail: [],
  selectedRepair: "primary",
  vehicle: {
    vin: "",
    year: "",
    make: "",
    model: "",
    mileage: "",
    trim: "",
    engine: "",
    drivetrain: "",
    transmission: "",
    registration: "",
    customerName: "",
    customerFirstName: "",
    customerLastName: "",
    customerPhone: "",
    customerEmail: "",
  },
  dtcs: [],
  complaint: "",
  notes: "",
  photos: [],
  savedJourney: {
    route: "repair",
    step: 4,
  },
  workflowUnlockedStep: 4,
  repairReferenceEnabled: true,
  calendar: {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    selectedDay: new Date().getDate(),
  },
  repair: {
    workNotes: "",
    verificationNotes: "",
    system: "",
    parts: [],
    photos: [],
  },
};

let jobRecords = [
  {
    id: "volvo-v60-open",
    status: "open",
    vehicle: { year: "2020", make: "Volvo", model: "V60", mileage: "80,000", vin: "", customerName: "Maria Santos", customerPhone: "" },
    bay: "Bay 03",
    time: "08:42",
    complaint: "Check engine light comes on after 15–20 minutes. Hesitates when accelerating uphill.",
    observations: "Lean condition at idle. Light whistle near intake. Fuel trims rise above +18% when warm.",
    summary: "Check-engine light appears after 15–20 minutes with hesitation uphill. Warm idle is lean with a light whistle near the intake.",
    dtcs: ["P0171"],
    resume: { route: "repair", step: 4 },
  },
  {
    id: "toyota-camry-open",
    status: "open",
    vehicle: { year: "2020", make: "Toyota", model: "Camry", mileage: "61,200", vin: "", customerName: "Jamie Lee", customerPhone: "" },
    bay: "Bay 02",
    time: "08:10",
    complaint: "Rough idle with a slight hesitation when pulling away from a stop.",
    observations: "Idle speed varies when warm; no visible smoke or fluid leaks.",
    summary: "Rough idle when warm with slight hesitation pulling away. Idle speed varies, with no visible smoke or fluid leaks.",
    dtcs: ["P0171"],
    resume: { route: "new", step: 2 },
  },
  {
    id: "ford-f150-open",
    status: "open",
    vehicle: { year: "2018", make: "Ford", model: "F-150", mileage: "134,900", vin: "", customerName: "Noah Williams", customerPhone: "" },
    bay: "Bay 05",
    time: "07:31",
    complaint: "Engine shakes at idle and feels weak at low RPM.",
    observations: "Misfire is most noticeable while stationary after the engine warms up.",
    summary: "Engine shakes at idle and feels weak at low RPM. The misfire becomes more noticeable after the engine warms up.",
    dtcs: ["P0300"],
    resume: { route: "new", step: 2 },
  },
  {
    id: "bmw-x3-open",
    status: "open",
    vehicle: { year: "2017", make: "BMW", model: "X3", mileage: "102,440", vin: "", customerName: "Ava Brown", customerPhone: "" },
    bay: "Bay 04",
    time: "09:05",
    complaint: "Coolant warning returns after longer drives.",
    observations: "Small dried coolant trace visible below expansion tank connection.",
    summary: "Coolant warning returns after longer drives. A small dried coolant trace is visible below the expansion-tank connection.",
    dtcs: [],
    resume: { route: "new", step: 2 },
  },
  {
    id: "honda-civic-resolved",
    status: "resolved",
    vehicle: { year: "2019", make: "Honda", model: "Civic", mileage: "82,400", vin: "19XFC2F59KE031842", customerName: "Priya Nair", customerPhone: "0400 555 014" },
    bay: "Bay 01",
    time: "07:55",
    resolvedAt: "13 Aug 2026 · 07:55",
    technician: "Diego Martins",
    complaint: "Check-engine light was on with no noticeable loss of power.",
    observations: "No exhaust leak found. Rear oxygen-sensor response remained slow after the engine reached operating temperature.",
    summary: "Check-engine light with no noticeable power loss. Rear oxygen-sensor response remained slow after reaching operating temperature.",
    dtcs: ["P0420"],
    repairSummary: "Catalytic-converter efficiency was below specification after oxygen-sensor operation and exhaust integrity were verified.",
    workPerformed: "Checked the exhaust system for leaks and damage, then verified front and rear oxygen-sensor activity at operating temperature. Replaced the catalytic converter and both sealing gaskets, cleared adaptations and completed the manufacturer drive cycle.",
    parts: [
      { name: "Catalytic converter assembly", type: "Part", number: "18160-5BA-A00", quantity: "1" },
      { name: "Exhaust flange gasket", type: "Part", number: "18212-SA7-003", quantity: "2" },
    ],
    verification: "No DTC returned after the full drive cycle. Catalyst monitor completed and tailpipe emissions remained within specification.",
    reference: "2018 Honda Civic · P0420 · verified shop repair",
  },
  {
    id: "subaru-outback-resolved",
    status: "resolved",
    vehicle: { year: "2021", make: "Subaru", model: "Outback", mileage: "54,180", vin: "", customerName: "Olivia Chen", customerPhone: "" },
    bay: "Bay 06",
    time: "11:24",
    resolvedAt: "13 Aug 2026 · 11:24",
    technician: "Diego Martins",
    complaint: "Battery warning appeared intermittently.",
    observations: "Charging voltage dropped under electrical load.",
    summary: "Battery warning appeared intermittently. Charging voltage dropped below specification when electrical load increased.",
    dtcs: [],
    repairSummary: "Alternator output dropped below specification under load.",
    workPerformed: "Load-tested the charging system, replaced the alternator and verified charging voltage under full electrical load.",
    parts: [{ name: "Alternator assembly", type: "Part", number: "23700AA940", quantity: "1" }],
    verification: "Charging voltage remained stable during the final road test.",
    reference: "No previous repair reference used",
  },
  {
    id: "mazda-cx5-resolved",
    status: "resolved",
    vehicle: { year: "2019", make: "Mazda", model: "CX-5", mileage: "76,920", vin: "", customerName: "Ethan Wilson", customerPhone: "" },
    bay: "Bay 02",
    time: "14:18",
    resolvedAt: "13 Aug 2026 · 14:18",
    technician: "Diego Martins",
    complaint: "Front brakes made a grinding sound at low speed.",
    observations: "Inner front pads were below service limit.",
    summary: "Front brakes produced a grinding sound at low speed. The inner front pads were found below the service limit.",
    dtcs: [],
    repairSummary: "Front brake pads were worn through on the inner edges.",
    workPerformed: "Inspected the braking system, replaced the front pads and rotors, then road-tested and rechecked wheel torque.",
    parts: [{ name: "Front brake pad and rotor set", type: "Part", number: "K0Y1-33-28Z", quantity: "1" }],
    verification: "Braking was smooth and quiet during the final road test.",
    reference: "2020 Mazda CX-5 · front brake wear",
  },
];

// Jobs are loaded from the signed-in workshop. Keeping this empty prevents a
// split-second display of old sample data before the API response arrives.
jobRecords = [];

function storedActiveJobId() {
  try { return localStorage.getItem("argos-active-job-id"); } catch (_) { return null; }
}

function rememberActiveJob(id) {
  try {
    if (id) localStorage.setItem("argos-active-job-id", id);
    else localStorage.removeItem("argos-active-job-id");
  } catch (_) {}
}

function shortDate(iso) {
  return new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(iso));
}

function mediumDate(iso) {
  return new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(iso));
}

function jobVehicleName(job) {
  return `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`;
}

function jobSummary(job) {
  return job.complaint || job.summary || job.observations || "";
}

function jobSearchText(job) {
  return [
    jobVehicleName(job),
    job.vehicle.customerName,
  ].filter(Boolean).join(" ").toLowerCase();
}

let repairMatches = [
  {
    id: "primary",
    rank: "01",
    label: "Best match",
    percent: "92",
    evidence: ["Same model", "Same fault code (P0171)"],
    vehicle: "2019 Volvo V60 · P0171",
    trim: "T5 Momentum",
    drivetrain: "FWD",
    engine: "B4204T",
    transmission: "8-speed auto",
    mileageLabel: "78,240 km",
    repairedDateLabel: "14 Mar 2026",
    repairSummary: "PCV system air leak caused by a cracked diaphragm and hardened breather hose. Both components were replaced and the throttle body cleaned.",
    complaint: "Rough idle and check engine light.",
    observations: "Idle fluctuated between 550-900 RPM when cold; smoothed out once warm.",
    dtcs: ["P0171"],
    workPerformed: "Smoke-tested the intake after the engine reached operating temperature. Isolated the leak to the oil filter housing PCV diaphragm and breather elbow. Replaced the diaphragm kit and hardened breather hose, cleaned the throttle body and reset adaptations.",
    verificationNotes: "Road-tested for 18 km and confirmed fuel trims remained below +4%. Idle remained stable after reaching operating temperature.",
    parts: [
      ["PCV diaphragm repair kit", "VOLVO / RKX-027 · QTY 1", "pcv"],
      ["Crankcase breather hose", "VOLVO 31430923 · QTY 1", "hose"],
      ["Throttle body cleaner", "CONSUMABLE · 180 ML", "cleaner"],
    ],
  },
  {
    id: "secondary",
    rank: "02",
    label: "Next closest",
    percent: "76",
    evidence: ["Same engine family"],
    vehicle: "2021 Volvo XC60 · lean idle",
    trim: "B5 Momentum",
    drivetrain: "AWD",
    engine: "B4204T",
    transmission: "8-speed auto",
    mileageLabel: "91,600 km",
    repairedDateLabel: "21 Jun 2026",
    repairSummary: "Intake manifold air leak at the cylinder 1 runner caused by a failed gasket. The complete gasket set was replaced.",
    complaint: "Lean idle and occasional stumble on acceleration.",
    observations: "Fuel trims elevated at idle, normalised above 2,500 RPM.",
    dtcs: [],
    workPerformed: "Verified positive trims at idle and near-normal trims above 2,500 RPM. Smoke-tested the warm engine and isolated the leak at the cylinder 1 runner. Removed the intake manifold and replaced the complete gasket set.",
    verificationNotes: "Reset adaptations, road-tested the vehicle and confirmed fuel trims remained below +5%.",
    parts: [
      ["Intake manifold gasket set", "VOLVO 31375429 · QTY 1", "gasket"],
      ["Throttle body cleaner", "CONSUMABLE · 180 ML", "cleaner"],
    ],
  },
];

function repairMatchPercent(repair) {
  if (state.dtcs.length) return repair.percent;
  return repair.id === "primary" ? "84" : "68";
}

function repairMatchEvidence(repair) {
  if (state.dtcs.length) return repair.evidence;
  return repair.id === "primary" ? ["Same model", "Similar symptoms"] : ["Same engine family", "Similar symptoms"];
}

const icons = {
  home: '<path d="M3 10.8 12 3l9 7.8v9.4a.8.8 0 0 1-.8.8h-5.4v-6.4H9.2V21H3.8a.8.8 0 0 1-.8-.8Z"/><path d="M9.2 21h5.6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V2h6v2M9 10h6M9 15h6"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3Z"/><circle cx="12" cy="13" r="3.5"/>',
  upload: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
  scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/>',
  wrench: '<path d="M14.5 6.5a4.8 4.8 0 0 0-6-3.8l3 3-3.8 3.8-3-3a4.8 4.8 0 0 0 6.3 5.8L19.7 21l1.3-1.3-8.7-8.7a4.8 4.8 0 0 0 2.2-4.5Z"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  save: '<path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L7 20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  more: '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  sparkles: '<path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/><path d="m5 14 .8 1.7 1.7.8-1.7.8L5 19l-.8-1.7-1.7-.8 1.7-.8Z"/>',
  send: '<path d="m3 11 18-8-8 18-2-7Z"/><path d="m11 14 10-11"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5V5.5Z"/><path d="M20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5V5.5Z"/>',
  steeringWheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M12 5.5v4.3M6.9 15.3l3.4-2.1M17.1 15.3l-3.4-2.1"/>',
  car: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/><rect x="3" y="11" width="18" height="6" rx="2"/><circle cx="7.5" cy="17" r="1.6"/><circle cx="16.5" cy="17" r="1.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  externalLink: '<path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/><path d="M14 3h7v7"/><path d="M10 14 21 3"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8 5.5 5.5 0 0 1 10.7-1.8A4.2 4.2 0 0 1 17 18Z"/><path d="M8 21v-1M12 21.5v-1.5M16 21v-1"/>',
  engineWarning: '<path d="M4 15V9h2l2-2h2v2h4V7h2l2 2v6"/><rect x="4" y="15" width="14" height="4" rx="0"/><path d="M20 12v3"/>',
  brakeDisc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6"/><path d="M12 3v3M12 18v3M21 12h-3M6 12H3M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1M18.4 18.4l-2.1-2.1M7.7 7.7 5.6 5.6"/>',
  building: '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 21v-5h4v5M9 8h.01M9 12h.01M13 8h.01M13 12h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M9.5 19a2.5 2.5 0 0 0 5 0"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7Z"/>',
  logout: '<path d="M15 21h4a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-4"/><path d="m8 17-5-5 5-5"/><path d="M3 12h12"/>',
};

const REPAIR_SYSTEM_ICONS = {
  emissions: "cloud",
  ignition: "engineWarning",
  brakes: "brakeDisc",
};

const filledIcons = {
  home: '<path d="M12 2.2 2.5 10v11h6.2v-6.4h6.6V21h6.2V10L12 2.2Z"/>',
  clipboard: '<path fill-rule="evenodd" d="M9 2h6a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2-2Zm0 3v2h6V5H9Zm0 6v2h7v-2H9Zm0 5v2h7v-2H9Z"/>',
  database: '<path d="M3 5c0-2.2 4-4 9-4s9 1.8 9 4-4 4-9 4-9-1.8-9-4Zm0 3.4c2.1 1.6 5.4 2.4 9 2.4s6.9-.8 9-2.4V12c0 2.2-4 4-9 4s-9-1.8-9-4V8.4Zm0 7c2.1 1.6 5.4 2.4 9 2.4s6.9-.8 9-2.4V19c0 2.2-4 4-9 4s-9-1.8-9-4v-3.6Z"/>',
  settings: '<path fill-rule="evenodd" d="M19.4 13a7.7 7.7 0 0 0 0-2l2.1-1.6a.6.6 0 0 0 .1-.8l-2-3.4a.6.6 0 0 0-.7-.3l-2.5 1a8 8 0 0 0-1.7-1L14.4 2a.6.6 0 0 0-.6-.5h-4a.6.6 0 0 0-.6.5L8.8 4.7a8 8 0 0 0-1.7 1l-2.5-1a.6.6 0 0 0-.7.3l-2 3.4a.6.6 0 0 0 .1.8L4.1 11a7.7 7.7 0 0 0 0 2L2 14.6a.6.6 0 0 0-.1.8l2 3.4a.6.6 0 0 0 .7.3l2.5-1a8 8 0 0 0 1.7 1l.4 2.7a.6.6 0 0 0 .6.5h4a.6.6 0 0 0 .6-.5l.4-2.7a8 8 0 0 0 1.7-1l2.5 1a.6.6 0 0 0 .7-.3l2-3.4a.6.6 0 0 0-.1-.8L19.4 13ZM12 8.3a3.7 3.7 0 1 0 0 7.4 3.7 3.7 0 0 0 0-7.4Z"/>',
  plus: '<path d="M10.5 4h3v6.5H20v3h-6.5V20h-3v-6.5H4v-3h6.5V4Z"/>',
  arrow: '<path d="m8 3.5 8.5 8.5L8 20.5V3.5Z"/>',
  down: '<path d="M3.5 7.5h17L12 17 3.5 7.5Z"/>',
  back: '<path d="m14.8 3.2 2.4 2.4-6.4 6.4 6.4 6.4-2.4 2.4L6 12l8.8-8.8Z"/>',
  camera: '<path fill-rule="evenodd" d="M8.2 4h7.6l1.7 2.5H21a2 2 0 0 1 2 2V20H1V8.5a2 2 0 0 1 2-2h3.5L8.2 4ZM12 9a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/>',
  mic: '<path d="M12 2a4 4 0 0 0-4 4v6a4 4 0 1 0 8 0V6a4 4 0 0 0-4-4Z"/><path d="M5 11h2v1a5 5 0 0 0 10 0v-1h2v1a7 7 0 0 1-6 6.9V21h4v2H7v-2h4v-2.1A7 7 0 0 1 5 12v-1Z"/>',
  scan: '<path d="M3 3h7v3H6v4H3V3Zm11 0h7v7h-3V6h-4V3ZM3 14h3v4h4v3H3v-7Zm15 0h3v7h-7v-3h4v-4ZM9 9h6v6H9V9Z"/>',
  search: '<path fill-rule="evenodd" d="M10.5 2.5a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/><path d="m15.4 14 6.7 6.7-1.4 1.4-6.7-6.7 1.4-1.4Z"/>',
  globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM4.3 10h3.1c.2-1.9.7-3.7 1.4-5.1A8 8 0 0 0 4.3 10Zm0 4h3.1c.2 1.9.7 3.7 1.4 5.1A8 8 0 0 1 4.3 14Zm7.7 5.8c-.8-.9-1.8-2.9-2.1-5.8h4.2c-.3 2.9-1.3 4.9-2.1 5.8ZM14.1 10H9.9c.3-2.9 1.3-4.9 2.1-5.8.8.9 1.8 2.9 2.1 5.8Zm1.1 9.1c.7-1.4 1.2-3.2 1.4-5.1h3.1a8 8 0 0 1-4.5 5.1Zm1.4-9c-.2-1.9-.7-3.7-1.4-5.1a8 8 0 0 1 4.5 5.1h-3.1Z"/>',
  wrench: '<path d="M14.6 2.4a6 6 0 0 0-7.2 7.7L2 15.5 8.5 22l5.4-5.4a6 6 0 0 0 7.7-7.2l-4.1 4.1-3-3 4.1-4.1-4-4Z"/>',
  bolt: '<path d="M13.5 1 4 14h7l-1 9 10-14h-7l.5-8Z"/>',
  check: '<path d="m3.5 12.5 3-3 3.2 3.2 7.8-8 3 3L9.7 18.5l-6.2-6Z"/>',
  close: '<path d="m5.1 2.9 6.9 6.9 6.9-6.9 2.2 2.2-6.9 6.9 6.9 6.9-2.2 2.2-6.9-6.9-6.9 6.9-2.2-2.2 6.9-6.9-6.9-6.9 2.2-2.2Z"/>',
  info: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.4 4.3h2.8v2.8h-2.8V6.3Zm0 4.5h2.8v7h-2.8v-7Z"/>',
  save: '<path fill-rule="evenodd" d="M3 2h15l3 3v17H3V2Zm4 2v6h10V4H7Zm1 10v6h8v-6H8Z"/>',
  image: '<path fill-rule="evenodd" d="M2 3h20v18H2V3Zm3 15h14l-4.5-5.5-3.2 3.7-2.1-2.3L5 18Zm3-7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>',
  sun: '<path d="M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM10.5 0h3v4h-3V0Zm0 20h3v4h-3v-4ZM0 10.5h4v3H0v-3Zm20 0h4v3h-4v-3ZM3.5 1.4l2.8 2.8-2.1 2.1-2.8-2.8 2.1-2.1Zm14.2 14.2 2.8 2.8-2.1 2.1-2.8-2.8 2.1-2.1ZM1.4 20.5l2.8-2.8 2.1 2.1-2.8 2.8-2.1-2.1ZM15.6 4.2l2.8-2.8 2.1 2.1-2.8 2.8-2.1-2.1Z"/>',
  moon: '<path d="M20.8 15.1A9 9 0 0 1 8.9 3.2 9.8 9.8 0 1 0 20.8 15Z"/>',
  sparkles: '<path d="m12 1 1.8 5.2L19 8l-5.2 1.8L12 15l-1.8-5.2L5 8l5.2-1.8L12 1Zm7 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM5 14l.9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9L5 14Z"/>',
  send: '<path d="M2 3.5 22 12 2 20.5V14l13-2L2 10V3.5Z"/>',
};

function icon(name, label = "") {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${label ? `aria-label="${label}" role="img"` : 'aria-hidden="true"'}>${icons[name] || ""}</svg>`;
}

const materialIcons = {
  technicians: '<path d="M40-160v-112q0-34 17.5-62.5T104-378q62-31 126-46.5T360-440q66 0 130 15.5T616-378q29 15 46.5 43.5T680-272v112H40Zm720 0v-120q0-44-24.5-84.5T666-434q51 6 96 20.5t84 35.5q36 20 55 44.5t19 53.5v120H760ZM247-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47Zm466 0q-47 47-113 47-11 0-28-2.5t-28-5.5q27-32 41.5-71t14.5-81q0-42-14.5-81T544-792q14-5 28-6.5t28-1.5q66 0 113 47t47 113q0 66-47 113ZM120-240h480v-32q0-11-5.5-20T580-306q-54-27-109-40.5T360-360q-56 0-111 13.5T140-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q440-607 440-640t-23.5-56.5Q393-720 360-720t-56.5 23.5Q280-673 280-640t23.5 56.5Q327-560 360-560t56.5-23.5ZM360-240Zm0-400Z"/>',
  resumeJob: '<path d="M358.5-373.23q-93.81 0-159.48-65.67-65.67-65.67-65.67-159.48 0-16.3 2.27-32.34 2.27-16.05 7.96-31.05 3.37-8.23 9.6-12.83 6.24-4.6 14.11-6.67 7.86-2.08 15.71.14 7.84 2.21 14.27 8.75l106.04 105.46 87.46-86.66-105.38-105.77q-6.41-6.35-8.53-14.38-2.13-8.03-.2-15.76t6.37-13.91q4.43-6.18 12.66-9.71 14.81-6.08 30.8-8.66t31.99-2.58q93.93 0 159.96 66.03 66.02 66.03 66.02 159.94 0 25.26-4.77 47.07t-14.31 42.16l217.08 215.81q24.16 24.27 24.16 59.42 0 35.15-24.33 59.3-24.51 24.35-59.21 23.95-34.69-.41-59.04-24.87L447.88-392.31q-21.15 9.16-43 14.12-21.86 4.96-46.38 4.96Zm-.08-55.96q26.09 0 52.07-8.06 25.97-8.06 47.74-24.17l246.46 246.77q7.43 7.61 18.62 7.71 11.19.1 19.11-7.92 7.93-8.02 7.93-19.12 0-11.1-7.93-19.21L495.65-499.35q16.54-21.07 24.7-46.51 8.15-25.45 8.15-52.52 0-66.54-48.75-118.74-48.75-52.19-123.94-49.77l90.42 90.43q10.35 10.34 10.1 24.09t-10.6 24.17L326.69-511.96q-10.5 10.04-24.17 9.79-13.67-.25-23.71-10.29L191-600.27q-1.46 78.92 50.86 125 52.33 46.08 116.56 46.08Zm110.23-60.62Z"/>',
};

function materialIcon(name, label = "") {
  return `<svg viewBox="0 -960 960 960" fill="currentColor" ${label ? `aria-label="${label}" role="img"` : 'aria-hidden="true"'}>${materialIcons[name] || ""}</svg>`;
}

// The two icon sets draw differently (stroked 24x24 vs filled Material), so
// callers that just name an icon get whichever set defines it.
function anyIcon(name, label = "") {
  return materialIcons[name] ? materialIcon(name, label) : icon(name, label);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...options, headers });
  let payload = {};
  try { payload = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function relatedRecord(value) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function stageResume(stage) {
  if (stage === "repair") return { route: "repair", step: 4 };
  if (stage === "similar_repairs") return { route: "new", step: 3 };
  if (stage === "assessment") return { route: "new", step: 2 };
  return { route: "new", step: 1 };
}

function splitCustomerName(fullName = "") {
  const pieces = String(fullName).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: pieces.shift() || "",
    lastName: pieces.join(" "),
  };
}

function customerFullName(vehicle = state.vehicle) {
  const fullName = [vehicle.customerFirstName, vehicle.customerLastName].filter(Boolean).join(" ").trim();
  return fullName || String(vehicle.customerName || "").trim();
}

function databaseJobToUi(row) {
  const vehicle = relatedRecord(row.vehicle) || {};
  const customer = relatedRecord(row.customer) || {};
  const repair = relatedRecord(row.repair) || {};
  const dtcs = (row.dtcs || []).map((entry) => typeof entry === "string" ? entry : entry.code).filter(Boolean);
  const repairedItems = (repair.items || []).map((item) => ({
    name: item.name, type: item.kind === "consumable" ? "Consumable" : "Part", number: item.part_number || "",
    quantity: String(item.quantity || 1), supplier: item.supplier || "", price: item.price_amount == null ? "" : `${item.currency || "AUD"} ${Number(item.price_amount).toFixed(2)}`,
    offerUrl: item.offer_url || "", offerImageUrl: item.offer_image_url || "",
  }));
  const timestamp = row.resolved_at || row.updated_at || row.created_at;
  const name = customer.full_name || "Unknown customer";
  const { firstName, lastName } = splitCustomerName(name);
  return {
    id: row.id,
    jobNumber: row.job_number || "",
    status: row.status === "cancelled" ? "deleted" : row.status === "resolved" ? "resolved" : "open",
    vehicle: {
      year: String(vehicle.year || ""), make: vehicle.make || "", model: vehicle.model || "", mileage: Number(vehicle.mileage || 0).toLocaleString("en-AU"),
      vin: vehicle.vin || "", customerName: name, customerFirstName: firstName, customerLastName: lastName,
      customerPhone: customer.phone || "", customerEmail: customer.email || "",
      trim: vehicle.trim || "", engine: vehicle.engine || "", drivetrain: vehicle.drivetrain || "", transmission: vehicle.transmission || "",
    },
    bay: row.bay || "Unassigned",
    time: timestamp ? new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(timestamp)) : "",
    createdAtShort: row.created_at ? shortDate(row.created_at) : "",
    resolvedAtShort: row.resolved_at ? shortDate(row.resolved_at) : "",
    updatedAtShort: row.updated_at ? shortDate(row.updated_at) : "",
    resolvedAt: row.resolved_at ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.resolved_at)) : "",
    updatedAt: row.updated_at ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(row.updated_at)) : "",
    assignedTo: row.assigned_to || null,
    assigneeName: relatedRecord(row.assignee)?.full_name || null,
    technician: relatedRecord(row.assignee)?.full_name || "Unassigned",
    complaint: row.complaint || "",
    observations: row.observations || "",
    summary: row.summary || "",
    dtcs,
    resume: stageResume(row.stage),
    repairSummary: repair.cause || "",
    workPerformed: repair.work_performed || "",
    system: repair.system || "",
    parts: repairedItems,
    verification: repair.verification_notes || "No verification notes recorded.",
    referenceJobId: relatedRecord(repair.reference)?.job_id || null,
    raw: row,
  };
}

function databaseMatchToUi(row, index) {
  const items = (row.items || []).map((item) => [
    item.name,
    `${item.kind === "consumable" ? "CONSUMABLE" : item.brand || "PART"}${item.part_number ? ` ${item.part_number}` : ""} · QTY ${item.quantity || 1}`,
    item.id,
  ]);
  return {
    id: row.repair_id,
    rank: String(index + 1).padStart(2, "0"),
    label: index === 0 ? "Best match" : "Next closest",
    percent: String(Math.min(99, Math.max(1, row.score || 1))),
    evidence: row.evidence && row.evidence.length ? row.evidence : ["Related workshop repair"],
    vehicle: row.vehicle_label || "Previous workshop repair",
    trim: row.vehicle_trim || "",
    drivetrain: row.vehicle_drivetrain || "",
    engine: row.vehicle_engine || "",
    transmission: row.vehicle_transmission || "",
    mileageLabel: row.vehicle_mileage ? formatKilometres(row.vehicle_mileage) : "",
    repairedDateLabel: row.repaired_at ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(row.repaired_at)) : "",
    repairSummary: row.cause || "",
    complaint: row.complaint || "",
    observations: row.observations || "",
    dtcs: row.dtcs || [],
    workPerformed: row.work_performed || "",
    verificationNotes: row.verification_notes || "",
    parts: items,
  };
}

async function loadCatalogModels(make = state.vehicle.make) {
  if (!make) {
    state.catalog.models = [];
    state.catalog.variants = [];
    return;
  }
  try {
    const { models } = await apiRequest(`/api/catalog?make=${encodeURIComponent(make)}`);
    state.catalog.models = Array.isArray(models) ? models : [];
  } catch (_) {
    state.catalog.models = [];
  }
}

async function loadCatalogVariants(make = state.vehicle.make, model = state.vehicle.model) {
  if (!make || !model) {
    state.catalog.variants = [];
    return;
  }
  try {
    const { variants } = await apiRequest(`/api/catalog?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}`);
    state.catalog.variants = Array.isArray(variants) ? variants : [];
  } catch (_) {
    state.catalog.variants = [];
  }
}

// Distinct catalogue values for a spec field, narrowed to the selected trim.
// e.g. a trim offered as manual OR automatic returns two transmission options.
function specOptions(field) {
  const trim = state.vehicle.trim;
  const rows = trim
    ? state.catalog.variants.filter((item) => item.name === trim)
    : state.catalog.variants;
  const seen = [];
  rows.forEach((item) => {
    const value = item[field];
    if (value && !seen.includes(value)) seen.push(value);
  });
  return seen;
}

// Renders a spec field that adapts to how many options the catalogue offers for
// the selected trim: several → dropdown with a chevron (mechanic picks, e.g.
// 4-speed auto vs 5-speed manual); one → auto-filled entry; none → free entry,
// or the provided fallback dropdown (used for drivetrain so FWD/RWD/AWD/4WD
// stays pickable when the catalogue has nothing).
function specFieldHtml(field, label, placeholder, fallbackOptions) {
  const value = state.vehicle[field] || "";
  const options = specOptions(field);
  const asSelect = (opts) =>
    `<label class="form-field"><div class="field-header"><span class="field-label">${label}</span></div><span class="select-control"><select class="select${value ? "" : " is-placeholder"}" name="${field}" required aria-label="${label}"><option value=""${value ? "" : " selected"}></option>${opts.map((option) => `<option${value === option ? " selected" : ""}>${escapeHTML(option)}</option>`).join("")}</select>${icon("down")}</span></label>`;
  if (options.length > 1) return asSelect(options);
  if (options.length === 0 && fallbackOptions && fallbackOptions.length) return asSelect(fallbackOptions);
  return `<label class="form-field"><div class="field-header"><span class="field-label">${label}</span></div><input class="input" name="${field}" value="${escapeHTML(value)}" placeholder="${placeholder}" required /></label>`;
}

async function loadBackendData() {
  try {
    const { makes } = await apiRequest("/api/catalog");
    state.catalog.makes = Array.isArray(makes) ? makes : [];
    await loadCatalogModels();
    await loadCatalogVariants();
  } catch (_) {}
  try {
    await apiRequest("/api/demo-jobs", { method: "POST" });
    const [{ jobs }, account] = await Promise.all([apiRequest("/api/jobs"), apiRequest("/api/me")]);
    state.profile = account.profile || null;
    state.shop = account.shop ? { ...account.shop, sharesRepairData: Boolean(account.shop.shares_repair_data), networkReadExempt: Boolean(account.shop.network_read_exempt) } : null;
    const profileInitials = state.profile?.full_name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const profileLabel = document.querySelector(".profile-button span");
    if (profileInitials && profileLabel) profileLabel.textContent = profileInitials;
    const loadedJobs = (jobs || []).map(databaseJobToUi);
    jobRecords = loadedJobs;
    const rememberedJob = loadedJobs.find((job) => job.id === storedActiveJobId() && job.status === "open");
    state.activeJobId = rememberedJob?.id || null;
    state.currentJobId = rememberedJob?.id || null;
    state.backendStatus = "connected";
    await Promise.all([loadWorkshopRoster(), loadLibraryProfiles()]);
  } catch (error) {
    state.backendStatus = error.status === 401 ? "signed-out" : "offline";
  }
  render();
}

function vehiclePayload() {
  return {
    customer: {
      fullName: customerFullName(),
      phone: state.vehicle.customerPhone || null,
      email: state.vehicle.customerEmail || null,
    },
    vehicle: {
      vin: state.vehicle.vin || null,
      year: Number(state.vehicle.year), make: state.vehicle.make, model: state.vehicle.model,
      mileage: Number(String(state.vehicle.mileage).replace(/[^0-9]/g, "")) || 0,
      trim: state.vehicle.trim || null,
      engine: state.vehicle.engine || null,
      drivetrain: state.vehicle.drivetrain || null,
      transmission: state.vehicle.transmission || null,
    },
    // A new job lands in the shop's default bay when one is configured under
    // Settings -> Profile & management -> Job defaults.
    bay: defaultBayName(),
  };
}

// The roster backs both the Workshop profile screens and the default bay a new
// job is filed into, so it loads with the rest of the account rather than only
// when Settings is opened.
async function loadWorkshopRoster() {
  try {
    const [{ bays }, { technicians }] = await Promise.all([
      apiRequest("/api/shop/bays"),
      apiRequest("/api/shop/technicians"),
    ]);
    state.bays = bays || [];
    state.technicians = technicians || [];
  } catch (_) {
    state.bays = [];
    state.technicians = [];
  }
}

// The signed-in login's roster record, when it has one. profiles are logins
// and shop_technicians is the crew roster, so a login only resolves to a
// technician once someone has linked or added them on the roster.
function currentTechnician() {
  if (!state.profile) return null;
  return state.technicians.find((technician) => technician.profile_id === state.profile.id) || null;
}

// Every job on the floor is visible to everyone, but only the technician a
// job is assigned to (or an owner/manager, who can edit anything) may change
// it. A job still being drafted (never saved) has no assignment yet, so it's
// always editable by whoever is creating it.
function canEditJob(job) {
  if (!job || !isPersistedJobId(job.id)) return true;
  if (state.profile?.role !== "technician") return true;
  return job.assignedTo === state.profile?.id;
}

function currentJobRecord() {
  return jobRecords.find((record) => String(record.id) === String(state.currentJobId)) || null;
}

function canEditCurrentJob() {
  return canEditJob(currentJobRecord());
}

// Hides every control that would let a read-only viewer change a job:
// text inputs (also stops mobile keyboards opening on tap), the workflow's
// save/continue docks, dictate/enhance, DTC and photo add/remove, and the
// parts editor. Deliberately narrower than ".field-actions" -- that class
// also wraps the already-recorded DTC chips, which a read-only viewer should
// still be able to see. Read-only affordances (photo viewing, journey nav,
// "show original") are untouched since they don't mutate anything.
const LOCKED_JOB_HIDE_SELECTORS = [
  ".action-dock", ".dictate-button", ".enhance-button", ".photo-actions",
  ".catalog-action-row", ".vin-camera", ".add-dtc-button", ".dtc-chip-remove",
  ".add-parts-button", ".recorded-part-actions", ".result-actions",
];
function lockWorkflowForm() {
  const scope = app.querySelector(".workflow-shell");
  if (!scope) return;
  scope.querySelectorAll("input, select, textarea").forEach((el) => { el.disabled = true; });
  scope.querySelectorAll(LOCKED_JOB_HIDE_SELECTORS.join(", ")).forEach((el) => { el.hidden = true; });
}

// Shown under the journey nav on every workflow step so it's clear who owns
// the job. The reassign action follows the same rule as edit access: the
// assigned technician (handing off their own job) or an owner/manager.
function assignmentBar() {
  const job = currentJobRecord();
  if (!job || !isPersistedJobId(job.id)) return "";
  const editable = canEditJob(job);
  const assigneeName = job.assigneeName || "Unassigned";
  return `<div class="assignment-bar${editable ? "" : " is-locked"}">
    <span class="assignment-bar-label">${editable ? "" : icon("lock")}<span>Assigned to <strong>${escapeHTML(assigneeName)}</strong></span></span>
    ${editable ? `<button class="text-button assignment-reassign-button" type="button" data-action="reassign-job">Reassign</button>` : ""}
  </div>`;
}

// Shown wherever the app states which bay the signed-in technician works from.
// Says so plainly when nothing is assigned rather than implying a bay.
function assignedBayLabel() {
  const bayId = currentTechnician()?.default_bay_id;
  if (!bayId) return "No bay assigned";
  return state.bays.find((bay) => bay.id === bayId)?.name || "No bay assigned";
}

function defaultBayName() {
  const bayId = state.shop?.default_bay_id;
  if (!bayId) return null;
  return state.bays.find((bay) => bay.id === bayId)?.name || null;
}

async function persistVehicleDetails() {
  const persistedJobId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.currentJobId || "")
    ? state.currentJobId
    : null;
  const path = persistedJobId ? `/api/jobs/${persistedJobId}` : "/api/jobs";
  const method = persistedJobId ? "PATCH" : "POST";
  const { job } = await apiRequest(path, { method, body: JSON.stringify(vehiclePayload()) });
  state.currentJobId = job.id;
  state.activeJobId = job.id;
  rememberActiveJob(job.id);
  const mapped = databaseJobToUi(job);
  const existingIndex = jobRecords.findIndex((record) => record.id === job.id);
  if (existingIndex >= 0) jobRecords[existingIndex] = mapped;
  else jobRecords.unshift(mapped);
  return mapped;
}

async function persistAssessment(nextStage) {
  const complaint = String(state.complaint || "").trim();
  if (!complaint) throw new Error("Enter the symptoms to continue.");
  if (!state.currentJobId) await persistVehicleDetails();
  const { job } = await apiRequest(`/api/jobs/${state.currentJobId}/assessment`, {
    method: "PUT",
    body: JSON.stringify({
      complaint,
      observations: state.notes || null,
      dtcs: state.dtcs.map((code) => typeof code === "string" ? code : code?.code).filter(Boolean).map((code) => String(code).trim().toUpperCase()),
      nextStage,
    }),
  });
  const mapped = databaseJobToUi(job);
  const index = jobRecords.findIndex((record) => record.id === mapped.id);
  if (index >= 0) jobRecords[index] = mapped;
  return mapped;
}

async function loadRepairMatches() {
  if (!state.currentJobId) return;
  const { matches } = await apiRequest(`/api/jobs/${state.currentJobId}/matches`);
  if (matches?.length) {
    repairMatches = matches.map(databaseMatchToUi);
    state.selectedRepair = repairMatches[0].id;
  }
}

async function loadJobPhotos(jobId) {
  if (!jobId) return;
  try {
    const { photos } = await apiRequest(`/api/jobs/${jobId}/photos`);
    state.photos = (photos || []).filter((photo) => photo.kind === "arrival");
    state.repair.photos = (photos || []).filter((photo) => photo.kind === "repair" || photo.kind === "verification");
    render();
  } catch (error) {
    if (error.status !== 401) showToast("Saved photos could not be loaded.");
  }
}

function repairPayload(resolve = false) {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair);
  return {
    workPerformed: state.repair.workNotes,
    verificationNotes: state.repair.verificationNotes || null,
    system: state.repair.system || null,
    dtcs: state.dtcs,
    referenceRepairId: selected && /^[0-9a-f-]{36}$/i.test(selected.id) ? selected.id : null,
    items: state.repair.parts.map((part) => ({
      kind: part.type === "Consumable" ? "consumable" : "part", name: part.name, partNumber: part.number || null,
      quantity: Number(part.quantity || 1), supplier: part.supplier || null,
      priceAmount: part.price ? Number(String(part.price).replace(/[^0-9.]/g, "")) || null : null, currency: "AUD",
      offerUrl: part.offerUrl || null, offerImageUrl: part.offerImageUrl || null,
    })),
    resolve,
  };
}

async function persistRepair(resolve = false) {
  if (!state.currentJobId) await persistVehicleDetails();
  const { job } = await apiRequest(`/api/jobs/${state.currentJobId}/repair`, { method: "PUT", body: JSON.stringify(repairPayload(resolve)) });
  const mapped = databaseJobToUi(job);
  const index = jobRecords.findIndex((record) => record.id === mapped.id);
  if (index >= 0) jobRecords[index] = mapped;
  return mapped;
}

function queueRepairAutosave(delay = 900) {
  if (!state.currentJobId || state.route !== "repair") return;
  clearTimeout(repairAutosaveTimer);
  repairAutosaveTimer = window.setTimeout(async () => {
    if (repairAutosaveInFlight) return queueRepairAutosave(500);
    repairAutosaveInFlight = true;
    try {
      await persistRepair(false);
    } catch (error) {
      showToast(error.status === 401 ? "Sign in to save this repair draft." : "Repair draft could not be saved.");
    } finally {
      repairAutosaveInFlight = false;
    }
  }, delay);
}

function syncTextFieldState(target) {
  if (target.id === "complaint") state.complaint = target.value;
  if (target.id === "notes") state.notes = target.value;
  if (target.id === "repair-notes") state.repair.workNotes = target.value;
  if (target.id === "repair-verification") state.repair.verificationNotes = target.value;
  if (target.id === "repair-notes" || target.id === "repair-verification") queueRepairAutosave();
}

function enhanceWorkshopText(value) {
  const cleaned = String(value)
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1");
  const sentenceCase = cleaned.replace(/(^|[.!?]\s+)([a-z])/g, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
  return /[.!?]$/.test(sentenceCase) ? sentenceCase : `${sentenceCase}.`;
}

async function startDictation(button, target) {
  clearTimeout(dictationDockHideTimer);
  if (activeDictationButton && activeDictationButton !== button) {
    await finishDictation();
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    return showToast("Voice recording is not supported in this browser.");
  }
  try {
    activeAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
    activeMediaRecorder = preferredType
      ? new MediaRecorder(activeAudioStream, { mimeType: preferredType })
      : new MediaRecorder(activeAudioStream);
    recordedAudioChunks = [];
    activeMediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) recordedAudioChunks.push(event.data);
    });
    activeDictationButton = button;
    activeDictationTarget = target;
    button.classList.add("is-listening");
    button.setAttribute("aria-pressed", "true");
    button.innerHTML = `${icon("mic")} Listening…`;
    dictationDock.hidden = false;
    document.body.classList.add("dictation-active");
    requestAnimationFrame(() => dictationDock.classList.add("is-active"));
    activeMediaRecorder.start();
    showToast("Listening… Press Send or Dictate again to transcribe.");
  } catch (error) {
    activeAudioStream?.getTracks().forEach((track) => track.stop());
    activeAudioStream = null;
    activeMediaRecorder = null;
    showToast(error?.name === "NotAllowedError" ? "Microphone permission is required for dictation." : "Could not start voice recording.");
  }
}

async function finishDictation() {
  if (!activeDictationButton || !activeDictationTarget) return;
  const completedButton = activeDictationButton;
  const completedTarget = activeDictationTarget;
  const recorder = activeMediaRecorder;
  completedButton.innerHTML = `${icon("mic")} Transcribing…`;
  completedButton.classList.remove("is-listening");
  dictationDock.classList.remove("is-active");
  document.body.classList.remove("dictation-active");
  try {
    if (!recorder) throw new Error("No active recording");
    if (recorder.state !== "inactive") {
      await new Promise((resolve) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.stop();
      });
    }
    const mimeType = recorder.mimeType || recordedAudioChunks[0]?.type || "audio/webm";
    const extension = mimeType.includes("mp4") ? "m4a" : "webm";
    const audioFile = new File(recordedAudioChunks, `dictation.${extension}`, { type: mimeType });
    const formData = new FormData();
    formData.append("file", audioFile);
    const response = await fetch("/api/transcribe", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Transcription failed");
    const transcript = String(result.text || "").trim();
    if (!transcript) throw new Error("No speech was detected");
    completedTarget.value = [completedTarget.value.trim(), transcript].filter(Boolean).join(" ");
    if (completedTarget.id === "complaint") state.complaint = completedTarget.value;
    if (completedTarget.id === "notes") state.notes = completedTarget.value;
    if (completedTarget.id === "repair-notes") state.repair.workNotes = completedTarget.value;
    if (completedTarget.id === "repair-verification") state.repair.verificationNotes = completedTarget.value;
    showToast("Transcript added — press Dictate to record more.");
  } catch (error) {
    showToast(error?.message || "Voice transcription failed. Please try again.");
  } finally {
    activeAudioStream?.getTracks().forEach((track) => track.stop());
    activeAudioStream = null;
    activeMediaRecorder = null;
    recordedAudioChunks = [];
  }
  completedButton.classList.remove("is-listening");
  completedButton.setAttribute("aria-pressed", "false");
  completedButton.innerHTML = `${icon("mic")} Dictate`;
  completedButton.blur();
  activeDictationButton = null;
  activeDictationTarget = null;
  dictationDock.classList.remove("is-active");
  document.body.classList.remove("dictation-active");
  dictationDockHideTimer = setTimeout(() => { dictationDock.hidden = true; }, 180);
}

function cancelDictation() {
  const cancelledButton = activeDictationButton;
  const recorder = activeMediaRecorder;
  if (recorder && recorder.state !== "inactive") recorder.stop();
  activeAudioStream?.getTracks().forEach((track) => track.stop());
  activeAudioStream = null;
  activeMediaRecorder = null;
  recordedAudioChunks = [];
  if (cancelledButton) {
    cancelledButton.classList.remove("is-listening");
    cancelledButton.setAttribute("aria-pressed", "false");
    cancelledButton.innerHTML = `${icon("mic")} Dictate`;
    cancelledButton.blur();
  }
  activeDictationButton = null;
  activeDictationTarget = null;
  dictationDock.classList.remove("is-active");
  document.body.classList.remove("dictation-active");
  clearTimeout(dictationDockHideTimer);
  dictationDockHideTimer = setTimeout(() => { dictationDock.hidden = true; }, 180);
  showToast("Dictation cancelled.");
}

function preferredTheme() {
  try {
    const saved = localStorage.getItem("argos-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch (_) {}
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme, persist = true) {
  document.documentElement.dataset.theme = theme;
  const toggle = document.querySelector("#theme-toggle");
  const nextTheme = theme === "dark" ? "light" : "dark";
  if (toggle) {
    toggle.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    toggle.setAttribute("aria-pressed", String(theme === "light"));
    const iconSlot = toggle.querySelector("[data-theme-icon]");
    if (iconSlot) iconSlot.innerHTML = icon(theme === "dark" ? "sun" : "moon");
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#090909");
  if (persist) {
    try { localStorage.setItem("argos-theme", theme); } catch (_) {}
  }
}

const KM_PER_MILE = 1.609344;

function unitSystem() {
  try {
    const saved = localStorage.getItem("argos-units");
    if (saved === "imperial" || saved === "metric") return saved;
  } catch (_) {}
  return "metric";
}

function setUnitSystem(system) {
  try { localStorage.setItem("argos-units", system); } catch (_) {}
}

function resetJobDraft() {
  [...state.photos, ...state.repair.photos].forEach((photo) => {
    if (typeof photo === "string" || photo?.local) URL.revokeObjectURL(photoUrl(photo));
  });
  state.step = 1;
  state.workflowUnlockedStep = 1;
  state.currentJobId = null;
  state.vehicle = {
    vin: "", year: "", make: "", model: "", mileage: "", customerName: "",
    customerFirstName: "", customerLastName: "", customerPhone: "", customerEmail: "",
  };
  state.complaint = "";
  state.notes = "";
  state.dtcs = [];
  state.photos = [];
  state.repair = { workNotes: "", verificationNotes: "", system: "", parts: [], photos: [] };
  state.catalog.models = [];
}

function hydrateIcons(scope = document) {
  scope.querySelectorAll("[data-icon]").forEach((node) => {
    node.innerHTML = icon(node.dataset.icon);
  });
}

function setRoute(route) {
  state.route = route;
  if (route === "new") {
    resetJobDraft();
  }
  if (route === "settings") {
    state.settingsPage = null;
    state.settingsTrail = [];
  }
  animateNextScreen = true;
  updateNavigation();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNavigation() {
  document.querySelectorAll(".nav-item, .nav-new").forEach((item) => {
    const isActive = item.dataset.route === state.route
      || (item.dataset.route === "new" && state.route === "repair")
      || (item.dataset.route === "jobs" && state.route === "resolved" && state.resolvedReturn.route === "jobs")
      || (item.dataset.route === "knowledge" && (state.route === "car-profile" || (state.route === "resolved" && state.resolvedReturn.route === "car-profile")));
    item.classList.toggle("is-active", isActive);
  });
}

function updateNavUpdateBadge() {
  const settingsNavItem = document.querySelector('.nav-item[data-route="settings"]');
  if (settingsNavItem) settingsNavItem.classList.toggle("has-update", updateAvailable);
}

// Compares the commit baked into this loaded bundle against a live check --
// a stale open tab/installed PWA never re-fetches app.js on its own, so this
// is the only way it learns a newer deploy exists.
function checkForUpdate() {
  if (updateCheckInFlight) return;
  updateCheckInFlight = true;
  // A hung request (flaky workshop wifi) must not wedge this flag forever --
  // that would silently kill every future check (interval, focus, tab
  // switch) until the next full reload. Bound it so a stalled fetch always
  // releases the flag within a few seconds.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  fetch("/api/version", { cache: "no-store", signal: controller.signal })
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      const wasAvailable = updateAvailable;
      updateAvailable = Boolean(data && data.version && data.version !== BUILD_VERSION);
      updateNavUpdateBadge();
      if (updateAvailable !== wasAvailable && state.route === "settings") renderSettings();
    })
    .catch(() => {})
    .finally(() => { clearTimeout(timeout); updateCheckInFlight = false; });
}

// A bare location.reload() is near-instant and easy to miss entirely --
// this makes the update feel deliberate: a full-screen overlay with a
// progress bar that fills, switches to a completion message, then reloads.
function showUpdateOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "update-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `<div class="update-overlay-content">
    <div class="update-overlay-bar"><div class="update-overlay-bar-fill"></div></div>
    <p class="update-overlay-message">Updating Argos One&hellip;</p>
  </div>`;
  document.body.appendChild(overlay);
  const fill = overlay.querySelector(".update-overlay-bar-fill");
  const message = overlay.querySelector(".update-overlay-message");
  requestAnimationFrame(() => {
    overlay.classList.add("is-visible");
    requestAnimationFrame(() => { fill.style.width = "100%"; });
  });
  setTimeout(() => { message.textContent = "Update complete"; }, 2400);
  setTimeout(() => { window.location.reload(); }, 3400);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function showTopProgressBar({ blocking = false } = {}) {
  if (!document.querySelector(".top-progress-bar")) {
    const bar = document.createElement("div");
    bar.className = "top-progress-bar";
    document.body.appendChild(bar);
  }
  if (blocking && !document.querySelector(".transition-block-overlay")) {
    const overlay = document.createElement("div");
    overlay.className = "transition-block-overlay";
    document.body.appendChild(overlay);
  }
}

function hideTopProgressBar() {
  document.querySelector(".top-progress-bar")?.remove();
  document.querySelector(".transition-block-overlay")?.remove();
}

function setButtonLoading(button, label) {
  if (!button || button.dataset.loading === "true") return;
  button.dataset.loading = "true";
  button.dataset.originalHtml = button.innerHTML;
  button.disabled = true;
  button.innerHTML = `<span class="button-spinner" aria-hidden="true"></span><span>${label}</span>`;
}

function resetButtonLoading(button) {
  if (!button || button.dataset.loading !== "true") return;
  button.disabled = false;
  button.innerHTML = button.dataset.originalHtml;
  delete button.dataset.loading;
  delete button.dataset.originalHtml;
}

function updateScrollCue() {
  if (!scrollCue) return;
  const remaining = document.documentElement.scrollHeight - (window.scrollY + window.innerHeight);
  const terminalActions = app.querySelector(".action-dock, .result-actions");
  const terminalActionsVisible = terminalActions
    ? terminalActions.getBoundingClientRect().top < window.innerHeight - 72
    : false;
  const hasMoreContent = remaining > 72 && !terminalActionsVisible;
  scrollCue.classList.toggle("is-visible", hasMoreContent);
  scrollCue.setAttribute("aria-hidden", String(!hasMoreContent));
  scrollCue.tabIndex = hasMoreContent ? 0 : -1;
}

function updateStickyJourney() {
  const journey = app.querySelector(".journey-nav");
  if (!journey) return;
  const topbar = document.querySelector(".topbar");
  const stickyTop = topbar?.getBoundingClientRect().height || 68;
  journey.classList.toggle("is-stuck", window.scrollY > 0 && journey.getBoundingClientRect().top <= stickyTop + 1);
}

function scrollJourneyIntoView() {
  const journey = app.querySelector(".journey-nav");
  if (!journey) return;
  const current = journey.querySelector(".journey-item.is-current");
  if (!current) return;
  const currentStep = Number(current.dataset.journeyStep);
  if (currentStep <= 1) journey.scrollLeft = 0;
  else if (currentStep === 2) journey.scrollLeft = current.offsetLeft;
  else journey.scrollLeft = current.offsetLeft + current.offsetWidth - journey.clientWidth;
}

function scrollToNextView() {
  const documentHeight = document.documentElement.scrollHeight;
  const maximumScroll = Math.max(0, documentHeight - window.innerHeight);
  const step = Math.max(320, Math.round(window.innerHeight * 0.72));
  window.scrollTo({ top: Math.min(window.scrollY + step, maximumScroll), behavior: "smooth" });
}

function taskHeader({ context, title, backAction = "", backLabel = "Go back", status = "", statusType = "saved", deleteAction = "" }) {
  return `<header class="task-header${backAction ? " has-back" : ""}">
    ${backAction ? `<button class="task-back" type="button" data-action="${backAction}" aria-label="${backLabel}">${icon("back")}</button>` : ""}
    <div class="task-header-copy${context ? "" : " is-title-only"}"><h1>${title}</h1>${context ? `<span class="task-context">${context}</span>` : ""}</div>
    ${status ? `<span class="task-status is-${statusType}">${statusType === "saved" ? '<span class="task-status-dot" aria-hidden="true"></span>' : ""}${status}</span>` : ""}
    ${deleteAction ? `<button class="icon-button" type="button" data-action="${deleteAction}" aria-label="Delete this job">${icon("trash")}</button>` : ""}
  </header>`;
}

function workflowJourney(currentStep) {
  const stages = [
    [1, "Vehicle"],
    [2, "Assessment"],
    [3, "Similar repairs"],
    [4, "Repair"],
  ];
  const unlockedStep = Math.max(currentStep, state.workflowUnlockedStep || 1);
  return `<nav class="journey-nav" aria-label="Job progress">${stages.map(([step, label]) => {
    const isSkipped = step === 3 && unlockedStep >= 4 && !state.repairReferenceEnabled;
    const isComplete = step < unlockedStep && !isSkipped;
    if (step === currentStep) return `<span class="journey-item is-current${isComplete ? " is-complete" : ""}" data-journey-step="${step}" aria-current="step">${isComplete ? icon("check") : ""}<span>${label}</span></span>`;
    if (isSkipped) return `<button class="journey-item is-skipped" type="button" data-journey-step="3" aria-label="Similar repairs skipped; open this stage"><span>${label}</span></button>`;
    if (step <= unlockedStep) {
      return `<button class="journey-item ${isComplete ? "is-complete" : "is-available"}" type="button" data-journey-step="${step}">${isComplete ? icon("check") : ""}<span>${label}</span></button>`;
    }
    return `<span class="journey-item is-upcoming" aria-disabled="true"><span>${label}</span></span>`;
  }).join("")}</nav>`;
}

function vehicleTaskHeader() {
  return taskHeader({ context: "New job", title: "Vehicle details", deleteAction: canEditCurrentJob() ? "delete-job" : "" });
}

function problemTaskHeader() {
  return taskHeader({
    context: vehicleMoustache(),
    title: vehicleName(),
    deleteAction: canEditCurrentJob() ? "delete-job" : "",
  });
}

function vehicleName() {
  return `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
}

function vehicleMoustache() {
  const specs = [state.vehicle.trim, state.vehicle.drivetrain, state.vehicle.engine, state.vehicle.transmission, formatMileageDisplay(state.vehicle.mileage)].filter(Boolean).join(" · ");
  return specs ? `<span>${specs}</span>` : "";
}

function resultsTaskHeader() {
  return taskHeader({
    context: vehicleMoustache(),
    title: vehicleName(),
    deleteAction: canEditCurrentJob() ? "delete-job" : "",
  });
}

function repairRecordHeader() {
  return taskHeader({
    context: vehicleMoustache(),
    title: vehicleName(),
    deleteAction: canEditCurrentJob() ? "delete-job" : "",
  });
}

function renderHome() {
  const openJobs = jobRecords.filter((job) => job.status === "open");
  const resolvedJobs = jobRecords.filter((job) => job.status === "resolved");
  const allJobsCount = jobRecords.length;
  const activeJob = jobRecords.find((job) => job.id === state.activeJobId && job.status === "open");
  const repairLibraryCount = state.libraryProfiles.length;
  const resumeTitle = "Resume job";
  const resumeTile = activeJob
    ? `<button type="button" class="control-tile" data-action="open-job" data-job-id="${activeJob.id}" aria-label="${resumeTitle} for ${jobVehicleName(activeJob)}">
        <span class="tile-copy"><strong>${resumeTitle}</strong><small>${jobVehicleName(activeJob)}</small></span>
        <span class="tile-icon">${materialIcon("resumeJob")}</span>
      </button>`
    : `<button type="button" class="control-tile" data-route="new" aria-label="Start a new job">
        <span class="tile-copy"><strong>No active job</strong><small>Ready for the next vehicle</small></span>
        <span class="tile-icon">${materialIcon("resumeJob")}</span>
      </button>`;
  app.innerHTML = `<section class="screen dashboard-shell">
    <div class="home-status-block">
      <div class="home-kicker"><span>${escapeHTML(assignedBayLabel())}</span></div>
      <div class="home-metrics" aria-label="Today's workshop status">
        <div class="home-metric"><strong>${String(openJobs.length).padStart(2, "0")}</strong><span>Open jobs</span></div>
        <div class="home-metric"><strong>${String(resolvedJobs.length).padStart(2, "0")}</strong><span>Resolved today</span></div>
        <div class="home-metric secondary"><strong>1.8<small>h</small></strong><span>Average diagnosis</span></div>
      </div>
    </div>

    <div class="control-grid" aria-label="Workshop controls">
      <button type="button" class="control-tile is-primary" data-route="new">
        <span class="tile-copy"><strong>New job</strong><small>Start inspection</small></span>
        <span class="tile-icon">${icon("plus")}</span>
      </button>
      ${resumeTile}
      <button type="button" class="control-tile" data-route="jobs">
        <span class="tile-copy"><strong>All jobs</strong><small>${allJobsCount} ${allJobsCount === 1 ? "item" : "items"}</small></span>
        <span class="tile-icon">${icon("clipboard")}</span>
      </button>
      <button type="button" class="control-tile" data-route="knowledge">
        <span class="tile-copy"><strong>Repair library</strong><small>${repairLibraryCount} ${repairLibraryCount === 1 ? "car profile" : "car profiles"}</small></span>
        <span class="tile-icon">${icon("database")}</span>
      </button>
    </div>

    <div class="home-jobs-section">
      <div class="field-header">
        <div><h2>Currently active</h2></div>
        <button class="secondary-button view-all-button" type="button" data-action="view-active-jobs">View all ${icon("arrow")}</button>
      </div>
      <div class="job-list">
        ${openJobs.slice(0, 3).map(jobCard).join("")}
      </div>
    </div>
  </section>`;
}

function jobCard(job, { hidden = false } = {}) {
  const statusLabel = job.status === "deleted" ? "Deleted" : job.status === "resolved" ? "Resolved" : "Active";
  const dateLabel = job.status === "deleted"
    ? job.updatedAtShort
    : job.status === "resolved"
      ? job.resolvedAtShort
      : (job.createdAtShort ? `Started ${job.createdAtShort}` : "");
  // Deleted jobs already have their own restore/permanent-delete affordances
  // (see the deleted-jobs detail page), so the list-level delete menu is only
  // useful for jobs that are still open or resolved.
  const showMenu = job.status !== "deleted";
  return `<div class="job-card" data-status="${job.status}"${hidden ? " hidden" : ""} data-job-search="${escapeHTML(jobSearchText(job))}">
    <button class="job-card-main" data-action="open-job" data-job-id="${job.id}" type="button" aria-label="${job.status === "open" ? "Resume" : `View ${statusLabel.toLowerCase()} job for`} ${jobVehicleName(job)}">
      <span class="job-card-top">
        <span class="job-status-group">
          <span class="status-chip ${job.status === "resolved" ? "resolved" : job.status === "deleted" ? "deleted" : ""}">${statusLabel}</span>
          ${dateLabel ? `<span class="job-date">${escapeHTML(dateLabel)}</span>` : ""}
        </span>
        <span class="job-bay">${job.bay.toUpperCase()}</span>
      </span>
      <span class="job-vehicle">${jobVehicleName(job)}</span>
      <span class="job-card-context"><span>${escapeHTML(formatMileageDisplay(job.vehicle.mileage))}</span><span>${escapeHTML(job.vehicle.customerName)}</span></span>
      <span class="job-issue">${jobSummary(job)}</span>
    </button>
    <span class="job-card-action" aria-hidden="true">${icon("arrow")}</span>
    ${showMenu ? `<button class="job-card-menu" type="button" data-action="delete-job-from-list" data-job-id="${job.id}" aria-label="Delete job for ${jobVehicleName(job)}">${icon("more")}</button>` : `<span class="job-card-menu-spacer" aria-hidden="true"></span>`}
  </div>`;
}

function renderJobs() {
  const counts = {
    all: jobRecords.length,
    open: jobRecords.filter((job) => job.status === "open").length,
    resolved: jobRecords.filter((job) => job.status === "resolved").length,
    deleted: jobRecords.filter((job) => job.status === "deleted").length,
  };
  const visibleJobs = state.jobFilter === "all" ? jobRecords : jobRecords.filter((job) => job.status === state.jobFilter);
  const normalizedSearch = state.jobSearch.trim().toLowerCase();
  const hasSearchResults = !normalizedSearch || visibleJobs.some((job) => jobSearchText(job).includes(normalizedSearch));
  app.innerHTML = `<section class="screen workflow-shell">
    <div class="page-header"><div><h1>Jobs</h1></div></div>
    <label class="form-field jobs-search-field" for="job-search">
      <div class="field-header"><span class="field-label">Search jobs</span></div>
      <span class="jobs-search-control">${icon("search")}<input class="input jobs-search-input" id="job-search" type="search" value="${escapeHTML(state.jobSearch)}" placeholder="Vehicle or customer" autocomplete="off" /></span>
    </label>
    <div class="quick-row job-filters" role="group" aria-label="Filter jobs">
      ${[["all", "All"], ["open", "Active"], ["resolved", "Resolved"], ["deleted", "Deleted"]].map(([filter, label]) => `<button class="quick-chip${state.jobFilter === filter ? " is-selected" : ""}" type="button" data-action="filter-jobs" data-job-filter="${filter}" aria-pressed="${state.jobFilter === filter}">${label} ${counts[filter]}</button>`).join("")}
    </div>
    <div class="job-list">
      ${visibleJobs.map((job) => jobCard(job, { hidden: Boolean(normalizedSearch && !jobSearchText(job).includes(normalizedSearch)) })).join("")}
    </div>
    <div class="jobs-empty"${hasSearchResults ? " hidden" : ""} role="status">No jobs match your search.</div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Repair library: car profiles
//
// A profile is a car bucket (make + model + generation/engine). Every note and
// repair filed under it keeps its own year, trim, transmission and mileage, so
// the bucket stays dense enough to be worth opening without losing detail.
// ---------------------------------------------------------------------------

function profileName(profile) {
  return [profile.make, profile.model].filter(Boolean).join(" ").trim() || "Unknown vehicle";
}

function profileSearchText(profile) {
  return [profile.make, profile.model].filter(Boolean).join(" ").toLowerCase();
}

// A profile is Make+Model only; trim lives on the vehicles/repairs inside
// it. The library now picks a trim before ever opening a profile (Brand ->
// Golf GTI -> profile), so every profile page is scoped to one trim key.
function repairVariantKey(job) {
  return job.vehicle.trim || "";
}

function repairVariantLabel(job) {
  return job.vehicle.trim || "Unspecified";
}

// Drawn from both surfaces the filter now spans -- the resolved-job list
// behind Repair history and the grouped cases behind Common symptoms &
// repairs -- deduped by job id, since in real data the same resolved job
// feeds both. Reading only the job list would miss variants that appear in
// grouped cases.
function profileVariantOptions(repairs, repairGroups = []) {
  const byJob = new Map();
  repairs.forEach((job) => {
    byJob.set(String(job.id), { key: repairVariantKey(job), label: repairVariantLabel(job) });
  });
  repairGroups.forEach((group) => {
    (group.instances || []).forEach((instance) => {
      const jobId = String(instance.job_id || "");
      if (!jobId || byJob.has(jobId)) return;
      byJob.set(jobId, {
        key: instanceVariantKey(instance),
        label: instance.trim || "Unspecified",
      });
    });
  });
  const seen = new Map();
  byJob.forEach(({ key, label }) => {
    if (!seen.has(key)) seen.set(key, { key, label, count: 0 });
    seen.get(key).count += 1;
  });
  return Array.from(seen.values()).sort((a, b) => b.count - a.count);
}

// The same trim key the Repair history tab filters by, rebuilt from a
// repair-group instance (vehicle_profile_repair_groups, 0037) instead of a
// job row -- so one variant selection narrows both tabs.
function instanceVariantKey(instance) {
  return instance.trim || "";
}

// Narrows each case to the selected trim and re-derives its occurrence
// count from what survived, dropping cases with nothing left. Counting the
// filtered instances rather than trusting the group's own `occurrences`
// matters: that number was computed server-side across every trim.
function filterRepairGroups(groups, trimKey) {
  return groups.reduce((kept, group) => {
    const instances = (group.instances || []).filter((instance) => instanceVariantKey(instance) === trimKey);
    if (instances.length) kept.push({ ...group, instances, occurrences: instances.length });
    return kept;
  }, []);
}

function filterNotesByVariant(notes, trimKey) {
  return notes.filter((note) => (note.vehicle_trim || "") === trimKey);
}

// Network cases are grouped by trim at the source too (0039), same shape as
// filterRepairGroups above.
function filterNetworkByTrim(networkGroups, trimKey) {
  return networkGroups.reduce((kept, group) => {
    const rows = (group.rows || []).filter((row) => (row.trim || "") === trimKey);
    if (rows.length) kept.push({ ...group, rows, occurrences: rows.reduce((sum, row) => sum + row.occurrences, 0) });
    return kept;
  }, []);
}

// Vehicle mileage is stored/entered as a raw km number everywhere in the
// data model; this only converts it for on-screen display when the shop has
// switched to imperial. Takes either a number or an already comma-formatted
// digit string (e.g. state.vehicle.mileage while a form is being filled in).
function formatMileageDisplay(rawMileage) {
  const digits = String(rawMileage ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  return formatKilometres(Number(digits));
}

function formatKilometres(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  if (unitSystem() === "imperial") return `${Math.round(number / KM_PER_MILE).toLocaleString("en-AU")} mi`;
  return `${Math.round(number).toLocaleString("en-AU")} km`;
}

function formatShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function profileCard(profile, { hidden = false } = {}) {
  const repairs = Number(profile.repair_count || 0);
  return `<button class="library-result-card" type="button" data-action="open-car-profile" data-profile-id="${escapeHTML(profile.id)}" data-library-search="${escapeHTML(profileSearchText(profile))}"${hidden ? " hidden" : ""} aria-label="Open the ${escapeHTML(profileName(profile))} car profile">
    <h2 class="library-result-name">${escapeHTML(profile.model || profileName(profile))}</h2>
    <span class="library-result-counts">
      <span>${repairs} ${repairs === 1 ? "repair" : "repairs"}</span>
    </span>
    <span class="library-result-action" aria-hidden="true">${icon("arrow")}</span>
  </button>`;
}

// One row per trim the shop has actually seen for this model, not every
// possible trim -- the brand drill-in list is the trim picker now, so this
// is where a mechanic chooses "Golf GTI" rather than "Golf" before ever
// opening the profile. A model with no recorded trims still gets exactly
// one row (bare model name), same as before this split existed.
function profileTrimRows(profiles) {
  return profiles.flatMap((profile) => {
    const trims = Array.isArray(profile.trims) && profile.trims.length
      ? profile.trims
      : [{ trim: null, vehicle_count: profile.vehicle_count, repair_count: profile.repair_count }];
    return trims.map((entry) => ({ profile, entry }));
  }).sort((a, b) => {
    const modelCompare = (a.profile.model || "").localeCompare(b.profile.model || "");
    return modelCompare !== 0 ? modelCompare : (b.entry.repair_count || 0) - (a.entry.repair_count || 0);
  });
}

function profileTrimCard(profile, entry) {
  const trimKey = entry.trim || "";
  const label = trimKey ? `${profile.model || ""} ${trimKey}`.trim() : (profile.model || profileName(profile));
  const repairs = Number(entry.repair_count || 0);
  return `<button class="library-result-card" type="button" data-action="open-car-profile" data-profile-id="${escapeHTML(profile.id)}" data-trim="${escapeHTML(trimKey)}" aria-label="Open the ${escapeHTML(label)} car profile">
    <h2 class="library-result-name">${escapeHTML(label)}</h2>
    <span class="library-result-counts">
      <span>${repairs} ${repairs === 1 ? "repair" : "repairs"}</span>
    </span>
    <span class="library-result-action" aria-hidden="true">${icon("arrow")}</span>
  </button>`;
}


function libraryBrandGroups(profiles) {
  const groups = new Map();
  profiles.forEach((profile) => {
    const make = profile.make || "Other";
    if (!groups.has(make)) groups.set(make, { make, profiles: [] });
    groups.get(make).profiles.push(profile);
  });
  return Array.from(groups.values()).sort((a, b) => a.make.localeCompare(b.make));
}

function libraryBrandTile(group) {
  const modelCount = group.profiles.length;
  const repairCount = group.profiles.reduce((sum, profile) => sum + Number(profile.repair_count || 0), 0);
  return `<button class="library-brand-tile" type="button" data-action="open-library-brand" data-brand="${escapeHTML(group.make)}" aria-label="Open ${escapeHTML(group.make)} car profiles">
    <span class="library-brand-name">${escapeHTML(group.make)}</span>
    <span class="library-brand-counts">
      <span class="library-brand-count">${modelCount} ${modelCount === 1 ? "model" : "models"}</span>
      <span class="library-brand-count">${repairCount} ${repairCount === 1 ? "repair" : "repairs"}</span>
    </span>
  </button>`;
}

function librarySearchField() {
  return `<label class="form-field jobs-search-field" for="library-search">
      <div class="field-header"><span class="field-label">Search cars &amp; repairs</span></div>
      <span class="jobs-search-control">${icon("search")}<input class="input jobs-search-input" id="library-search" type="search" value="${escapeHTML(state.librarySearch)}" placeholder="Search by make, model, or repair" autocomplete="off" /></span>
      <span class="helper">Example: Civic throttle response</span>
    </label>`;
}

function sortedProfileList(profiles) {
  return [...profiles].sort((a, b) => {
    const makeCompare = (a.make || "").localeCompare(b.make || "");
    return makeCompare !== 0 ? makeCompare : (a.model || "").localeCompare(b.model || "");
  });
}

function restoreLibrarySearchFocus(caretPos) {
  requestAnimationFrame(() => {
    const input = document.querySelector("#library-search");
    if (!input) return;
    input.focus();
    if (typeof caretPos === "number") input.setSelectionRange(caretPos, caretPos);
  });
}

// Debounced so it only fires once typing pauses -- the instant "Cars" list
// filtering above stays snappy and caret-safe, this just adds a slower
// "Repairs" tier underneath once there's something worth asking the server.
async function runLibraryRepairSearch(query, caretPos) {
  try {
    const { repairs } = await apiRequest(`/api/library/search?q=${encodeURIComponent(query)}`);
    if (state.librarySearch.trim() !== query) return;
    state.libraryRepairQuery = query;
    state.libraryRepairMatches = Array.isArray(repairs) ? repairs : [];
  } catch (_) {
    state.libraryRepairQuery = query;
    state.libraryRepairMatches = [];
  }
  render();
  restoreLibrarySearchFocus(caretPos);
}

function libraryRepairMatchCard(repair) {
  const carName = [repair.make, repair.model].filter(Boolean).join(" ");
  return `<button class="library-repair-match" type="button" data-action="open-car-profile" data-profile-id="${escapeHTML(repair.profile_id)}">
    <span class="library-repair-match-main">
      <span class="library-repair-match-car">${escapeHTML(carName)}</span>
      <span class="profile-repair-label">${escapeHTML(repair.label)}</span>
      <span class="profile-repair-mileage">${escapeHTML(REPAIR_SYSTEM_LABELS.get(repair.system) || "Other")}</span>
    </span>
    <span class="profile-repair-meta"><strong>${repair.occurrences} repair${repair.occurrences === 1 ? "" : "s"}</strong>${icon("arrow")}</span>
  </button>`;
}

function renderKnowledge() {
  const normalizedSearch = state.librarySearch.trim().toLowerCase();
  const profiles = state.libraryProfiles;

  // Searching cuts across the whole library, so it bypasses the brand drill-in
  // entirely rather than hiding matches that sit under another brand.
  if (normalizedSearch) {
    const matches = sortedProfileList(profiles).filter((profile) => profileSearchText(profile).includes(normalizedSearch));
    const repairMatches = state.libraryRepairQuery === state.librarySearch.trim() ? state.libraryRepairMatches : [];
    const searchLongEnough = normalizedSearch.length >= 3;
    const noResults = !matches.length && !repairMatches.length;
    app.innerHTML = `<section class="screen workflow-shell">
      <div class="page-header"><div><h1>Repair library</h1></div></div>
      ${librarySearchField()}
      ${matches.length ? `<div class="field-header"><div><span class="field-label">Cars</span></div></div>` : ""}
      <div class="library-result-list">${matches.map((profile) => profileCard(profile)).join("")}</div>
      <div class="jobs-empty library-empty"${matches.length ? " hidden" : ""} role="status">No cars match your search.</div>
      ${repairMatches.length ? `<div class="field-header"><div><span class="field-label">Repairs</span></div></div>
        <div class="library-repair-match-list">${repairMatches.map(libraryRepairMatchCard).join("")}</div>` : ""}
      ${noResults && searchLongEnough ? `<div class="library-web-fallback">
        <p class="profile-empty">No matches in your shop's history.</p>
        <button class="secondary-button" type="button" data-action="search-library-web">${icon("search")} Search the web for "${escapeHTML(state.librarySearch.trim())}"</button>
      </div>` : ""}
    </section>`;
    return;
  }

  const groups = libraryBrandGroups(profiles);
  const activeGroup = state.libraryBrand ? groups.find((group) => group.make === state.libraryBrand) : null;

  if (activeGroup) {
    const trimRows = profileTrimRows(activeGroup.profiles);
    app.innerHTML = `<section class="screen workflow-shell">
      ${taskHeader({ context: "Repair library", title: activeGroup.make, backAction: "back-to-library-brands", backLabel: "Back to all brands" })}
      <div class="library-result-list">${trimRows.map(({ profile, entry }) => profileTrimCard(profile, entry)).join("")}</div>
    </section>`;
    return;
  }

  app.innerHTML = `<section class="screen workflow-shell">
    <div class="page-header"><div><h1>Repair library</h1></div></div>
    ${librarySearchField()}
    <div class="field-header"><div><span class="field-label">Brands</span></div></div>
    <div class="library-brand-grid">${groups.map(libraryBrandTile).join("")}</div>
    ${profiles.length === 0 && state.libraryStatus !== "loading" ? `<div class="jobs-empty library-zero-state" role="status">No cars in the library yet. Profiles are created automatically as jobs come through the shop.</div>` : ""}
  </section>`;
}

function noteTimestamp(note) {
  return note.updated_at || note.created_at;
}

function lastNoteModified(notes) {
  if (!notes.length) return null;
  return notes.reduce((latest, note) => {
    const stamp = noteTimestamp(note);
    return !latest || stamp > latest ? stamp : latest;
  }, null);
}

function profileNoteCard(note) {
  const specifics = [
    note.vehicle_year ? String(note.vehicle_year) : "",
    note.vehicle_transmission || "",
    note.vehicle_mileage ? formatKilometres(note.vehicle_mileage) : "",
  ].filter(Boolean).join(" · ");
  const author = relatedRecord(note.author)?.full_name || "";
  const meta = [formatShortDate(noteTimestamp(note)), author].filter(Boolean).join(" · ");
  return `<article class="profile-note">
    <span class="profile-note-meta">${escapeHTML(meta)}</span>
    <p class="profile-note-body">${escapeHTML(note.body)}</p>
    ${specifics ? `<span class="profile-note-specifics">${escapeHTML(specifics)}</span>` : ""}
  </article>`;
}

function profileRepairGroups(rows) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = row.system || "other";
    if (!groups.has(key)) groups.set(key, { system: key, rows: [], total: 0 });
    const group = groups.get(key);
    group.rows.push(row);
    group.total += row.occurrences;
  });
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

function repairMileageLabel(row) {
  if (row.mileage_low == null && row.mileage_high == null) return "";
  if (row.mileage_low == null || row.mileage_high == null || row.mileage_low === row.mileage_high) {
    return formatKilometres(row.mileage_low ?? row.mileage_high);
  }
  return `${formatKilometres(row.mileage_low)} – ${formatKilometres(row.mileage_high)}`;
}

// Opening the system accordion goes straight to the flat list of repairs --
// no second accordion click needed to see what's inside. Tapping a repair
// opens a sheet (the app's existing modal) with the Symptom/Repair preview;
// "View full repair" inside that sheet is the one deliberate way to leave
// the page, listed once per instance since the fix may not have been
// identical every time.
function profileRepairRow(row) {
  const mileage = repairMileageLabel(row);
  const countLabel = `${row.occurrences} repair${row.occurrences === 1 ? "" : "s"}`;
  return `<li><button class="profile-repair-row profile-repair-row-button" type="button" data-action="open-repair-case" data-source="shop" data-system="${escapeHTML(row.system || "other")}" data-label="${escapeHTML(row.label)}">
    <span class="profile-repair-body">
      <span class="profile-repair-label">${escapeHTML(row.label)}</span>
      <span class="profile-repair-meta">${mileage ? `<span class="profile-repair-mileage">${escapeHTML(mileage)}</span>` : ""}<span class="profile-repair-count">${countLabel}</span></span>
    </span>
    <span class="profile-repair-view">View</span>
  </button></li>`;
}

// The sheet is a preview, not the report: same field labels/order as the
// full repair (Symptoms, Work performed), verbatim, just fewer of them --
// Verification/DTCs/Parts/Photos only live on the full page, one tap away
// via the CTA. Multiple instances share one label (e.g. the same DTC fixed
// 4 times) but may not be the same fix each time, so a numbered case
// picker swaps which instance's real text is shown and which job the CTA
// opens -- never blending them into one paragraph.
let activeRepairCase = { system: null, label: null, index: 0 };

function repairCaseOptionLabel(instance, index) {
  const bits = [instance.year, instance.mileage != null ? formatKilometres(instance.mileage) : "", instance.repaired_at ? formatShortDate(instance.repaired_at) : ""].filter(Boolean);
  return `${String(index + 1).padStart(2, "0")} · ${bits.join(" · ") || "Repair"}`;
}

function shopRepairCaseSheet(row, selectedIndex = 0) {
  const instances = Array.isArray(row.instances) ? row.instances : [];
  const index = Math.min(Math.max(selectedIndex, 0), Math.max(instances.length - 1, 0));
  activeRepairCase = { system: row.system || "other", label: row.label, index };
  const current = instances[index] || {};
  const countLabel = `${instances.length} repair${instances.length === 1 ? "" : "s"}`;
  const caseSelector = instances.length > 1 ? `<label class="form-field repair-case-select-field">
    <div class="field-header"><span class="field-label">Select repair</span></div>
    <span class="select-control"><select class="select" id="repair-case-select">
      ${instances.map((instance, i) => `<option value="${i}"${i === index ? " selected" : ""}>${escapeHTML(repairCaseOptionLabel(instance, i))}</option>`).join("")}
    </select>${icon("down")}</span>
  </label>` : "";
  openSheet(`<div class="sheet-head"><div><h2>${escapeHTML(row.label)}</h2><span class="task-context">${escapeHTML(countLabel)}</span></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body repair-case-sheet-body">
      ${caseSelector}
      ${resolvedDetailSection("Symptoms", `<div class="repair-summary-box"><p>${escapeHTML(current.symptom_text || "No complaint recorded.")}</p></div>`)}
      ${resolvedDetailSection("Work performed", `<div class="repair-summary-box"><p>${escapeHTML(current.repair_text || "No work performed recorded.")}</p></div>`)}
    </div>
    <div class="sheet-footer">
      <button class="primary-button full repair-case-cta" type="button" data-action="open-job" data-job-id="${escapeHTML(current.job_id)}">View full repair ${icon("arrow")}</button>
    </div>`, { sheetClass: "repair-case-sheet", ariaLabel: row.label });
}

// The accordion header counts distinct repair cases in the category, not
// total times repaired -- "3x" at category level previously meant "sum of
// occurrences across every fault in here," which read as "3 different
// repairs" when it was really 1 fault that recurred 3 times. Each row's
// own "N shops · Nx" (network) or "Nx" (own shop) still carries the true
// per-fault frequency.
function caseCountLabel(count) {
  return `${count} common case${count === 1 ? "" : "s"}`;
}

function profileRepairsSection(rows) {
  const groups = profileRepairGroups(rows);
  if (!groups.length) {
    return `<p class="profile-empty">Not enough repair data to be shown yet.</p>`;
  }
  return `<div class="known-issues-list">
    ${groups.map((group) => `<details class="known-issues-accordion">
      <summary>
        <span class="known-issues-system-icon">${icon(REPAIR_SYSTEM_ICONS[group.system] || "wrench")}</span>
        <span class="known-issues-summary-text known-issues-summary-text-stacked"><span class="field-label">${escapeHTML(REPAIR_SYSTEM_LABELS.get(group.system) || "Other")}</span><span class="known-issues-case-count">${caseCountLabel(group.rows.length)}</span></span>
        <span class="known-issues-count">${icon("down")}</span>
      </summary>
      <ul class="profile-repair-list">${group.rows.map((row) => profileRepairRow(row)).join("")}</ul>
    </details>`).join("")}
  </div>`;
}

// Deliberately a separate section from "Common symptoms & repairs": this is
// other shops' work, not this shop's verified history, and the two must stay
// visually and structurally distinct. Always rendered (even sharing-off)
// so the feature isn't buried three taps deep in Settings -- the empty
// states carry the call to action instead of hiding entirely.
//
// Every label within a system gets its own row (not just the top one) --
// a rare cross-shop fault is exactly what a mechanic won't already know,
// so it can't be the one that gets buried behind a "most common" pick.
function networkPatternRow(row) {
  return `<li><button class="profile-repair-row profile-repair-row-button" type="button" data-action="open-repair-case" data-source="network" data-system="${escapeHTML(row.system || "other")}" data-label="${escapeHTML(row.label)}" data-trim="${escapeHTML(row.trim || "")}">
    <span class="profile-repair-label">${escapeHTML(row.mostCommonIssue || row.label)}</span>
    <span class="profile-repair-meta">${row.shopCount} shop${row.shopCount === 1 ? "" : "s"} · <strong>${row.occurrences} repair${row.occurrences === 1 ? "" : "s"}</strong>${icon("arrow")}</span>
  </button></li>`;
}

function networkRepairCaseSheet(row) {
  const meta = `${row.shopCount} shop${row.shopCount === 1 ? "" : "s"} · ${row.occurrences} repair${row.occurrences === 1 ? "" : "s"} reported`;
  openSheet(`<div class="sheet-head"><div><h2>${escapeHTML(row.mostCommonIssue || row.label)}</h2><span class="task-context">${escapeHTML(meta)}</span></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
      ${resolvedDetailSection("Symptoms", `<div class="repair-summary-box"><p>${escapeHTML(row.symptomsSummary)}</p></div>`)}
      ${resolvedDetailSection("Repair", `<div class="repair-summary-box"><p>${escapeHTML(row.repairSummary)}</p></div>`)}
    </div>`, { sheetClass: "repair-case-sheet", ariaLabel: row.mostCommonIssue || row.label });
}

// Gated on read-capability (sharing OR read-exempt, mirroring the SQL
// function's own check), not on sharesRepairData alone -- a read-exempt
// shop (the demo shop) doesn't share but must still see this section, or it
// would wrongly show "Turn on sharing" despite the RPC returning data.
function profileNetworkSection(networkGroups) {
  const sharing = Boolean(state.shop?.sharesRepairData);
  const canRead = sharing || Boolean(state.shop?.networkReadExempt);
  const statusTag = sharing
    ? `<span class="reference-tag reference-tag-active">Active</span>`
    : `<span class="reference-tag">Off</span>`;
  const heading = `<div class="field-header"><span class="field-label">Network cases${statusTag}</span></div>`;

  if (!canRead) {
    return `${heading}<p class="profile-empty">Turn on sharing in Settings to see what other shops found for this trim.</p>`;
  }
  if (!networkGroups.length) {
    return `${heading}<p class="profile-empty">No shared repairs for this trim yet.</p>`;
  }
  return `${heading}
    <div class="known-issues-list">
      ${networkGroups.map((group) => `<details class="known-issues-accordion">
        <summary>
          <span class="known-issues-summary-text known-issues-summary-text-stacked"><span class="field-label">${escapeHTML(REPAIR_SYSTEM_LABELS.get(group.system) || "Other")}</span><span class="known-issues-case-count">${caseCountLabel(group.rows.length)}</span></span>
          <span class="known-issues-count">${icon("down")}</span>
        </summary>
        <ul class="profile-repair-list">${group.rows.map(networkPatternRow).join("")}</ul>
      </details>`).join("")}
    </div>`;
}

function recallCard(recall) {
  const years = [recall.year_from, recall.year_to].filter(Boolean);
  const yearLabel = years.length === 2 && years[0] !== years[1] ? `${years[0]}–${years[1]}` : (years[0] ? String(years[0]) : "");
  const dateLabel = recall.recall_date ? formatShortDate(recall.recall_date) : "";
  return `<a class="profile-recall" href="${escapeHTML(recall.source_url)}" target="_blank" rel="noopener noreferrer">
    <span class="profile-recall-meta">${[yearLabel, dateLabel].filter(Boolean).map(escapeHTML).join(" · ")}</span>
    <p class="profile-recall-body">${escapeHTML(recall.defect_description)}</p>
    ${recall.remedy ? `<div class="profile-recall-fix"><div class="field-header"><span class="field-label">Fix</span></div><p>${escapeHTML(recall.remedy)}</p></div>` : ""}
    <span class="profile-recall-link">View recall notice ${icon("arrow")}</span>
  </a>`;
}

function profileRecallsSection(recalls) {
  if (!recalls.length) {
    return `<p class="profile-empty">No known recalls for this model.</p>`;
  }
  return `<div class="profile-recall-list">${recalls.map(recallCard).join("")}</div>`;
}

function titleCase(value) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function complaintTrendCard(trend) {
  return `<div class="profile-recall">
    <span class="profile-recall-meta">${trend.complaint_count.toLocaleString()} NHTSA complaints</span>
    <p class="profile-recall-body"><strong>${escapeHTML(titleCase(trend.component))}</strong>${trend.sample_summary ? ` — ${escapeHTML(trend.sample_summary)}` : ""}</p>
  </div>`;
}

function profileComplaintTrendsSection(complaintTrends) {
  if (!complaintTrends.length) {
    return `<p class="profile-empty">No commonly reported issues on file for this model.</p>`;
  }
  return `<div class="profile-recall-list">${complaintTrends.map(complaintTrendCard).join("")}</div>`;
}

// Recalls/NHTSA are reference data a mechanic looks up occasionally, not
// day-to-day info like Shop notes -- collapsed by default so they don't
// dominate the page, with a one-line summary visible when closed.
function knownIssuesAccordion(label, summaryText, bodyHtml, caption) {
  return `<details class="known-issues-accordion">
    <summary>
      <span class="known-issues-summary-text known-issues-summary-text-stacked"><span class="field-label">${escapeHTML(label)}</span>${caption ? `<span class="known-issues-case-count">${escapeHTML(caption)}</span>` : ""}</span>
      <span class="known-issues-count">${escapeHTML(summaryText)}${icon("down")}</span>
    </summary>
    ${bodyHtml}
  </details>`;
}

function recallsSummaryText(recalls) {
  if (!recalls.length) return "No recalls on file";
  return `${recalls.length} recall${recalls.length === 1 ? "" : "s"} on file`;
}

function complaintTrendsSummaryText(complaintTrends) {
  if (!complaintTrends.length) return "None on file";
  const top = complaintTrends[0];
  return `Top: ${titleCase(top.component)} (${top.complaint_count.toLocaleString()})`;
}

function complaintTrendsCaption(complaintTrends) {
  if (!complaintTrends.length) return "US market data";
  return `US market data · ${complaintTrendsSummaryText(complaintTrends)}`;
}

function renderCarProfile() {
  const detail = state.activeProfile;
  if (!detail) {
    // A blocking top-progress-bar is already running while this loads (see
    // openCarProfile), so this screen stays visually quiet rather than
    // showing its own "Loading…" text on top of it.
    app.innerHTML = state.profileStatus === "loading"
      ? `<section class="screen workflow-shell"></section>`
      : `<section class="screen workflow-shell"><section class="empty-state"><h1>Car profile not found</h1><p>That car profile is unavailable.</p><button class="secondary-button" type="button" data-route="knowledge">Back to library</button></section></section>`;
    return;
  }
  const { profile, notes, repairGroups = [], repairs, recalls = [], complaintTrends = [], networkPatterns = [] } = detail;
  const activeVariant = state.profileVariantFilter || "";
  const visibleRepairs = repairs.filter((job) => repairVariantKey(job) === activeVariant);
  const visibleGroups = filterRepairGroups(repairGroups, activeVariant);
  const visibleNotes = filterNotesByVariant(notes, activeVariant);
  const visibleNetwork = filterNetworkByTrim(networkPatterns, activeVariant);
  const modelLabel = profile.model || profileName(profile);
  const trimTitle = activeVariant ? `${modelLabel} ${activeVariant}`.trim() : modelLabel;
  const isNotesTab = state.profileTab !== "history";
  app.innerHTML = `<section class="screen workflow-shell car-profile-shell">
    ${taskHeader({ context: profile.make || "Car profile", title: trimTitle, backAction: "back-to-library", backLabel: "Back to the repair library" })}

    <div class="quick-row profile-tabs" role="tablist" aria-label="Car profile sections">
      <button class="quick-chip${isNotesTab ? " is-selected" : ""}" type="button" role="tab" aria-selected="${isNotesTab}" data-action="set-profile-tab" data-profile-tab="notes">Notes &amp; insights</button>
      <button class="quick-chip${isNotesTab ? "" : " is-selected"}" type="button" role="tab" aria-selected="${!isNotesTab}" data-action="set-profile-tab" data-profile-tab="history">Repair history ${repairs.length}</button>
    </div>

    <div class="profile-panel"${isNotesTab ? "" : " hidden"} role="tabpanel" aria-label="Notes and insights">
      <div class="field-header"><span class="field-label">Common symptoms &amp; repairs</span></div>
      ${visibleGroups.length
        ? profileRepairsSection(visibleGroups)
        : `<p class="profile-empty">No repairs recorded for this trim yet.</p>`}
      <div class="field-header"><span class="field-label">Shop notes</span></div>
      ${visibleNotes.length
        ? `<div class="profile-note-list">${visibleNotes.map(profileNoteCard).join("")}</div>`
        : `<p class="profile-empty profile-empty-tight">${notes.length ? "No notes for this trim yet." : "No notes yet. Add the first one below."}</p>`}
      <div class="profile-note-buttons">
        <button class="secondary-button" type="button" data-action="open-add-note">${icon("plus")} Add note</button>
        ${visibleNotes.length ? `<button class="secondary-button" type="button" data-action="open-edit-notes">${icon("edit")} Edit note</button>` : ""}
      </div>
      ${visibleNotes.length ? `<p class="profile-note-modified">Last modified ${escapeHTML(formatShortDate(lastNoteModified(visibleNotes)))}</p>` : ""}
      ${profileNetworkSection(visibleNetwork)}
      <div class="field-header"><span class="field-label">Known issues <span class="optional-label">(all trims)</span></span></div>
      <div class="known-issues-list">
        ${knownIssuesAccordion("Recalls", "", profileRecallsSection(recalls), recallsSummaryText(recalls))}
        ${knownIssuesAccordion("Commonly reported", "", profileComplaintTrendsSection(complaintTrends), complaintTrendsCaption(complaintTrends))}
      </div>
    </div>

    <div class="profile-panel"${isNotesTab ? " hidden" : ""} role="tabpanel" aria-label="Repair history">
      ${visibleRepairs.length ? `<div class="job-list">${visibleRepairs.map((job) => jobCard(job)).join("")}</div>` : `<p class="profile-empty">${repairs.length ? "No repairs match this trim." : "No resolved repairs recorded for this car yet."}</p>`}
    </div>
  </section>`;
}

async function loadLibraryProfiles() {
  showTopProgressBar();
  try {
    const { profiles } = await apiRequest("/api/library/profiles");
    state.libraryProfiles = Array.isArray(profiles) ? profiles : [];
    state.libraryStatus = "loaded";
  } catch (_) {
    state.libraryProfiles = [];
    state.libraryStatus = "offline";
  } finally {
    hideTopProgressBar();
  }
}

// UI-only dev fixture for the Honda Civic library profile -- this is the
// permanent client-demo profile ("what an active profile looks like"), and
// it never writes to the database. Toggle from the browser console with
// localStorage.setItem("argos-dev-fixtures", "on") (persists across
// reloads/navigation, unlike a fetch-interceptor which resets every full
// page load).
//
// Headline rule: a case's display label is ALWAYS a plain-language symptom
// phrase, NEVER the raw DTC code -- the code is not surfaced anywhere in the
// sheet (see shopRepairCaseSheet). Content lengths deliberately vary within a
// case (one-line vs multi-sentence) so the fixed-height sheet can be verified
// against real content instead of uniformly-sized placeholder text.
// Instances carry their own trim/engine where they differ, so the fixture
// exercises the in-profile variant filter (a profile only renders the filter
// once it has more than one variant behind it). These are the fallback.
const FIXTURE_DEFAULT_TRIM = "VTi-LX";
const FIXTURE_DEFAULT_ENGINE = "1.5L turbo petrol";

const DEV_FIXTURE_CASES = [
  {
    system: "emissions",
    label: "Catalytic converter efficiency fault",
    dtc: "P0420",
    instances: [
      { key: "p0420-1", year: 2019, mileage: 91200, resolvedAt: "2026-08-16",
        complaint: "Check-engine light on.",
        workPerformed: "Replaced downstream O2 sensor." },
      { key: "p0420-2", year: 2018, mileage: 78000, resolvedAt: "2026-05-02",
        complaint: "Check-engine light on, slight rotten egg smell from exhaust noticed by customer during highway driving.",
        workPerformed: "Replaced catalytic converter and both oxygen sensors, cleared codes and verified with a full drive cycle before returning the vehicle." },
      { key: "p0420-3", year: 2020, mileage: 64500, resolvedAt: "2026-02-10", trim: "RS",
        complaint: "Customer reported the check-engine light flashing intermittently on cold starts, mostly in the mornings, and said it would sometimes go off after the car warmed up for ten minutes or so. No other drivability complaints -- engine ran smoothly with no hesitation or rough idle during the test drive we did with the customer present.",
        workPerformed: "Diagnosed an exhaust leak upstream of the catalytic converter caused by a cracked manifold gasket, which was letting in extra oxygen and skewing the downstream O2 sensor reading enough to trip the efficiency code intermittently. Replaced the manifold gasket, retorqued the manifold bolts to spec, cleared the code, and completed a full drive cycle with a scan tool connected to confirm the readiness monitor passed with no code recurrence." },
      { key: "p0420-4", year: 2017, mileage: 103000, resolvedAt: "2025-11-20", trim: "RS",
        complaint: "No symptoms noticed by customer; code found during scheduled service scan.",
        workPerformed: "Cat efficiency below threshold. Replaced converter and both O2 sensors." },
    ],
  },
  {
    system: "emissions",
    label: "Fuel trim drifting rich at idle",
    dtc: null,
    instances: [
      { key: "fueltrim-1", year: 2021, mileage: 45000, resolvedAt: "2026-07-01",
        complaint: "Fuel trim drifting rich at idle, no code stored, customer noticed a slightly rough idle after cold start only.",
        workPerformed: "Found a vacuum leak at the intake manifold gasket, replaced the gasket and reset the adaptive fuel trims; confirmed the idle smoothed out on a 20 minute test drive." },
    ],
  },
  {
    system: "ignition",
    label: "Rough idle with cylinder misfire",
    dtc: "P0301",
    instances: [
      { key: "p0301-1", year: 2019, mileage: 88000, resolvedAt: "2026-08-01",
        complaint: "Rough idle.",
        workPerformed: "Replaced cylinder 1 coil pack." },
      { key: "p0301-2", year: 2019, mileage: 71000, resolvedAt: "2026-03-15", trim: "Type R", engine: "2.0L turbo petrol",
        complaint: "Engine shaking at idle, customer says it's worse when the car is cold and settles down once warmed up.",
        workPerformed: "Replaced the ignition coil and spark plugs on all cylinders as a preventive measure rather than just the failing one, since the plugs were near the end of their service interval anyway." },
      { key: "p0301-3", year: 2016, mileage: 121000, resolvedAt: "2025-09-05",
        complaint: "Customer reported hesitation on acceleration, most noticeable pulling out into traffic.",
        workPerformed: "Found a fouled plug on cylinder 1, replaced the plug and coil, cleared the code and confirmed no misfire counts accumulating on a test drive." },
    ],
  },
  {
    system: "ignition",
    label: "Misfire under acceleration",
    dtc: "P0303",
    instances: [
      { key: "p0303-1", year: 2020, mileage: 52000, resolvedAt: "2026-06-20", trim: "Type R", engine: "2.0L turbo petrol",
        complaint: "Intermittent misfire under acceleration.",
        workPerformed: "Replaced cylinder 3 coil pack." },
    ],
  },
];

function fixtureJobId(key) {
  return `fixture-honda-civic-${key}`;
}

function fixtureResolvedJob({ key, year, mileage, resolvedAt, complaint, dtc, workPerformed, trim, engine }) {
  const resolvedIso = `${resolvedAt}T09:00:00.000Z`;
  return {
    id: fixtureJobId(key),
    jobNumber: `AO-DEMO-${key.toUpperCase()}`,
    status: "resolved",
    vehicle: {
      year: String(year), make: "Honda", model: "Civic", mileage: Number(mileage).toLocaleString("en-AU"),
      vin: "", customerName: "Demo customer", customerFirstName: "Demo", customerLastName: "Customer",
      customerPhone: "", customerEmail: "",
      trim: trim || FIXTURE_DEFAULT_TRIM, engine: engine || FIXTURE_DEFAULT_ENGINE,
      drivetrain: "FWD", transmission: "CVT",
    },
    bay: "Bay 02",
    time: "09:00",
    createdAtShort: shortDate(resolvedIso),
    resolvedAtShort: shortDate(resolvedIso),
    updatedAtShort: shortDate(resolvedIso),
    resolvedAt: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(resolvedIso)),
    updatedAt: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(resolvedIso)),
    technician: "Workshop technician",
    complaint,
    observations: "",
    summary: "",
    dtcs: dtc ? [dtc] : [],
    resume: { route: "resolved", step: 5 },
    repairSummary: "",
    workPerformed,
    system: "",
    parts: [],
    verification: "Verified with a post-repair test drive; no code recurrence.",
    referenceJobId: null,
    raw: { resolved_at: resolvedIso, updated_at: resolvedIso },
  };
}

function applyDevFixtures(detail) {
  const devOn = localStorage.getItem("argos-dev-fixtures") === "on"
    || new URLSearchParams(location.search).get("dev") === "1";
  if (!devOn) return detail;
  if ((detail.profile?.make || "").toLowerCase() !== "honda" || (detail.profile?.model || "").toLowerCase() !== "civic") return detail;
  detail.repairGroups = DEV_FIXTURE_CASES.map((repairCase) => ({
    system: repairCase.system,
    label: repairCase.label,
    occurrences: repairCase.instances.length,
    instances: repairCase.instances.map((instance) => ({
      job_id: fixtureJobId(instance.key),
      year: instance.year,
      // Mirrors what vehicle_profile_repair_groups returns (0037) so the
      // variant filter behaves identically against fixtures and real data.
      trim: instance.trim || FIXTURE_DEFAULT_TRIM,
      engine: instance.engine || FIXTURE_DEFAULT_ENGINE,
      mileage: instance.mileage,
      repaired_at: instance.resolvedAt,
      symptom_text: instance.complaint,
      repair_text: instance.workPerformed,
      dtc_code: repairCase.dtc,
    })).sort((a, b) => (a.repaired_at < b.repaired_at ? 1 : -1)),
  }));
  DEV_FIXTURE_CASES.forEach((repairCase) => {
    repairCase.instances.forEach((instance) => {
      const job = fixtureResolvedJob({ ...instance, dtc: repairCase.dtc });
      const index = jobRecords.findIndex((record) => record.id === job.id);
      if (index >= 0) jobRecords[index] = job;
      else jobRecords.push(job);
    });
  });
  return detail;
}

// `trim` comes from the brand drill-in row the mechanic just picked, so the
// profile opens already scoped to it -- no in-page picker. Left undefined
// only when opened from search (which cuts across models, bypassing the
// trim picker entirely), in which case the most-repaired trim is picked as
// the default once the detail has loaded.
async function openCarProfile(profileId, { tab = "notes", trim } = {}) {
  state.activeProfileId = profileId;
  state.profileTab = tab;
  state.profileNoteDraft = "";
  state.profileVariantFilter = trim === undefined ? null : trim;
  state.profileStatus = "loading";
  state.activeProfile = null;
  setRoute("car-profile");
  showTopProgressBar({ blocking: true });
  try {
    const detail = await apiRequest(`/api/library/profiles/${encodeURIComponent(profileId)}`);
    // The mechanic may have navigated away while this was in flight.
    if (state.activeProfileId !== profileId) return hideTopProgressBar();
    detail.repairs = (detail.repairs || []).map(databaseJobToUi);
    state.activeProfile = applyDevFixtures(detail);
    if (state.profileVariantFilter === null) {
      const options = profileVariantOptions(state.activeProfile.repairs, state.activeProfile.repairGroups);
      state.profileVariantFilter = options[0]?.key ?? "";
    }
    state.profileStatus = "loaded";
  } catch (error) {
    if (state.activeProfileId !== profileId) return hideTopProgressBar();
    state.profileStatus = "error";
    showToast(error.message || "Could not open that car profile");
  }
  hideTopProgressBar();
  render();
}

function openAddNoteModal() {
  openSheet(`<div class="confirmation-content">
    <h2>Add a note</h2>
    <form class="profile-note-form" id="profile-note-form" autocomplete="off">
      <textarea class="textarea" id="profile-note-input" name="body" rows="5" placeholder="Anything worth remembering about this car">${escapeHTML(state.profileNoteDraft)}</textarea>
      <div class="profile-note-actions">
        <button class="dictate-button" type="button" data-dictate="profile-note-input" aria-pressed="false" aria-label="Dictate note">${icon("mic")} Dictate</button>
        <button class="primary-button" type="submit">${icon("save")} Save note</button>
      </div>
    </form>
  </div>`, { sheetClass: "confirmation-sheet add-note-sheet", ariaLabel: "Add a note" });
}

async function saveProfileNote(form) {
  const body = String(new FormData(form).get("body") || "").trim();
  if (!body) return showToast("Write a note first");
  const profileId = state.activeProfileId;
  try {
    const { note } = await apiRequest(`/api/library/profiles/${encodeURIComponent(profileId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ body, vehicleTrim: state.profileVariantFilter || null }),
    });
    if (state.activeProfileId !== profileId || !state.activeProfile) return;
    state.activeProfile.notes = [note, ...state.activeProfile.notes];
    state.profileNoteDraft = "";
    const listed = state.libraryProfiles.find((profile) => profile.id === profileId);
    if (listed) listed.note_count = Number(listed.note_count || 0) + 1;
    closeSheet();
    render();
    showToast("Note saved");
  } catch (error) {
    showToast(error.message || "Could not save that note");
  }
}

// Every note visible for the active trim is editable in one pass -- a
// trash icon marks a row for deletion (re-render keeps it visible but
// struck through, with an Undo) rather than removing it immediately, so
// Cancel can still back out before anything is sent to the server.
function editNoteRow(note) {
  const deleted = state.profileNoteEditDeleted.has(note.id);
  const draft = state.profileNoteEditDrafts[note.id] ?? note.body;
  const author = relatedRecord(note.author)?.full_name || "";
  const meta = [formatShortDate(noteTimestamp(note)), author].filter(Boolean).join(" · ");
  return `<div class="profile-note-edit-row${deleted ? " is-deleted" : ""}" data-note-id="${escapeHTML(note.id)}">
    <div class="profile-note-edit-head">
      <span class="profile-note-edit-meta">${escapeHTML(meta)}</span>
      <button class="icon-button" type="button" data-action="toggle-delete-note" data-note-id="${escapeHTML(note.id)}" aria-label="${deleted ? "Undo delete" : "Delete note"}">${deleted ? "Undo" : icon("trash")}</button>
    </div>
    ${deleted
      ? `<p class="profile-note-edit-deleted-label">Note will be removed</p>`
      : `<textarea class="textarea" name="note-${escapeHTML(note.id)}" rows="2">${escapeHTML(draft)}</textarea>`}
  </div>`;
}

function captureEditNoteDrafts() {
  sheetLayer.querySelectorAll(".profile-note-edit-row textarea").forEach((textarea) => {
    const row = textarea.closest(".profile-note-edit-row");
    if (row) state.profileNoteEditDrafts[row.dataset.noteId] = textarea.value;
  });
}

function openEditNotesModal({ reset = true } = {}) {
  const detail = state.activeProfile;
  if (!detail) return;
  if (reset) {
    state.profileNoteEditDrafts = {};
    state.profileNoteEditDeleted = new Set();
  }
  const visibleNotes = filterNotesByVariant(detail.notes, state.profileVariantFilter || "");
  openSheet(`<div class="confirmation-content edit-notes-content">
    <h2>Edit shop notes</h2>
    <form class="edit-notes-form" id="edit-notes-form">
      <div class="edit-notes-list">${visibleNotes.map(editNoteRow).join("")}</div>
      <div class="confirmation-actions">
        <button class="secondary-button full" type="button" data-action="close-sheet">Cancel</button>
        <button class="primary-button full" type="submit">${icon("save")} Save note</button>
      </div>
    </form>
  </div>`, { sheetClass: "confirmation-sheet edit-notes-sheet", ariaLabel: "Edit shop notes" });
}

async function saveEditedNotes(form) {
  const profileId = state.activeProfileId;
  const detail = state.activeProfile;
  if (!detail) return closeSheet();
  const deletions = Array.from(state.profileNoteEditDeleted);
  const edits = [];
  new FormData(form).forEach((value, key) => {
    const match = key.match(/^note-(.+)$/);
    if (!match || deletions.includes(match[1])) return;
    const original = detail.notes.find((note) => note.id === match[1]);
    const body = String(value).trim();
    if (original && body && body !== original.body) edits.push({ noteId: match[1], body });
  });
  if (!edits.length && !deletions.length) return closeSheet();
  try {
    await Promise.all([
      ...edits.map(({ noteId, body }) => apiRequest(`/api/library/profiles/${encodeURIComponent(profileId)}/notes/${encodeURIComponent(noteId)}`, { method: "PATCH", body: JSON.stringify({ body }) })),
      ...deletions.map((noteId) => apiRequest(`/api/library/profiles/${encodeURIComponent(profileId)}/notes/${encodeURIComponent(noteId)}`, { method: "DELETE" })),
    ]);
    if (state.activeProfileId === profileId && state.activeProfile) {
      const editedMap = new Map(edits.map(({ noteId, body }) => [noteId, body]));
      const now = new Date().toISOString();
      state.activeProfile.notes = state.activeProfile.notes
        .filter((note) => !deletions.includes(note.id))
        .map((note) => editedMap.has(note.id) ? { ...note, body: editedMap.get(note.id), updated_at: now } : note);
      const listed = state.libraryProfiles.find((profile) => profile.id === profileId);
      if (listed && deletions.length) listed.note_count = Math.max(0, Number(listed.note_count || 0) - deletions.length);
    }
    state.profileNoteEditDrafts = {};
    state.profileNoteEditDeleted = new Set();
    closeSheet();
    render();
    showToast("Notes updated");
  } catch (error) {
    showToast(error.message || "Could not save note changes");
  }
}

// ---- Settings ------------------------------------------------------------
// A small router of its own: state.settingsPage is null for the grouped
// overview, or a key into SETTINGS_PAGES for a detail page. Pages that
// aren't backed by real app behaviour yet say so plainly via unwiredBanner()
// instead of shipping a toggle that looks real but does nothing.

// Back navigation follows the trail actually taken rather than a fixed parent
// per page, because several pages are reachable from more than one place --
// going "back" should return to whichever list the technician came in through.
function settingsGoBack() {
  state.settingsPage = state.settingsTrail.pop() || null;
}

function settingsOpenPage(page) {
  if (page) state.settingsTrail.push(state.settingsPage);
  else state.settingsTrail = [];
  state.settingsPage = page || null;
}

function settingsPageHeader(title, eyebrow) {
  return `<header class="task-header has-back">
    <button class="task-back" type="button" data-action="settings-back" aria-label="Back">${icon("back")}</button>
    <div class="task-header-copy"><h2>${escapeHTML(title)}</h2>${eyebrow ? `<span class="task-context">${escapeHTML(eyebrow)}</span>` : ""}</div>
  </header>`;
}

function settingsRow({ iconName, title, description, value = "", page = "", disabled = false, locked = false }) {
  const inner = `<span class="settings-row-icon" aria-hidden="true">${anyIcon(iconName)}</span>
    <span class="settings-row-text"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(description)}</small></span>
    ${value ? `<span class="settings-row-value">${escapeHTML(value)}</span>` : ""}
    ${page && !disabled ? `<span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>` : ""}`;
  if (!page || disabled) return `<div class="settings-row${disabled ? " is-disabled" : ""}">${inner}</div>`;
  return `<button class="settings-row" type="button" data-action="open-settings-page" data-settings-page="${page}"${locked ? ' data-locked="true"' : ""}>${inner}</button>`;
}

function settingsGroup(label, rowsHtml, { locked = false } = {}) {
  return `<section class="settings-group">
    <span class="settings-group-label">${escapeHTML(label)}${locked ? `<span class="settings-group-lock" aria-hidden="true">${icon("lock")}</span>` : ""}</span>
    <div class="settings-list">${rowsHtml}</div>
  </section>`;
}

function unwiredBanner(text) {
  return `<div class="settings-unwired-banner">${icon("info")}<span>${escapeHTML(text)}</span></div>`;
}

function settingsSwitchRow({ title, description = "", checked, action = "", disabled = false }) {
  const switchHtml = `<span class="switch${checked ? " is-on" : ""}${disabled ? " is-disabled" : ""}" role="switch" aria-checked="${checked ? "true" : "false"}"><span class="switch-thumb"></span></span>`;
  const inner = `<span class="settings-row-text"><strong>${escapeHTML(title)}</strong>${description ? `<small>${escapeHTML(description)}</small>` : ""}</span>${switchHtml}`;
  if (disabled || !action) return `<div class="settings-row settings-toggle-row${disabled ? " is-disabled" : ""}">${inner}</div>`;
  return `<button class="settings-row settings-toggle-row" type="button" data-action="${action}" aria-pressed="${checked ? "true" : "false"}">${inner}</button>`;
}

function renderSettingsHome() {
  const theme = document.documentElement.dataset.theme || "dark";
  // Until the shop has loaded, show no value rather than defaulting to "Off":
  // this row reports whether repair data leaves the workshop, and stating
  // "Off" while it is actually on misrepresents a privacy setting.
  const sharingLabel = state.shop ? (state.shop.sharesRepairData ? "On" : "Off") : "";
  const unitsLabel = unitSystem() === "metric" ? "Metric" : "Imperial";
  const activeBays = state.bays.filter((bay) => bay.active).length;
  const activeTechnicians = state.technicians.filter((technician) => technician.active).length;
  const isTechnicianRole = (currentTechnician()?.role || state.profile?.role || "technician") === "technician";
  app.innerHTML = `<section class="screen workflow-shell settings-shell">
    <div class="page-header"><div><h1>Settings</h1></div></div>

    ${updateAvailable ? `<button class="settings-update-banner" type="button" data-action="reload-app">
      <span class="settings-update-banner-text"><strong>A new version of Argos One is available</strong><small>Tap to update now.</small></span>
      <span class="settings-update-banner-arrow" aria-hidden="true">${icon("arrow")}</span>
    </button>` : ""}

    ${settingsGroup("Appearance", [
      settingsRow({ iconName: "sun", title: "Theme", description: theme === "dark" ? "Reduced glare in the workshop" : "Maximum clarity in daylight", value: theme === "dark" ? "Dark" : "Light", page: "theme" }),
    ].join(""))}

    ${settingsGroup("Network", [
      settingsRow({ iconName: "globe", title: "Cross-shop repair patterns", description: "Share anonymised repair patterns", value: sharingLabel, page: "network-sharing" }),
    ].join(""))}

    ${settingsGroup("Profile & management", [
      settingsRow({ iconName: "building", title: "Workshop profile", description: "Details and suppliers", page: "workshop-profile", locked: isTechnicianRole }),
      settingsRow({ iconName: "building", title: "Bay management", description: "Add, edit or remove bays", value: String(activeBays), page: "bays", locked: isTechnicianRole }),
      settingsRow({ iconName: "technicians", title: "Staff management", description: "Add, edit or remove staff", value: String(activeTechnicians), page: "technicians", locked: isTechnicianRole }),
      settingsRow({ iconName: "settings", title: "Job defaults", description: "Default bay, technician and assignment", page: "job-defaults", locked: isTechnicianRole }),
    ].join(""), { locked: isTechnicianRole })}

    ${settingsGroup("Preferences", [
      settingsRow({ iconName: "gauge", title: "Units & measurements", description: "Metric, imperial and unit types", value: unitsLabel, page: "units" }),
      settingsRow({ iconName: "mic", title: "Voice & dictation", description: "Microphone and transcription review", page: "voice-dictation" }),
      settingsRow({ iconName: "camera", title: "Camera & photos", description: "Permissions, quality and storage", page: "camera-photos" }),
      settingsRow({ iconName: "bell", title: "Notifications", description: "Alerts and reminders", page: "notifications" }),
      settingsRow({ iconName: "cloud", title: "Data & storage", description: "Cache, backups and offline data", page: "storage" }),
      settingsRow({ iconName: "lock", title: "Privacy", description: "What Argos One collects and shares", page: "privacy" }),
    ].join(""))}

    ${settingsGroup("Support", [
      settingsRow({ iconName: "info", title: "Help & feedback", description: "Guides and contact support", page: "help" }),
      settingsRow({ iconName: "sparkles", title: "What's new", description: "See recent updates", page: "whats-new" }),
    ].join(""))}

    ${updateAvailable ? "" : settingsGroup("About", settingsRow({ iconName: "check", title: "You're up to date", description: `Build ${escapeHTML(BUILD_VERSION === "dev-local" ? BUILD_VERSION : BUILD_VERSION.slice(0, 7))}` }))}
  </section>`;
}

function renderThemePage() {
  const theme = document.documentElement.dataset.theme || "dark";
  return `${settingsPageHeader("Theme", "Appearance")}
    <p class="settings-detail-intro">Choose how Argos One looks in the workshop.</p>
    <div class="theme-options" role="group" aria-label="Choose interface theme">
      <button class="setting-choice ${theme === "dark" ? "is-selected" : ""}" type="button" data-theme-choice="dark" aria-pressed="${theme === "dark"}">
        <span class="theme-swatch dark-swatch" aria-hidden="true"><i></i></span>
        <span><strong>Dark</strong><small>Reduced glare in the workshop</small></span>
        <span class="choice-state">${theme === "dark" ? "Selected" : "Choose"}</span>
      </button>
      <button class="setting-choice ${theme === "light" ? "is-selected" : ""}" type="button" data-theme-choice="light" aria-pressed="${theme === "light"}">
        <span class="theme-swatch light-swatch" aria-hidden="true"><i></i></span>
        <span><strong>Light</strong><small>Maximum clarity in daylight</small></span>
        <span class="choice-state">${theme === "light" ? "Selected" : "Choose"}</span>
      </button>
    </div>`;
}

function renderNetworkSharingPage() {
  const loaded = Boolean(state.shop);
  const sharing = Boolean(state.shop?.sharesRepairData);
  return `${settingsPageHeader("Cross-shop repair patterns", "Network")}
    <p class="settings-detail-intro">Share anonymised repair patterns and see what other workshops are fixing.</p>
    <div class="settings-list">
      ${settingsSwitchRow({ title: "Share repair patterns", description: loaded ? "Allow sharing of your verified repairs" : "Checking your workshop's setting…", checked: sharing, action: "toggle-network-sharing", disabled: !loaded })}
    </div>
    <span class="settings-group-label settings-group-label-spaced">What's shared</span>
    <ul class="settings-check-list">
      <li>${icon("check")}<span>Verified repairs (no customer details)</span></li>
      <li>${icon("check")}<span>Vehicle (make, model, year, engine)</span></li>
      <li>${icon("check")}<span>Symptoms and causes</span></li>
      <li>${icon("check")}<span>Parts and repairs performed</span></li>
      <li>${icon("check")}<span>Success outcome</span></li>
    </ul>
    <span class="settings-group-label settings-group-label-spaced">What's not shared</span>
    <ul class="settings-check-list is-muted">
      <li>${icon("close")}<span>Customer, VIN or technician details</span></li>
    </ul>`;
}

function renderVoiceDictationPage() {
  return `${settingsPageHeader("Voice & dictation", "Preferences")}
    <span class="settings-group-label">Microphone</span>
    <div class="settings-list">
      <div class="settings-row"><span class="settings-row-icon" aria-hidden="true">${icon("mic")}</span><span class="settings-row-text"><strong>Microphone access</strong><small>Checked from your browser's permission state</small></span><span class="settings-row-value" id="mic-permission-value">Checking…</span></div>
      <button class="settings-row" type="button" data-action="test-microphone"><span class="settings-row-icon" aria-hidden="true">${icon("wrench")}</span><span class="settings-row-text"><strong>Test microphone</strong><small>Confirm dictation can record audio</small></span><span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span></button>
    </div>
    <span class="settings-group-label settings-group-label-spaced">Dictation</span>
    <div class="settings-list">
      ${settingsRow({ iconName: "globe", title: "Language", description: "Used when transcribing dictation", value: "Not configurable", disabled: true })}
      ${settingsSwitchRow({ title: "Auto punctuation", description: "Add punctuation automatically", checked: false, disabled: true })}
      ${settingsSwitchRow({ title: "Transcription review", description: "Review and edit before saving", checked: false, disabled: true })}
    </div>
    ${unwiredBanner("Language, auto punctuation and review-before-saving aren't built yet -- dictation always transcribes automatically in one pass.")}`;
}

function renderCameraPhotosPage() {
  return `${settingsPageHeader("Camera & photos", "Preferences")}
    <span class="settings-group-label">Permissions</span>
    <div class="settings-list">
      ${settingsRow({ iconName: "camera", title: "Camera access", description: "Used for photo capture during jobs", value: "Requested on first use" })}
    </div>
    <span class="settings-group-label settings-group-label-spaced">Image settings</span>
    <div class="settings-list">
      ${settingsRow({ iconName: "image", title: "Photo quality", description: "Compression applied on upload", value: "Not configurable", disabled: true })}
      ${settingsSwitchRow({ title: "Save location data", description: "Include location in photo metadata", checked: false, disabled: true })}
    </div>
    ${unwiredBanner("Photo quality tiers and location metadata aren't built yet -- photos upload at their original quality with no location tag.")}`;
}

function technicianName(technician) {
  return [technician.first_name, technician.last_name].filter(Boolean).join(" ");
}

// Owner created the workshop and cannot be invited away or removed while they
// are the last one; Admin is the invitable equivalent with the same rights.
function roleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

// The roster row's live invite, if it still has one. A staff member who has
// redeemed their code has a profile_id and no pending invite.
function technicianInvite(technician) {
  const invite = relatedRecord(technician.invite);
  if (!invite || invite.consumed_at) return null;
  return invite;
}

function isInvitePending(technician) {
  return !technician.profile_id && Boolean(technicianInvite(technician));
}

function inviteExpired(invite) {
  return Boolean(invite) && new Date(invite.expires_at).getTime() < Date.now();
}

function renderWorkshopProfilePage() {
  const shop = state.shop || {};
  return `${settingsPageHeader("Workshop profile", "Profile & management")}
    <span class="settings-group-label">Workshop details</span>
    <div class="settings-list">
      ${settingsEditRow({ title: "Workshop name", value: shop.name || "Not set", field: "name" })}
      ${settingsEditRow({ title: "Workshop phone", value: shop.phone || "Not set", field: "phone", optional: true })}
      ${settingsEditRow({ title: "Workshop email", value: shop.email || "Not set", field: "email", optional: true })}
      ${settingsEditRow({ title: "Business / branch ID", value: shop.branch_id || "Not set", field: "branchId" })}
      ${settingsEditRow({ title: "Region", value: shop.region || "Not set", field: "region" })}
      ${settingsEditRow({ title: "Timezone", value: shop.timezone || "Not set", field: "timezone" })}
    </div>
    <span class="settings-group-label settings-group-label-spaced">Parts &amp; suppliers</span>
    <div class="settings-list">
      ${settingsEditRow({ title: "Supplier region", value: shop.region || "Not set", field: "region" })}
      ${settingsEditRow({ title: "Preferred supplier", value: shop.preferred_supplier || "Not set", field: "preferredSupplier", optional: true })}
    </div>
    <p class="settings-detail-intro">Supplier region helps show relevant parts, pricing and availability.</p>`;
}

// One row that opens a prompt-style editor for a single shop field. Kept as a
// row rather than an always-open input so the page reads as a summary of what
// the shop is set to, matching every other settings list.
function settingsEditRow({ title, value, field, optional = false }) {
  return `<button class="settings-row" type="button" data-action="edit-shop-field" data-field="${field}" data-title="${escapeHTML(title)}" data-optional="${optional}">
    <span class="settings-row-text"><strong>${escapeHTML(title)}</strong></span>
    <span class="settings-row-value">${escapeHTML(value)}</span>
    <span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>
  </button>`;
}

function renderBaysPage() {
  const rows = state.bays.length
    ? state.bays.map((bay) => `<button class="settings-row" type="button" data-action="edit-bay" data-bay-id="${bay.id}">
        <span class="settings-row-icon" aria-hidden="true">${icon("building")}</span>
        <span class="settings-row-text"><strong>${escapeHTML(bay.name)}</strong>${bay.description ? `<small>${escapeHTML(bay.description)}</small>` : ""}</span>
        <span class="settings-row-value">${bay.active ? "Active" : "Inactive"}</span>
        <span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>
      </button>`).join("")
    : `<div class="settings-row"><span class="settings-row-text"><strong>No bays yet</strong><small>Add the bays this workshop runs.</small></span></div>`;
  return `${settingsPageHeader("Manage bays", "Profile & management")}
    <div class="settings-list">${rows}</div>
    <div class="settings-page-action"><button class="secondary-button full" type="button" data-action="add-bay">${icon("plus")} Add bay</button></div>`;
}

function technicianSearchText(technician) {
  return [technicianName(technician), roleLabel(technician.role), technician.employee_id].filter(Boolean).join(" ").toLowerCase();
}

function staffBreakdown(technicians) {
  const counts = { technician: 0, admin: 0, owner: 0 };
  technicians.forEach((technician) => { counts[technician.role] = (counts[technician.role] || 0) + 1; });
  const labels = { technician: ["Technician", "Technicians"], admin: ["Admin", "Admins"], owner: ["Owner", "Owners"] };
  return ["technician", "admin", "owner"]
    .filter((role) => counts[role])
    .map((role) => `${counts[role]} ${counts[role] === 1 ? labels[role][0] : labels[role][1]}`)
    .join(" &middot; ");
}

function renderTechniciansPage() {
  const rows = state.technicians.length
    ? state.technicians.map((technician) => {
      const pending = isInvitePending(technician);
      const expired = pending && inviteExpired(technicianInvite(technician));
      const status = pending ? (expired ? "Expired" : "Invited") : technician.active ? "Active" : "Inactive";
      return `<button class="settings-row" type="button" data-action="edit-technician" data-technician-id="${technician.id}" data-staff-search="${escapeHTML(technicianSearchText(technician))}">
        <span class="settings-row-text"><strong>${escapeHTML(technicianName(technician))}</strong><small>${technician.role === "owner" ? `<span class="role-star" aria-hidden="true">${icon("star")}</span>` : ""}${escapeHTML(roleLabel(technician.role))}${technician.employee_id ? ` &middot; ${escapeHTML(technician.employee_id)}` : ""}</small></span>
        <span class="settings-row-value${pending ? (expired ? " is-expired" : " is-invited") : ""}">${status}</span>
        <span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>
      </button>`;
    }).join("")
    : `<div class="settings-row"><span class="settings-row-text"><strong>No technicians yet</strong><small>Add the crew who work in this workshop.</small></span></div>`;
  return `${settingsPageHeader("Manage staff", "Profile & management")}
    <label class="form-field jobs-search-field jobs-search-field-tight" for="staff-search">
      <span class="jobs-search-control">${icon("search")}<input class="input jobs-search-input" id="staff-search" type="search" value="${escapeHTML(state.staffSearch || "")}" placeholder="Search by name or role" autocomplete="off" /></span>
    </label>
    <div class="settings-page-action"><button class="secondary-button full" type="button" data-action="add-technician">${icon("plus")} Invite staff</button></div>
    <div class="field-header"><span class="field-label">Staff</span><span class="settings-row-value">${state.technicians.length ? staffBreakdown(state.technicians) : "No staff yet"}</span></div>
    <div class="settings-list">${rows}</div>
    <p class="profile-empty staff-empty" hidden>No staff match "<span class="staff-empty-query"></span>".</p>`;
}

function renderUnitsPage() {
  const isMetric = unitSystem() === "metric";
  return `${settingsPageHeader("Units & measurements", "Preferences")}
    <p class="settings-detail-intro">Choose your preferred units for measurements.</p>
    <span class="settings-group-label">System of measurement</span>
    <div class="theme-options" role="group" aria-label="Choose system of measurement">
      <button class="setting-choice ${isMetric ? "is-selected" : ""}" type="button" data-units-choice="metric" aria-pressed="${isMetric}">
        <span class="settings-row-icon" aria-hidden="true">${icon("gauge")}</span>
        <span><strong>Metric</strong><small>mm, kg, &deg;C, kPa, Nm</small><span class="choice-state">${isMetric ? "Selected" : "Choose"}</span></span>
      </button>
      <button class="setting-choice ${!isMetric ? "is-selected" : ""}" type="button" data-units-choice="imperial" aria-pressed="${!isMetric}">
        <span class="settings-row-icon" aria-hidden="true">${icon("gauge")}</span>
        <span><strong>Imperial</strong><small>in, lb, &deg;F, psi, ft-lb</small><span class="choice-state">${!isMetric ? "Selected" : "Choose"}</span></span>
      </button>
    </div>
    <span class="settings-group-label settings-group-label-spaced">Units preview</span>
    <div class="settings-list">
      ${settingsRow({ iconName: "gauge", title: "Length", description: "Vehicle dimensions", value: isMetric ? "mm" : "in" })}
      ${settingsRow({ iconName: "gauge", title: "Temperature", description: "Fluid and ambient readings", value: isMetric ? "°C" : "°F" })}
      ${settingsRow({ iconName: "gauge", title: "Pressure", description: "Tyre and system pressure", value: isMetric ? "kPa" : "psi" })}
      ${settingsRow({ iconName: "gauge", title: "Torque", description: "Fastener specifications", value: isMetric ? "Nm" : "ft-lb" })}
      ${settingsRow({ iconName: "gauge", title: "Weight", description: "Parts and vehicle weight", value: isMetric ? "kg" : "lb" })}
    </div>
    ${unwiredBanner("Job odometer readings switch units immediately -- that's the only numeric measurement Argos One tracks today. The rest of this preview shows which unit each category would use; length, temperature, pressure, torque and weight aren't recorded as fields anywhere yet.")}`;
}

function renderJobDefaultsPage() {
  const shop = state.shop || {};
  const defaultBay = state.bays.find((bay) => bay.id === shop.default_bay_id);
  const defaultTechnician = state.technicians.find((technician) => technician.id === shop.default_technician_id);
  return `${settingsPageHeader("Job defaults", "Profile & management")}
    <p class="settings-detail-intro">These defaults are applied when a new job is created.</p>
    <div class="settings-list">
      <button class="settings-row" type="button" data-action="pick-default-bay">
        <span class="settings-row-icon" aria-hidden="true">${icon("building")}</span>
        <span class="settings-row-text"><strong>Default bay</strong><small>New jobs start in this bay</small></span>
        <span class="settings-row-value">${escapeHTML(defaultBay?.name || "Not set")}</span>
        <span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>
      </button>
      <button class="settings-row" type="button" data-action="pick-default-technician">
        <span class="settings-row-icon" aria-hidden="true">${icon("wrench")}</span>
        <span class="settings-row-text"><strong>Default technician</strong><small>Suggested owner for new jobs</small></span>
        <span class="settings-row-value">${escapeHTML(defaultTechnician ? technicianName(defaultTechnician) : "Not set")}</span>
        <span class="settings-row-chevron" aria-hidden="true">${icon("arrow")}</span>
      </button>
    </div>
    ${defaultTechnician ? unwiredBanner("The default bay is applied to every new job. The default technician is recorded here but isn't assigned automatically yet -- jobs are still picked up manually.") : ""}`;
}

function renderNotificationsPage() {
  return `${settingsPageHeader("Notifications", "Preferences")}
    <div class="settings-list">
      ${settingsSwitchRow({ title: "New software updates", description: "Get notified about updates", checked: false, disabled: true })}
      ${settingsSwitchRow({ title: "Job reminders", description: "Reminders for active jobs", checked: false, disabled: true })}
      ${settingsSwitchRow({ title: "System alerts", description: "Important system messages", checked: false, disabled: true })}
    </div>
    ${unwiredBanner("There's no notification system yet -- the update banner on the main Settings page is the only alert Argos One sends today.")}`;
}

function renderStoragePage() {
  return `${settingsPageHeader("Data & storage", "Preferences")}
    ${unwiredBanner("Offline cache and storage tracking aren't built yet -- Argos One always reads live from the server.")}`;
}

function renderPrivacyPage() {
  return `${settingsPageHeader("Privacy", "Preferences")}
    <p class="settings-detail-intro">What Argos One stores and shares.</p>
    <ul class="settings-check-list">
      <li>${icon("check")}<span>Customer, vehicle and job details stay in your workshop's own account.</span></li>
      <li>${icon("check")}<span>Cross-shop repair patterns are opt-in and anonymised -- see <button class="settings-inline-link" type="button" data-action="open-settings-page" data-settings-page="network-sharing">Cross-shop repair patterns</button>.</span></li>
      <li>${icon("check")}<span>Dictation audio is sent off for transcription and isn't stored afterwards.</span></li>
    </ul>`;
}

function renderHelpPage() {
  return `${settingsPageHeader("Help & feedback", "Support")}
    ${unwiredBanner("In-app support and feedback channels aren't set up yet -- reach out however your workshop normally gets in touch with your Argos One admin.")}`;
}

const SETTINGS_CHANGELOG = [
  ["28 Aug 2026", "Shop notes redesigned: Add note and Edit note now open focused modals instead of one long always-open box, with the date shown above each note."],
  ["28 Aug 2026", "Updating now shows a full-screen progress overlay so the update is impossible to miss."],
  ["28 Aug 2026", "Fixed a bug where an already-open tab could sit on an old build for minutes after an update went live -- it now checks every 30 seconds."],
  ["27 Aug 2026", "Repair library is now trim-specific end to end: pick a brand, then a model + trim, and repairs, notes and network cases all narrow to that exact trim."],
];

function renderWhatsNewPage() {
  return `${settingsPageHeader("What's new", "Support")}
    <div class="settings-list settings-changelog">
      ${SETTINGS_CHANGELOG.map(([date, text]) => `<div class="settings-row settings-changelog-row"><span class="settings-row-icon" aria-hidden="true">${icon("sparkles")}</span><span class="settings-row-text"><small>${escapeHTML(date)}</small><span>${escapeHTML(text)}</span></span></div>`).join("")}
    </div>`;
}

function openShopFieldModal({ field, title, optional }) {
  const current = {
    name: state.shop?.name,
    phone: state.shop?.phone,
    email: state.shop?.email,
    branchId: state.shop?.branch_id,
    region: state.shop?.region,
    timezone: state.shop?.timezone,
    preferredSupplier: state.shop?.preferred_supplier,
  }[field] || "";
  openSheet(`<div class="confirmation-content">
    <h2>${escapeHTML(title)}</h2>
    <form class="settings-edit-form" id="shop-field-form" autocomplete="off" data-field="${field}">
      <input class="input" name="value" value="${escapeHTML(current)}" placeholder="${escapeHTML(title)}"${optional ? "" : " required"} />
      <div class="profile-note-actions">
        <button class="secondary-button" type="button" data-action="close-sheet">Cancel</button>
        <button class="primary-button" type="submit">${icon("save")} Save</button>
      </div>
    </form>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: title });
}

function openBayModal(bay) {
  const isNew = !bay;
  openSheet(`<div class="confirmation-content">
    <h2>${isNew ? "Add bay" : "Edit bay"}</h2>
    <form class="settings-edit-form" id="bay-form" autocomplete="off" data-bay-id="${bay?.id || ""}">
      <label class="form-field"><div class="field-header"><span class="field-label">Bay name / number</span></div><input class="input" name="name" value="${escapeHTML(bay?.name || "")}" placeholder="e.g. Bay 05" required /></label>
      <label class="form-field"><div class="field-header"><span class="field-label">Description <span class="muted">(optional)</span></span></div><input class="input" name="description" value="${escapeHTML(bay?.description || "")}" placeholder="e.g. Diagnostics" /></label>
      ${settingsSwitchRow({ title: "Active", description: "Available for new jobs", checked: bay ? bay.active : true, action: "toggle-form-active" })}
      <div class="profile-note-actions">
        ${isNew
          ? `<button class="secondary-button" type="button" data-action="close-sheet">Cancel</button>`
          : `<button class="danger-button" type="button" data-action="delete-bay" data-bay-id="${bay.id}">${icon("trash")} Delete bay</button>`}
        <button class="primary-button" type="submit">${icon("save")} ${isNew ? "Save" : "Save changes"}</button>
      </div>
    </form>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: isNew ? "Add bay" : "Edit bay" });
}

function bayOptionsHtml(selectedBayId) {
  return [`<option value=""${selectedBayId ? "" : " selected"}>No bay assigned</option>`]
    .concat(state.bays.map((bay) => `<option value="${bay.id}"${selectedBayId === bay.id ? " selected" : ""}>${escapeHTML(bay.name)}</option>`))
    .join("");
}

// Owner is deliberately absent: it belongs to whoever created the workshop and
// is not something an invite can hand out.
function roleOptionsHtml(selectedRole) {
  return ["technician", "admin"]
    .map((role) => `<option value="${role}"${(selectedRole || "technician") === role ? " selected" : ""}>${roleLabel(role)}</option>`)
    .join("");
}

// Adding staff means inviting them, so this collects only what the admin
// plausibly knows -- the invitee fills in their own surname and confirms their
// contact details when they redeem the code.
function openInviteStaffModal() {
  openSheet(`<div class="sheet-head"><div><h2>Invite staff</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
    <form class="settings-edit-form" id="invite-staff-form" autocomplete="off">
      <p class="sheet-intro">They'll get an invitation code to create their own login. You can hand it to them in person — nothing is sent automatically.</p>
      <div class="customer-details-grid">
        <label class="form-field"><div class="field-header"><span class="field-label">First name</span></div><input class="input" name="firstName" placeholder="First name" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Role</span></div><span class="select-control"><select class="select" name="role">${roleOptionsHtml("technician")}</select>${icon("down")}</span></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Mobile <span class="muted">(optional)</span></span></div><input class="input" name="mobile" type="tel" inputmode="tel" placeholder="0412 345 678" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Email <span class="muted">(optional)</span></span></div><input class="input" name="email" type="email" inputmode="email" placeholder="name@email.com" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Default bay</span></div><span class="select-control"><select class="select" name="defaultBayId">${bayOptionsHtml(null)}</select>${icon("down")}</span></label>
      </div>
      <div class="profile-note-actions">
        <button class="secondary-button" type="button" data-action="close-sheet">Cancel</button>
        <button class="primary-button" type="submit">${icon("plus")} Create invite</button>
      </div>
    </form>
    </div>`, { ariaLabel: "Invite staff" });
}

// Shown immediately after an invite is created, and reachable again from the
// staff row while the code is still pending. This screen is the only delivery
// mechanism -- there is no email or SMS -- so the code is large and copyable.
function openInviteCodeModal(technician, invite) {
  const expires = new Date(invite.expires_at);
  const expiryLabel = new Intl.DateTimeFormat("en-AU", { weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(expires);
  const expired = inviteExpired(invite);
  openSheet(`<div class="sheet-head"><div><h2>${escapeHTML(technicianName(technician) || "Invitation")}</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
      <p class="sheet-intro">Give this code to ${escapeHTML(technician.first_name || "them")}. They open Argos One, tap <strong>Join a workshop</strong> and enter it to create their login.</p>
      <div class="invite-code-block${expired ? " is-expired" : ""}">
        <span class="field-label">Invitation code</span>
        <strong class="invite-code-value">${escapeHTML(invite.code)}</strong>
        <small>${expired ? "This code has expired — generate a new one." : `Expires ${escapeHTML(expiryLabel)}`}</small>
      </div>
      <div class="profile-note-actions">
        <button class="secondary-button" type="button" data-action="copy-invite-code" data-code="${escapeHTML(invite.code)}">${icon("clipboard")} Copy code</button>
        <button class="primary-button" type="button" data-action="regenerate-invite" data-technician-id="${technician.id}">${icon("plus")} New code</button>
      </div>
      <button class="text-button invite-revoke-button" type="button" data-action="revoke-invite" data-technician-id="${technician.id}">Cancel this invitation</button>
    </div>`, { ariaLabel: "Invitation code" });
}

function openTechnicianModal(technician) {
  if (!technician) return openInviteStaffModal();
  const pendingInvite = isInvitePending(technician) ? technicianInvite(technician) : null;
  if (pendingInvite) return openInviteCodeModal(technician, pendingInvite);

  // A shop with zero active Owners has nobody left who can reach this very
  // screen to fix that, so editing the last one locks the controls that
  // could strand the shop rather than only rejecting the save afterwards.
  const activeOwnerCount = state.technicians.filter((t) => t.role === "owner" && t.active).length;
  const isLastOwner = Boolean(technician.role === "owner" && technician.active && activeOwnerCount <= 1);
  // Owner stays in the list only when editing an owner: it is not offered as a
  // choice, but demoting the last one is blocked anyway.
  const roleOptions = technician.role === "owner"
    ? `<option value="owner" selected>${roleLabel("owner")}</option>${roleOptionsHtml(null)}`
    : roleOptionsHtml(technician.role);
  openSheet(`<div class="sheet-head"><div><h2>Edit staff</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
    <form class="settings-edit-form" id="technician-form" autocomplete="off" data-technician-id="${technician.id}">
      <div class="customer-details-grid">
        <label class="form-field"><div class="field-header"><span class="field-label">First name</span></div><input class="input" name="firstName" value="${escapeHTML(technician.first_name || "")}" placeholder="First name" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Last name</span></div><input class="input" name="lastName" value="${escapeHTML(technician.last_name || "")}" placeholder="Last name" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Initials <span class="muted">(optional)</span></span></div><input class="input" name="initials" maxlength="4" value="${escapeHTML(technician.initials || "")}" placeholder="e.g. DS" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Employee ID <span class="muted">(optional)</span></span></div><input class="input" name="employeeId" value="${escapeHTML(technician.employee_id || "")}" placeholder="e.g. EMP-1001" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Role</span></div><span class="select-control"><select class="select" name="role"${isLastOwner ? " disabled" : ""}>${roleOptions}</select>${icon("down")}</span></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Default bay</span></div><span class="select-control"><select class="select" name="defaultBayId">${bayOptionsHtml(technician.default_bay_id)}</select>${icon("down")}</span></label>
      </div>
      ${settingsSwitchRow({ title: "Active", description: "Currently working in this shop", checked: technician.active, action: "toggle-form-active", disabled: isLastOwner })}
      <div class="profile-note-actions">
        <button class="danger-button" type="button" data-action="delete-technician" data-technician-id="${technician.id}"${isLastOwner ? " disabled" : ""}>${icon("trash")} Delete staff</button>
        <button class="primary-button" type="submit">${icon("save")} Save changes</button>
      </div>
    </form>
    </div>`, { ariaLabel: "Edit staff" });
}

// Default bay / default technician are a pick-one-from-the-roster choice, so
// they share a single chooser rather than each getting a bespoke screen.
function openDefaultPickerModal({ title, options, selectedId, action }) {
  const rows = options.map((option) => `<button class="settings-row" type="button" data-action="${action}" data-choice-id="${option.id}">
      <span class="settings-row-text"><strong>${escapeHTML(option.label)}</strong></span>
      ${selectedId === option.id ? `<span class="settings-row-value">Selected</span>` : ""}
    </button>`).join("");
  openSheet(`<div class="confirmation-content">
    <h2>${escapeHTML(title)}</h2>
    <div class="settings-list">
      <button class="settings-row" type="button" data-action="${action}" data-choice-id="">
        <span class="settings-row-text"><strong>Not set</strong></span>
        ${selectedId ? "" : `<span class="settings-row-value">Selected</span>`}
      </button>
      ${rows}
    </div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: title });
}

// Only staff with a linked login can own a job (assigned_to is a profiles.id),
// so imported/unlinked roster rows aren't offered here. Unlike the default
// pickers above, a job always has someone assigned -- there's no "Not set".
function openReassignJobModal(job) {
  if (!job) return;
  const options = state.technicians.filter((technician) => technician.active && technician.profile_id);
  const rows = options.map((technician) => `<button class="settings-row" type="button" data-action="reassign-job-to" data-technician-id="${technician.id}">
      <span class="settings-row-text"><strong>${escapeHTML(technicianName(technician))}</strong></span>
      ${technician.profile_id === job.assignedTo ? `<span class="settings-row-value">Current</span>` : ""}
    </button>`).join("");
  openSheet(`<div class="confirmation-content">
    <h2>Reassign job</h2>
    <div class="settings-list">${rows || `<p class="empty-hint">No staff with logins available to assign yet.</p>`}</div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: "Reassign job" });
}

function reassignCurrentJob(technicianId) {
  if (!technicianId || !isPersistedJobId(state.currentJobId)) return closeSheet();
  return apiRequest(`/api/jobs/${state.currentJobId}/assign`, { method: "PATCH", body: JSON.stringify({ technicianId }) })
    .then(({ job }) => {
      const updated = databaseJobToUi(job);
      const index = jobRecords.findIndex((record) => record.id === updated.id);
      if (index >= 0) jobRecords[index] = updated; else jobRecords.push(updated);
      closeSheet();
      showToast("Job reassigned");
      render();
    })
    .catch((error) => showToast(error.message || "Could not reassign that job"));
}

async function saveShopField(form) {
  const value = String(new FormData(form).get("value") || "").trim();
  const field = form.dataset.field;
  try {
    await saveShopFields({ [field]: value || null });
    closeSheet();
    showToast("Workshop profile updated");
    render();
  } catch (error) {
    showToast(error.message || "Could not save that change");
  }
}

function formActiveState(form) {
  return form.querySelector(".switch")?.classList.contains("is-on") ?? true;
}

async function saveBay(form) {
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || "").trim(),
    description: String(data.get("description") || "").trim() || null,
    active: formActiveState(form),
  };
  if (!payload.name) return showToast("Give the bay a name");
  const bayId = form.dataset.bayId;
  try {
    await apiRequest(bayId ? `/api/shop/bays/${bayId}` : "/api/shop/bays", {
      method: bayId ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    closeSheet();
    await loadWorkshopRoster();
    showToast(bayId ? "Bay updated" : "Bay added");
    render();
  } catch (error) {
    showToast(error.message || "Could not save that bay");
  }
}

async function saveTechnician(form) {
  const data = new FormData(form);
  const payload = {
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    initials: String(data.get("initials") || "").trim() || null,
    employeeId: String(data.get("employeeId") || "").trim() || null,
    role: String(data.get("role") || "technician"),
    defaultBayId: String(data.get("defaultBayId") || "") || null,
    active: formActiveState(form),
  };
  if (!payload.firstName) return showToast("Give the technician a first name");
  if (!payload.lastName) return showToast("Give the technician a last name");
  try {
    await apiRequest(`/api/shop/technicians/${form.dataset.technicianId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    closeSheet();
    await loadWorkshopRoster();
    showToast("Staff member updated");
    render();
  } catch (error) {
    showToast(error.message || "Could not save that technician");
  }
}

// Creates the roster row and its code together, then hands straight over to
// the code screen -- that display is the only way the code reaches the staff
// member, so it must never be skipped.
async function saveStaffInvite(form) {
  const data = new FormData(form);
  const payload = {
    firstName: String(data.get("firstName") || "").trim(),
    email: String(data.get("email") || "").trim() || null,
    mobile: String(data.get("mobile") || "").trim() || null,
    role: String(data.get("role") || "technician"),
    defaultBayId: String(data.get("defaultBayId") || "") || null,
  };
  if (!payload.firstName) return showToast("Give the staff member a first name");
  try {
    const { technician, invite } = await apiRequest("/api/shop/technicians", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await loadWorkshopRoster();
    render();
    openInviteCodeModal(technician, invite);
  } catch (error) {
    showToast(error.message || "Could not create that invitation");
  }
}

async function regenerateInvite(technicianId) {
  try {
    const { invite } = await apiRequest(`/api/shop/technicians/${technicianId}/invite`, { method: "POST" });
    await loadWorkshopRoster();
    render();
    const technician = state.technicians.find((entry) => entry.id === technicianId);
    if (technician) openInviteCodeModal(technician, invite);
    showToast("New code generated");
  } catch (error) {
    showToast(error.message || "Could not generate a new code");
  }
}

async function revokeInvite(technicianId) {
  try {
    await apiRequest(`/api/shop/technicians/${technicianId}/invite`, { method: "DELETE" });
    await apiRequest(`/api/shop/technicians/${technicianId}`, { method: "DELETE" });
    closeSheet();
    await loadWorkshopRoster();
    showToast("Invitation cancelled");
    render();
  } catch (error) {
    showToast(error.message || "Could not cancel that invitation");
  }
}

// navigator.clipboard is unavailable on insecure origins and older tablet
// browsers, so fall back to selecting the code for a manual copy.
async function copyInviteCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast("Code copied");
  } catch (_) {
    const target = document.querySelector(".invite-code-value");
    if (target && window.getSelection) {
      const range = document.createRange();
      range.selectNodeContents(target);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      showToast("Press and hold to copy the code");
      return;
    }
    showToast("Could not copy — write the code down");
  }
}

async function saveShopFields(patch) {
  const { shop } = await apiRequest("/api/shop", { method: "PATCH", body: JSON.stringify(patch) });
  state.shop = { ...shop, sharesRepairData: Boolean(shop.shares_repair_data), networkReadExempt: Boolean(shop.network_read_exempt) };
}

const SETTINGS_PAGES = {
  theme: renderThemePage,
  "network-sharing": renderNetworkSharingPage,
  "voice-dictation": renderVoiceDictationPage,
  "camera-photos": renderCameraPhotosPage,
  "workshop-profile": renderWorkshopProfilePage,
  bays: renderBaysPage,
  technicians: renderTechniciansPage,
  units: renderUnitsPage,
  "job-defaults": renderJobDefaultsPage,
  notifications: renderNotificationsPage,
  storage: renderStoragePage,
  privacy: renderPrivacyPage,
  help: renderHelpPage,
  "whats-new": renderWhatsNewPage,
};

function updateMicPermissionLabel() {
  const label = document.querySelector("#mic-permission-value");
  if (!label) return;
  if (!navigator.permissions?.query) { label.textContent = "Unknown"; return; }
  navigator.permissions.query({ name: "microphone" })
    .then((status) => {
      const current = document.querySelector("#mic-permission-value");
      if (!current) return;
      current.textContent = status.state === "granted" ? "Allowed" : status.state === "denied" ? "Blocked" : "Not requested yet";
    })
    .catch(() => { const current = document.querySelector("#mic-permission-value"); if (current) current.textContent = "Unknown"; });
}

const LOCKED_SETTINGS_PAGES = new Set(["workshop-profile", "bays", "technicians", "job-defaults"]);

function renderSettings() {
  if (!state.settingsPage) return renderSettingsHome();
  const pageRenderer = SETTINGS_PAGES[state.settingsPage];
  const isTechnicianRole = (currentTechnician()?.role || state.profile?.role || "technician") === "technician";
  if (!pageRenderer || (isTechnicianRole && LOCKED_SETTINGS_PAGES.has(state.settingsPage))) {
    state.settingsPage = null;
    state.settingsTrail = [];
    if (isTechnicianRole && pageRenderer) showToast("You don't have access to this section.");
    return renderSettingsHome();
  }
  app.innerHTML = `<section class="screen workflow-shell settings-shell settings-detail-shell">${pageRenderer()}</section>`;
  if (state.settingsPage === "voice-dictation") updateMicPermissionLabel();
}

function renderVehicle() {
  // Catalogue and VIN responses may omit optional specifications. Keep every
  // form value string-safe so an absent value never renders as "undefined".
  ["vin", "year", "make", "model", "trim", "drivetrain", "engine", "transmission", "registration", "mileage"].forEach((key) => {
    state.vehicle[key] = String(state.vehicle[key] || "");
  });
  const makes = [state.vehicle.make, ...state.catalog.makes, "Volvo", "Toyota", "Ford", "Honda", "BMW"].filter((value, index, values) => value && values.indexOf(value) === index);
  const models = [state.vehicle.model, ...state.catalog.models].filter((value, index, values) => value && values.indexOf(value) === index);
  const variants = [state.vehicle.trim, ...state.catalog.variants.map((variant) => variant.name)].filter((value, index, values) => value && values.indexOf(value) === index);
  const savedName = splitCustomerName(state.vehicle.customerName);
  const firstName = state.vehicle.customerFirstName ?? savedName.firstName;
  const lastName = state.vehicle.customerLastName ?? savedName.lastName;
  app.innerHTML = `<section class="screen workflow-shell">
    ${vehicleTaskHeader()}
    ${workflowJourney(1)}
    ${assignmentBar()}
    <form id="vehicle-form" class="form-grid two-col">
      <div class="form-field span-2 vin-field">
        <div class="field-header"><label class="field-label" for="vin">Scan or enter VIN</label></div>
        <div class="vin-row">
          <input class="input" id="vin" name="vin" maxlength="17" value="${state.vehicle.vin}" placeholder="17-character VIN" autocapitalize="characters" />
          <button class="icon-button vin-camera" type="button" data-action="scan-vin" aria-label="Open camera to scan VIN">${icon("scan")}</button>
        </div>
        <span class="helper">Use the camera on the dash or door-jamb plate. Vehicle data can still be corrected after decoding.</span>
      </div>
      <div class="vehicle-details-grid span-2">
        <label class="form-field"><div class="field-header"><span class="field-label">Year</span></div><input class="input" name="year" inputmode="numeric" value="${state.vehicle.year}" placeholder="e.g. 2010" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Make</span></div><span class="select-control"><select class="select${state.vehicle.make ? "" : " is-placeholder"}" name="make" id="vehicle-make" required aria-label="Make"><option value="" disabled${state.vehicle.make ? "" : " selected"}></option>${makes.map((make) => `<option${state.vehicle.make === make ? " selected" : ""}>${escapeHTML(make)}</option>`).join("")}</select>${icon("down")}</span></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Model</span></div><span class="select-control"><select class="select${state.vehicle.model ? "" : " is-placeholder"}" name="model" id="vehicle-model"${state.vehicle.make ? "" : " disabled"} required aria-label="Model"><option value="" disabled${state.vehicle.model ? "" : " selected"}></option>${models.map((model) => `<option${state.vehicle.model === model ? " selected" : ""}>${escapeHTML(model)}</option>`).join("")}</select>${icon("down")}</span></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Trim</span></div><span class="select-control"><select class="select${state.vehicle.trim ? "" : " is-placeholder"}" name="trim" id="vehicle-trim" required aria-label="Trim"><option value=""${state.vehicle.trim ? "" : " selected"}></option>${variants.map((variant) => `<option${state.vehicle.trim === variant ? " selected" : ""}>${escapeHTML(variant)}</option>`).join("")}</select>${icon("down")}</span></label>
        ${specFieldHtml("drivetrain", "Drivetrain", "e.g. AWD", ["FWD", "RWD", "AWD", "4WD"])}
        ${specFieldHtml("engine", "Engine", "e.g. 2.0L turbo", null)}
        ${specFieldHtml("transmission", "Transmission", "e.g. 7-speed DSG", null)}
        <label class="form-field"><div class="field-header"><span class="field-label">Registration <span class="muted">(optional)</span></span></div><input class="input" name="registration" autocapitalize="characters" value="${escapeHTML(state.vehicle.registration)}" placeholder="e.g. 1ABC234" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Current mileage</span></div><input class="input" name="mileage" inputmode="numeric" value="${state.vehicle.mileage}" placeholder="e.g. 82000" required /></label>
        <div class="catalog-action-row"><button class="secondary-button field-secondary-action catalog-add-button" type="button" data-action="add-catalog-vehicle">${icon("plus")} Add new vehicle</button></div>
      </div>
      <div class="customer-details-heading span-2"><h2>Customer details</h2></div>
      <div class="customer-details-grid span-2">
        <label class="form-field"><div class="field-header"><span class="field-label">First name</span></div><input class="input" name="customerFirstName" autocomplete="given-name" value="${escapeHTML(firstName)}" placeholder="First name" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Last name</span></div><input class="input" name="customerLastName" autocomplete="family-name" value="${escapeHTML(lastName)}" placeholder="Last name" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Phone <span class="muted">(optional)</span></span></div><input class="input" name="customerPhone" autocomplete="tel" inputmode="tel" value="${escapeHTML(state.vehicle.customerPhone)}" placeholder="Mobile number" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Email <span class="muted">(optional)</span></span></div><input class="input" name="customerEmail" autocomplete="email" inputmode="email" type="email" value="${escapeHTML(state.vehicle.customerEmail || "")}" placeholder="Email address" /></label>
      </div>
      <div class="action-dock vehicle-actions span-2"><button class="primary-button full" type="submit">Save & continue ${icon("arrow")}</button></div>
    </form>
  </section>`;
  if (!canEditCurrentJob()) lockWorkflowForm();
}

function vehicleContext(score = "") {
  const specifications = [formatMileageDisplay(state.vehicle.mileage), state.vehicle.trim, state.vehicle.engine, state.vehicle.drivetrain, state.vehicle.transmission].filter(Boolean);
  return `<section class="vehicle-context" aria-label="Locked vehicle details">
    <div class="vehicle-context-main"><div class="vehicle-name">${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}</div><div class="vehicle-data">${specifications.map(escapeHTML).join(" · ")}</div></div>
    ${score ? `<div class="vehicle-score" aria-label="${score} percent vehicle data confidence">${score}<span class="percent-symbol">%</span></div>` : ""}
  </section>`;
}

function photoCollection(scope) {
  return scope === "repair" ? state.repair.photos : state.photos;
}

function photoUrl(photo) {
  return typeof photo === "string" ? photo : photo?.url || "";
}

function photoStrip(photos, scope, label) {
  if (!photos.length) {
    return `<div class="photo-strip is-empty" aria-label="${label} gallery"><span class="photo-slot photo-slot-empty" aria-hidden="true"></span></div>`;
  }
  const emptySlots = Math.max(1, 3 - photos.length);
  return `<div class="photo-strip" aria-label="${label} gallery">
    ${photos.map((photo, index) => `<button class="photo-thumb-button" type="button" data-action="view-photo" data-photo-scope="${scope}" data-photo-index="${index}" aria-label="Open photo ${index + 1} of ${photos.length}"><img src="${escapeHTML(photoUrl(photo))}" alt="${label} ${index + 1}" class="photo-thumb" /><span class="photo-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></button>`).join("")}
    ${Array.from({ length: emptySlots }, () => '<span class="photo-slot" aria-hidden="true"></span>').join("")}
  </div>`;
}

function photoActionButtons() {
  return `<div class="field-actions photo-actions"><button class="dictate-button" type="button" data-action="add-photo" data-photo-mode="camera">${icon("camera")}<span>Take photo</span></button><button class="dictate-button" type="button" data-action="add-photo" data-photo-mode="upload">${icon("upload")}<span>Upload file</span></button></div>`;
}

function renderProblem() {
  app.innerHTML = `<section class="screen workflow-shell">
    ${problemTaskHeader()}
    ${workflowJourney(2)}
    ${assignmentBar()}
    <form id="problem-form" class="form-grid assessment-form">
      <div class="form-field">
        <div class="field-header"><label class="field-label intake-section-title" for="complaint">Symptoms</label></div>
        <div class="text-field-shell"><textarea class="textarea" id="complaint" name="complaint" placeholder="In their own words…" required>${state.complaint}</textarea></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="complaint" aria-pressed="false">${icon("mic")} Dictate</button></div>
      </div>
      <div class="form-field">
        <div class="field-header"><label class="field-label intake-section-title" for="notes">Initial observations <span class="optional-label">(optional)</span></label></div>
        <div class="text-field-shell"><textarea class="textarea" id="notes" name="notes" placeholder="Objective signs noticed before research…">${state.notes}</textarea><button class="see-original-button" type="button" data-see-original="notes" hidden>Show original</button></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="notes" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="notes">${icon("sparkles")} AI enhance</button></div>
      </div>
      <div class="form-field repair-dtc-field">
        <div class="field-header"><span class="field-label intake-section-title">Diagnostic trouble codes <span class="optional-label">(optional)</span></span></div>
        <div class="field-actions dtc-actions">
          <button class="add-dtc-button" type="button" data-action="add-dtc">${icon("plus")}<span>Add code</span></button>
          <div class="quick-row" id="dtc-row">${state.dtcs.map((code) => `<span class="dtc-chip caps-text">${code}<button class="dtc-chip-remove" type="button" data-action="remove-dtc" data-code="${code}" aria-label="Remove ${code}">${icon("close")}</button></span>`).join("")}</div>
        </div>
      </div>
      <div class="form-field">
        <div class="field-header"><span class="field-label intake-section-title">Arrival photos <span class="optional-label">(optional)</span></span></div>
        <div class="photo-panel">${photoStrip(state.photos, "inspection", "Arrival photo")}</div>
        <p class="photo-upload-hint">Maximum file size: 15 MB. Allowed formats: JPG, PNG, WebP, HEIC and HEIF.</p>
        ${photoActionButtons()}
      </div>
      <div class="action-dock intake-actions"><button class="secondary-button full" type="submit">${icon("search")} Show similar repairs</button><button class="primary-button full" type="button" data-action="proceed-to-diagnosis" aria-label="Save assessment and continue directly to repair">Save & continue ${icon("arrow")}</button></div>
    </form>
  </section>`;
  if (!canEditCurrentJob()) lockWorkflowForm();
}

function renderResults() {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair) || repairMatches[0];
  const selectedPercent = repairMatchPercent(selected);
  const selectedVehicleName = selected.vehicle.split(" · ")[0];
  const specRows = [
    [selected.trim, selected.drivetrain],
    [selected.engine, selected.transmission],
    [selected.mileageLabel],
  ].map((parts) => parts.filter(Boolean).join(" · ")).filter(Boolean);
  const repairedLabel = selected.repairedDateLabel ? `Repaired ${selected.repairedDateLabel}` : "";
  const repairCountClass = repairMatches.length === 1 ? "has-one" : repairMatches.length === 2 ? "has-two" : "has-many";
  app.innerHTML = `<section class="screen workflow-shell">
    ${resultsTaskHeader()}
    ${workflowJourney(3)}
    ${assignmentBar()}

    <div class="match-selector ${repairCountClass}" role="group" aria-label="Choose a repair record">
      ${repairMatches.map((repair) => matchOption(repair, repair.id === selected.id)).join("")}
    </div>

    <section class="selected-repair-card" aria-live="polite" aria-labelledby="selected-repair-heading-label">
      <div class="selected-repair-top">
        <span class="field-label selected-repair-eyebrow${selected.rank === "01" ? " is-best" : ""}" id="selected-repair-heading-label">${selected.rank === "01" ? "Best match" : `Repair ${selected.rank}`}</span>
        <span class="selected-match-value${selected.rank === "01" ? " is-best" : ""}">${selectedPercent}<span class="percent-symbol">%</span></span>
      </div>
      <h2 id="selected-repair-heading">${selectedVehicleName}</h2>
      <div class="selected-repair-specs">
        ${specRows.length ? `<span class="selected-repair-spec-line">${icon("car")}<span>${escapeHTML(specRows.join(" · "))}</span></span>` : ""}
        ${repairedLabel ? `<span class="selected-repair-date-line">${icon("calendar")}<span>${escapeHTML(repairedLabel)}</span></span>` : ""}
      </div>

      ${reportCoreSections({ complaint: selected.complaint, observations: selected.observations, dtcs: selected.dtcs, workPerformed: selected.workPerformed, verificationNotes: selected.verificationNotes })}
      <div class="result-detail-section" aria-labelledby="parts-used-label">
        <div class="field-header parts-heading"><span class="field-label" id="parts-used-label">Parts & consumables used</span><span class="parts-item-count">${selected.parts.length} items</span></div>
        <div class="parts-panel always-visible">${selected.parts.map(([name, number, key]) => partRow(name, number, key)).join("")}</div>
      </div>
    </section>
    <div class="result-actions"><button class="primary-button full" type="button" data-action="log-fix">${materialIcon("resumeJob")} Save & start repair</button><button class="web-button full" type="button" data-action="web-research">${icon("globe")} Search web repair tips</button></div>
  </section>`;
  if (!canEditCurrentJob()) lockWorkflowForm();
}

// Controlled vocabulary for grouping repairs on the car profile. Wider than
// the SAE code systems in dtc_reference, which only cover powertrain -- a
// brake or suspension job has no fault code to derive a category from.
const REPAIR_SYSTEMS = [
  { value: "engine_fuel_air", label: "Engine — fuel & air" },
  { value: "ignition", label: "Ignition & misfire" },
  { value: "transmission", label: "Transmission & driveline" },
  { value: "emissions", label: "Emissions" },
  { value: "cooling_hvac", label: "Cooling & HVAC" },
  { value: "brakes", label: "Brakes" },
  { value: "suspension_steering", label: "Suspension & steering" },
  { value: "electrical", label: "Electrical & battery" },
  { value: "body_interior", label: "Body & interior" },
  { value: "other", label: "Other" },
];

const REPAIR_SYSTEM_LABELS = new Map(REPAIR_SYSTEMS.map((entry) => [entry.value, entry.label]));

function renderRepairRecord() {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair) || repairMatches[0];
  const jobSpecRows = [
    state.vehicle.trim,
    [state.vehicle.drivetrain, state.vehicle.engine].filter(Boolean).join(" · "),
    [state.vehicle.transmission, formatMileageDisplay(state.vehicle.mileage)].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const activeJobRecord = jobRecords.find((record) => String(record.id) === String(state.currentJobId));
  app.innerHTML = `<section class="screen workflow-shell repair-record-shell">
    ${repairRecordHeader()}
    ${workflowJourney(4)}
    ${assignmentBar()}
    <div class="repair-job-strip">
      <div class="repair-job-info">
        <strong>${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}</strong>
        ${jobSpecRows.map((row) => `<span>${escapeHTML(row)}</span>`).join("")}
      </div>
      <div class="repair-job-meta">
        ${activeJobRecord?.jobNumber ? `<span class="repair-job-number">Job ${escapeHTML(activeJobRecord.jobNumber)}</span>` : ""}
        ${activeJobRecord?.bay ? `<span class="repair-job-bay">${escapeHTML(activeJobRecord.bay)}</span>` : ""}
      </div>
    </div>

    <form id="repair-form" class="repair-form">
      <div class="form-field">
        <div class="field-header"><label class="field-label" for="repair-system">System type</label></div>
        <span class="select-control"><select class="select${state.repair.system ? "" : " is-placeholder"}" id="repair-system" name="system" aria-label="System type" required>
          <option value=""${state.repair.system ? "" : " selected"} disabled>Select a system</option>
          ${REPAIR_SYSTEMS.map((entry) => `<option value="${entry.value}"${state.repair.system === entry.value ? " selected" : ""}>${escapeHTML(entry.label)}</option>`).join("")}
        </select>${icon("down")}</span>
        <p class="photo-upload-hint">Groups this repair on the car profile so recurring issues surface for the next mechanic.</p>
      </div>

      <div class="form-field">
        <div class="field-header"><label class="field-label" for="repair-notes">Work performed</label></div>
        <div class="text-field-shell"><textarea class="textarea repair-notes" id="repair-notes" name="workNotes" placeholder="Record tests, repair steps and adjustments…">${escapeHTML(state.repair.workNotes)}</textarea><button class="see-original-button" type="button" data-see-original="repair-notes" hidden>Show original</button></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="repair-notes" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="repair-notes">${icon("sparkles")} AI enhance</button></div>
      </div>

      <section class="repair-parts-section" aria-labelledby="repair-parts-heading">
        <div class="repair-section-head"><span class="field-label" id="repair-parts-heading">Parts & consumables <span class="optional-label">(optional)</span></span></div>
        ${repairPartsTable()}
        <button class="secondary-button add-parts-button" type="button" data-action="open-parts-editor">${icon("plus")} Add parts & consumables</button>
      </section>

      <div class="form-field">
        <div class="field-header"><label class="field-label" for="repair-verification">Verification notes</label></div>
        <div class="text-field-shell"><textarea class="textarea" id="repair-verification" name="verificationNotes" placeholder="How did you confirm the repair worked?">${escapeHTML(state.repair.verificationNotes)}</textarea><button class="see-original-button" type="button" data-see-original="repair-verification" hidden>Show original</button></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="repair-verification" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="repair-verification">${icon("sparkles")} AI enhance</button></div>
      </div>

      <div class="form-field">
        <div class="field-header"><span class="field-label">Repair photos <span class="optional-label">(optional)</span></span></div>
        <div class="photo-panel">${photoStrip(state.repair.photos, "repair", "Repair photo")}</div>
        <p class="photo-upload-hint">Maximum file size: 15 MB. Allowed formats: JPG, PNG, WebP, HEIC and HEIF.</p>
        ${photoActionButtons()}
      </div>

      <div class="action-dock repair-action-dock"><button class="secondary-button full" type="button" data-action="save-repair-draft">${icon("save")} Save job</button><button class="primary-button full" type="submit">${icon("check")} Complete job</button></div>
    </form>
  </section>`;
  if (!canEditCurrentJob()) lockWorkflowForm();
}

function repairPartsTable() {
  if (!state.repair.parts.length) {
    return `<div class="repair-parts-empty"><span>No items added to this repair yet.</span></div>`;
  }

  return `<div class="repair-parts-table" role="table" aria-label="Parts and consumables added to this repair">
    <div class="repair-parts-table-head visually-hidden" role="row"><span role="columnheader">Item</span><span role="columnheader">Qty</span><span role="columnheader">Supplier / price</span><span role="columnheader">Actions</span></div>
    ${state.repair.parts.map((part, index) => `<div class="repair-parts-table-row" role="row">
      <div class="recorded-part-main" role="cell"><strong>${escapeHTML(part.name)}</strong><span>${escapeHTML(part.type)}${part.number ? ` · ${escapeHTML(part.number)}` : ""}</span></div>
      <span class="recorded-part-qty" role="cell">${escapeHTML(part.quantity || "1")}</span>
      <div class="recorded-part-price" role="cell">${part.supplier ? `<strong>${escapeHTML(part.price)}</strong><span>${escapeHTML(part.supplier)}</span>${part.offerUrl ? `<a href="${escapeHTML(part.offerUrl)}" target="_blank" rel="noopener noreferrer">View offer</a>` : ""}` : `<span>Not priced</span>`}</div>
      <div class="recorded-part-actions" role="cell"><button type="button" data-part="${escapeHTML(part.key || "custom")}" data-part-name="${escapeHTML(part.name)}">${icon("search")} Price</button><button type="button" data-action="remove-recorded-part" data-recorded-part-index="${index}">Remove</button></div>
    </div>`).join("")}
  </div>`;
}

function resolvedPhotoGallery() {
  const photos = [
    ...state.photos.map((photo, index) => ({ photo, scope: "inspection", index })),
    ...state.repair.photos.map((photo, index) => ({ photo, scope: "repair", index })),
  ];
  if (!photos.length) return `<div class="resolved-photo-empty">No photos were saved with this repair.</div>`;
  return `<div class="resolved-photo-gallery">${photos.map(({ photo, scope, index }, displayIndex) => `<button type="button" data-action="view-photo" data-photo-scope="${scope}" data-photo-index="${index}" aria-label="Open repair photo ${displayIndex + 1}"><img src="${escapeHTML(photoUrl(photo))}" alt="Repair photo ${displayIndex + 1}" /></button>`).join("")}</div>`;
}

function resolvedDetailSection(label, content, { optional = "" } = {}) {
  return `<div class="result-detail-section">
    <div class="field-header"><span class="field-label">${label}${optional ? ` <span class="optional-label">${optional}</span>` : ""}</span></div>
    ${content}
  </div>`;
}

// Shared by the resolved job report and the similar-repairs match card so
// the two can't drift out of sync again -- same section order, same
// labels, same fallback copy, regardless of which screen is asking. Parts
// and photos are left to the caller since they genuinely differ (clickable
// "add to repair" on a match vs. a static list on a finished job; a match
// has no photos at all).
function reportCoreSections(fields) {
  return `${resolvedDetailSection("Symptoms", `<div class="repair-summary-box"><p>${escapeHTML(fields.complaint) || "No complaint recorded."}</p></div>`)}
    ${resolvedDetailSection("Initial observations", `<div class="repair-summary-box"><p>${escapeHTML(fields.observations || "No initial observations recorded.")}</p></div>`)}
    ${resolvedDetailSection("Diagnostic trouble codes", (fields.dtcs || []).length ? `<div class="quick-row">${fields.dtcs.map((code) => `<span class="dtc-chip caps-text">${escapeHTML(code)}</span>`).join("")}</div>` : `<div class="repair-summary-box"><p>No scan codes recorded.</p></div>`)}
    ${resolvedDetailSection("Work performed", `<div class="repair-summary-box"><p>${escapeHTML(fields.workPerformed || "No work performed recorded.")}</p></div>`)}
    ${resolvedDetailSection("Verification", `<div class="repair-summary-box"><p>${escapeHTML(fields.verificationNotes || "No verification notes recorded.")}</p></div>`)}`;
}

// Read-only twin of partRow(): a resolved job is a finished record, so parts
// are listed as a table rather than offered as "add to repair" actions.
function resolvedPartRow(part) {
  const meta = [part.type, part.number, `QTY ${part.quantity}`].filter(Boolean).join(" · ");
  return `<div class="part-row is-static">
    <div><div class="part-name">${escapeHTML(part.name)}</div><div class="part-number">${escapeHTML(meta)}</div></div>
  </div>`;
}

function renderResolvedJob() {
  const job = jobRecords.find((record) => String(record.id) === String(state.selectedJobId) && (record.status === "resolved" || record.status === "deleted"));
  if (!job) {
    app.innerHTML = `<section class="screen workflow-shell"><section class="empty-state"><h1>Repair not found</h1><p>The requested repair record is unavailable.</p><button class="secondary-button" type="button" data-route="jobs">Back to jobs</button></section></section>`;
    return;
  }
  const vehicle = jobVehicleName(job);
  const isDeleted = job.status === "deleted";
  // A deleted (cancelled) job never resolves, so it has no resolved_at --
  // show when it was cancelled (updated_at) instead. Matches the "Active
  // job" header exactly: context + title, no back button, no status
  // chip -- this is a paused job, not a finished repair.
  const backLabel = state.resolvedReturn.route === "car-profile" ? "Back to repair history" : "Back to jobs";
  const header = isDeleted
    ? taskHeader({ context: vehicle, title: "Deleted job", backAction: "back-from-resolved", backLabel })
    : taskHeader({ context: "Repair details", title: vehicle, status: "Resolved", statusType: "resolved", backAction: "back-from-resolved", backLabel });
  // Vehicle spec line holds trim/drivetrain/engine/transmission only --
  // mileage gets its own odometer line rather than being folded in here.
  const specLine = [
    [job.vehicle.trim, job.vehicle.drivetrain].filter(Boolean).join(" · "),
    [job.vehicle.engine, job.vehicle.transmission].filter(Boolean).join(" · "),
  ].filter(Boolean).join(" · ");
  const odometerLine = job.vehicle.mileage ? `Odometer: ${formatMileageDisplay(job.vehicle.mileage)}` : "";
  // Date only -- no time -- matching the similar-repair card.
  const dateSource = isDeleted ? job.raw.updated_at : job.raw.resolved_at;
  const dateLabel = dateSource ? `${isDeleted ? "Deleted" : "Repaired"} ${mediumDate(dateSource)}` : "";
  app.innerHTML = `<section class="screen workflow-shell resolved-job-shell${isDeleted ? " deleted-job-shell" : ""}">
    ${header}
    <section class="selected-repair-card resolved-repair-card" aria-label="${isDeleted ? "Deleted job record" : "Resolved repair record"}">
      <div class="resolved-report-head">
        <div class="resolved-report-identity">
          <h2>${escapeHTML(vehicle)}</h2>
          <div class="selected-repair-specs">
            ${specLine ? `<span class="selected-repair-spec-line">${icon("car")}<span>${escapeHTML(specLine)}</span></span>` : ""}
            ${odometerLine ? `<span class="selected-repair-date-line">${icon("gauge")}<span>${escapeHTML(odometerLine)}</span></span>` : ""}
            ${dateLabel ? `<span class="selected-repair-date-line">${icon("calendar")}<span>${escapeHTML(dateLabel)}</span></span>` : ""}
          </div>
        </div>
        <div class="repair-job-meta">
          ${job.jobNumber ? `<span class="repair-job-number">Job ${escapeHTML(job.jobNumber)}</span>` : ""}
          ${job.technician ? `<span class="repair-job-bay">${escapeHTML(job.technician)}</span>` : ""}
        </div>
      </div>

      ${reportCoreSections({ complaint: job.complaint, observations: job.observations, dtcs: job.dtcs, workPerformed: job.workPerformed, verificationNotes: job.verification })}
      <div class="result-detail-section">
        <div class="field-header parts-heading"><span class="field-label">Parts &amp; consumables used</span><span class="parts-item-count">${job.parts.length} ${job.parts.length === 1 ? "item" : "items"}</span></div>
        ${job.parts.length ? `<div class="parts-panel always-visible">${job.parts.map(resolvedPartRow).join("")}</div>` : `<div class="repair-summary-box"><p>No parts or consumables recorded.</p></div>`}
      </div>
      ${resolvedDetailSection("Repair photos", resolvedPhotoGallery())}
    </section>
    ${job.referenceJobId ? `<button class="text-button resolved-reference-link" type="button" data-action="open-job" data-job-id="${escapeHTML(job.referenceJobId)}">${icon("back")} Previous repair reference</button>` : ""}
    ${isDeleted ? `<div class="action-dock resolved-actions span-2">
      <button class="secondary-button full" type="button" data-action="restore-job" data-job-id="${job.id}">${icon("back")} Restore job</button>
      <button class="danger-button full" type="button" data-action="delete-forever" data-job-id="${job.id}">${icon("trash")} Delete forever</button>
    </div>` : ""}
  </section>`;
}

function matchOption(repair, isSelected) {
  const percent = repairMatchPercent(repair);
  const evidence = repairMatchEvidence(repair);
  const vehicleName = repair.vehicle.split(" · ")[0];
  return `<button class="match-option${isSelected ? " is-selected" : ""}" type="button" data-repair-match="${repair.id}" aria-pressed="${isSelected}">
    <span class="match-option-top"><span class="match-option-rank">${repair.rank}${repair.rank === "01" ? `<span class="match-option-best">Best match</span>` : ""}</span><span class="match-option-score">${percent}<span class="percent-symbol">%</span></span></span>
    <span class="match-option-copy"><strong>${vehicleName}</strong><ul class="match-option-evidence">${evidence.map((reason) => `<li>${icon("check")}<span>${reason}</span></li>`).join("")}</ul>${repair.repairSummary ? `<p class="match-option-summary">${escapeHTML(repair.repairSummary)}</p>` : ""}</span>
    <span class="match-option-action" aria-hidden="true">${icon(isSelected ? "check" : "arrow")}</span>
  </button>`;
}

function restoreMatchCarouselPosition() {
  if (!pendingMatchCarouselRestore) return;
  const pending = pendingMatchCarouselRestore;
  pendingMatchCarouselRestore = null;
  const selector = document.querySelector(".match-selector");
  if (!selector) return;
  const selected = Array.from(selector.querySelectorAll("[data-repair-match]")).find((option) => option.dataset.repairMatch === pending.selectedRepair);
  const maximumScroll = Math.max(0, selector.scrollWidth - selector.clientWidth);
  const targetScroll = pending.pinSelectedRight
    ? pending.targetScroll
    : pending.scrollLeft;
  selector.style.scrollSnapType = "none";
  const boundedTarget = Math.max(0, Math.min(targetScroll, maximumScroll));
  if (pending.pinSelectedRight) {
    selector.scrollTo({ left: boundedTarget, behavior: "smooth" });
    window.setTimeout(() => selector.style.removeProperty("scroll-snap-type"), 360);
  } else {
    selector.scrollLeft = boundedTarget;
    requestAnimationFrame(() => selector.style.removeProperty("scroll-snap-type"));
  }
}

function partRow(name, number, key) {
  const isAdded = state.repair.parts.some((part) => part.key === key || part.name === name);
  return `<div class="part-row"><div><div class="part-name">${name}</div><div class="part-number">${number}</div></div><div class="part-row-actions"><button class="part-button add-reference-part" type="button" data-action="add-reference-part" data-reference-key="${key}" data-reference-name="${name}" data-reference-number="${number}" ${isAdded ? "disabled" : ""}>${isAdded ? `${icon("check")} Added` : `${icon("plus")} Add to repair`}</button></div></div>`;
}

function render() {
  if (state.route === "home") renderHome();
  if (state.route === "jobs") renderJobs();
  if (state.route === "knowledge") renderKnowledge();
  if (state.route === "car-profile") renderCarProfile();
  if (state.route === "settings") renderSettings();
  if (state.route === "resolved") renderResolvedJob();
  if (state.route === "new" && state.step === 1) renderVehicle();
  if (state.route === "new" && state.step === 2) renderProblem();
  if (state.route === "new" && state.step === 3) renderResults();
  if (state.route === "repair") renderRepairRecord();
  hydrateIcons(app);
  if (animateNextScreen) {
    app.querySelector(".screen")?.classList.add("screen-enter");
    animateNextScreen = false;
  }
  app.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    restoreMatchCarouselPosition();
    updateScrollCue();
    updateStickyJourney();
    scrollJourneyIntoView();
  });
}

function syncVehicle(form) {
  const data = new FormData(form);
  ["vin", "year", "make", "model", "mileage", "trim", "engine", "drivetrain", "transmission", "registration", "customerFirstName", "customerLastName", "customerPhone", "customerEmail"].forEach((key) => {
    state.vehicle[key] = String(data.get(key) || "").trim();
  });
  state.vehicle.customerName = customerFullName();
}

async function decodeVin(vin) {
  const normalizedVin = String(vin || "").trim().toUpperCase();
  if (normalizedVin.length !== 17) return;
  showToast("Decoding VIN…");
  try {
    const response = await fetch(`/api/vin?vin=${encodeURIComponent(normalizedVin)}`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "VIN could not be decoded");
    state.vehicle = {
      ...state.vehicle,
      vin: normalizedVin,
      year: String(result.year || state.vehicle.year),
      make: String(result.make || state.vehicle.make),
      model: String(result.model || state.vehicle.model),
      trim: String(result.trim || state.vehicle.trim),
      engine: String(result.engine || state.vehicle.engine),
      drivetrain: String(result.drivetrain || state.vehicle.drivetrain),
      transmission: String(result.transmission || state.vehicle.transmission),
    };
    await loadCatalogModels(state.vehicle.make);
    await loadCatalogVariants(state.vehicle.make, state.vehicle.model);
    render();
    showToast(result.partial ? "VIN partially decoded — check the vehicle details." : "VIN decoded — vehicle details auto-filled.");
  } catch (error) {
    showToast(error?.message || "VIN lookup failed. Enter the vehicle details manually.");
  }
}

function syncProblem(form) {
  const data = new FormData(form);
  state.complaint = String(data.get("complaint") || "").trim();
  state.notes = String(data.get("notes") || "").trim();
}

function validateAssessment(form) {
  const complaint = form?.querySelector("#complaint");
  if (!complaint?.value.trim()) {
    complaint?.setCustomValidity("Enter the symptoms to continue.");
    complaint?.reportValidity();
    complaint?.setCustomValidity("");
    showToast("Add the symptoms before continuing.");
    return false;
  }
  return true;
}

function syncRepairRecord(form) {
  const data = new FormData(form);
  state.repair.workNotes = String(data.get("workNotes") || "").trim();
  state.repair.verificationNotes = String(data.get("verificationNotes") || "").trim();
}

function validateRepairCompletion(form) {
  const systemField = form.querySelector("#repair-system");
  if (!state.repair.system) {
    systemField?.scrollIntoView({ behavior: "smooth", block: "center" });
    systemField?.setCustomValidity("Select a system before completing this job.");
    systemField?.reportValidity();
    systemField?.setCustomValidity("");
    showToast("Select a system before completing this job.");
    return false;
  }
  const workField = form.querySelector("#repair-notes");
  if (!state.repair.workNotes) {
    workField?.scrollIntoView({ behavior: "smooth", block: "center" });
    workField?.setCustomValidity("Record the work performed before completing this job.");
    workField?.reportValidity();
    workField?.setCustomValidity("");
    showToast("Add the work performed before completing this job.");
    return false;
  }
  const verificationField = form.querySelector("#repair-verification");
  if (!state.repair.verificationNotes) {
    verificationField?.scrollIntoView({ behavior: "smooth", block: "center" });
    verificationField?.setCustomValidity("Add verification notes before completing this job.");
    verificationField?.reportValidity();
    verificationField?.setCustomValidity("");
    showToast("Add verification notes before completing this job.");
    return false;
  }
  return true;
}

function openRepairRecord() {
  state.route = "repair";
  state.savedJourney = { route: "repair", step: 4 };
  state.workflowUnlockedStep = 4;
  animateNextScreen = true;
  updateNavigation();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function returnToResults() {
  const form = document.querySelector("#repair-form");
  if (form) syncRepairRecord(form);
  state.route = "new";
  state.step = state.repairReferenceEnabled ? 3 : 2;
  animateNextScreen = true;
  updateNavigation();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resumeSavedJob() {
  if (state.savedJourney.route === "repair") return openRepairRecord();
  return setStep(state.savedJourney.step || 1);
}

function openJob(jobId, { reopenSheet = null } = {}) {
  const job = jobRecords.find((record) => String(record.id) === String(jobId));
  if (!job) return;
  state.selectedJobId = job.id;
  if (job.status === "resolved" || job.status === "deleted") {
    state.resolvedReturn = state.route === "car-profile"
      ? { route: "car-profile", profileId: state.activeProfileId, tab: state.profileTab, sheet: reopenSheet }
      : { route: "jobs" };
    state.route = "resolved";
    animateNextScreen = true;
    updateNavigation();
    render();
    if (/^[0-9a-f-]{36}$/i.test(job.id)) loadJobPhotos(job.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  state.activeJobId = job.id;
  state.currentJobId = job.id;
  rememberActiveJob(job.id);
  state.vehicle = { ...job.vehicle };
  state.complaint = job.complaint || "";
  state.notes = job.observations || "";
  state.dtcs = [...(job.dtcs || [])];
  state.savedJourney = { ...job.resume };
  state.workflowUnlockedStep = Math.max(1, job.resume.step || 1);
  state.repairReferenceEnabled = job.resume.step >= 4;
  state.repair = {
    workNotes: Array.isArray(job.workPerformed) ? job.workPerformed.join("\n") : job.workPerformed || "",
    verificationNotes: job.verification && !job.verification.startsWith("No verification") ? job.verification : "",
    system: job.system || "",
    parts: (job.parts || []).map((part) => ({ ...part, key: part.id || part.number || part.name })),
    photos: [],
  };
  const result = resumeSavedJob();
  if (/^[0-9a-f-]{36}$/i.test(job.id)) loadJobPhotos(job.id);
  return result;
}

function setStep(step) {
  state.route = "new";
  state.step = step;
  animateNextScreen = true;
  updateNavigation();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openSheet(content, { sheetClass = "", ariaLabel = "" } = {}) {
  clearTimeout(sheetCloseTimer);
  const isRefreshing = !sheetLayer.hidden && sheetLayer.classList.contains("is-open");
  const previousScrollTop = sheetLayer.querySelector(".bottom-sheet")?.scrollTop || 0;
  if (!isRefreshing) {
    sheetReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  if (lockedScrollY === null) {
    // Lock the body in place at its current scroll offset (rather than
    // overflow:hidden) so position:sticky elements behind the sheet — the
    // topbar and journey tabs — keep their normal stuck position instead of
    // losing their scroll-container context and appearing to vanish.
    lockedScrollY = window.scrollY;
    document.body.style.top = `-${lockedScrollY}px`;
  }
  document.documentElement.classList.add("sheet-open");
  document.body.classList.add("sheet-open");
  sheetLayer.classList.toggle("is-confirmation-modal", sheetClass.split(/\s+/).includes("confirmation-sheet"));
  if (!isRefreshing) sheetLayer.classList.remove("is-open");
  sheetLayer.innerHTML = `<section class="bottom-sheet${sheetClass ? ` ${sheetClass}` : ""}" role="dialog" aria-modal="true"${ariaLabel ? ` aria-label="${escapeHTML(ariaLabel)}"` : ""}>${content}</section>`;
  sheetLayer.hidden = false;
  hydrateIcons(sheetLayer);
  const sheet = sheetLayer.querySelector(".bottom-sheet");
  if (isRefreshing) {
    sheet.scrollTop = previousScrollTop;
    requestAnimationFrame(() => {
      sheet.scrollTop = previousScrollTop;
    });
    return;
  }
  requestAnimationFrame(() => {
    sheetLayer.classList.add("is-open");
    sheetLayer.querySelector("button")?.focus();
  });
}

function closeSheet() {
  if (sheetLayer.hidden) return;
  sheetLayer.classList.remove("is-open");
  clearTimeout(sheetCloseTimer);
  sheetCloseTimer = setTimeout(() => {
    sheetLayer.hidden = true;
    sheetLayer.innerHTML = "";
    sheetLayer.classList.remove("is-confirmation-modal");
    document.documentElement.classList.remove("sheet-open");
    document.body.classList.remove("sheet-open");
    document.body.style.top = "";
    if (lockedScrollY !== null) {
      window.scrollTo({ top: lockedScrollY, behavior: "instant" });
      lockedScrollY = null;
    }
    sheetReturnFocus?.focus({ preventScroll: true });
    sheetReturnFocus = null;
  }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 240);
}

function deleteRepairConfirmation() {
  openSheet(`<div class="confirmation-content">
    <h2>Delete this repair?</h2>
    <p>This moves the job, vehicle, notes, parts and photos to Deleted jobs, where the workshop can still review its saved details.</p>
    <div class="confirmation-actions">
      <button class="secondary-button full" type="button" data-action="close-sheet">Cancel</button>
      <button class="danger-button full" type="button" data-action="confirm-delete-repair">${icon("trash")} Delete repair</button>
    </div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: "Confirm repair deletion" });
}

function completeJobConfirmation() {
  const completingJob = jobRecords.find((record) => String(record.id) === String(state.currentJobId));
  const vehicleLine = `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
  const partsCount = state.repair.parts.length;
  const photosCount = state.repair.photos.length;
  const checklist = [
    { label: "Work performed", detail: "Tests, steps and adjustments recorded", done: Boolean(state.repair.workNotes) },
    { label: "Parts & consumables", optional: true, detail: partsCount ? `${partsCount} item${partsCount === 1 ? "" : "s"} added to this repair` : "No parts added yet", done: partsCount > 0 },
    { label: "Verification notes", detail: "How you confirmed the repair was successful", done: Boolean(state.repair.verificationNotes) },
    { label: "Repair photos", optional: true, detail: photosCount ? `${photosCount} photo${photosCount === 1 ? "" : "s"} attached` : "No photos attached", done: photosCount > 0 },
  ];
  openSheet(`<div class="confirmation-content complete-job-confirmation">
    ${completingJob?.jobNumber ? `<span class="repair-job-number">Job ${escapeHTML(completingJob.jobNumber)}</span>` : ""}
    <h2>Ready to complete?</h2>
    <div class="complete-job-vehicle">${escapeHTML(vehicleLine)}</div>
    <ul class="complete-job-checklist">
      ${checklist.map((item) => `<li class="complete-job-check-item${item.done ? " is-done" : ""}">
        <span class="complete-job-check-icon">${icon("check")}</span>
        <span>
          <strong>${escapeHTML(item.label)}${item.optional ? ` <em>(optional)</em>` : ""}</strong>
          <span>${escapeHTML(item.detail)}</span>
        </span>
      </li>`).join("")}
    </ul>
    <div class="complete-job-note">
      ${icon("info")}
      <span>Completing this job will mark it as Resolved and add it to the Repair Library.</span>
    </div>
    <div class="confirmation-actions">
      <button class="secondary-button full" type="button" data-action="close-sheet">Cancel</button>
      <button class="primary-button full" type="button" data-action="confirm-complete-job">${icon("check")} Complete & resolve</button>
    </div>
  </div>`, { sheetClass: "confirmation-sheet complete-job-sheet", ariaLabel: "Confirm job completion" });
}

function cancelJobConfirmation() {
  openSheet(`<div class="confirmation-content">
    <h2>Cancel this job?</h2>
    <p>This moves the job to Deleted jobs, where the workshop can still review its saved details.</p>
    <div class="confirmation-actions">
      <button class="secondary-button full" type="button" data-action="close-sheet">Keep job</button>
      <button class="danger-button full" type="button" data-action="confirm-cancel-job">${icon("trash")} Cancel job</button>
    </div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: "Confirm job cancellation" });
}

function cancelJob() {
  const finish = () => {
    const cancelledJobId = state.currentJobId;
    if (cancelledJobId && !isPersistedJobId(cancelledJobId)) {
      jobRecords = jobRecords.filter((job) => job.id !== cancelledJobId);
    }
    state.activeJobId = null;
    rememberActiveJob(null);
    resetJobDraft();
    closeSheet();
    setRoute("home");
    showToast("Job moved to Deleted jobs.");
  };
  if (!isPersistedJobId(state.currentJobId)) return finish();
  return apiRequest(`/api/jobs/${state.currentJobId}`, { method: "DELETE" })
    .then(({ job }) => {
      const archivedJob = databaseJobToUi(job);
      const index = jobRecords.findIndex((entry) => entry.id === archivedJob.id);
      if (index >= 0) jobRecords[index] = archivedJob;
      state.activeJobId = null;
      finish();
    })
    .catch((error) => showToast(error.message));
}

function deleteRepairRecord() {
  const deletedJobId = state.currentJobId;
  if (deletedJobId && !isPersistedJobId(deletedJobId)) {
    jobRecords = jobRecords.filter((job) => job.id !== deletedJobId);
  }
  state.activeJobId = null;
  rememberActiveJob(null);
  resetJobDraft();
  closeSheet();
  setRoute("home");
  showToast("Repair moved to Deleted jobs.");
}

// Un-cancels a deleted job and drops the mechanic back into the workflow at
// whichever step it was cancelled from (openJob() already resumes a job at
// job.resume based on its saved stage -- restoring just needs status back to
// "open" first so that routing treats it as a normal in-progress job again).
function restoreJob() {
  const jobId = state.selectedJobId;
  const job = jobRecords.find((record) => record.id === jobId);
  if (!job) return;
  return apiRequest(`/api/jobs/${jobId}/restore`, { method: "POST" })
    .then(({ job: restored }) => {
      const restoredJob = databaseJobToUi(restored);
      const index = jobRecords.findIndex((entry) => entry.id === restoredJob.id);
      if (index >= 0) jobRecords[index] = restoredJob;
      showToast("Job restored.");
      openJob(restoredJob.id);
    })
    .catch((error) => showToast(error.message));
}

function deleteForeverConfirmation() {
  const jobId = state.selectedJobId;
  openSheet(`<div class="confirmation-content">
    <h2>Delete this job forever?</h2>
    <p>This permanently removes the job, its notes, DTCs and repair record. This cannot be undone.</p>
    <div class="confirmation-actions">
      <button class="secondary-button full" type="button" data-action="close-sheet">Keep job</button>
      <button class="danger-button full" type="button" data-action="confirm-delete-forever" data-job-id="${jobId}">${icon("trash")} Delete forever</button>
    </div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: "Confirm permanent deletion" });
}

function deleteForever(jobId) {
  return apiRequest(`/api/jobs/${jobId}/purge`, { method: "DELETE" })
    .then(() => {
      jobRecords = jobRecords.filter((job) => job.id !== jobId);
      closeSheet();
      setRoute("jobs");
      showToast("Job permanently deleted.");
    })
    .catch((error) => showToast(error.message));
}

// Deleting from the Jobs list is deliberately lighter than deleting from
// inside an open job: there's no in-progress draft to flush here, just the
// job's already-saved server state, so this calls the archive endpoint
// directly by id rather than routing through cancelJob()/deleteRepairRecord()
// (both of which assume you're currently inside the job being deleted).
function deleteJobFromListConfirmation(jobId) {
  const job = jobRecords.find((entry) => entry.id === jobId);
  if (!job) return;
  openSheet(`<div class="confirmation-content">
    <h2>Delete this job?</h2>
    <p>This moves the job for ${escapeHTML(jobVehicleName(job))} to Deleted jobs, where the workshop can still review its saved details.</p>
    <div class="confirmation-actions">
      <button class="secondary-button full" type="button" data-action="close-sheet">Keep job</button>
      <button class="danger-button full" type="button" data-action="confirm-delete-job-from-list" data-job-id="${jobId}">${icon("trash")} Delete job</button>
    </div>
  </div>`, { sheetClass: "confirmation-sheet", ariaLabel: "Confirm job deletion" });
}

function deleteJobFromList(jobId) {
  return apiRequest(`/api/jobs/${jobId}`, { method: "DELETE" })
    .then(({ job }) => {
      const archivedJob = databaseJobToUi(job);
      const index = jobRecords.findIndex((entry) => entry.id === archivedJob.id);
      if (index >= 0) jobRecords[index] = archivedJob;
      if (state.activeJobId === jobId) state.activeJobId = null;
      closeSheet();
      render();
      showToast("Job moved to Deleted jobs.");
    })
    .catch((error) => showToast(error.message));
}

function photoViewerSheet(scope, requestedIndex = 0) {
  const photos = photoCollection(scope);
  if (!photos.length) return;
  const index = Math.max(0, Math.min(requestedIndex, photos.length - 1));
  const scopeLabel = scope === "repair" ? "Repair photos" : "Arrival photos";
  openSheet(`<div class="sheet-head"><div><span class="field-label">${scopeLabel} · ${photos.length} saved</span><h2>Photo viewer</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close photo viewer">${icon("close")}</button></div>
    <div class="sheet-body photo-viewer-body">
      <div class="photo-viewer-track" data-photo-viewer-track tabindex="0" aria-label="Swipe through ${scopeLabel.toLowerCase()}">
        ${photos.map((photo, photoIndex) => `<figure class="photo-viewer-slide" data-photo-viewer-index="${photoIndex}"><div class="photo-viewer-frame" data-photo-zoom-frame><img src="${escapeHTML(photoUrl(photo))}" alt="${scopeLabel.slice(0, -1)} ${photoIndex + 1} of ${photos.length}" draggable="false" /><span class="photo-viewer-count">${photoIndex + 1} / ${photos.length}</span></div><button class="photo-delete-button" type="button" data-action="delete-photo" data-photo-scope="${scope}" data-photo-index="${photoIndex}">${icon("trash")} Delete photo</button></figure>`).join("")}
      </div>
      <span class="photo-swipe-hint">${photos.length > 1 ? "Swipe to browse · pinch to zoom" : "Pinch to zoom"}</span>
    </div>`, { sheetClass: "photo-viewer-sheet" });
  requestAnimationFrame(() => {
    const track = sheetLayer.querySelector("[data-photo-viewer-track]");
    if (track) track.scrollLeft = index * track.clientWidth;
  });
}

function clampPhotoPosition(frame, gesture) {
  const maxX = (frame.clientWidth * (gesture.scale - 1)) / 2;
  const maxY = (frame.clientHeight * (gesture.scale - 1)) / 2;
  gesture.x = Math.max(-maxX, Math.min(maxX, gesture.x));
  gesture.y = Math.max(-maxY, Math.min(maxY, gesture.y));
}

function applyPhotoTransform(frame, gesture) {
  const image = frame.querySelector("img");
  if (!image) return;
  image.style.transform = `translate3d(${gesture.x}px, ${gesture.y}px, 0) scale(${gesture.scale})`;
}

function photoGestureState(frame) {
  if (!photoGestureStates.has(frame)) {
    photoGestureStates.set(frame, { pointers: new Map(), scale: 1, x: 0, y: 0, dragStart: null, pinchStart: null });
  }
  return photoGestureStates.get(frame);
}

function pointerDistance([first, second]) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint([first, second]) {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function beginPhotoGesture(event) {
  const frame = event.target.closest("[data-photo-zoom-frame]");
  if (!frame) return;
  event.preventDefault();
  frame.setPointerCapture(event.pointerId);
  frame.classList.add("is-gesturing");
  frame.closest("[data-photo-viewer-track]")?.classList.add("is-dragging");
  const gesture = photoGestureState(frame);
  gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (gesture.pointers.size === 1) {
    const track = frame.closest("[data-photo-viewer-track]");
    gesture.dragStart = { x: event.clientX, y: event.clientY, imageX: gesture.x, imageY: gesture.y, trackLeft: track?.scrollLeft || 0 };
  } else if (gesture.pointers.size === 2) {
    const points = [...gesture.pointers.values()];
    gesture.pinchStart = { distance: Math.max(1, pointerDistance(points)), midpoint: pointerMidpoint(points), scale: gesture.scale, x: gesture.x, y: gesture.y };
  }
}

function movePhotoGesture(event) {
  const frame = event.target.closest("[data-photo-zoom-frame]");
  if (!frame) return;
  const gesture = photoGestureStates.get(frame);
  if (!gesture?.pointers.has(event.pointerId)) return;
  event.preventDefault();
  gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (gesture.pointers.size >= 2 && gesture.pinchStart) {
    const points = [...gesture.pointers.values()].slice(0, 2);
    const midpoint = pointerMidpoint(points);
    gesture.scale = Math.max(1, Math.min(4, gesture.pinchStart.scale * (pointerDistance(points) / gesture.pinchStart.distance)));
    gesture.x = gesture.pinchStart.x + midpoint.x - gesture.pinchStart.midpoint.x;
    gesture.y = gesture.pinchStart.y + midpoint.y - gesture.pinchStart.midpoint.y;
    clampPhotoPosition(frame, gesture);
    applyPhotoTransform(frame, gesture);
    return;
  }
  if (gesture.pointers.size === 1 && gesture.dragStart) {
    const point = [...gesture.pointers.values()][0];
    if (gesture.scale > 1) {
      gesture.x = gesture.dragStart.imageX + point.x - gesture.dragStart.x;
      gesture.y = gesture.dragStart.imageY + point.y - gesture.dragStart.y;
      clampPhotoPosition(frame, gesture);
      applyPhotoTransform(frame, gesture);
    } else {
      const track = frame.closest("[data-photo-viewer-track]");
      if (track) track.scrollLeft = gesture.dragStart.trackLeft - (point.x - gesture.dragStart.x);
    }
  }
}

function endPhotoGesture(event) {
  const frame = event.target.closest("[data-photo-zoom-frame]");
  if (!frame) return;
  const gesture = photoGestureStates.get(frame);
  if (!gesture?.pointers.has(event.pointerId)) return;
  event.preventDefault();
  gesture.pointers.delete(event.pointerId);
  if (frame.hasPointerCapture(event.pointerId)) frame.releasePointerCapture(event.pointerId);
  if (gesture.pointers.size === 1) {
    const [point] = gesture.pointers.values();
    const track = frame.closest("[data-photo-viewer-track]");
    gesture.dragStart = { x: point.x, y: point.y, imageX: gesture.x, imageY: gesture.y, trackLeft: track?.scrollLeft || 0 };
    gesture.pinchStart = null;
    return;
  }
  if (gesture.pointers.size) return;
  frame.classList.remove("is-gesturing");
  frame.closest("[data-photo-viewer-track]")?.classList.remove("is-dragging");
  gesture.dragStart = null;
  gesture.pinchStart = null;
  if (gesture.scale < 1.04) {
    gesture.scale = 1;
    gesture.x = 0;
    gesture.y = 0;
    applyPhotoTransform(frame, gesture);
    const track = frame.closest("[data-photo-viewer-track]");
    if (track?.clientWidth) {
      const target = Math.round(track.scrollLeft / track.clientWidth) * track.clientWidth;
      track.scrollTo({ left: target, behavior: "smooth" });
    }
  } else {
    clampPhotoPosition(frame, gesture);
    applyPhotoTransform(frame, gesture);
  }
}

function updateWorkshopClock() {
  const now = new Date();
  const time = document.querySelector("#workshop-time");
  const date = document.querySelector("#workshop-date");
  if (time) time.textContent = new Intl.DateTimeFormat("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  if (date) date.textContent = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "2-digit", month: "short" }).format(now).replace(",", "");
}

function calendarSheet() {
  const { year, month, selectedDay } = state.calendar;
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = (firstDay.getDay() + 6) % 7;
  const monthLabel = new Intl.DateTimeFormat("en-AU", { month: "long", year: "numeric" }).format(firstDay);
  const selectedDate = new Date(year, month, selectedDay);
  const selectedLabel = new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long" }).format(selectedDate);
  const activeDays = new Set([3, 6, 12, 18, 20, 29]);
  const blankCells = Array.from({ length: leadingBlanks }, () => '<span class="calendar-day-blank" aria-hidden="true"></span>').join("");
  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const selected = day === selectedDay;
    return `<button class="calendar-day${activeDays.has(day) ? " has-work" : ""}${selected ? " is-selected" : ""}" type="button" data-action="select-calendar-day" data-calendar-day="${day}" aria-pressed="${selected}" aria-label="${day} ${monthLabel}${activeDays.has(day) ? ", workshop activity" : ""}">${String(day).padStart(2, "0")}</button>`;
  }).join("");
  const trailingBlanks = Array.from({ length: (7 - ((leadingBlanks + daysInMonth) % 7)) % 7 }, () => '<span class="calendar-day-blank" aria-hidden="true"></span>').join("");

  openSheet(`<div class="sheet-head"><div><span class="field-label">Workshop schedule</span><h2>Calendar</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close calendar">${icon("close")}</button></div>
    <div class="sheet-body calendar-sheet-body">
      <div class="calendar-toolbar">
        <button class="calendar-nav" type="button" data-action="calendar-previous" aria-label="Previous month">${icon("back")}</button>
        <h3>${monthLabel}</h3>
        <button class="calendar-nav" type="button" data-action="calendar-next" aria-label="Next month">${icon("arrow")}</button>
      </div>
      <div class="calendar-grid" role="grid" aria-label="${monthLabel}">
        ${["M", "T", "W", "T", "F", "S", "S"].map((day) => `<span class="calendar-weekday" role="columnheader">${day}</span>`).join("")}
        ${blankCells}${dayCells}${trailingBlanks}
      </div>
      <section class="calendar-agenda" aria-live="polite">
        <span class="field-label">${selectedLabel}</span>
        <h3>${activeDays.has(selectedDay) ? "3 workshop bookings" : "No scheduled bookings"}</h3>
        <p>${activeDays.has(selectedDay) ? "Bay activity, jobs and completed repairs for the selected day." : "The workshop schedule is clear for this date."}</p>
      </section>
    </div>`);
}

function technicianProfileSheet() {
  const fullName = state.profile?.full_name || "Diego Martins";
  const initials = fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const role = currentTechnician()?.role || state.profile?.role || "technician";
  const employeeId = currentTechnician()?.employee_id;
  const bayLabel = assignedBayLabel();
  const hasBay = bayLabel !== "No bay assigned";
  // An unset fact reads as a placeholder (same weight/colour as the role
  // line above), not as data worth bolding -- only a real value earns
  // <strong>.
  const factValue = (value, hasValue) => hasValue ? `<strong>${escapeHTML(value)}</strong>` : `<span class="profile-fact-empty">${escapeHTML(value)}</span>`;
  openSheet(`<div class="sheet-head"><div><h2>Your profile</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close technician profile">${icon("close")}</button></div>
    <div class="sheet-body">
      <section class="technician-profile" aria-label="Signed-in technician">
        <span class="technician-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
        <div><h3>${escapeHTML(fullName)}</h3><p>${escapeHTML(roleLabel(role))}</p></div>
      </section>
      <div class="profile-facts" aria-label="Technician work details">
        <div class="profile-fact"><span class="field-label">Assigned bay</span>${factValue(bayLabel, hasBay)}</div>
        <div class="profile-fact"><span class="field-label">Employee ID</span>${factValue(employeeId || "Not registered", Boolean(employeeId))}</div>
      </div>
      <nav class="profile-menu" aria-label="Technician shortcuts">
        <button class="profile-menu-button" type="button" data-action="profile-jobs">${icon("clipboard")}<span>My active jobs</span>${icon("arrow")}</button>
        ${state.backendStatus === "connected" ? `<button class="profile-menu-button" type="button" data-action="sign-out">${icon("logout")}<span>Sign out</span>${icon("arrow")}</button>` : `<button class="profile-menu-button" type="button" data-action="sign-in">${icon("lock")}<span>Sign in for cloud storage</span>${icon("arrow")}</button>`}
      </nav>
    </div>`);
}

function catalogEditorSheet() {
  openSheet(`<div class="sheet-head"><div><span class="field-label">Vehicle catalog</span><h2>Add make or model</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><p class="muted">Add a make, model, or an exact variant for your workshop. Variants can include its engine, drivetrain and transmission.</p>
      <form id="catalog-editor-form" class="form-grid">
        <label class="form-field"><div class="field-header"><span class="field-label">Make</span></div><input class="input" name="catalog-make" value="${escapeHTML(state.vehicle.make)}" required /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Model <span class="muted">(optional)</span></span></div><input class="input" name="catalog-model" value="${escapeHTML(state.vehicle.model)}" placeholder="e.g. Golf" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Variant / trim <span class="muted">(optional)</span></span></div><input class="input" name="catalog-variant" placeholder="e.g. GTI" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Engine <span class="muted">(optional)</span></span></div><input class="input" name="catalog-engine" placeholder="e.g. 2.0L turbo" /></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Drivetrain <span class="muted">(optional)</span></span></div><span class="select-control"><select class="select" name="catalog-drivetrain"><option value="">Choose drivetrain</option><option>FWD</option><option>RWD</option><option>AWD</option><option>4WD</option></select>${icon("down")}</span></label>
        <label class="form-field"><div class="field-header"><span class="field-label">Transmission <span class="muted">(optional)</span></span></div><input class="input" name="catalog-transmission" placeholder="e.g. 7-speed DSG" /></label>
        <button class="primary-button full" type="submit">${icon("save")} Save to catalog</button>
      </form>
    </div>`);
}

function dtcEditorSheet() {
  openSheet(`<div class="sheet-head"><div><span class="field-label">${vehicleName()}</span><h2>Add scan code</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><form id="dtc-editor-form" class="form-grid">
      <label class="form-field"><div class="field-header"><span class="field-label">Diagnostic trouble code</span></div><input class="input caps-text" name="dtc-code" autocomplete="off" autocapitalize="characters" placeholder="e.g. P0171" required /></label>
      <button class="primary-button full" type="submit">${icon("plus")} Add code</button>
    </form></div>`);
  setTimeout(() => document.querySelector('[name="dtc-code"]')?.focus(), 50);
}

sheetLayer.addEventListener("wheel", (event) => {
  const sheet = event.target instanceof Element ? event.target.closest(".bottom-sheet") : null;
  if (!sheet) {
    event.preventDefault();
    return;
  }

  const atTop = sheet.scrollTop <= 0 && event.deltaY < 0;
  const atBottom = Math.ceil(sheet.scrollTop + sheet.clientHeight) >= sheet.scrollHeight && event.deltaY > 0;
  if (sheet.scrollHeight <= sheet.clientHeight || atTop || atBottom) event.preventDefault();
}, { passive: false });

sheetLayer.addEventListener("touchmove", (event) => {
  const sheet = event.target instanceof Element ? event.target.closest(".bottom-sheet") : null;
  if (!sheet) event.preventDefault();
}, { passive: false });

function repairPartFromReference(name, number, key) {
  const quantityMatch = String(number).match(/QTY\s+(\d+)/i);
  const isConsumable = String(number).toUpperCase().startsWith("CONSUMABLE");
  const cleanNumber = isConsumable
    ? String(number).replace(/^CONSUMABLE\s*·?\s*/i, "")
    : String(number).replace(/\s*·\s*QTY\s+\d+\s*$/i, "");
  return { key, type: isConsumable ? "Consumable" : "Part", name, number: cleanNumber, quantity: quantityMatch?.[1] || "1", supplier: "", price: "" };
}

function addRepairPart(part) {
  const existing = state.repair.parts.find((item) => (part.key && item.key === part.key) || item.name.toLowerCase() === part.name.toLowerCase());
  if (existing) {
    Object.assign(existing, part, { quantity: existing.quantity || part.quantity || "1" });
    return false;
  }
  state.repair.parts.push({ key: part.key || `custom-${Date.now()}`, type: part.type || "Part", name: part.name, number: part.number || "", quantity: part.quantity || "1", supplier: part.supplier || "", price: part.price || "", offerUrl: part.offerUrl || "", offerImageUrl: part.offerImageUrl || "" });
  return true;
}

function partsEditorSheet() {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair) || repairMatches[0];
  openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>Repair record</strong> · ${state.repair.parts.length} saved</span><h2>Add parts & consumables</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body parts-editor-body">
      ${state.repairReferenceEnabled ? `<section class="parts-editor-section" aria-labelledby="suggested-parts-heading">
        <div class="parts-editor-heading"><span class="field-label">From selected repair ${selected.rank}</span><h3 id="suggested-parts-heading">Previously used on this fix</h3><p>Add only the items you actually use. Search pricing later from the repair record.</p></div>
        <div class="suggested-parts-list">${selected.parts.map(([name, number, key]) => {
          const isAdded = state.repair.parts.some((part) => part.key === key || part.name === name);
          return `<div class="suggested-part-row"><div><strong>${name}</strong><span>${number}</span></div><div class="suggested-part-actions"><button class="part-button reference-toggle-button${isAdded ? " is-remove" : ""}" type="button" data-action="toggle-reference-part" data-reference-key="${key}" data-reference-name="${name}" data-reference-number="${number}" aria-pressed="${isAdded}">${isAdded ? `${icon("close")} Remove` : `${icon("plus")} Add`}</button></div></div>`;
        }).join("")}</div>
      </section>` : ""}

      <section class="parts-editor-section custom-part-section" aria-labelledby="custom-part-heading">
        <div class="parts-editor-heading"><span class="field-label">Different item</span><h3 id="custom-part-heading">Add a custom part</h3></div>
        <form id="part-editor-form" class="custom-part-form">
          <label class="form-field"><div class="field-header"><span class="field-label">Type</span></div><span class="select-control"><select class="select" name="custom-type"><option>Part</option><option>Consumable</option></select>${icon("down")}</span></label>
          <label class="form-field custom-part-name"><div class="field-header"><span class="field-label">Part or consumable</span></div><input class="input" name="custom-name" placeholder="e.g. Oil filter" /></label>
          <label class="form-field"><div class="field-header"><span class="field-label">Part number</span></div><input class="input" name="custom-number" placeholder="Optional" /></label>
          <label class="form-field"><div class="field-header"><span class="field-label">Qty</span></div><input class="input" name="custom-quantity" value="1" inputmode="numeric" /></label>
          <button class="primary-button full custom-part-save" type="button" data-action="save-custom-part">${icon("save")} Save item to repair</button>
        </form>
      </section>
    </div>`);
}

async function priceSheet(partName, partKey = "") {
  const lowerName = partName.toLowerCase();
  const isDiaphragm = lowerName.includes("diaphragm");
  const isHose = lowerName.includes("hose");
  const isGasket = lowerName.includes("gasket");
  const isCleaner = lowerName.includes("throttle body cleaner");
  const product = isDiaphragm
    ? { image: `${assetBase}/assets/parts/pcv-diaphragm-kit.jpg`, number: "RKX-027 · OE cross-check required", recordNumber: "RKX-027", category: "PCV system repair kit", type: "Part" }
    : isHose
      ? { image: `${assetBase}/assets/parts/crankcase-breather-hose.jpg`, number: "Volvo 31430923", recordNumber: "Volvo 31430923", category: "Crankcase ventilation hose", type: "Part" }
      : isGasket
        ? { image: `${assetBase}/assets/parts/intake-manifold-gasket-set.jpg`, number: "Volvo 31375429", recordNumber: "Volvo 31375429", category: "Intake manifold sealing set", type: "Part" }
        : isCleaner
          ? { image: `${assetBase}/assets/parts/throttle-body-cleaner.jpg`, number: "180 ml workshop consumable", recordNumber: "180 ml", category: "Intake cleaning consumable", type: "Consumable" }
          : { image: "", number: "Catalogue number to verify", recordNumber: "", category: "Workshop part search", type: "Part" };
  const savedPart = state.repair.parts.find((part) => part.key === partKey || part.name === partName);
  const recordNumber = savedPart?.number || product.recordNumber;
  const query = [state.vehicle.year, state.vehicle.make, state.vehicle.model, partName].filter(Boolean).join(" ");
  openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>Live part search</strong></span><h2>Searching prices…</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><div class="part-product-placeholder">${icon("search")}<span>Checking Australian suppliers for ${escapeHTML(partName)}</span></div></div>`);
  try {
    const response = await fetch("/api/parts/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, partNumber: recordNumber || undefined }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Part search failed");
    const offers = Array.isArray(result.offers) ? result.offers : [];
    openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>Live part search</strong> · ${offers.length} offer${offers.length === 1 ? "" : "s"}</span><h2>Compare prices</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
      <div class="part-search-summary">
        <div class="part-product-media">${product.image ? `<img class="part-product-image" src="${product.image}" alt="Reference catalogue photo of ${partName}" /><span class="reference-chip">Reference image</span>` : `<div class="part-product-placeholder">${icon("search")}<span>Catalogue search</span></div>`}</div>
        <div class="part-product-copy"><span class="field-label">Requested part</span><h3>${escapeHTML(partName)}</h3><span class="part-product-number">${escapeHTML(product.number)}</span><span class="part-product-fitment">${escapeHTML(product.category)}<br>${escapeHTML(`${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`)}</span></div>
      </div>
      <p class="part-search-note">Compare one part at a time by price, availability and supplier. Product imagery is illustrative; confirm the catalogue image and fitment before ordering.</p>
      <div class="price-list" aria-label="Supplier offers">${offers.length ? offers.map((offer, i) => `<button class="price-card" type="button" data-action="select-price" data-part-key="${escapeHTML(partKey)}" data-part-name="${escapeHTML(partName)}" data-part-number="${escapeHTML(recordNumber)}" data-part-type="${product.type}" data-supplier="${escapeHTML(offer.merchant || "Unknown supplier")}" data-price="${escapeHTML(offer.price || "Quote required")}" data-offer-url="${escapeHTML(offer.link || "")}" data-offer-image-url="${escapeHTML(offer.imageUrl || "")}">${offer.imageUrl ? `<img class="offer-image" src="${escapeHTML(offer.imageUrl)}" alt="" />` : product.image ? `<img class="offer-image" src="${product.image}" alt="" />` : `<span class="offer-image offer-image-placeholder">${icon("search")}</span>`}<span class="offer-copy"><span class="supplier">${i === 0 ? `<strong class="offer-badge">Lowest listed</strong>` : ""}${escapeHTML(offer.merchant || "Unknown supplier")}</span><span class="supplier-meta">${escapeHTML(offer.delivery || "Availability not listed")}</span><span class="offer-detail">${escapeHTML(offer.title || partName)}</span></span><span class="offer-price"><span class="price">${escapeHTML(offer.price || "Quote")}</span><span class="offer-action">Use offer ${icon("arrow")}</span></span></button>`).join("") : `<div class="source-card"><h3>No current offers found</h3><p>Try a more specific part number or confirm availability with a supplier.</p></div>`}</div>
      <div class="disclaimer">Confirm fitment against the VIN and supplier catalogue before ordering. Price and availability can change.</div>
    </div>`);
  } catch (error) {
    openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>Live part search</strong></span><h2>Search unavailable</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
      <div class="sheet-body"><div class="source-card"><h3>Could not load supplier offers</h3><p>${escapeHTML(error?.message || "Try again in a moment.")}</p></div><button class="secondary-button" type="button" data-action="close-sheet">Close</button></div>`);
  }
}

function markdownTableToBullets(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
  const isSeparatorRow = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line);
  const cellsOf = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()).filter(Boolean);
  while (i < lines.length) {
    if (isTableRow(lines[i])) {
      const tableLines = [];
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const rows = tableLines.filter((line) => !isSeparatorRow(line));
      rows.slice(1).forEach((row) => {
        const cells = cellsOf(row);
        if (cells.length) out.push(`- ${cells.join(" — ")}`);
      });
      continue;
    }
    out.push(lines[i]);
    i += 1;
  }
  return out.join("\n");
}

function formatResearchSynthesisLine(line, sourceCount) {
  const normalized = line.replace(/【(\d+)[^\d】]*】/g, "[$1]");
  const escaped = escapeHTML(normalized);
  const bolded = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  return bolded.replace(/\[(\d+)\]/g, (match, num) => {
    const index = Number(num) - 1;
    if (index < 0 || index >= sourceCount) return match;
    const source = lastResearchResult && lastResearchResult.sources[index];
    if (!source) return match;
    return `<a class="citation-link" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">[${num}]</a>`;
  });
}

function formatResearchSynthesis(rawText, sourceCount) {
  const lines = markdownTableToBullets(rawText || "").split("\n");
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      blocks.push(`<span class="synthesis-line">${buffer.join("<br>")}</span>`);
      buffer = [];
    }
  };
  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flush();
      return;
    }
    const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
    if (headingMatch) {
      flush();
      blocks.push(`<strong class="synthesis-heading">${formatResearchSynthesisLine(headingMatch[1], sourceCount)}</strong>`);
    } else {
      buffer.push(formatResearchSynthesisLine(trimmed, sourceCount));
    }
  });
  flush();
  return blocks.join("");
}

function sourceDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function researchVehicleMoustache() {
  const specs = [state.vehicle.trim, state.vehicle.drivetrain, state.vehicle.engine, state.vehicle.transmission].filter(Boolean).join(" · ");
  return specs ? `${icon("car")}<span>${escapeHTML(specs)}</span>` : "";
}

function renderResearchSourceList(options = {}) {
  const { sources, synthesis } = lastResearchResult;
  const moustache = options.moustache !== undefined ? options.moustache : researchVehicleMoustache();
  const title = options.title || "Web repair tips";
  const resultCount = `${sources.length} result${sources.length === 1 ? "" : "s"}`;
  openSheet(`<div class="sheet-head"><div><h2>${escapeHTML(title)}</h2>${moustache ? `<span class="task-context">${moustache}</span>` : ""}</div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><p class="muted">Your verified shop repairs remain the primary reference. External findings are diagnostic directions, not confirmed fixes.</p>
      <details class="source-card internal synthesis-accordion"><summary class="field-label">AI synthesis with source citations${icon("down")}</summary><p>${synthesis ? formatResearchSynthesis(synthesis, sources.length) : "No summary was returned."}</p></details>
      <span class="field-label results-heading">External research · <strong class="results-heading-count">${escapeHTML(resultCount)}</strong></span>
      <div class="source-list">${sources.map((source) => `<a class="source-list-item" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer"><span class="source-list-main"><span class="source-list-meta"><img class="source-favicon" src="https://www.google.com/s2/favicons?sz=32&domain=${escapeHTML(sourceDomain(source.url))}" alt="" /><span class="source-domain">${escapeHTML(sourceDomain(source.url))}</span>${source.date ? `<span class="source-date">· ${escapeHTML(source.date)}</span>` : ""}</span><span class="source-list-title">${escapeHTML(source.title)}</span><span class="source-list-snippet">${escapeHTML(source.snippet || "Open source")}</span></span><span class="source-list-external" aria-hidden="true">${icon("externalLink")}</span></a>`).join("")}</div>
      <div class="disclaimer">Verify procedures, specifications, part fitment and safety steps against official service information before work begins.</div>
    </div>`);
}

async function webResearchSheet() {
  const vehicle = `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
  const query = [state.complaint, state.notes].filter(Boolean).join(" ").slice(0, 450) || "diagnostic repair guidance";
  openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>External research</strong></span><h2>Searching repair sources…</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="part-product-placeholder">${icon("search")}<span>Researching ${escapeHTML(vehicle)} and cross-checking sources</span></div></div>`);
  showTopProgressBar();
  try {
    const result = await apiRequest("/api/research", { method: "POST", body: JSON.stringify({ jobId: state.currentJobId || undefined, query, vehicle, dtcs: state.dtcs, complaint: state.complaint, observations: state.notes }) });
    if (sheetLayer.hidden) return;
    lastResearchResult = { synthesis: result.synthesis, sources: Array.isArray(result.sources) ? result.sources : [] };
    renderResearchSourceList();
  } catch (error) {
    if (sheetLayer.hidden) return;
    openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>External research</strong></span><h2>Research unavailable</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="source-card"><h3>Could not search repair sources</h3><p>${escapeHTML(error.message)}</p></div><button class="secondary-button" type="button" data-action="close-sheet">Close</button></div>`);
  } finally {
    hideTopProgressBar();
  }
}

async function libraryWebResearchSheet() {
  const query = state.librarySearch.trim();
  if (!query) return;
  openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>External research</strong></span><h2>Searching repair sources…</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="part-product-placeholder">${icon("search")}<span>Researching "${escapeHTML(query)}"</span></div></div>`);
  showTopProgressBar();
  try {
    const result = await apiRequest("/api/research", { method: "POST", body: JSON.stringify({ query }) });
    if (sheetLayer.hidden) return;
    lastResearchResult = { synthesis: result.synthesis, sources: Array.isArray(result.sources) ? result.sources : [] };
    renderResearchSourceList({ title: "Web repair tips", moustache: "" });
  } catch (error) {
    if (sheetLayer.hidden) return;
    openSheet(`<div class="sheet-head"><div><span class="field-label"><strong>External research</strong></span><h2>Research unavailable</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="source-card"><h3>Could not search repair sources</h3><p>${escapeHTML(error.message)}</p></div><button class="secondary-button" type="button" data-action="close-sheet">Close</button></div>`);
  } finally {
    hideTopProgressBar();
  }
}

document.addEventListener("click", (event) => {
  const themeChoice = event.target.closest("[data-theme-choice]");
  if (themeChoice) {
    setTheme(themeChoice.dataset.themeChoice);
    render();
    return;
  }

  const unitsChoice = event.target.closest("[data-units-choice]");
  if (unitsChoice) {
    setUnitSystem(unitsChoice.dataset.unitsChoice);
    render();
    return;
  }

  const routeButton = event.target.closest("[data-route]");
  if (routeButton) return setRoute(routeButton.dataset.route);

  const stepButton = event.target.closest("[data-step]");
  if (stepButton && !stepButton.disabled) return setStep(Number(stepButton.dataset.step));

  const journeyButton = event.target.closest("[data-journey-step]");
  if (journeyButton) {
    const repairForm = document.querySelector("#repair-form");
    if (repairForm) {
      syncRepairRecord(repairForm);
      queueRepairAutosave(0);
    }
    const journeyStep = Number(journeyButton.dataset.journeyStep);
    return journeyStep === 4 ? openRepairRecord() : setStep(journeyStep);
  }

  const repairChoice = event.target.closest("[data-repair-match]");
  if (repairChoice) {
    const selector = repairChoice.closest(".match-selector");
    const selectorBounds = selector?.getBoundingClientRect();
    const repairBounds = repairChoice.getBoundingClientRect();
    const isClipped = Boolean(selectorBounds && (repairBounds.left < selectorBounds.left - 1 || repairBounds.right > selectorBounds.right + 1));
    pendingMatchCarouselRestore = {
      selectedRepair: repairChoice.dataset.repairMatch,
      scrollLeft: selector?.scrollLeft || 0,
      pinSelectedRight: isClipped,
      targetScroll: selectorBounds ? (selector?.scrollLeft || 0) + repairBounds.right - selectorBounds.right : 0,
    };
    state.selectedRepair = repairChoice.dataset.repairMatch;
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "workflow-back") return state.step > 1 ? setStep(state.step - 1) : setRoute("home");
    if (action === "cancel-job") return cancelJobConfirmation();
    if (action === "confirm-cancel-job") return cancelJob();
    // The header exposes one delete entry point across every workflow step
    // (not just the first and last tabs) -- it picks whichever confirmation
    // actually matches the current step's state: the repair step has a
    // draft worth flushing before archiving, the earlier steps don't.
    if (action === "delete-job") return state.route === "repair" ? deleteRepairConfirmation() : cancelJobConfirmation();
    if (action === "restore-job") return restoreJob();
    if (action === "delete-forever") return deleteForeverConfirmation();
    if (action === "confirm-delete-forever") return deleteForever(actionButton.dataset.jobId);
    if (action === "delete-job-from-list") return deleteJobFromListConfirmation(actionButton.dataset.jobId);
    if (action === "confirm-delete-job-from-list") return deleteJobFromList(actionButton.dataset.jobId);
    if (action === "reassign-job") return openReassignJobModal(currentJobRecord());
    if (action === "reassign-job-to") return reassignCurrentJob(actionButton.dataset.technicianId);
    if (action === "view-active-jobs") {
      state.jobFilter = "open";
      setRoute("jobs");
      return;
    }
    if (action === "filter-jobs") {
      const searchInput = document.querySelector("#job-search");
      if (searchInput) state.jobSearch = searchInput.value;
      state.jobFilter = actionButton.dataset.jobFilter || "all";
      render();
      return;
    }
    if (action === "scroll-next") return scrollToNextView();
    if (action === "reload-app") { showUpdateOverlay(); return; }
    if (action === "theme-toggle") return setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    if (action === "open-settings-page") {
      if (actionButton.dataset.locked === "true") return showToast("You don't have access to this section.");
      settingsOpenPage(actionButton.dataset.settingsPage || null);
      return render();
    }
    if (action === "settings-back") {
      settingsGoBack();
      return render();
    }
    if (action === "edit-shop-field") {
      return openShopFieldModal({
        field: actionButton.dataset.field,
        title: actionButton.dataset.title,
        optional: actionButton.dataset.optional === "true",
      });
    }
    if (action === "add-bay") return openBayModal(null);
    if (action === "edit-bay") return openBayModal(state.bays.find((bay) => bay.id === actionButton.dataset.bayId));
    if (action === "add-technician") return openTechnicianModal(null);
    if (action === "copy-invite-code") return copyInviteCode(actionButton.dataset.code);
    if (action === "regenerate-invite") return regenerateInvite(actionButton.dataset.technicianId);
    if (action === "revoke-invite") return revokeInvite(actionButton.dataset.technicianId);
    if (action === "edit-technician") return openTechnicianModal(state.technicians.find((technician) => technician.id === actionButton.dataset.technicianId));
    // The switch inside a bay/technician form is local state only -- it is read
    // off the DOM when the form is submitted, not saved on its own.
    if (action === "toggle-form-active") {
      const control = actionButton.querySelector(".switch");
      const next = !control.classList.contains("is-on");
      control.classList.toggle("is-on", next);
      control.setAttribute("aria-checked", String(next));
      actionButton.setAttribute("aria-pressed", String(next));
      return;
    }
    if (action === "delete-bay") {
      return apiRequest(`/api/shop/bays/${actionButton.dataset.bayId}`, { method: "DELETE" })
        .then(async () => {
          closeSheet();
          await loadWorkshopRoster();
          showToast("Bay deleted");
          render();
        })
        .catch((error) => showToast(error.message || "Could not delete that bay"));
    }
    if (action === "delete-technician") {
      return apiRequest(`/api/shop/technicians/${actionButton.dataset.technicianId}`, { method: "DELETE" })
        .then(async () => {
          closeSheet();
          await loadWorkshopRoster();
          showToast("Technician deleted");
          render();
        })
        .catch((error) => showToast(error.message || "Could not delete that technician"));
    }
    if (action === "pick-default-bay") {
      return openDefaultPickerModal({
        title: "Default bay",
        options: state.bays.map((bay) => ({ id: bay.id, label: bay.name })),
        selectedId: state.shop?.default_bay_id || "",
        action: "set-default-bay",
      });
    }
    if (action === "pick-default-technician") {
      return openDefaultPickerModal({
        title: "Default technician",
        options: state.technicians.map((technician) => ({ id: technician.id, label: technicianName(technician) })),
        selectedId: state.shop?.default_technician_id || "",
        action: "set-default-technician",
      });
    }
    if (action === "set-default-bay" || action === "set-default-technician") {
      const key = action === "set-default-bay" ? "defaultBayId" : "defaultTechnicianId";
      return saveShopFields({ [key]: actionButton.dataset.choiceId || null })
        .then(() => { closeSheet(); render(); })
        .catch((error) => showToast(error.message || "Could not save that default"));
    }
    if (action === "test-microphone") {
      if (!navigator.mediaDevices?.getUserMedia) return showToast("This browser can't access the microphone.");
      showToast("Testing microphone…");
      return navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          stream.getTracks().forEach((track) => track.stop());
          updateMicPermissionLabel();
          showToast("Microphone is working.");
        })
        .catch((error) => showToast(`Could not access microphone: ${error.message || "permission denied"}`));
    }
    if (action === "toggle-network-sharing") {
      const next = !state.shop?.sharesRepairData;
      return apiRequest("/api/shop", { method: "PATCH", body: JSON.stringify({ sharesRepairData: next }) })
        .then(({ shop }) => {
          state.shop = { ...shop, sharesRepairData: Boolean(shop.shares_repair_data), networkReadExempt: Boolean(shop.network_read_exempt) };
          render();
          showToast(next ? "Sharing anonymised repair patterns with the network." : "Stopped sharing with the network.");
        })
        .catch((error) => showToast(error.message));
    }
    if (action === "continue-diagnosis") return resumeSavedJob();
    if (action === "open-calendar") return calendarSheet();
    if (action === "open-profile") return technicianProfileSheet();
    if (action === "add-catalog-vehicle") return catalogEditorSheet();
    if (action === "sign-in") { window.location.href = "/login?next=/dashboard"; return; }
    if (action === "sign-out") {
      return apiRequest("/api/auth/signout", { method: "POST" }).finally(() => { window.location.href = "/login"; });
    }
    if (action === "profile-jobs") { closeSheet(); return setRoute("jobs"); }
    if (action === "calendar-previous" || action === "calendar-next") {
      const direction = action === "calendar-next" ? 1 : -1;
      const next = new Date(state.calendar.year, state.calendar.month + direction, 1);
      state.calendar.year = next.getFullYear();
      state.calendar.month = next.getMonth();
      state.calendar.selectedDay = 1;
      return calendarSheet();
    }
    if (action === "select-calendar-day") {
      state.calendar.selectedDay = Number(actionButton.dataset.calendarDay);
      return calendarSheet();
    }
    if (action === "view-photo") return photoViewerSheet(actionButton.dataset.photoScope, Number(actionButton.dataset.photoIndex));
    if (action === "delete-photo") {
      const scope = actionButton.dataset.photoScope;
      const photos = photoCollection(scope);
      const index = Number(actionButton.dataset.photoIndex);
      const [removedPhoto] = photos.splice(index, 1);
      if (removedPhoto && (typeof removedPhoto === "string" || removedPhoto.local)) URL.revokeObjectURL(photoUrl(removedPhoto));
      if (removedPhoto?.id && state.currentJobId) {
        apiRequest(`/api/jobs/${state.currentJobId}/photos?photoId=${encodeURIComponent(removedPhoto.id)}`, { method: "DELETE" }).catch((error) => showToast(error.message));
      }
      render();
      if (photos.length) photoViewerSheet(scope, Math.min(index, photos.length - 1));
      else closeSheet();
      return showToast("Photo deleted.");
    }
    if (action === "scan-vin") return vinCameraInput.click();
    if (action === "proceed-to-diagnosis") {
      const form = document.querySelector("#problem-form");
      if (form) syncProblem(form);
      if (!validateAssessment(form)) return;
      showTopProgressBar({ blocking: true });
      setButtonLoading(actionButton, "Saving…");
      return persistAssessment("repair").then(() => {
        state.repairReferenceEnabled = false;
        state.workflowUnlockedStep = 4;
        openRepairRecord();
        showToast("Assessment saved. Repair is ready to continue.");
      }).catch((error) => {
        resetButtonLoading(actionButton);
        showToast(error.message);
      }).finally(() => hideTopProgressBar());
    }
    if (action === "add-photo") {
      const problemForm = document.querySelector("#problem-form");
      if (problemForm) syncProblem(problemForm);
      const repairForm = document.querySelector("#repair-form");
      if (repairForm) syncRepairRecord(repairForm);
      photoInput.dataset.photoScope = state.route === "repair" ? "repair" : "inspection";
      if (actionButton.dataset.photoMode === "upload") photoInput.removeAttribute("capture");
      else photoInput.setAttribute("capture", "environment");
      photoInput.value = "";
      return photoInput.click();
    }
    if (action === "add-dtc") {
      return dtcEditorSheet();
    }
    if (action === "remove-dtc") {
      const code = actionButton.dataset.code;
      state.dtcs = state.dtcs.filter((entry) => entry !== code);
      render();
      queueRepairAutosave();
      return showToast(`${code} removed.`);
    }
    if (action === "repair-back") return returnToResults();
    if (action === "save-repair-draft") {
      const repairForm = document.querySelector("#repair-form");
      if (repairForm) syncRepairRecord(repairForm);
      // Drafts already autosave (queueRepairAutosave), so this is an explicit
      // "save and step away" -- flush now rather than waiting out the timer,
      // then leave the job open in the jobs list to come back to.
      clearTimeout(repairAutosaveTimer);
      return persistRepair(false)
        .then(() => {
          state.route = "jobs";
          updateNavigation();
          render();
          showToast("Job saved. Pick it back up from Jobs.");
        })
        .catch((error) => showToast(error.message));
    }
    if (action === "delete-repair") {
      const form = document.querySelector("#repair-form");
      if (form) syncRepairRecord(form);
      return deleteRepairConfirmation();
    }
    if (action === "confirm-delete-repair") {
      if (!isPersistedJobId(state.currentJobId)) return deleteRepairRecord();
      // Flush the current repair draft (cause/work performed/verification/
      // parts/DTCs) BEFORE cancelling -- archiveJob only flips status, it
      // never touches repair_records, so without this the mechanic's
      // in-progress notes at the repair step would be silently lost.
      clearTimeout(repairAutosaveTimer);
      return persistRepair(false)
        .catch(() => {}) // best-effort: still cancel even if the flush failed
        .then(() => apiRequest(`/api/jobs/${state.currentJobId}`, { method: "DELETE" }))
        .then(({ job }) => {
          const archivedJob = databaseJobToUi(job);
          const index = jobRecords.findIndex((entry) => entry.id === archivedJob.id);
          if (index >= 0) jobRecords[index] = archivedJob;
          state.activeJobId = null;
          deleteRepairRecord();
        })
        .catch((error) => showToast(error.message));
    }
    if (action === "confirm-complete-job") {
      return persistRepair(true).then((job) => {
        state.selectedJobId = job.id;
        state.route = "resolved";
        closeSheet();
        updateNavigation();
        render();
        showToast("Repair record saved and job marked resolved.");
      }).catch((error) => showToast(error.message));
    }
    if (action === "open-parts-editor") {
      const form = document.querySelector("#repair-form");
      if (form) syncRepairRecord(form);
      return partsEditorSheet();
    }
    if (action === "add-reference-part") {
      const added = addRepairPart(repairPartFromReference(actionButton.dataset.referenceName, actionButton.dataset.referenceNumber, actionButton.dataset.referenceKey));
      render();
      if (added) queueRepairAutosave();
      return showToast(added ? "Item added to the repair record." : "This item is already in the repair record.");
    }
    if (action === "toggle-reference-part") {
      const key = actionButton.dataset.referenceKey;
      const name = actionButton.dataset.referenceName;
      const existingIndex = state.repair.parts.findIndex((part) => part.key === key || part.name === name);
      const removed = existingIndex >= 0;
      if (removed) state.repair.parts.splice(existingIndex, 1);
      else addRepairPart(repairPartFromReference(name, actionButton.dataset.referenceNumber, key));
      render();
      partsEditorSheet();
      queueRepairAutosave();
      return showToast(removed ? "Item removed from the repair record." : "Item added to the repair record.");
    }
    if (action === "save-custom-part") {
      const form = document.querySelector("#part-editor-form");
      const data = new FormData(form);
      const name = String(data.get("custom-name") || "").trim();
      if (!name) {
        form.querySelector('[name="custom-name"]')?.focus();
        return showToast("Enter a part or consumable name first.");
      }
      addRepairPart({ type: String(data.get("custom-type") || "Part"), name, number: String(data.get("custom-number") || "").trim(), quantity: String(data.get("custom-quantity") || "1").trim() || "1" });
      closeSheet();
      render();
      queueRepairAutosave();
      return showToast("Custom item saved to the repair record.");
    }
    if (action === "remove-recorded-part") {
      const form = document.querySelector("#repair-form");
      if (form) syncRepairRecord(form);
      state.repair.parts.splice(Number(actionButton.dataset.recordedPartIndex), 1);
      render();
      queueRepairAutosave();
      return showToast("Item removed from this repair record.");
    }
    if (action === "close-sheet") return closeSheet();
    if (action === "web-research") return webResearchSheet();
    if (action === "search-library-web") return libraryWebResearchSheet();
    if (action === "log-fix") {
      showTopProgressBar({ blocking: true });
      setButtonLoading(actionButton, "Saving…");
      state.repairReferenceEnabled = true;
      openRepairRecord();
      hideTopProgressBar();
      return showToast("Selected repair reference saved to this job.");
    }
    if (action === "save-research") { closeSheet(); return showToast("Research notes saved with source links."); }
    if (action === "select-price") {
      addRepairPart({ key: actionButton.dataset.partKey, type: actionButton.dataset.partType, name: actionButton.dataset.partName, number: actionButton.dataset.partNumber, quantity: "1", supplier: actionButton.dataset.supplier, price: actionButton.dataset.price, offerUrl: actionButton.dataset.offerUrl, offerImageUrl: actionButton.dataset.offerImageUrl });
      closeSheet();
      render();
      queueRepairAutosave();
      return showToast("Supplier offer and part saved to the repair record.");
    }
    if (action === "send-dictation") return finishDictation();
    if (action === "cancel-dictation") return cancelDictation();
    if (action === "open-job") {
      const reopenSheet = actionButton.classList.contains("repair-case-cta")
        ? { type: "shop-repair-case", system: activeRepairCase.system, label: activeRepairCase.label, index: activeRepairCase.index }
        : null;
      closeSheet();
      return openJob(actionButton.dataset.jobId || state.activeJobId, { reopenSheet });
    }
    if (action === "open-repair-case") {
      const detail = state.activeProfile;
      if (!detail) return;
      const { source, system, label } = actionButton.dataset;
      if (source === "shop") {
        const row = (detail.repairGroups || []).find((r) => (r.system || "other") === system && r.label === label);
        if (row) shopRepairCaseSheet(row);
        return;
      }
      const networkTrim = actionButton.dataset.trim || "";
      const systemGroup = (detail.networkPatterns || []).find((g) => g.system === system);
      const row = systemGroup?.rows.find((r) => r.label === label && (r.trim || "") === networkTrim);
      if (row) networkRepairCaseSheet(row);
      return;
    }
    if (action === "back-from-resolved") {
      const target = state.resolvedReturn;
      if (target.route === "car-profile" && state.activeProfile) {
        state.profileTab = target.tab || "history";
        setRoute("car-profile");
        if (target.sheet?.type === "shop-repair-case") {
          const row = (state.activeProfile.repairGroups || []).find((r) => (r.system || "other") === target.sheet.system && r.label === target.sheet.label);
          if (row) shopRepairCaseSheet(row, target.sheet.index);
        }
        return;
      }
      return setRoute("jobs");
    }
    if (action === "open-car-profile") return openCarProfile(actionButton.dataset.profileId, { trim: actionButton.dataset.trim });
    if (action === "back-to-library") {
      state.activeProfile = null;
      state.activeProfileId = null;
      return setRoute("knowledge");
    }
    if (action === "open-library-brand") {
      state.libraryBrand = actionButton.dataset.brand || null;
      return render();
    }
    if (action === "back-to-library-brands") {
      state.libraryBrand = null;
      return render();
    }
    if (action === "set-profile-tab") {
      state.profileTab = actionButton.dataset.profileTab === "history" ? "history" : "notes";
      const draft = document.querySelector("#profile-note-input");
      if (draft) state.profileNoteDraft = draft.value;
      return render();
    }
    if (action === "open-add-note") return openAddNoteModal();
    if (action === "open-edit-notes") return openEditNotesModal();
    if (action === "toggle-delete-note") {
      const noteId = actionButton.dataset.noteId;
      captureEditNoteDrafts();
      if (state.profileNoteEditDeleted.has(noteId)) state.profileNoteEditDeleted.delete(noteId);
      else state.profileNoteEditDeleted.add(noteId);
      return openEditNotesModal({ reset: false });
    }
  }

  const dictate = event.target.closest("[data-dictate]");
  if (dictate) {
    const target = document.querySelector(`#${dictate.dataset.dictate}`);
    if (!target) return;
    if (dictate.classList.contains("is-listening")) return finishDictation();
    return startDictation(dictate, target);
  }

  const seeOriginal = event.target.closest("[data-see-original]");
  if (seeOriginal) {
    const target = document.querySelector(`#${seeOriginal.dataset.seeOriginal}`);
    if (!target || target.dataset.aiOriginal === undefined) return;
    target.value = target.dataset.aiOriginal;
    delete target.dataset.aiOriginal;
    syncTextFieldState(target);
    seeOriginal.hidden = true;
    return;
  }

  const enhancer = event.target.closest("[data-enhance]");
  if (enhancer) {
    const target = document.querySelector(`#${enhancer.dataset.enhance}`);
    if (!target) return;
    if (!target.value.trim()) return showToast("Type or dictate first.");
    const fieldShell = target.closest(".text-field-shell");
    const seeOriginalButton = fieldShell?.querySelector("[data-see-original]");
    clearTimeout(enhancer.enhanceTimer);
    fieldShell?.classList.remove("is-ai-tracing");
    if (fieldShell) void fieldShell.offsetWidth;
    fieldShell?.classList.add("is-ai-tracing");
    enhancer.classList.add("is-enhancing");
    enhancer.innerHTML = `${icon("sparkles")} Enhancing…`;
    const field = target.id === "complaint" ? "complaint" : target.id === "notes" ? "observations" : target.id === "repair-verification" ? "verification" : "work_performed";
    const originalText = target.value;
    apiRequest("/api/ai/enhance", { method: "POST", body: JSON.stringify({ text: target.value, field }) }).then((result) => {
      target.value = result.text;
      target.dataset.aiOriginal = originalText;
      if (seeOriginalButton) seeOriginalButton.hidden = false;
      syncTextFieldState(target);
      showToast("Text enhanced for clarity — review before continuing.");
    }).catch((error) => {
      target.value = enhanceWorkshopText(target.value);
      syncTextFieldState(target);
      showToast(`${error.message}. Basic cleanup applied locally.`);
    }).finally(() => {
      enhancer.classList.remove("is-enhancing");
      enhancer.innerHTML = `${icon("sparkles")} AI enhance`;
      enhancer.blur();
      fieldShell?.classList.remove("is-ai-tracing");
    });
  }

  const part = event.target.closest("[data-part]");
  if (part) return priceSheet(part.dataset.partName, part.dataset.part);

});

document.addEventListener("input", (event) => {
  if (event.target.matches("#repair-notes, #repair-verification")) {
    if (event.target.id === "repair-notes") state.repair.workNotes = event.target.value;
    if (event.target.id === "repair-verification") state.repair.verificationNotes = event.target.value;
    queueRepairAutosave();
    return;
  }
  if (event.target.matches('input[name="mileage"]')) {
    const digitsBeforeCursor = event.target.value.slice(0, event.target.selectionStart).replace(/[^0-9]/g, "").length;
    const digits = event.target.value.replace(/[^0-9]/g, "");
    const formatted = digits ? Number(digits).toLocaleString("en-AU") : "";
    event.target.value = formatted;
    let cursor = formatted.length;
    let seen = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/[0-9]/.test(formatted[i])) seen++;
      if (seen === digitsBeforeCursor) { cursor = i + 1; break; }
    }
    if (digitsBeforeCursor === 0) cursor = 0;
    event.target.setSelectionRange(cursor, cursor);
    state.vehicle.mileage = formatted;
    return;
  }
  if (event.target.matches("#vin")) {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    state.vehicle.vin = event.target.value;
    clearTimeout(vinDecodeTimer);
    if (event.target.value.length === 17) vinDecodeTimer = setTimeout(() => decodeVin(event.target.value), 320);
    return;
  }
  const isJobSearch = event.target.matches("#job-search");
  const isLibrarySearch = event.target.matches("#library-search");
  const isStaffSearch = event.target.matches("#staff-search");
  if (isStaffSearch) {
    state.staffSearch = event.target.value;
    const query = event.target.value.trim().toLowerCase();
    const rows = [...document.querySelectorAll(".settings-row[data-staff-search]")];
    let visibleCount = 0;
    rows.forEach((row) => {
      const matches = !query || row.dataset.staffSearch.includes(query);
      row.hidden = !matches;
      if (matches) visibleCount += 1;
    });
    const emptyState = document.querySelector(".staff-empty");
    if (emptyState) {
      emptyState.hidden = !query || visibleCount > 0;
      const queryLabel = emptyState.querySelector(".staff-empty-query");
      if (queryLabel) queryLabel.textContent = event.target.value.trim();
    }
    return;
  }
  if (!isJobSearch && !isLibrarySearch) return;
  if (isJobSearch) state.jobSearch = event.target.value;
  if (isLibrarySearch) {
    state.librarySearch = event.target.value;
    clearTimeout(libraryRepairSearchTimer);
    const trimmed = event.target.value.trim();
    const caretPos = event.target.selectionStart;
    if (trimmed.length < 3) {
      if (state.libraryRepairMatches.length || state.libraryRepairQuery) {
        state.libraryRepairMatches = [];
        state.libraryRepairQuery = "";
        render();
        restoreLibrarySearchFocus(caretPos);
      }
    } else {
      libraryRepairSearchTimer = setTimeout(() => runLibraryRepairSearch(trimmed, caretPos), 350);
    }
  }
  const query = event.target.value.trim().toLowerCase();
  const cards = [...document.querySelectorAll(isJobSearch ? ".job-card[data-job-search]" : ".library-result-card[data-library-search]")];
  let visibleCount = 0;
  cards.forEach((card) => {
    const searchText = isJobSearch ? card.dataset.jobSearch : card.dataset.librarySearch;
    const matches = !query || searchText.includes(query);
    card.hidden = !matches;
    if (matches) visibleCount += 1;
  });
  const emptyState = document.querySelector(isJobSearch ? ".jobs-empty" : ".library-empty");
  if (emptyState) emptyState.hidden = visibleCount > 0;
});

document.addEventListener("change", (event) => {
  if (event.target.matches("#repair-case-select")) {
    const detail = state.activeProfile;
    const row = detail && (detail.repairGroups || []).find((r) => (r.system || "other") === activeRepairCase.system && r.label === activeRepairCase.label);
    if (row) shopRepairCaseSheet(row, Number(event.target.value));
    return;
  }
  if (event.target.matches("#repair-system")) {
    // No re-render: the select already shows the new value, and rebuilding the
    // repair form mid-edit would drop caret position in the textareas above.
    state.repair.system = event.target.value;
    event.target.classList.toggle("is-placeholder", !event.target.value);
    return;
  }
  const vehicleForm = event.target.closest("#vehicle-form");
  if (!vehicleForm) return;
  // A make change reloads the dependent model list. Capture every field first
  // so an in-progress year, mileage, or customer value survives that refresh.
  syncVehicle(vehicleForm);
  if (event.target.matches("#vehicle-make")) {
    state.vehicle.make = event.target.value;
    // Keep independent intake data (year, mileage and customer details), but
    // reset every specification that belongs to the previous make/model.
    state.vehicle.model = "";
    state.vehicle.trim = "";
    state.vehicle.engine = "";
    state.vehicle.drivetrain = "";
    state.vehicle.transmission = "";
    state.catalog.models = [];
    state.catalog.variants = [];
    loadCatalogModels(state.vehicle.make).then(() => render());
    return;
  }
  if (event.target.matches("#vehicle-model")) {
    state.vehicle.model = event.target.value;
    state.vehicle.trim = "";
    loadCatalogVariants(state.vehicle.make, state.vehicle.model).then(() => render());
    return;
  }
  if (event.target.matches("#vehicle-trim")) {
    // Auto-fill spec fields the selected trim pins to a single value; clear those
    // with several options so the mechanic picks (the dropdown shows a placeholder).
    ["engine", "drivetrain", "transmission"].forEach((field) => {
      const options = specOptions(field);
      if (options.length === 1) state.vehicle[field] = options[0];
      else if (options.length > 1 && !options.includes(state.vehicle[field])) state.vehicle[field] = "";
    });
    render();
  }
});

document.addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.target.id === "profile-note-form") return saveProfileNote(event.target);
  if (event.target.id === "edit-notes-form") return saveEditedNotes(event.target);
  if (event.target.id === "shop-field-form") return saveShopField(event.target);
  if (event.target.id === "bay-form") return saveBay(event.target);
  if (event.target.id === "technician-form") return saveTechnician(event.target);
  if (event.target.id === "invite-staff-form") return saveStaffInvite(event.target);
  if (event.target.id === "vehicle-form") {
    syncVehicle(event.target);
    const submitButton = event.submitter || event.target.querySelector('button[type="submit"]');
    showTopProgressBar({ blocking: true });
    setButtonLoading(submitButton, "Saving…");
    return persistVehicleDetails().then(() => {
      state.savedJourney = { route: "new", step: 2 };
      state.workflowUnlockedStep = Math.max(state.workflowUnlockedStep, 2);
      showToast("Vehicle and customer saved to the workshop cloud.");
      setStep(2);
    }).catch((error) => {
      resetButtonLoading(submitButton);
      showToast(error.status === 401 ? "Sign in to create and save this job." : error.message);
    }).finally(() => hideTopProgressBar());
  }
  if (event.target.id === "problem-form") {
    syncProblem(event.target);
    if (!validateAssessment(event.target)) return;
    const submitButton = event.submitter || event.target.querySelector('button[type="submit"]');
    showTopProgressBar({ blocking: true });
    setButtonLoading(submitButton, "Searching…");
    return persistAssessment("similar_repairs").then(async () => {
      state.repairReferenceEnabled = true;
      state.savedJourney = { route: "new", step: 3 };
      state.workflowUnlockedStep = Math.max(state.workflowUnlockedStep, 3);
      showToast("Assessment saved. Searching verified workshop repairs…");
      await loadRepairMatches();
      setStep(3);
    }).catch((error) => {
      resetButtonLoading(submitButton);
      showToast(error.message);
    }).finally(() => hideTopProgressBar());
  }
  if (event.target.id === "catalog-editor-form") {
    const data = new FormData(event.target);
    const make = String(data.get("catalog-make") || "").trim();
    const model = String(data.get("catalog-model") || "").trim();
    const variant = String(data.get("catalog-variant") || "").trim();
    const engine = String(data.get("catalog-engine") || "").trim();
    const drivetrain = String(data.get("catalog-drivetrain") || "").trim();
    const transmission = String(data.get("catalog-transmission") || "").trim();
    return apiRequest("/api/catalog", { method: "POST", body: JSON.stringify({ make, model: model || undefined, variant: variant || undefined, engine: engine || undefined, drivetrain: drivetrain || undefined, transmission: transmission || undefined }) }).then(async (result) => {
      state.vehicle.make = make;
      if (model) state.vehicle.model = model;
      if (result.variant) {
        state.vehicle.trim = result.variant.name || "";
        state.vehicle.engine = result.variant.engine || "";
        state.vehicle.drivetrain = result.variant.drivetrain || "";
        state.vehicle.transmission = result.variant.transmission || "";
      }
      const makesResult = await apiRequest("/api/catalog");
      state.catalog.makes = makesResult.makes || [];
      await loadCatalogModels(make);
      await loadCatalogVariants(make, model || state.vehicle.model);
      closeSheet();
      render();
      showToast("Vehicle catalog updated.");
    }).catch((error) => showToast(error.message));
  }
  if (event.target.id === "dtc-editor-form") {
    const data = new FormData(event.target);
    const code = String(data.get("dtc-code") || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!code) return showToast("Enter a code.");
    if (!state.dtcs.includes(code)) state.dtcs.push(code);
    closeSheet();
    render();
    queueRepairAutosave();
    return showToast(`${code} added to the active job.`);
  }
  if (event.target.id === "repair-form") {
    syncRepairRecord(event.target);
    if (!validateRepairCompletion(event.target)) return;
    return completeJobConfirmation();
  }
});

photoInput.addEventListener("change", async () => {
  if (!photoInput.files.length) return;
  const scope = photoInput.dataset.photoScope || (state.route === "repair" ? "repair" : "inspection");
  const targetPhotos = photoCollection(scope);
  const files = [...photoInput.files];
  const nextPhotos = files.map((file) => ({ url: URL.createObjectURL(file), local: true, key: `${file.name}-${file.size}-${Date.now()}-${Math.random()}` }));
  targetPhotos.push(...nextPhotos);
  photoInput.value = "";
  render();
  if (!state.currentJobId) return showToast("Save the vehicle first so photos can be stored with the job.");
  showToast(`Uploading ${files.length} photo${files.length === 1 ? "" : "s"}…`);
  let uploaded = 0;
  for (let index = 0; index < files.length; index += 1) {
    const formData = new FormData();
    formData.append("file", files[index]);
    formData.append("kind", scope === "repair" ? "repair" : "arrival");
    try {
      const { photo } = await apiRequest(`/api/jobs/${state.currentJobId}/photos`, { method: "POST", body: formData });
      const targetIndex = targetPhotos.findIndex((entry) => entry?.key === nextPhotos[index].key);
      if (targetIndex >= 0) {
        URL.revokeObjectURL(nextPhotos[index].url);
        targetPhotos[targetIndex] = photo;
      }
      uploaded += 1;
    } catch (error) {
      const targetIndex = targetPhotos.findIndex((entry) => entry?.key === nextPhotos[index].key);
      if (targetIndex >= 0) targetPhotos[targetIndex].uploadError = true;
      showToast(error.message);
    }
  }
  render();
  if (uploaded) showToast(`${uploaded} photo${uploaded === 1 ? "" : "s"} saved to the workshop cloud.`);
});

vinCameraInput.addEventListener("change", async () => {
  if (!vinCameraInput.files.length) return;
  const file = vinCameraInput.files[0];
  vinCameraInput.value = "";
  if ("BarcodeDetector" in window) {
    try {
      const detector = new BarcodeDetector({ formats: ["code_39", "code_128", "data_matrix", "qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close();
      const vin = codes.map((result) => String(result.rawValue || "").toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "")).find((value) => value.length === 17);
      if (vin) {
        state.vehicle.vin = vin;
        render();
        await decodeVin(vin);
        return;
      }
    } catch (_) {}
  }
  document.querySelector("#vin")?.focus();
  showToast("No VIN barcode was detected. Enter the 17-character VIN to decode the vehicle.");
});

sheetLayer.addEventListener("click", (event) => {
  if (event.target === sheetLayer) closeSheet();
});
sheetLayer.addEventListener("pointerdown", beginPhotoGesture, { passive: false });
sheetLayer.addEventListener("pointermove", movePhotoGesture, { passive: false });
sheetLayer.addEventListener("pointerup", endPhotoGesture, { passive: false });
sheetLayer.addEventListener("pointercancel", endPhotoGesture, { passive: false });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !sheetLayer.hidden) closeSheet();
});

window.addEventListener("scroll", () => {
  updateScrollCue();
  updateStickyJourney();
}, { passive: true });
window.addEventListener("resize", () => {
  updateScrollCue();
  updateStickyJourney();
});
window.addEventListener("load", () => {
  updateScrollCue();
  updateStickyJourney();
});

// Lets a browser opt into the Honda Civic demo fixtures via a one-time URL
// visit (?dev=1 / ?dev=0) instead of needing devtools console access --
// localStorage persists after that, same as setting it manually.
(function syncDevFixturesFromUrl() {
  const devParam = new URLSearchParams(location.search).get("dev");
  if (devParam === "1") { localStorage.setItem("argos-dev-fixtures", "on"); location.replace(location.pathname); }
  if (devParam === "0") { localStorage.removeItem("argos-dev-fixtures"); location.replace(location.pathname); }
})();

setTheme(preferredTheme(), false);
hydrateIcons();
updateWorkshopClock();
setInterval(updateWorkshopClock, 30000);
render();
loadBackendData();

checkForUpdate();
setInterval(checkForUpdate, 30 * 1000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});
window.addEventListener("focus", checkForUpdate);
})();
