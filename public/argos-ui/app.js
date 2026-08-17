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
let repairAutosaveInFlight = false;
let animateNextScreen = false;
let pendingMatchCarouselRestore = null;
const photoGestureStates = new WeakMap();
const assetBase = window.location.pathname.startsWith("/dashboard") ? "/argos-ui" : "";
const isPersistedJobId = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ""));

const state = {
  route: "home",
  step: 1,
  activeJobId: null,
  selectedJobId: null,
  jobFilter: "all",
  jobSearch: "",
  librarySearch: "",
  currentJobId: null,
  backendStatus: "loading",
  catalog: { makes: [], models: [], variants: [] },
  profile: null,
  shop: null,
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
    cause: "Catalytic-converter efficiency was below specification after oxygen-sensor operation and exhaust integrity were verified.",
    workPerformed: [
      "Checked the exhaust system for leaks and damage.",
      "Verified front and rear oxygen-sensor activity at operating temperature.",
      "Replaced the catalytic converter and both sealing gaskets.",
      "Cleared adaptations and completed the manufacturer drive cycle.",
    ],
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
    cause: "Alternator output dropped below specification under load.",
    workPerformed: ["Load-tested the charging system.", "Replaced the alternator.", "Verified charging voltage under full electrical load."],
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
    cause: "Front brake pads were worn through on the inner edges.",
    workPerformed: ["Inspected braking system.", "Replaced front pads and rotors.", "Road-tested and rechecked wheel torque."],
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

function jobVehicleName(job) {
  return `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`;
}

function jobSummary(job) {
  if (job.summary) return job.summary;
  return [job.complaint, job.observations].filter(Boolean).join(" · ");
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
    evidence: "Same model · same code",
    vehicle: "2019 Volvo V60 · P0171",
    meta: "78,240 KM · B4204T ENGINE · REPAIRED 14 MAR 2026 · J. MORRIS",
    cause: "Replaced a cracked PCV diaphragm and hardened breather hose that caused an air leak when warm.",
    steps: [
      "Smoke-tested intake after engine reached operating temperature.",
      "Isolated leak at oil filter housing PCV diaphragm and breather elbow.",
      "Replaced diaphragm kit and breather hose; cleaned throttle body.",
      "Reset adaptations, road-tested 18 km and verified fuel trims below +4%.",
    ],
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
    evidence: "Same engine family",
    vehicle: "2021 Volvo XC60 · lean idle",
    meta: "91,600 KM · B4204T ENGINE · REPAIRED 21 JUN 2026 · A. NGUYEN",
    cause: "Replaced the intake manifold gasket at cylinder 1 after a warm-engine smoke test confirmed the leak.",
    steps: [
      "Verified positive trims at idle and near-normal trims above 2,500 RPM.",
      "Smoke-tested the warm engine and isolated the leak at the cylinder 1 runner.",
      "Removed the intake manifold and replaced the complete gasket set.",
      "Reset adaptations, road-tested and verified fuel trims below +5%.",
    ],
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
  return repair.id === "primary" ? "Same model · similar symptoms" : "Same engine family · similar symptoms";
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
  mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6"/>',
  scan: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M7 12h10"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18"/>',
  wrench: '<path d="M14.5 6.5a4.8 4.8 0 0 0-6-3.8l3 3-3.8 3.8-3-3a4.8 4.8 0 0 0 6.3 5.8L19.7 21l1.3-1.3-8.7-8.7a4.8 4.8 0 0 0 2.2-4.5Z"/>',
  bolt: '<path d="m13 2-8 12h7l-1 8 8-12h-7Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  save: '<path d="M5 3h12l2 2v16H5Z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="1"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5L7 20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  sparkles: '<path d="m12 2 1.4 4.6L18 8l-4.6 1.4L12 14l-1.4-4.6L6 8l4.6-1.4Z"/><path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8Z"/><path d="m5 14 .8 1.7 1.7.8-1.7.8L5 19l-.8-1.7-1.7-.8 1.7-.8Z"/>',
  send: '<path d="m3 11 18-8-8 18-2-7Z"/><path d="m11 14 10-11"/>',
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
  resumeJob: '<path d="M358.5-373.23q-93.81 0-159.48-65.67-65.67-65.67-65.67-159.48 0-16.3 2.27-32.34 2.27-16.05 7.96-31.05 3.37-8.23 9.6-12.83 6.24-4.6 14.11-6.67 7.86-2.08 15.71.14 7.84 2.21 14.27 8.75l106.04 105.46 87.46-86.66-105.38-105.77q-6.41-6.35-8.53-14.38-2.13-8.03-.2-15.76t6.37-13.91q4.43-6.18 12.66-9.71 14.81-6.08 30.8-8.66t31.99-2.58q93.93 0 159.96 66.03 66.02 66.03 66.02 159.94 0 25.26-4.77 47.07t-14.31 42.16l217.08 215.81q24.16 24.27 24.16 59.42 0 35.15-24.33 59.3-24.51 24.35-59.21 23.95-34.69-.41-59.04-24.87L447.88-392.31q-21.15 9.16-43 14.12-21.86 4.96-46.38 4.96Zm-.08-55.96q26.09 0 52.07-8.06 25.97-8.06 47.74-24.17l246.46 246.77q7.43 7.61 18.62 7.71 11.19.1 19.11-7.92 7.93-8.02 7.93-19.12 0-11.1-7.93-19.21L495.65-499.35q16.54-21.07 24.7-46.51 8.15-25.45 8.15-52.52 0-66.54-48.75-118.74-48.75-52.19-123.94-49.77l90.42 90.43q10.35 10.34 10.1 24.09t-10.6 24.17L326.69-511.96q-10.5 10.04-24.17 9.79-13.67-.25-23.71-10.29L191-600.27q-1.46 78.92 50.86 125 52.33 46.08 116.56 46.08Zm110.23-60.62Z"/>',
};

function materialIcon(name, label = "") {
  return `<svg viewBox="0 -960 960 960" fill="currentColor" ${label ? `aria-label="${label}" role="img"` : 'aria-hidden="true"'}>${materialIcons[name] || ""}</svg>`;
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
  const repairedSteps = (repair.steps || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0)).map((step) => step.instruction);
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
    technician: state.profile?.full_name || "Workshop technician",
    complaint: row.complaint || "",
    observations: row.observations || "",
    summary: row.summary || "",
    dtcs,
    resume: stageResume(row.stage),
    cause: repair.cause || "No confirmed cause recorded.",
    workPerformed: repairedSteps.length ? repairedSteps : String(repair.work_performed || "").split(/\n+/).map((line) => line.trim()).filter(Boolean),
    parts: repairedItems,
    verification: repair.verification_notes || "No verification notes recorded.",
    reference: repair.reference_repair_id ? "Previous repair reference saved" : "No previous repair reference used",
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
    evidence: (row.evidence || []).join(" · ") || "Related workshop repair",
    vehicle: row.vehicle_label || "Previous workshop repair",
    meta: row.repaired_at ? `REPAIRED ${new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(row.repaired_at)).toUpperCase()}` : "VERIFIED SHOP REPAIR",
    cause: row.cause || row.work_performed || "Open the repair record for details.",
    steps: (row.steps || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0)).map((step) => step.instruction),
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
    `<label class="form-field"><span class="field-label">${label}</span><span class="select-control"><select class="select${value ? "" : " is-placeholder"}" name="${field}" aria-label="${label}"><option value=""${value ? "" : " selected"}></option>${opts.map((option) => `<option${value === option ? " selected" : ""}>${escapeHTML(option)}</option>`).join("")}</select>${icon("down")}</span></label>`;
  if (options.length > 1) return asSelect(options);
  if (options.length === 0 && fallbackOptions && fallbackOptions.length) return asSelect(fallbackOptions);
  return `<label class="form-field"><span class="field-label">${label}</span><input class="input" name="${field}" value="${escapeHTML(value)}" placeholder="${placeholder}" /></label>`;
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
    state.shop = account.shop || null;
    const profileInitials = state.profile?.full_name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    const profileLabel = document.querySelector(".profile-button span");
    if (profileInitials && profileLabel) profileLabel.textContent = profileInitials;
    const loadedJobs = (jobs || []).map(databaseJobToUi);
    jobRecords = loadedJobs;
    const rememberedJob = loadedJobs.find((job) => job.id === storedActiveJobId() && job.status === "open");
    state.activeJobId = rememberedJob?.id || null;
    state.currentJobId = rememberedJob?.id || null;
    state.backendStatus = "connected";
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
    bay: null,
  };
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
  if (!complaint) throw new Error("Enter the customer complaint to continue.");
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
  const steps = state.repair.workNotes.split(/\n+/).map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  return {
    cause: null,
    workPerformed: state.repair.workNotes,
    verificationNotes: state.repair.verificationNotes || null,
    dtcs: state.dtcs,
    referenceRepairId: selected && /^[0-9a-f-]{36}$/i.test(selected.id) ? selected.id : null,
    steps,
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
  state.repair = { workNotes: "", verificationNotes: "", parts: [], photos: [] };
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
  animateNextScreen = true;
  updateNavigation();
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateNavigation() {
  document.querySelectorAll(".nav-item, .nav-new").forEach((item) => {
    const isActive = item.dataset.route === state.route
      || (item.dataset.route === "new" && state.route === "repair")
      || (item.dataset.route === "jobs" && state.route === "resolved");
    item.classList.toggle("is-active", isActive);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
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

function scrollToNextView() {
  const documentHeight = document.documentElement.scrollHeight;
  const maximumScroll = Math.max(0, documentHeight - window.innerHeight);
  const step = Math.max(320, Math.round(window.innerHeight * 0.72));
  window.scrollTo({ top: Math.min(window.scrollY + step, maximumScroll), behavior: "smooth" });
}

function taskHeader({ context, title, backAction = "", backLabel = "Go back", status = "", statusType = "saved" }) {
  return `<header class="task-header${backAction ? " has-back" : ""}">
    ${backAction ? `<button class="task-back" type="button" data-action="${backAction}" aria-label="${backLabel}">${icon("back")}</button>` : ""}
    <div class="task-header-copy${context ? "" : " is-title-only"}">${context ? `<span class="task-context">${context}</span>` : ""}<h1>${title}</h1></div>
    ${status ? `<span class="task-status is-${statusType}">${statusType === "saved" ? '<span class="task-status-dot" aria-hidden="true"></span>' : ""}${status}</span>` : ""}
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
    if (step === currentStep) return `<span class="journey-item is-current${isComplete ? " is-complete" : ""}" aria-current="step">${isComplete ? icon("check") : ""}<span>${label}</span></span>`;
    if (isSkipped) return `<button class="journey-item is-skipped" type="button" data-journey-step="3" aria-label="Similar repairs skipped; open this stage"><span>${label}</span></button>`;
    if (step <= unlockedStep) {
      return `<button class="journey-item ${isComplete ? "is-complete" : "is-available"}" type="button" data-journey-step="${step}">${isComplete ? icon("check") : ""}<span>${label}</span></button>`;
    }
    return `<span class="journey-item is-upcoming" aria-disabled="true"><span>${label}</span></span>`;
  }).join("")}</nav>`;
}

function vehicleTaskHeader() {
  return taskHeader({ context: "New job", title: "Vehicle details" });
}

function problemTaskHeader() {
  return taskHeader({
    context: "Initial assessment",
    title: vehicleName(),
  });
}

function vehicleName() {
  return `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
}

function resultsTaskHeader() {
  return taskHeader({
    context: `Useful repairs · ${repairMatches.length} found`,
    title: vehicleName(),
  });
}

function repairRecordHeader() {
  return taskHeader({
    context: "Repair details",
    title: vehicleName(),
  });
}

function renderHome() {
  const openJobs = jobRecords.filter((job) => job.status === "open");
  const resolvedJobs = jobRecords.filter((job) => job.status === "resolved");
  const allJobsCount = jobRecords.length;
  const activeJob = jobRecords.find((job) => job.id === state.activeJobId && job.status === "open");
  const repairLibraryCount = libraryRecords.length;
  const resumeTitle = "Resume job";
  const resumeTile = activeJob
    ? `<button type="button" class="control-tile" data-action="open-job" data-job-id="${activeJob.id}" aria-label="${resumeTitle} for ${jobVehicleName(activeJob)}">
        <span class="tile-icon">${materialIcon("resumeJob")}</span>
        <span class="tile-copy"><strong>${resumeTitle}</strong><small>${jobVehicleName(activeJob)}</small></span>
      </button>`
    : `<button type="button" class="control-tile" data-route="new" aria-label="Start a new job">
        <span class="tile-icon">${materialIcon("resumeJob")}</span>
        <span class="tile-copy"><strong>No active job</strong><small>Ready for the next vehicle</small></span>
      </button>`;
  app.innerHTML = `<section class="screen dashboard-shell">
    <div class="home-status-block">
      <div class="home-kicker"><span>Bay 03</span></div>
      <div class="home-metrics" aria-label="Today's workshop status">
        <div class="home-metric"><strong>${String(openJobs.length).padStart(2, "0")}</strong><span>Open jobs</span></div>
        <div class="home-metric"><strong>${String(resolvedJobs.length).padStart(2, "0")}</strong><span>Resolved today</span></div>
        <div class="home-metric secondary"><strong>1.8<small>h</small></strong><span>Average diagnosis</span></div>
      </div>
    </div>

    <div class="control-grid" aria-label="Workshop controls">
      <button type="button" class="control-tile is-primary" data-route="new">
        <span class="tile-icon">${icon("plus")}</span>
        <span class="tile-copy"><strong>New job</strong><small>Vehicle &amp; complaint</small></span>
      </button>
      ${resumeTile}
      <button type="button" class="control-tile" data-route="jobs">
        <span class="tile-icon">${icon("clipboard")}</span>
        <span class="tile-copy"><strong>All jobs</strong><small>${allJobsCount} ${allJobsCount === 1 ? "item" : "items"}</small></span>
      </button>
      <button type="button" class="control-tile" data-route="knowledge">
        <span class="tile-icon">${icon("database")}</span>
        <span class="tile-copy"><strong>Repair library</strong><small>${repairLibraryCount} ${repairLibraryCount === 1 ? "item" : "items"}</small></span>
      </button>
    </div>

    <div class="home-jobs-section">
      <div class="section-heading">
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
  return `<button class="job-card" data-status="${job.status}" data-action="open-job" data-job-id="${job.id}" data-job-search="${escapeHTML(jobSearchText(job))}"${hidden ? " hidden" : ""} type="button" aria-label="${job.status === "open" ? "Resume" : `View ${statusLabel.toLowerCase()} job for`} ${jobVehicleName(job)}">
    <span class="job-card-main">
      <span class="job-card-top">
        <span class="job-status-group">
          <span class="status-chip ${job.status === "resolved" ? "resolved" : job.status === "deleted" ? "deleted" : ""}">${statusLabel}</span>
          ${dateLabel ? `<span class="job-date">${escapeHTML(dateLabel)}</span>` : ""}
        </span>
        <span class="job-bay">${job.bay.toUpperCase()}</span>
      </span>
      <span class="job-vehicle">${jobVehicleName(job)}</span>
      <span class="job-card-context"><span>${escapeHTML(job.vehicle.mileage)} km</span><span>${escapeHTML(job.vehicle.customerName)}</span></span>
      <span class="job-issue">${jobSummary(job)}</span>
    </span>
    <span class="job-card-action" aria-hidden="true">${icon("arrow")}</span>
  </button>`;
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
      <span class="field-label">Search jobs</span>
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

const libraryRecords = [
  { vehicle: "Volvo V60 / XC60", issue: "P0171 · PCV diaphragm / breather hose", meta: "22 reuses", score: "92%" },
  { vehicle: "Ford F-150 3.5L", issue: "P0300 · coil pack heat failure", meta: "18 reuses", score: "88%" },
];

function librarySearchText(record) {
  return [record.vehicle, record.issue, record.meta, record.score].join(" ").toLowerCase();
}

function libraryCard(record, { hidden = false } = {}) {
  return `<article class="job-card library-result-card" data-library-search="${escapeHTML(librarySearchText(record))}"${hidden ? " hidden" : ""}>
    <span class="job-card-main"><span class="job-status-row"><span class="status-chip resolved">Verified repair</span><span class="job-bay">${record.meta}</span><span class="job-time">${record.score}</span></span><span class="job-vehicle">${record.vehicle}</span><span class="job-issue">${record.issue}</span></span>
    <span class="job-card-action" aria-hidden="true">${icon("arrow")}</span>
  </article>`;
}

function renderKnowledge() {
  const normalizedSearch = state.librarySearch.trim().toLowerCase();
  const hasSearchResults = !normalizedSearch || libraryRecords.some((record) => librarySearchText(record).includes(normalizedSearch));
  app.innerHTML = `<section class="screen workflow-shell">
    <div class="page-header"><div><h1>Repair library</h1></div></div>
    <label class="form-field jobs-search-field" for="library-search">
      <span class="field-label">Search repairs</span>
      <span class="jobs-search-control">${icon("search")}<input class="input jobs-search-input" id="library-search" type="search" value="${escapeHTML(state.librarySearch)}" placeholder="Vehicle, code, part or repair" autocomplete="off" /></span>
    </label>
    <div class="stat-grid"><div class="stat"><span class="stat-value">86%</span><span class="stat-label">Fix verified</span></div><div class="stat"><span class="stat-value">312</span><span class="stat-label">Models</span></div><div class="stat"><span class="stat-value">48</span><span class="stat-label">Techs</span></div></div>
    <div class="section-heading"><div><span class="section-label">Most reused</span><h2>This month</h2></div></div>
    <div class="job-list">
      ${libraryRecords.map((record) => libraryCard(record, { hidden: Boolean(normalizedSearch && !librarySearchText(record).includes(normalizedSearch)) })).join("")}
    </div>
    <div class="jobs-empty library-empty"${hasSearchResults ? " hidden" : ""} role="status">No repairs match your search.</div>
  </section>`;
}

function renderSettings() {
  const theme = document.documentElement.dataset.theme || "dark";
  app.innerHTML = `<section class="screen workflow-shell settings-shell">
    <div class="page-header"><div><h1>Settings</h1></div></div>

    <section class="settings-group" aria-labelledby="display-settings">
      <div class="settings-section-head"><span class="section-label">Display</span><h2 id="display-settings">Theme</h2></div>
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
      </div>
    </section>

    <section class="settings-group" aria-labelledby="accessibility-settings">
      <div class="settings-section-head"><span class="section-label">Readability</span><h2 id="accessibility-settings">Workshop accessibility</h2></div>
      <div class="setting-row"><span><strong>Readable interface</strong><small>Body and control text never drops below 16px</small></span><span class="setting-value">On</span></div>
      <div class="setting-row"><span><strong>High-contrast primary text</strong><small>Important instructions stay bright in both themes</small></span><span class="setting-value">On</span></div>
    </section>

    <section class="settings-group" aria-labelledby="input-settings">
      <div class="settings-section-head"><span class="section-label">Input</span><h2 id="input-settings">Workshop tools</h2></div>
      <button class="setting-row is-action" type="button" data-action="settings-info"><span><strong>Voice and dictation</strong><small>Microphone, language and transcription review</small></span><span class="setting-row-action">${icon("arrow")}</span></button>
      <button class="setting-row is-action" type="button" data-action="settings-info"><span><strong>Camera and photos</strong><small>Permissions, image quality and storage</small></span><span class="setting-row-action">${icon("arrow")}</span></button>
      <button class="setting-row is-action" type="button" data-action="settings-info"><span><strong>Workshop profile</strong><small>Bays, technicians and supplier region</small></span><span class="setting-row-action">${icon("arrow")}</span></button>
    </section>
  </section>`;
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
    <form id="vehicle-form" class="form-grid two-col">
      <div class="form-field span-2 vin-field">
        <label class="field-label" for="vin">Scan or enter VIN</label>
        <div class="vin-row">
          <input class="input" id="vin" name="vin" maxlength="17" value="${state.vehicle.vin}" placeholder="17-character VIN" autocapitalize="characters" />
          <button class="icon-button vin-camera" type="button" data-action="scan-vin" aria-label="Open camera to scan VIN">${icon("scan")}</button>
        </div>
        <span class="helper">Use the camera on the dash or door-jamb plate. Vehicle data can still be corrected after decoding.</span>
      </div>
      <div class="vehicle-details-grid span-2">
        <label class="form-field"><span class="field-label">Year</span><input class="input" name="year" inputmode="numeric" value="${state.vehicle.year}" placeholder="e.g. 2010" required /></label>
        <label class="form-field"><span class="field-label">Make</span><span class="select-control"><select class="select${state.vehicle.make ? "" : " is-placeholder"}" name="make" id="vehicle-make" required aria-label="Make"><option value="" disabled${state.vehicle.make ? "" : " selected"}></option>${makes.map((make) => `<option${state.vehicle.make === make ? " selected" : ""}>${escapeHTML(make)}</option>`).join("")}</select>${icon("down")}</span></label>
        <label class="form-field"><span class="field-label">Model</span><span class="select-control"><select class="select${state.vehicle.model ? "" : " is-placeholder"}" name="model" id="vehicle-model"${state.vehicle.make ? "" : " disabled"} required aria-label="Model"><option value="" disabled${state.vehicle.model ? "" : " selected"}></option>${models.map((model) => `<option${state.vehicle.model === model ? " selected" : ""}>${escapeHTML(model)}</option>`).join("")}</select>${icon("down")}</span></label>
        <label class="form-field"><span class="field-label">Trim</span><span class="select-control"><select class="select${state.vehicle.trim ? "" : " is-placeholder"}" name="trim" id="vehicle-trim" aria-label="Trim"><option value=""${state.vehicle.trim ? "" : " selected"}></option>${variants.map((variant) => `<option${state.vehicle.trim === variant ? " selected" : ""}>${escapeHTML(variant)}</option>`).join("")}</select>${icon("down")}</span></label>
        ${specFieldHtml("drivetrain", "Drivetrain", "e.g. AWD", ["FWD", "RWD", "AWD", "4WD"])}
        ${specFieldHtml("engine", "Engine", "e.g. 2.0L turbo", null)}
        ${specFieldHtml("transmission", "Transmission", "e.g. 7-speed DSG", null)}
        <label class="form-field"><span class="field-label">Registration <span class="muted">(optional)</span></span><input class="input" name="registration" autocapitalize="characters" value="${escapeHTML(state.vehicle.registration)}" placeholder="e.g. 1ABC234" /></label>
        <label class="form-field"><span class="field-label">Current mileage</span><input class="input" name="mileage" inputmode="numeric" value="${state.vehicle.mileage}" placeholder="e.g. 82000" required /></label>
        <div class="catalog-action-row"><button class="secondary-button field-secondary-action catalog-add-button" type="button" data-action="add-catalog-vehicle">${icon("plus")} Add make or model</button></div>
      </div>
      <div class="customer-details-heading span-2"><h2>Customer details</h2></div>
      <div class="customer-details-grid span-2">
        <label class="form-field"><span class="field-label">First name</span><input class="input" name="customerFirstName" autocomplete="given-name" value="${escapeHTML(firstName)}" placeholder="First name" required /></label>
        <label class="form-field"><span class="field-label">Last name</span><input class="input" name="customerLastName" autocomplete="family-name" value="${escapeHTML(lastName)}" placeholder="Last name" required /></label>
        <label class="form-field"><span class="field-label">Phone <span class="muted">(optional)</span></span><input class="input" name="customerPhone" autocomplete="tel" inputmode="tel" value="${escapeHTML(state.vehicle.customerPhone)}" placeholder="Mobile number" /></label>
        <label class="form-field"><span class="field-label">Email <span class="muted">(optional)</span></span><input class="input" name="customerEmail" autocomplete="email" inputmode="email" type="email" value="${escapeHTML(state.vehicle.customerEmail || "")}" placeholder="Email address" /></label>
      </div>
      <div class="action-dock vehicle-actions span-2"><button class="secondary-button full" type="button" data-action="cancel-job">${icon("trash")} Cancel job</button><button class="primary-button full" type="submit">Save & continue ${icon("arrow")}</button></div>
    </form>
  </section>`;
}

function vehicleContext(score = "") {
  const specifications = [state.vehicle.mileage && `${state.vehicle.mileage} KM`, state.vehicle.trim, state.vehicle.engine, state.vehicle.drivetrain, state.vehicle.transmission].filter(Boolean);
  return `<section class="vehicle-context" aria-label="Locked vehicle details">
    <div class="vehicle-context-main"><span class="vehicle-context-status">${icon("lock")}<span>Vehicle locked</span></span><div class="vehicle-name">${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}</div><div class="vehicle-data">${specifications.map(escapeHTML).join(" · ")}</div></div>
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
  const emptySlots = Math.max(1, 3 - photos.length);
  return `<div class="photo-strip" aria-label="${label} gallery">
    ${photos.map((photo, index) => `<button class="photo-thumb-button" type="button" data-action="view-photo" data-photo-scope="${scope}" data-photo-index="${index}" aria-label="Open photo ${index + 1} of ${photos.length}"><img src="${escapeHTML(photoUrl(photo))}" alt="${label} ${index + 1}" class="photo-thumb" /><span class="photo-number" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></button>`).join("")}
    ${Array.from({ length: emptySlots }, () => '<span class="photo-slot" aria-hidden="true"></span>').join("")}
  </div>`;
}

function renderProblem() {
  app.innerHTML = `<section class="screen workflow-shell">
    ${problemTaskHeader()}
    ${workflowJourney(2)}
    ${vehicleContext()}
    <form id="problem-form" class="form-grid assessment-form">
      <div class="form-field">
        <div class="field-header"><label class="field-label intake-section-title" for="complaint">Customer complaint</label></div>
        <div class="text-field-shell"><textarea class="textarea" id="complaint" name="complaint" placeholder="In their own words…" required>${state.complaint}</textarea></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="complaint" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="complaint">${icon("sparkles")} AI enhance</button></div>
      </div>
      <div class="form-field">
        <div class="field-header"><label class="field-label intake-section-title" for="notes">Initial observations <span class="optional-label">(optional)</span></label></div>
        <div class="text-field-shell"><textarea class="textarea" id="notes" name="notes" placeholder="Objective signs noticed before research…">${state.notes}</textarea></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="notes" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="notes">${icon("sparkles")} AI enhance</button></div>
      </div>
      <div class="form-field">
        <span class="field-label intake-section-title">Arrival photos <span class="optional-label">(optional)</span></span>
        <div class="photo-panel"><button class="add-photo" type="button" data-action="add-photo">${icon("camera")}<span>Open camera</span></button>${photoStrip(state.photos, "inspection", "Arrival photo")}</div>
        <p class="photo-upload-hint">Maximum file size: 15 MB. Allowed formats: JPG, PNG, WebP, HEIC and HEIF.</p>
      </div>
      <div class="action-dock intake-actions"><button class="secondary-button full" type="submit">${icon("search")} Show similar repairs</button><button class="primary-button full" type="button" data-action="proceed-to-diagnosis" aria-label="Save assessment and continue directly to repair">Save & continue ${icon("arrow")}</button></div>
    </form>
  </section>`;
}

function renderResults() {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair) || repairMatches[0];
  const selectedPercent = repairMatchPercent(selected);
  const selectedEvidence = repairMatchEvidence(selected);
  const repairCountClass = repairMatches.length === 1 ? "has-one" : repairMatches.length === 2 ? "has-two" : "has-many";
  app.innerHTML = `<section class="screen workflow-shell">
    ${resultsTaskHeader()}
    ${workflowJourney(3)}

    <div class="match-selector ${repairCountClass}" role="group" aria-label="Choose a repair record">
      ${repairMatches.map((repair) => matchOption(repair, repair.id === selected.id)).join("")}
    </div>

    <section class="selected-repair" aria-labelledby="selected-repair-heading" aria-live="polite">
      <div class="selected-repair-head">
        <div><span class="section-label">Selected repair · ${selected.rank}</span><h2 id="selected-repair-heading">${selected.vehicle}</h2><span class="evidence-chip">${selectedEvidence}</span><span class="match-meta">${selected.meta}</span></div>
        <span class="selected-match-value">${selectedPercent}<span class="percent-symbol">%</span> match</span>
      </div>
      <section class="result-detail-section" aria-labelledby="what-fixed-label">
        <span class="section-label result-section-label" id="what-fixed-label">What fixed it</span>
        <div class="diagnosis-box"><p>${selected.cause}</p></div>
      </section>
      <section class="result-detail-section" aria-labelledby="repair-steps-label">
        <span class="section-label result-section-label" id="repair-steps-label">Repair steps</span>
        <div class="repair-steps-panel"><ol class="repair-steps">${selected.steps.map((step) => `<li>${step}</li>`).join("")}</ol></div>
      </section>
      <section class="result-detail-section" aria-labelledby="parts-used-label">
        <div class="parts-heading result-section-head"><span class="section-label" id="parts-used-label">Parts & consumables used</span><span class="parts-item-count">${selected.parts.length} items</span></div>
        <div class="parts-panel always-visible">${selected.parts.map(([name, number, key]) => partRow(name, number, key)).join("")}</div>
      </section>
    </section>
    <div class="result-actions"><button class="primary-button full" type="button" data-action="log-fix">${icon("wrench")} Save & start repair</button><button class="web-button full" type="button" data-action="web-research">${icon("globe")} Search web repair tips</button></div>
  </section>`;
}

function renderRepairRecord() {
  const selected = repairMatches.find((repair) => repair.id === state.selectedRepair) || repairMatches[0];
  app.innerHTML = `<section class="screen workflow-shell repair-record-shell">
    ${repairRecordHeader()}
    ${workflowJourney(4)}
    <div class="repair-job-strip">
      <div><span class="micro-label">Job AO-260809-04 · Bay 03</span><strong>${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}</strong><span>${[`${state.vehicle.mileage} KM`, ...state.dtcs].join(" · ")}</span></div>
      <span class="repair-status">In progress</span>
    </div>

    ${state.repairReferenceEnabled ? `<aside class="repair-reference" aria-label="Selected historical repair reference">
      <span class="micro-label">Reference repair ${selected.rank} · ${repairMatchPercent(selected)}% match</span>
      <strong>${selected.vehicle}</strong>
      <span>${selected.cause}</span>
    </aside>` : ""}

    <form id="repair-form" class="repair-form">
      <div class="form-field repair-dtc-field">
        <div class="field-header"><span class="field-label">Diagnostic trouble codes <span class="optional-label">(optional)</span></span></div>
        <div class="field-actions dtc-actions">
          <button class="add-dtc-button" type="button" data-action="add-dtc">${icon("plus")}<span>Add scan code</span></button>
          <div class="quick-row" id="dtc-row">${state.dtcs.map((code) => `<span class="dtc-chip caps-text">${code}</span>`).join("")}</div>
        </div>
      </div>

      <div class="form-field">
        <div class="field-header"><label class="field-label" for="repair-notes">Work performed</label></div>
        <div class="text-field-shell"><textarea class="textarea repair-notes" id="repair-notes" name="workNotes" placeholder="Record tests, repair steps and adjustments…">${escapeHTML(state.repair.workNotes)}</textarea></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="repair-notes" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="repair-notes">${icon("sparkles")} AI enhance</button></div>
      </div>

      <section class="repair-parts-section" aria-labelledby="repair-parts-heading">
        <div class="repair-section-head"><span class="section-label" id="repair-parts-heading">Parts & consumables</span></div>
        ${repairPartsTable()}
        <button class="secondary-button add-parts-button" type="button" data-action="open-parts-editor">${icon("plus")} Add parts & consumables</button>
      </section>

      <div class="form-field">
        <div class="field-header"><label class="field-label" for="repair-verification">Verification notes</label></div>
        <div class="text-field-shell"><textarea class="textarea" id="repair-verification" name="verificationNotes" placeholder="How did you confirm the repair worked?">${escapeHTML(state.repair.verificationNotes)}</textarea></div>
        <div class="field-actions"><button class="dictate-button" type="button" data-dictate="repair-verification" aria-pressed="false">${icon("mic")} Dictate</button><button class="enhance-button" type="button" data-enhance="repair-verification">${icon("sparkles")} AI enhance</button></div>
      </div>

      <div class="form-field">
        <span class="field-label">Repair photos</span>
        <div class="photo-panel"><button class="add-photo" type="button" data-action="add-photo">${icon("camera")}<span>Open camera</span></button>${photoStrip(state.repair.photos, "repair", "Repair photo")}</div>
        <p class="photo-upload-hint">Maximum file size: 15 MB. Allowed formats: JPG, PNG, WebP, HEIC and HEIF.</p>
      </div>

      <div class="action-dock repair-action-dock"><button class="secondary-button full" type="button" data-action="delete-repair">${icon("trash")} Delete repair</button><button class="primary-button full" type="submit">${icon("save")} Save repair record</button></div>
    </form>
  </section>`;
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

function resolvedDetail(label, content) {
  return `<section class="resolved-section"><h2 class="section-label">${label}</h2><div class="resolved-copy">${content}</div></section>`;
}

function resolvedPhotoGallery() {
  const photos = [
    ...state.photos.map((photo, index) => ({ photo, scope: "inspection", index })),
    ...state.repair.photos.map((photo, index) => ({ photo, scope: "repair", index })),
  ];
  if (!photos.length) return `<div class="resolved-photo-empty">No photos were saved with this repair.</div>`;
  return `<div class="resolved-photo-gallery">${photos.map(({ photo, scope, index }, displayIndex) => `<button type="button" data-action="view-photo" data-photo-scope="${scope}" data-photo-index="${index}" aria-label="Open repair photo ${displayIndex + 1}"><img src="${escapeHTML(photoUrl(photo))}" alt="Repair photo ${displayIndex + 1}" /></button>`).join("")}</div>`;
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
  const header = isDeleted
    ? taskHeader({ context: vehicle, title: "Deleted job" })
    : taskHeader({ context: "Repair details", title: vehicle, status: "Resolved", statusType: "resolved" });
  app.innerHTML = `<section class="screen workflow-shell resolved-job-shell${isDeleted ? " deleted-job-shell" : ""}">
    ${header}
    <section class="resolved-summary" aria-label="${isDeleted ? "Deleted job summary" : "Resolved job summary"}">
      <div><span class="section-label">Customer</span><strong>${escapeHTML(job.vehicle.customerName)}</strong>${job.vehicle.customerPhone ? `<span>${escapeHTML(job.vehicle.customerPhone)}</span>` : ""}</div>
      <div><span class="section-label">${isDeleted ? "Deleted" : "Resolved"}</span><strong>${escapeHTML(isDeleted ? job.updatedAt : job.resolvedAt)}</strong><span>${escapeHTML(job.bay)} · ${escapeHTML(job.technician)}</span></div>
      <div><span class="section-label">${isDeleted ? "Mileage" : "Final mileage"}</span><strong>${escapeHTML(job.vehicle.mileage)} KM</strong>${job.vehicle.vin ? `<span>VIN ${escapeHTML(job.vehicle.vin)}</span>` : ""}</div>
    </section>
    <div class="resolved-details">
      ${resolvedDetail("Customer complaint", `<p>${escapeHTML(job.complaint) || "No complaint recorded."}</p>`)}
      ${resolvedDetail("Initial observations", `<p>${escapeHTML(job.observations || "No initial observations recorded.")}</p>`)}
      ${resolvedDetail("Diagnostic trouble codes", job.dtcs.length ? `<div class="quick-row">${job.dtcs.map((code) => `<span class="dtc-chip caps-text">${escapeHTML(code)}</span>`).join("")}</div>` : `<p class="muted">No scan codes recorded.</p>`)}
      ${resolvedDetail("What fixed it", `<p>${escapeHTML(job.cause)}</p>`)}
      ${resolvedDetail("Work performed", job.workPerformed.length ? `<ol class="resolved-steps">${job.workPerformed.map((step) => `<li>${escapeHTML(step)}</li>`).join("")}</ol>` : `<p class="muted">No work performed recorded.</p>`)}
      ${resolvedDetail("Parts & consumables", job.parts.length ? `<div class="resolved-parts">${job.parts.map((part) => `<div><strong>${escapeHTML(part.name)}</strong><span>${escapeHTML(part.type)}${part.number ? ` · ${escapeHTML(part.number)}` : ""} · QTY ${escapeHTML(part.quantity)}</span></div>`).join("")}</div>` : `<p class="muted">No parts or consumables recorded.</p>`)}
      ${resolvedDetail("Verification", `<p>${escapeHTML(job.verification)}</p>`)}
      ${resolvedDetail("Previous repair reference", `<p>${escapeHTML(job.reference)}</p>`)}
      ${resolvedDetail("Repair photos", resolvedPhotoGallery())}
    </div>
    ${isDeleted ? `<div class="action-dock resolved-actions span-2">
      <button class="secondary-button full" type="button" data-action="restore-job" data-job-id="${job.id}">${icon("back")} Restore job</button>
      <button class="danger-button full" type="button" data-action="delete-forever" data-job-id="${job.id}">${icon("trash")} Delete forever</button>
    </div>` : ""}
  </section>`;
}

function matchOption(repair, isSelected) {
  const percent = repairMatchPercent(repair);
  const evidence = repairMatchEvidence(repair);
  return `<button class="match-option${isSelected ? " is-selected" : ""}" type="button" data-repair-match="${repair.id}" aria-pressed="${isSelected}">
    <span class="match-option-top"><span class="match-option-rank">${repair.rank}</span><span class="match-option-score">${percent}<span class="percent-symbol">%</span></span></span>
    <span class="match-option-copy"><span class="match-option-state">${isSelected ? "Selected" : "View repair"}</span><strong>${repair.label}</strong><span class="match-option-vehicle">${repair.vehicle}</span><span class="match-option-evidence">${evidence}</span></span>
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
    complaint?.setCustomValidity("Enter the customer complaint to continue.");
    complaint?.reportValidity();
    complaint?.setCustomValidity("");
    showToast("Add the customer complaint before continuing.");
    return false;
  }
  return true;
}

function syncRepairRecord(form) {
  const data = new FormData(form);
  state.repair.workNotes = String(data.get("workNotes") || "").trim();
  state.repair.verificationNotes = String(data.get("verificationNotes") || "").trim();
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

function openJob(jobId) {
  const job = jobRecords.find((record) => String(record.id) === String(jobId));
  if (!job) return;
  state.selectedJobId = job.id;
  if (job.status === "resolved" || job.status === "deleted") {
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

function photoViewerSheet(scope, requestedIndex = 0) {
  const photos = photoCollection(scope);
  if (!photos.length) return;
  const index = Math.max(0, Math.min(requestedIndex, photos.length - 1));
  const scopeLabel = scope === "repair" ? "Repair photos" : "Arrival photos";
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">${scopeLabel} · ${photos.length} saved</span><h2>Photo viewer</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close photo viewer">${icon("close")}</button></div>
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

  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Workshop schedule</span><h2>Calendar</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close calendar">${icon("close")}</button></div>
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
        <span class="micro-label">${selectedLabel}</span>
        <h3>${activeDays.has(selectedDay) ? "3 workshop bookings" : "No scheduled bookings"}</h3>
        <p>${activeDays.has(selectedDay) ? "Bay activity, jobs and completed repairs for the selected day." : "The workshop schedule is clear for this date."}</p>
      </section>
    </div>`);
}

function technicianProfileSheet() {
  const fullName = state.profile?.full_name || "Diego Martins";
  const initials = fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Technician account</span><h2>Profile</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close technician profile">${icon("close")}</button></div>
    <div class="sheet-body">
      <section class="technician-profile" aria-label="Signed-in technician">
        <span class="technician-avatar" aria-hidden="true">${escapeHTML(initials)}</span>
        <div><h3>${escapeHTML(fullName)}</h3><p>${escapeHTML(state.shop?.name || "Workshop technician")}</p><span class="technician-status">Available</span></div>
      </section>
      <div class="profile-facts" aria-label="Technician work details">
        <div class="profile-fact"><span class="micro-label">Assigned bay</span><strong>Bay 03</strong></div>
        <div class="profile-fact"><span class="micro-label">Shift</span><strong>07:00–16:00</strong></div>
        <div class="profile-fact"><span class="micro-label">Employee ID</span><strong>ARG-024</strong></div>
      </div>
      <nav class="profile-menu" aria-label="Technician shortcuts">
        <button class="profile-menu-button" type="button" data-action="profile-jobs">${icon("clipboard")}<span>My active jobs</span>${icon("arrow")}</button>
        <button class="profile-menu-button" type="button" data-action="profile-settings">${icon("settings")}<span>Account & workshop settings</span>${icon("arrow")}</button>
        ${state.backendStatus === "connected" ? `<button class="profile-menu-button" type="button" data-action="sign-out">${icon("back")}<span>Sign out</span>${icon("arrow")}</button>` : `<button class="profile-menu-button" type="button" data-action="sign-in">${icon("lock")}<span>Sign in for cloud storage</span>${icon("arrow")}</button>`}
      </nav>
    </div>`);
}

function catalogEditorSheet() {
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Vehicle catalog</span><h2>Add make or model</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><p class="muted">Add a make, model, or an exact variant for your workshop. Variants can include its engine, drivetrain and transmission.</p>
      <form id="catalog-editor-form" class="form-grid">
        <label class="form-field"><span class="field-label">Make</span><input class="input" name="catalog-make" value="${escapeHTML(state.vehicle.make)}" required /></label>
        <label class="form-field"><span class="field-label">Model <span class="muted">(optional)</span></span><input class="input" name="catalog-model" value="${escapeHTML(state.vehicle.model)}" placeholder="e.g. Golf" /></label>
        <label class="form-field"><span class="field-label">Variant / trim <span class="muted">(optional)</span></span><input class="input" name="catalog-variant" placeholder="e.g. GTI" /></label>
        <label class="form-field"><span class="field-label">Engine <span class="muted">(optional)</span></span><input class="input" name="catalog-engine" placeholder="e.g. 2.0L turbo" /></label>
        <label class="form-field"><span class="field-label">Drivetrain <span class="muted">(optional)</span></span><span class="select-control"><select class="select" name="catalog-drivetrain"><option value="">Choose drivetrain</option><option>FWD</option><option>RWD</option><option>AWD</option><option>4WD</option></select>${icon("down")}</span></label>
        <label class="form-field"><span class="field-label">Transmission <span class="muted">(optional)</span></span><input class="input" name="catalog-transmission" placeholder="e.g. 7-speed DSG" /></label>
        <button class="primary-button full" type="submit">${icon("save")} Save to catalog</button>
      </form>
    </div>`);
}

function dtcEditorSheet() {
  openSheet(`<div class="sheet-head"><div><span class="eyebrow">Active job</span><h2>Add scan code</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body"><form id="dtc-editor-form" class="form-grid">
      <label class="form-field"><span class="field-label">Diagnostic trouble code</span><input class="input caps-text" name="dtc-code" autocomplete="off" autocapitalize="characters" placeholder="e.g. P0171" maxlength="7" required /></label>
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
  openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>Repair record</strong> · ${state.repair.parts.length} saved</span><h2>Add parts & consumables</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body parts-editor-body">
      ${state.repairReferenceEnabled ? `<section class="parts-editor-section" aria-labelledby="suggested-parts-heading">
        <div class="parts-editor-heading"><span class="micro-label">From selected repair ${selected.rank}</span><h3 id="suggested-parts-heading">Previously used on this fix</h3><p>Add only the items you actually use. Search pricing later from the repair record.</p></div>
        <div class="suggested-parts-list">${selected.parts.map(([name, number, key]) => {
          const isAdded = state.repair.parts.some((part) => part.key === key || part.name === name);
          return `<div class="suggested-part-row"><div><strong>${name}</strong><span>${number}</span></div><div class="suggested-part-actions"><button class="part-button reference-toggle-button${isAdded ? " is-remove" : ""}" type="button" data-action="toggle-reference-part" data-reference-key="${key}" data-reference-name="${name}" data-reference-number="${number}" aria-pressed="${isAdded}">${isAdded ? `${icon("close")} Remove` : `${icon("plus")} Add`}</button></div></div>`;
        }).join("")}</div>
      </section>` : ""}

      <section class="parts-editor-section custom-part-section" aria-labelledby="custom-part-heading">
        <div class="parts-editor-heading"><span class="micro-label">Different item</span><h3 id="custom-part-heading">Add a custom part</h3></div>
        <form id="part-editor-form" class="custom-part-form">
          <label class="form-field"><span class="field-label">Type</span><span class="select-control"><select class="select" name="custom-type"><option>Part</option><option>Consumable</option></select>${icon("down")}</span></label>
          <label class="form-field custom-part-name"><span class="field-label">Part or consumable</span><input class="input" name="custom-name" placeholder="e.g. Oil filter" /></label>
          <label class="form-field"><span class="field-label">Part number</span><input class="input" name="custom-number" placeholder="Optional" /></label>
          <label class="form-field"><span class="field-label">Qty</span><input class="input" name="custom-quantity" value="1" inputmode="numeric" /></label>
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
  openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>Live part search</strong></span><h2>Searching prices…</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
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
    openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>Live part search</strong> · ${offers.length} offer${offers.length === 1 ? "" : "s"}</span><h2>Compare prices</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
    <div class="sheet-body">
      <div class="part-search-summary">
        <div class="part-product-media">${product.image ? `<img class="part-product-image" src="${product.image}" alt="Reference catalogue photo of ${partName}" /><span class="reference-chip">Reference image</span>` : `<div class="part-product-placeholder">${icon("search")}<span>Catalogue search</span></div>`}</div>
        <div class="part-product-copy"><span class="micro-label">Requested part</span><h3>${escapeHTML(partName)}</h3><span class="part-product-number">${escapeHTML(product.number)}</span><span class="part-product-fitment">${escapeHTML(product.category)}<br>${escapeHTML(`${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`)}</span></div>
      </div>
      <p class="part-search-note">Compare one part at a time by price, availability and supplier. Product imagery is illustrative; confirm the catalogue image and fitment before ordering.</p>
      <div class="price-list" aria-label="Supplier offers">${offers.length ? offers.map((offer, i) => `<button class="price-card" type="button" data-action="select-price" data-part-key="${escapeHTML(partKey)}" data-part-name="${escapeHTML(partName)}" data-part-number="${escapeHTML(recordNumber)}" data-part-type="${product.type}" data-supplier="${escapeHTML(offer.merchant || "Unknown supplier")}" data-price="${escapeHTML(offer.price || "Quote required")}" data-offer-url="${escapeHTML(offer.link || "")}" data-offer-image-url="${escapeHTML(offer.imageUrl || "")}">${offer.imageUrl ? `<img class="offer-image" src="${escapeHTML(offer.imageUrl)}" alt="" />` : product.image ? `<img class="offer-image" src="${product.image}" alt="" />` : `<span class="offer-image offer-image-placeholder">${icon("search")}</span>`}<span class="offer-copy"><span class="supplier">${i === 0 ? `<strong class="offer-badge">Lowest listed</strong>` : ""}${escapeHTML(offer.merchant || "Unknown supplier")}</span><span class="supplier-meta">${escapeHTML(offer.delivery || "Availability not listed")}</span><span class="offer-detail">${escapeHTML(offer.title || partName)}</span></span><span class="offer-price"><span class="price">${escapeHTML(offer.price || "Quote")}</span><span class="offer-action">Use offer ${icon("arrow")}</span></span></button>`).join("") : `<div class="source-card"><h3>No current offers found</h3><p>Try a more specific part number or confirm availability with a supplier.</p></div>`}</div>
      <div class="disclaimer">Confirm fitment against the VIN and supplier catalogue before ordering. Price and availability can change.</div>
    </div>`);
  } catch (error) {
    openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>Live part search</strong></span><h2>Search unavailable</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
      <div class="sheet-body"><div class="source-card"><h3>Could not load supplier offers</h3><p>${escapeHTML(error?.message || "Try again in a moment.")}</p></div><button class="secondary-button" type="button" data-action="close-sheet">Close</button></div>`);
  }
}

async function webResearchSheet() {
  const vehicle = `${state.vehicle.year} ${state.vehicle.make} ${state.vehicle.model}`;
  const query = [state.complaint, state.notes].filter(Boolean).join(" ").slice(0, 450) || "diagnostic repair guidance";
  openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>External research</strong></span><h2>Searching repair sources…</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="part-product-placeholder">${icon("search")}<span>Researching ${escapeHTML(vehicle)} and cross-checking sources</span></div></div>`);
  try {
    const result = await apiRequest("/api/research", { method: "POST", body: JSON.stringify({ jobId: state.currentJobId || undefined, query, vehicle, dtcs: state.dtcs, complaint: state.complaint, observations: state.notes }) });
    const sources = Array.isArray(result.sources) ? result.sources : [];
    openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>External research</strong> · ${sources.length} source${sources.length === 1 ? "" : "s"}</span><h2>Web repair tips</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div>
      <div class="sheet-body"><p class="muted">Your verified shop repairs remain the primary reference. External findings are diagnostic directions, not confirmed fixes.</p>
        <div class="source-card internal"><span class="micro-label">AI synthesis with source citations</span><h3>Research summary</h3><p>${escapeHTML(result.synthesis || "No summary was returned.").replace(/\n/g, "<br>")}</p></div>
        ${sources.map((source, index) => `<a class="source-card" href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer"><span class="micro-label">Source ${index + 1}${source.date ? ` · ${escapeHTML(source.date)}` : ""}</span><h3>${escapeHTML(source.title)}</h3><p>${escapeHTML(source.snippet || "Open source")}</p></a>`).join("")}
        <div class="disclaimer">Verify procedures, specifications, part fitment and safety steps against official service information before work begins.</div>
      </div>`);
  } catch (error) {
    openSheet(`<div class="sheet-head"><div><span class="eyebrow"><strong>External research</strong></span><h2>Research unavailable</h2></div><button class="icon-button" type="button" data-action="close-sheet" aria-label="Close">${icon("close")}</button></div><div class="sheet-body"><div class="source-card"><h3>Could not search repair sources</h3><p>${escapeHTML(error.message)}</p></div><button class="secondary-button" type="button" data-action="close-sheet">Close</button></div>`);
  }
}

document.addEventListener("click", (event) => {
  const themeChoice = event.target.closest("[data-theme-choice]");
  if (themeChoice) {
    setTheme(themeChoice.dataset.themeChoice);
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
    if (action === "restore-job") return restoreJob();
    if (action === "delete-forever") return deleteForeverConfirmation();
    if (action === "confirm-delete-forever") return deleteForever(actionButton.dataset.jobId);
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
    if (action === "theme-toggle") return setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
    if (action === "continue-diagnosis") return resumeSavedJob();
    if (action === "open-calendar") return calendarSheet();
    if (action === "open-profile") return technicianProfileSheet();
    if (action === "add-catalog-vehicle") return catalogEditorSheet();
    if (action === "sign-in") { window.location.href = "/login?next=/dashboard"; return; }
    if (action === "sign-out") {
      return apiRequest("/api/auth/signout", { method: "POST" }).finally(() => { window.location.href = "/login"; });
    }
    if (action === "profile-jobs") { closeSheet(); return setRoute("jobs"); }
    if (action === "profile-settings") { closeSheet(); return setRoute("settings"); }
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
      return persistAssessment("repair").then(() => {
        state.repairReferenceEnabled = false;
        state.workflowUnlockedStep = 4;
        openRepairRecord();
        showToast("Assessment saved. Repair is ready to continue.");
      }).catch((error) => showToast(error.message));
    }
    if (action === "add-photo") {
      const problemForm = document.querySelector("#problem-form");
      if (problemForm) syncProblem(problemForm);
      const repairForm = document.querySelector("#repair-form");
      if (repairForm) syncRepairRecord(repairForm);
      photoInput.dataset.photoScope = state.route === "repair" ? "repair" : "inspection";
      photoInput.value = "";
      return photoInput.click();
    }
    if (action === "add-dtc") {
      return dtcEditorSheet();
    }
    if (action === "repair-back") return returnToResults();
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
    if (action === "log-fix") {
      state.repairReferenceEnabled = true;
      openRepairRecord();
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
    if (action === "settings-info") return showToast("This preference will connect to the workshop profile.");
    if (action === "send-dictation") return finishDictation();
    if (action === "cancel-dictation") return cancelDictation();
    if (action === "open-job") return openJob(actionButton.dataset.jobId || state.activeJobId);
  }

  const dictate = event.target.closest("[data-dictate]");
  if (dictate) {
    const target = document.querySelector(`#${dictate.dataset.dictate}`);
    if (!target) return;
    if (dictate.classList.contains("is-listening")) return finishDictation();
    return startDictation(dictate, target);
  }

  const enhancer = event.target.closest("[data-enhance]");
  if (enhancer) {
    const target = document.querySelector(`#${enhancer.dataset.enhance}`);
    if (!target) return;
    if (!target.value.trim()) return showToast("Type or dictate first.");
    const fieldShell = target.closest(".text-field-shell");
    clearTimeout(enhancer.enhanceTimer);
    fieldShell?.classList.remove("is-ai-tracing");
    if (fieldShell) void fieldShell.offsetWidth;
    fieldShell?.classList.add("is-ai-tracing");
    enhancer.classList.add("is-enhancing");
    enhancer.innerHTML = `${icon("sparkles")} Enhancing…`;
    const field = target.id === "complaint" ? "complaint" : target.id === "notes" ? "observations" : target.id === "repair-verification" ? "verification" : "work_performed";
    apiRequest("/api/ai/enhance", { method: "POST", body: JSON.stringify({ text: target.value, field }) }).then((result) => {
      target.value = result.text;
      if (target.id === "complaint") state.complaint = target.value;
      if (target.id === "notes") state.notes = target.value;
      if (target.id === "repair-notes") state.repair.workNotes = target.value;
      if (target.id === "repair-verification") state.repair.verificationNotes = target.value;
      if (target.id === "repair-notes" || target.id === "repair-verification") queueRepairAutosave();
      showToast("Text enhanced for clarity — review before continuing.");
    }).catch((error) => {
      target.value = enhanceWorkshopText(target.value);
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
  if (event.target.matches("#vin")) {
    event.target.value = event.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    state.vehicle.vin = event.target.value;
    clearTimeout(vinDecodeTimer);
    if (event.target.value.length === 17) vinDecodeTimer = setTimeout(() => decodeVin(event.target.value), 320);
    return;
  }
  const isJobSearch = event.target.matches("#job-search");
  const isLibrarySearch = event.target.matches("#library-search");
  if (!isJobSearch && !isLibrarySearch) return;
  if (isJobSearch) state.jobSearch = event.target.value;
  if (isLibrarySearch) state.librarySearch = event.target.value;
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
  if (event.target.id === "vehicle-form") {
    syncVehicle(event.target);
    return persistVehicleDetails().then(() => {
      state.savedJourney = { route: "new", step: 2 };
      state.workflowUnlockedStep = Math.max(state.workflowUnlockedStep, 2);
      showToast("Vehicle and customer saved to the workshop cloud.");
      setStep(2);
    }).catch((error) => showToast(error.status === 401 ? "Sign in to create and save this job." : error.message));
  }
  if (event.target.id === "problem-form") {
    syncProblem(event.target);
    if (!validateAssessment(event.target)) return;
    return persistAssessment("similar_repairs").then(async () => {
      state.repairReferenceEnabled = true;
      state.savedJourney = { route: "new", step: 3 };
      state.workflowUnlockedStep = Math.max(state.workflowUnlockedStep, 3);
      showToast("Assessment saved. Searching verified workshop repairs…");
      await loadRepairMatches();
      setStep(3);
    }).catch((error) => showToast(error.message));
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
    if (!/^[PBCU][0-9A-F]{4,6}$/.test(code)) return showToast("Enter a valid code, such as P0171.");
    if (!state.dtcs.includes(code)) state.dtcs.push(code);
    closeSheet();
    render();
    queueRepairAutosave();
    return showToast(`${code} added to the active job.`);
  }
  if (event.target.id === "repair-form") {
    syncRepairRecord(event.target);
    return persistRepair(true).then((job) => {
      state.selectedJobId = job.id;
      state.route = "resolved";
      closeSheet();
      updateNavigation();
      render();
      showToast("Repair record saved and job marked resolved.");
    }).catch((error) => showToast(error.message));
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

setTheme(preferredTheme(), false);
hydrateIcons();
updateWorkshopClock();
setInterval(updateWorkshopClock, 30000);
render();
loadBackendData();
})();
