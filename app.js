// ══════════════════════════════════════════════════════════════
//  PREFLIGHT — Drone Ops App
//  Data stored in localStorage. No internet required after load
//  except for live weather (Open-Meteo, no API key needed).
// ══════════════════════════════════════════════════════════════

// ── CHECKLIST DATA ────────────────────────────────────────────
const CHECKLIST = [
  {
    id: 'regulatory', label: 'REGULATORY & AUTHORISATION',
    items: [
      { id:'r1', text:'Licence / qualification on person',          note:'GVC, A2 CofC or PFAW — carry digital or physical copy' },
      { id:'r2', text:'CAA Operator ID displayed on aircraft',      note:'Check label is legible and affixed' },
      { id:'r3', text:'Airspace checked — NATS, NOTAM, Drone Assist', note:'Checked within 24hrs; re-check for STS ops' },
      { id:'r4', text:'Flight within authorised category',          note:'A1/A2/A3 or Specific Authorisation confirmed' },
      { id:'r5', text:'Landowner / site permission confirmed',      note:'Written permission where required by op type' },
      { id:'r6', text:'Insurance active and covers this operation', note:'Verify commercial coverage if applicable' },
    ]
  },
  {
    id: 'aircraft', label: 'AIRCRAFT CONDITION',
    items: [
      { id:'a1', text:'Visual inspection — no cracks, damage, debris', note:'Arms, body, prop guards, payload mount' },
      { id:'a2', text:'Propellers secure, undamaged, correct orientation', note:'Check leading edges; replace if chipped' },
      { id:'a3', text:'Motors spin freely — no grinding or resistance',  note:'Rotate by hand before power-on' },
      { id:'a4', text:'Camera / gimbal secure, no play, lens clean',      note:'' },
      { id:'a5', text:'Landing gear undamaged and locked',                note:'' },
      { id:'a6', text:'No loose cables, covers or payload items',         note:'' },
    ]
  },
  {
    id: 'battery', label: 'BATTERY & POWER',
    items: [
      { id:'b1', text:'Flight battery charged to sufficient level',       note:'Plan for op duration + 20% reserve minimum' },
      { id:'b2', text:'Battery health OK — no swelling or damage',        note:'Never fly a swollen or cracked battery' },
      { id:'b3', text:'Battery within operating temperature range',       note:'Warm cold batteries before use; 10–40°C typical' },
      { id:'b4', text:'Remote controller charged',                        note:'' },
      { id:'b5', text:'Spare batteries safely stored (if applicable)',    note:'' },
    ]
  },
  {
    id: 'software', label: 'SOFTWARE & COMMS',
    items: [
      { id:'s1', text:'Aircraft and RC firmware up to date',              note:'Never update in the field — do this pre-mission' },
      { id:'s2', text:'Flight app loaded and responsive',                 note:'' },
      { id:'s3', text:'Return-to-home altitude set for this site',        note:'Must clear tallest obstacle plus margin' },
      { id:'s4', text:'Geofencing / unlocking configured if required',    note:'' },
      { id:'s5', text:'Memory card inserted — sufficient space free',     note:'' },
      { id:'s6', text:'Obstacle avoidance active and calibrated',         note:'Disable only if intentional and risk-assessed' },
    ]
  },
  {
    id: 'site', label: 'SITE ASSESSMENT',
    items: [
      { id:'si1', text:'Visual survey complete — obstacles, people, hazards', note:'Walk the area if accessible before flight' },
      { id:'si2', text:'Take-off / landing zone clear and stable',            note:'No long grass, loose debris, or slopes >5°' },
      { id:'si3', text:'Bystanders briefed or exclusion zone established',    note:'' },
      { id:'si4', text:'Emergency landing area identified',                   note:'Plan abort route before arming' },
      { id:'si5', text:'Wind speed acceptable at ground level',               note:'Check against aircraft manufacturer rating' },
      { id:'si6', text:'Visibility sufficient for VLOS operations',           note:'Unaided line of sight must be maintained' },
    ]
  },
  {
    id: 'powered', label: 'POWERED-ON CHECKS',
    items: [
      { id:'c1', text:'GPS lock confirmed — sufficient satellites',      note:'6+ satellites recommended; wait for stable lock' },
      { id:'c2', text:'Compass calibrated (if new location / prompted)', note:'Required when significantly relocating' },
      { id:'c3', text:'IMU status normal — no errors or warnings',       note:'' },
      { id:'c4', text:'Live camera feed confirmed on controller / app',  note:'' },
      { id:'c5', text:'Home point set correctly on map',                 note:'Verify before arming' },
      { id:'c6', text:'All telemetry readings normal',                   note:'Check voltage, GPS, signal strength' },
    ]
  },
];

// ── STATE & STORAGE ───────────────────────────────────────────
const STORE = {
  get: (k, fallback = null) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

let checkState = {};      // item id -> bool
let currentWeather = {};  // last fetched weather
let userCoords = null;    // { lat, lon }
let weatherFetching = false;

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initChecklist();
  initNav();
  loadPilotAutofill();
  loadAircraftDropdown();
  renderAircraftSettings();
  renderLogs();
  setupSettings();
  setupPreflightEvents();
  setupLogModal();
  setupPostFlightModal();
  setupDocs();
  updateDateDisplay();

  // Try to get location and fetch weather on load
  getLocation().then(coords => {
    if (coords) {
      userCoords = coords;
      fetchWeather(coords.lat, coords.lon);
    }
  });
});

// ── NAV ───────────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + view).classList.add('active');

      if (view === 'logs') renderLogs();
      if (view === 'docs') renderDocs();
      if (view === 'weather' && !weatherFetching) {
        getLocation().then(c => { if (c) { userCoords = c; fetchWeather(c.lat, c.lon); } });
      }
    });
  });
}

// ── CHECKLIST ─────────────────────────────────────────────────
function initChecklist() {
  // Load any saved draft state
  const saved = STORE.get('pf_draft_checks', {});
  checkState = {};
  CHECKLIST.forEach(s => s.items.forEach(i => { checkState[i.id] = saved[i.id] || false; }));
  renderChecklist();
  updateRing();
}

function renderChecklist() {
  const container = document.getElementById('checklist-container');
  container.innerHTML = '';

  CHECKLIST.forEach(section => {
    const done = section.items.filter(i => checkState[i.id]).length;
    const total = section.items.length;

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="section-header-row">
        <span class="section-title">${section.label}</span>
        <span class="section-prog ${done === total ? 'done' : ''}" id="prog-${section.id}">${done}/${total}</span>
      </div>
      <div class="check-items" id="items-${section.id}"></div>`;
    container.appendChild(card);

    const itemsEl = card.querySelector('#items-' + section.id);
    section.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'check-item' + (checkState[item.id] ? ' checked' : '');
      el.dataset.id = item.id;
      el.dataset.section = section.id;
      el.innerHTML = `
        <div class="check-box">
          <svg viewBox="0 0 12 12" fill="none">
            <polyline points="1.5,6 4.5,9 10.5,3" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="check-text">
          <div class="check-label">${item.text}</div>
          ${item.note ? `<div class="check-note">${item.note}</div>` : ''}
        </div>`;
      el.addEventListener('click', () => toggleCheck(item.id, section.id));
      itemsEl.appendChild(el);
    });
  });
}

function toggleCheck(itemId, sectionId) {
  checkState[itemId] = !checkState[itemId];

  // Update item UI
  const el = document.querySelector(`.check-item[data-id="${itemId}"]`);
  if (el) el.classList.toggle('checked', checkState[itemId]);

  // Update section progress
  const section = CHECKLIST.find(s => s.id === sectionId);
  const done = section.items.filter(i => checkState[i.id]).length;
  const progEl = document.getElementById('prog-' + sectionId);
  if (progEl) {
    progEl.textContent = `${done}/${section.items.length}`;
    progEl.classList.toggle('done', done === section.items.length);
  }

  updateRing();
  autosaveDraft();
}

function updateRing() {
  const total = Object.keys(checkState).length;
  const done = Object.values(checkState).filter(Boolean).length;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;
  const circumference = 113;
  const offset = circumference - (circumference * pct / 100);

  document.getElementById('ring-fill').style.strokeDashoffset = offset;
  document.getElementById('ring-pct').textContent = pct + '%';
}

function autosaveDraft() {
  STORE.set('pf_draft_checks', checkState);
}

// ── PREFLIGHT EVENTS ──────────────────────────────────────────
function setupPreflightEvents() {
  // Locate button
  document.getElementById('locate-btn').addEventListener('click', () => {
    getLocation().then(coords => {
      if (coords) {
        userCoords = coords;
        fetchWeather(coords.lat, coords.lon, true); // true = update preflight strip
        reverseGeocode(coords.lat, coords.lon).then(name => {
          document.getElementById('pf-location').value = name;
        });
      } else {
        alert('Could not get location. Please ensure location access is enabled.');
      }
    });
  });

  // Post-flight button
  document.getElementById('postflight-btn').addEventListener('click', () => {
    openPostFlightModal();
  });

  // Reset
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (!confirm('Reset all checks for a new flight?')) return;
    CHECKLIST.forEach(s => s.items.forEach(i => { checkState[i.id] = false; }));
    STORE.set('pf_draft_checks', {});
    renderChecklist();
    updateRing();
    document.getElementById('pf-notes').value = '';
    document.getElementById('pf-location').value = '';
    document.getElementById('pf-client').value = '';
    document.getElementById('pf-jobref').value = '';
  });
}

function updateDateDisplay() {
  const now = new Date();
  const opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  document.getElementById('pf-date-display').textContent = now.toLocaleDateString('en-GB', opts).toUpperCase();
}

// ── LOCATION & WEATHER ────────────────────────────────────────
function getLocation() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, enableHighAccuracy: false }
    );
  });
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
    const r = await fetch(url);
    const d = await r.json();
    const a = d.address;
    return a.town || a.city || a.village || a.county || 'Current location';
  } catch {
    return 'Current location';
  }
}

async function fetchWeather(lat, lon, updateStrip = false) {
  if (weatherFetching) return;
  weatherFetching = true;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,visibility,surface_pressure`
    + `&hourly=temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,visibility&hourly_timezone_auto=true`
    + `&wind_speed_unit=kn&forecast_days=1&timezone=auto`;

  try {
    const r = await fetch(url);
    const d = await r.json();
    const c = d.current;

    currentWeather = {
      temp:     Math.round(c.temperature_2m),
      feels:    Math.round(c.apparent_temperature),
      humid:    c.relative_humidity_2m,
      precip:   c.precipitation,
      cloud:    c.cloud_cover,
      wind:     Math.round(c.wind_speed_10m),
      gust:     Math.round(c.wind_gusts_10m),
      dir:      windDir(c.wind_direction_10m),
      vis:      formatVis(c.visibility),
      visRaw:   c.visibility,
      pressure: Math.round(c.surface_pressure),
      hourly:   d.hourly,
      fetched:  new Date(),
    };

    updateWeatherView(lat, lon);
    updatePreflightStrip();
  } catch (e) {
    console.error('Weather fetch failed:', e);
  } finally {
    weatherFetching = false;
  }
}

function windDir(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function formatVis(m) {
  if (m === undefined || m === null) return '--';
  if (m >= 10000) return '>10km';
  if (m >= 1000) return (m / 1000).toFixed(1) + 'km';
  return m + 'm';
}

function goNoGoAssessment(w) {
  // Returns { status: 'go'|'warn'|'nogo', reasons: [] }
  const issues = [];
  const warnings = [];

  // Get active aircraft wind limit
  const acId = document.getElementById('pf-aircraft')?.value;
  const aircraft = STORE.get('pf_aircraft', []).find(a => a.id === acId);
  const windLimit = aircraft ? parseInt(aircraft.wind) : 22;

  if (w.gust >= windLimit)   issues.push(`Gusts ${w.gust}kt exceed aircraft limit (${windLimit}kt)`);
  else if (w.wind >= windLimit * 0.8) warnings.push(`Wind ${w.wind}kt approaching limit`);

  if (w.visRaw !== undefined && w.visRaw < 500)       issues.push(`Visibility ${formatVis(w.visRaw)} — below VLOS minimum`);
  else if (w.visRaw !== undefined && w.visRaw < 1500) warnings.push(`Visibility ${formatVis(w.visRaw)} — reduced`);

  if (w.precip > 0)          warnings.push(`Precipitation: ${w.precip}mm`);
  if (w.cloud >= 90)         warnings.push('Total cloud cover');

  if (issues.length > 0)   return { status: 'nogo', reasons: issues };
  if (warnings.length > 0) return { status: 'warn', reasons: warnings };
  return { status: 'go', reasons: ['All parameters within limits'] };
}

function updatePreflightStrip() {
  if (!currentWeather.wind && currentWeather.wind !== 0) return;
  const w = currentWeather;
  document.getElementById('wx-temp').textContent  = w.temp + '°C';
  document.getElementById('wx-wind').textContent  = w.wind + 'kt';
  document.getElementById('wx-gust').textContent  = w.gust + 'kt';
  document.getElementById('wx-vis').textContent   = w.vis;
  document.getElementById('wx-cloud').textContent = w.cloud + '%';

  const assessment = goNoGoAssessment(w);
  const badge = document.getElementById('wx-go-badge');
  badge.textContent = assessment.status.toUpperCase();
  badge.className = 'wx-go ' + assessment.status;
}

function updateWeatherView(lat, lon) {
  if (!currentWeather.wind && currentWeather.wind !== 0) return;
  const w = currentWeather;

  // Main cards
  document.getElementById('wv-temp').textContent    = w.temp + '°C';
  document.getElementById('wv-feels').textContent   = w.feels + '°C';
  document.getElementById('wv-wind').textContent    = w.wind + 'kt';
  document.getElementById('wv-gust').textContent    = w.gust + 'kt';
  document.getElementById('wv-dir').textContent     = w.dir;
  document.getElementById('wv-vis').textContent     = w.vis;
  document.getElementById('wv-cloud').textContent   = w.cloud + '%';
  document.getElementById('wv-precip').textContent  = w.precip + 'mm';
  document.getElementById('wv-humid').textContent   = w.humid + '%';
  document.getElementById('wv-pressure').textContent = w.pressure + 'hPa';

  // Go/No-Go banner
  const assessment = goNoGoAssessment(w);
  const banner = document.getElementById('go-nogo-banner');
  banner.className = 'go-nogo-banner ' + assessment.status;
  document.getElementById('go-nogo-label').textContent  = assessment.status === 'go' ? 'GO' : assessment.status === 'warn' ? 'CAUTION' : 'NO-GO';
  document.getElementById('go-nogo-reason').textContent = assessment.reasons.join(' · ');

  // Location name
  reverseGeocode(lat, lon).then(name => {
    document.getElementById('wx-location-name').textContent = name;
  });

  // Hourly
  renderHourly(w.hourly);

  // Updated time
  document.getElementById('wx-updated').textContent = 'Last updated: ' + w.fetched.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function renderHourly(hourly) {
  if (!hourly) return;
  const list = document.getElementById('hourly-list');
  list.innerHTML = '';

  const now = new Date();
  const currentHour = now.getHours();

  hourly.time.forEach((timeStr, i) => {
    const t = new Date(timeStr);
    if (t.getHours() < currentHour && t.toDateString() === now.toDateString()) return;

    const wind = Math.round(hourly.wind_speed_10m[i]);
    const gust = Math.round(hourly.wind_gusts_10m[i]);
    const temp = Math.round(hourly.temperature_2m[i]);
    const vis  = hourly.visibility[i];
    const status = wind > 22 || (vis !== undefined && vis < 500) ? 'nogo' : (wind > 17 ? 'warn' : 'go');

    const row = document.createElement('div');
    row.className = 'hourly-item';
    row.innerHTML = `
      <div class="hourly-time">${t.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
      <div class="hourly-temp">${temp}°C</div>
      <div class="hourly-wind">${wind}kt / G${gust}kt &nbsp;·&nbsp; ${formatVis(vis)}</div>
      <div class="hourly-dot ${status}"></div>`;
    list.appendChild(row);
  });
}

// Weather refresh button
document.getElementById('wx-refresh-btn')?.addEventListener('click', () => {
  getLocation().then(c => { if (c) { userCoords = c; fetchWeather(c.lat, c.lon); } });
});

// ── PILOT AUTOFILL ────────────────────────────────────────────
function loadPilotAutofill() {
  const profile = STORE.get('pf_pilot', {});
  if (profile.name) document.getElementById('pf-pilot').value = profile.name;
}

// ── AIRCRAFT ──────────────────────────────────────────────────
function loadAircraftDropdown() {
  const aircraft = STORE.get('pf_aircraft', []);
  const sel = document.getElementById('pf-aircraft');
  sel.innerHTML = '<option value="">— Select aircraft —</option>';
  aircraft.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = a.name;
    sel.appendChild(opt);
  });
}

function renderAircraftSettings() {
  const aircraft = STORE.get('pf_aircraft', []);
  const list = document.getElementById('aircraft-list');
  if (!aircraft.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-dim);padding:8px 0;">No aircraft added yet.</div>';
    return;
  }
  list.innerHTML = aircraft.map(a => `
    <div class="aircraft-item">
      <div>
        <div class="aircraft-name">${a.name}</div>
        <div class="aircraft-detail">${a.serial || 'No serial'} · Max wind: ${a.wind || '?'}kt${a.notes ? ' · ' + a.notes : ''}</div>
      </div>
      <button class="delete-btn" onclick="deleteAircraft('${a.id}')">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>`).join('');
}

function deleteAircraft(id) {
  if (!confirm('Remove this aircraft?')) return;
  const aircraft = STORE.get('pf_aircraft', []).filter(a => a.id !== id);
  STORE.set('pf_aircraft', aircraft);
  renderAircraftSettings();
  loadAircraftDropdown();
}

// ── SETTINGS ──────────────────────────────────────────────────
function setupSettings() {
  // Load pilot profile into settings fields
  const profile = STORE.get('pf_pilot', {});
  if (profile.name)       document.getElementById('s-pilot-name').value = profile.name;
  if (profile.operatorId) document.getElementById('s-operator-id').value = profile.operatorId;
  if (profile.flyerId)    document.getElementById('s-flyer-id').value = profile.flyerId;
  if (profile.qual)       document.getElementById('s-qual').value = profile.qual;

  document.getElementById('save-pilot-btn').addEventListener('click', () => {
    const profile = {
      name:       document.getElementById('s-pilot-name').value,
      operatorId: document.getElementById('s-operator-id').value,
      flyerId:    document.getElementById('s-flyer-id').value,
      qual:       document.getElementById('s-qual').value,
    };
    STORE.set('pf_pilot', profile);
    loadPilotAutofill();
    showToast('Profile saved');
  });

  document.getElementById('add-aircraft-btn').addEventListener('click', () => {
    document.getElementById('aircraft-form-card').classList.remove('hidden');
  });

  document.getElementById('cancel-aircraft-btn').addEventListener('click', () => {
    document.getElementById('aircraft-form-card').classList.add('hidden');
  });

  document.getElementById('save-aircraft-btn').addEventListener('click', () => {
    const name = document.getElementById('ac-name').value.trim();
    if (!name) { alert('Enter an aircraft name.'); return; }
    const aircraft = STORE.get('pf_aircraft', []);
    aircraft.push({
      id:     'ac_' + Date.now(),
      name:   name,
      serial: document.getElementById('ac-serial').value,
      wind:   document.getElementById('ac-wind').value,
      notes:  document.getElementById('ac-notes').value,
    });
    STORE.set('pf_aircraft', aircraft);
    document.getElementById('aircraft-form-card').classList.add('hidden');
    ['ac-name','ac-serial','ac-notes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ac-wind').value = '22';
    renderAircraftSettings();
    loadAircraftDropdown();
    showToast('Aircraft saved');
  });
}

// ── SAVE FLIGHT LOG ───────────────────────────────────────────
function saveFlightLog() {
  const location = document.getElementById('pf-location').value.trim();
  const pilot    = document.getElementById('pf-pilot').value.trim();

  if (!location) { alert('Add a location before saving.'); return; }
  if (!pilot)    { alert('Add a pilot name before saving.'); return; }

  const acId     = document.getElementById('pf-aircraft').value;
  const aircraft = STORE.get('pf_aircraft', []).find(a => a.id === acId);
  const total    = Object.keys(checkState).length;
  const done     = Object.values(checkState).filter(Boolean).length;
  const client   = document.getElementById('pf-client').value.trim();
  const jobref   = document.getElementById('pf-jobref').value.trim();

  const record = {
    id:        Date.now(),
    date:      new Date().toISOString(),
    location,
    pilot,
    client,
    jobref,
    aircraft:  aircraft ? aircraft.name : 'Not specified',
    op:        document.getElementById('pf-op').value,
    notes:     document.getElementById('pf-notes').value,
    checks:    { ...checkState },
    done,
    total,
    weather:   currentWeather.wind !== undefined ? {
      temp:  currentWeather.temp,
      wind:  currentWeather.wind,
      gust:  currentWeather.gust,
      vis:   currentWeather.vis,
      dir:   currentWeather.dir,
      cloud: currentWeather.cloud,
    } : null,
  };

  const logs = STORE.get('pf_logs', []);
  logs.unshift(record);
  STORE.set('pf_logs', logs.slice(0, 200));
  showToast('Flight record saved');
  renderLogs();
  updateLogCountTitle();
}

// ── LOGS RENDERING ────────────────────────────────────────────
function renderLogs() {
  const allLogs = STORE.get('pf_logs', []);
  const container = document.getElementById('logs-list');
  updateLogCountTitle();

  // Populate client filter dropdown
  const clientSel = document.getElementById('log-filter-client');
  const currentFilter = clientSel.value;
  const clients = [...new Set(allLogs.map(r => r.client).filter(Boolean))].sort();
  clientSel.innerHTML = '<option value="">All clients / jobs</option>'
    + clients.map(c => `<option value="${c}" ${c === currentFilter ? 'selected' : ''}>${c}</option>`).join('');

  // Apply filter
  const activeFilter = clientSel.value;
  const logs = activeFilter ? allLogs.filter(r => r.client === activeFilter) : allLogs;
  document.getElementById('log-filter-clear').style.display = activeFilter ? 'block' : 'none';

  if (!logs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        ${activeFilter ? `No records for <strong>${activeFilter}</strong>.` : 'No flight records yet.<br>Complete a pre-flight check and save to begin logging.'}
      </div>`;
    return;
  }

  container.innerHTML = logs.map(r => {
    const d      = new Date(r.date);
    const dateStr = d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' }).toUpperCase();
    const pct    = Math.round(r.done / r.total * 100);
    const full   = r.done === r.total;
    const hasPFL = r.postFlight && (r.postFlight.takeoff || r.postFlight.notes);
    const durationStr = hasPFL && r.postFlight.duration ? ` · ${r.postFlight.duration}` : '';

    return `
      <div class="log-item" onclick="openLogModal(${r.id})">
        <div class="log-item-header">
          <span class="log-date">${dateStr}</span>
          <span class="log-complete ${full ? 'full' : 'partial'}">${pct}% COMPLETE</span>
        </div>
        ${r.client ? `<div style="margin-bottom:3px;"><span class="log-client-badge">${r.client}</span>${r.jobref ? `<span class="log-jobref">${r.jobref}</span>` : ''}</div>` : ''}
        <div class="log-location">${r.location}</div>
        <div class="log-meta">${r.aircraft} · ${r.pilot}${durationStr}</div>
        ${hasPFL ? `<span class="log-postflight-badge">POST-FLIGHT LOGGED</span>` : ''}
      </div>`;
  }).join('');
}

function updateLogCountTitle() {
  const logs = STORE.get('pf_logs', []);
  document.getElementById('log-count-title').textContent = `${logs.length} Record${logs.length !== 1 ? 's' : ''}`;
}

// ── LOG MODAL ─────────────────────────────────────────────────
function setupLogModal() {
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('log-modal').classList.add('hidden');
  });

  document.getElementById('log-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('log-modal')) {
      document.getElementById('log-modal').classList.add('hidden');
    }
  });

  document.getElementById('log-filter-client').addEventListener('change', renderLogs);
  document.getElementById('log-filter-clear').addEventListener('click', () => {
    document.getElementById('log-filter-client').value = '';
    renderLogs();
  });

  document.getElementById('export-btn').addEventListener('click', exportLogs);
}

function openLogModal(id) {
  const logs = STORE.get('pf_logs', []);
  const r = logs.find(l => l.id === id);
  if (!r) return;

  const d = new Date(r.date);
  const dateStr = d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  document.getElementById('modal-title').textContent = r.location.toUpperCase();

  let html = `
    <div class="modal-section">
      <div class="modal-section-title">FLIGHT DETAILS</div>
      ${row('Date', dateStr)}
      ${row('Location', r.location)}
      ${r.client ? row('Client', r.client) : ''}
      ${r.jobref ? row('Job ref', r.jobref) : ''}
      ${row('Aircraft', r.aircraft)}
      ${row('Pilot', r.pilot)}
      ${row('Operation', r.op)}
      ${row('Checks complete', r.done + '/' + r.total)}
    </div>`;

  if (r.weather) {
    html += `
      <div class="modal-section">
        <div class="modal-section-title">WEATHER AT TIME OF FLIGHT</div>
        ${row('Temperature', r.weather.temp + '°C')}
        ${row('Wind', r.weather.wind + 'kt ' + (r.weather.dir || ''))}
        ${row('Gusts', r.weather.gust + 'kt')}
        ${row('Visibility', r.weather.vis)}
        ${row('Cloud cover', r.weather.cloud + '%')}
      </div>`;
  }

  if (r.notes) {
    html += `
      <div class="modal-section">
        <div class="modal-section-title">PRE-FLIGHT NOTES</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${r.notes}</div>
      </div>`;
  }

  // Post-flight data
  if (r.postFlight) {
    const pfl = r.postFlight;
    html += `<div class="modal-section"><div class="modal-section-title">POST-FLIGHT LOG</div>`;
    if (pfl.takeoff || pfl.landing) {
      html += row('Take-off', pfl.takeoff || '--');
      html += row('Landing', pfl.landing || '--');
      if (pfl.duration) html += row('Duration', pfl.duration);
    }
    if (pfl.batteriesUsed) html += row('Batteries used', pfl.batteriesUsed);
    if (pfl.batteryRemaining) html += row('Final battery', pfl.batteryRemaining + '%');
    if (pfl.incidents && pfl.incidents.length) {
      html += `</div><div class="modal-section"><div class="modal-section-title">INCIDENTS & ANOMALIES</div>`;
      pfl.incidents.forEach((inc, i) => {
        html += `<div style="font-size:13px;color:var(--danger);line-height:1.5;padding:4px 0;border-bottom:1px solid var(--border);">${inc}</div>`;
      });
    }
    if (pfl.notes) {
      html += `</div><div class="modal-section"><div class="modal-section-title">POST-FLIGHT NOTES</div>
        <div style="font-size:13px;color:var(--text-muted);line-height:1.5;">${pfl.notes}</div>`;
    }
    html += `</div>`;
  } else {
    html += `<div class="modal-section">
      <button class="btn-ghost" style="width:100%;border-color:rgba(232,77,53,0.3);color:var(--accent);" onclick="openPostFlightModalForLog(${r.id})">+ ADD POST-FLIGHT LOG</button>
    </div>`;
  }

  // Checklist detail
  html += `<div class="modal-section"><div class="modal-section-title">CHECKS</div><div class="check-list-modal">`;
  CHECKLIST.forEach(section => {
    html += `<div style="font-size:10px;color:var(--accent);letter-spacing:0.12em;font-family:var(--font-mono);margin:10px 0 4px;">${section.label}</div>`;
    section.items.forEach(item => {
      const ok = r.checks[item.id];
      html += `<div class="check-list-item ${ok ? 'ok' : 'miss'}">${ok ? '✓' : '○'} ${item.text}</div>`;
    });
  });
  html += `</div></div>`;

  // Delete button
  html += `<button class="btn-ghost" style="width:100%;margin-top:8px;color:var(--danger);border-color:rgba(232,77,53,0.3);" onclick="deleteLog(${r.id})">DELETE RECORD</button>`;

  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('log-modal').classList.remove('hidden');
}

function row(label, val) {
  return `<div class="modal-row"><span class="modal-row-label">${label}</span><span class="modal-row-val">${val}</span></div>`;
}

function deleteLog(id) {
  if (!confirm('Delete this flight record?')) return;
  let logs = STORE.get('pf_logs', []).filter(l => l.id !== id);
  STORE.set('pf_logs', logs);
  document.getElementById('log-modal').classList.add('hidden');
  renderLogs();
}

// ── EXPORT ────────────────────────────────────────────────────
function exportLogs() {
  const logs = STORE.get('pf_logs', []);
  if (!logs.length) { alert('No logs to export.'); return; }

  let out = 'PREFLIGHT DRONE OPS — FLIGHT LOG EXPORT\n';
  out += '='.repeat(48) + '\n';
  out += `Exported: ${new Date().toLocaleString('en-GB')}\n`;
  out += `Records: ${logs.length}\n\n`;

  logs.forEach((r, idx) => {
    const d = new Date(r.date);
    out += `${'─'.repeat(48)}\n`;
    out += `RECORD ${idx + 1}\n`;
    out += `Date:       ${d.toLocaleString('en-GB')}\n`;
    out += `Location:   ${r.location}\n`;
    if (r.client) out += `Client:     ${r.client}\n`;
    if (r.jobref) out += `Job ref:    ${r.jobref}\n`;
    out += `Aircraft:   ${r.aircraft}\n`;
    out += `Pilot:      ${r.pilot}\n`;
    out += `Operation:  ${r.op}\n`;
    out += `Checks:     ${r.done}/${r.total} (${Math.round(r.done/r.total*100)}%)\n`;
    if (r.weather) {
      out += `Weather:    ${r.weather.temp}°C · Wind ${r.weather.wind}kt ${r.weather.dir || ''} · Gust ${r.weather.gust}kt · Vis ${r.weather.vis}\n`;
    }
    if (r.notes) out += `Notes:      ${r.notes}\n`;
    out += '\n';
    CHECKLIST.forEach(section => {
      out += `  ${section.label}\n`;
      section.items.forEach(item => {
        out += `    [${r.checks[item.id] ? 'X' : ' '}] ${item.text}\n`;
      });
    });
    out += '\n';
  });

  const blob = new Blob([out], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `preflight-log-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── TOAST ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:var(--bg3);border:1px solid var(--border2);color:var(--text);
      font-family:var(--font-mono);font-size:12px;letter-spacing:0.08em;
      padding:9px 18px;border-radius:6px;z-index:999;
      opacity:0;transition:opacity 0.2s;white-space:nowrap;`;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

// ── POST-FLIGHT MODAL ─────────────────────────────────────────
let postFlightTargetLogId = null; // null = attach to most recent unsaved, else log id

function setupPostFlightModal() {
  document.getElementById('postflight-close').addEventListener('click', () => {
    document.getElementById('postflight-modal').classList.add('hidden');
    postFlightTargetLogId = null;
  });

  // Auto-calculate duration when times change
  ['pfl-takeoff', 'pfl-landing'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateDurationDisplay);
  });

  document.getElementById('add-incident-btn').addEventListener('click', addIncidentRow);
  document.getElementById('save-postflight-btn').addEventListener('click', savePostFlight);
}

function openPostFlightModal(logId = null) {
  postFlightTargetLogId = logId;

  // Pre-fill time with now for landing if nothing set
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  if (!document.getElementById('pfl-landing').value) {
    document.getElementById('pfl-landing').value = hhmm;
  }

  // Clear incidents
  document.getElementById('incident-list').innerHTML = '';
  document.getElementById('pfl-notes').value = '';
  document.getElementById('pfl-batteries-used').value = '';
  document.getElementById('pfl-battery-remaining').value = '';
  updateDurationDisplay();

  document.getElementById('postflight-modal').classList.remove('hidden');
}

function openPostFlightModalForLog(logId) {
  document.getElementById('log-modal').classList.add('hidden');
  // Pre-fill existing data if any
  const logs = STORE.get('pf_logs', []);
  const r = logs.find(l => l.id === logId);
  if (r && r.postFlight) {
    const pfl = r.postFlight;
    document.getElementById('pfl-takeoff').value = pfl.takeoff || '';
    document.getElementById('pfl-landing').value = pfl.landing || '';
    document.getElementById('pfl-batteries-used').value = pfl.batteriesUsed || '';
    document.getElementById('pfl-battery-remaining').value = pfl.batteryRemaining || '';
    document.getElementById('pfl-notes').value = pfl.notes || '';
    document.getElementById('incident-list').innerHTML = '';
    (pfl.incidents || []).forEach(inc => addIncidentRow(inc));
  } else {
    document.getElementById('incident-list').innerHTML = '';
    document.getElementById('pfl-notes').value = '';
    document.getElementById('pfl-batteries-used').value = '';
    document.getElementById('pfl-battery-remaining').value = '';
  }
  openPostFlightModal(logId);
  updateDurationDisplay();
}

function updateDurationDisplay() {
  const t = document.getElementById('pfl-takeoff').value;
  const l = document.getElementById('pfl-landing').value;
  const el = document.getElementById('pfl-duration-display');
  if (!t || !l) { el.textContent = ''; return; }

  const [th, tm] = t.split(':').map(Number);
  const [lh, lm] = l.split(':').map(Number);
  let mins = (lh * 60 + lm) - (th * 60 + tm);
  if (mins < 0) mins += 24 * 60; // past midnight
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  el.textContent = h > 0 ? `Flight time: ${h}h ${m}m` : `Flight time: ${m} min`;
}

function addIncidentRow(text = '') {
  const list = document.getElementById('incident-list');
  const row = document.createElement('div');
  row.className = 'incident-row';
  row.innerHTML = `
    <textarea placeholder="Describe the incident or anomaly...">${text}</textarea>
    <button class="incident-remove" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(row);
}

function savePostFlight() {
  const takeoff  = document.getElementById('pfl-takeoff').value;
  const landing  = document.getElementById('pfl-landing').value;
  const bUsed    = document.getElementById('pfl-batteries-used').value;
  const bRemain  = document.getElementById('pfl-battery-remaining').value;
  const notes    = document.getElementById('pfl-notes').value.trim();
  const incidents = [...document.querySelectorAll('#incident-list textarea')]
    .map(t => t.value.trim()).filter(Boolean);

  // Calculate duration string
  let duration = '';
  if (takeoff && landing) {
    const [th, tm] = takeoff.split(':').map(Number);
    const [lh, lm] = landing.split(':').map(Number);
    let mins = (lh * 60 + lm) - (th * 60 + tm);
    if (mins < 0) mins += 24 * 60;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    duration = h > 0 ? `${h}h ${m}m` : `${m}min`;
  }

  const postFlight = { takeoff, landing, duration, batteriesUsed: bUsed, batteryRemaining: bRemain, incidents, notes };

  const logs = STORE.get('pf_logs', []);

  if (postFlightTargetLogId) {
    // Attach to specific existing log
    const idx = logs.findIndex(l => l.id === postFlightTargetLogId);
    if (idx !== -1) { logs[idx].postFlight = postFlight; STORE.set('pf_logs', logs); }
  } else {
    // Attach to most recent log
    if (logs.length) { logs[0].postFlight = postFlight; STORE.set('pf_logs', logs); }
    else { showToast('Save a pre-flight record first'); return; }
  }

  document.getElementById('postflight-modal').classList.add('hidden');
  postFlightTargetLogId = null;
  renderLogs();
  showToast('Post-flight log saved');
}

// ── DOCUMENTS ─────────────────────────────────────────────────
const DOC_ICONS = {
  'Insurance':        '🛡',
  'Qualification':    '🎓',
  'Registration':     '🪪',
  'Permission':       '📋',
  'Risk Assessment':  '⚠',
  'Other':            '📄',
};

const DOC_ICON_CLASS = {
  'Insurance':       'insurance',
  'Qualification':   'qualification',
  'Registration':    'registration',
  'Permission':      'permission',
  'Risk Assessment': 'risk',
  'Other':           'other',
};

function setupDocs() {
  document.getElementById('add-doc-btn').addEventListener('click', () => {
    document.getElementById('doc-form-card').classList.remove('hidden');
    document.getElementById('add-doc-btn').classList.add('hidden');
  });

  document.getElementById('cancel-doc-btn').addEventListener('click', () => {
    document.getElementById('doc-form-card').classList.add('hidden');
    document.getElementById('add-doc-btn').classList.remove('hidden');
    resetDocForm();
  });

  document.getElementById('doc-file').addEventListener('change', e => {
    const file = e.target.files[0];
    const info = document.getElementById('doc-file-info');
    if (file) {
      info.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      info.classList.remove('hidden');
    } else {
      info.classList.add('hidden');
    }
  });

  document.getElementById('save-doc-btn').addEventListener('click', saveDoc);
}

function saveDoc() {
  const name     = document.getElementById('doc-name').value.trim();
  const category = document.getElementById('doc-category').value;
  const expiry   = document.getElementById('doc-expiry').value;
  const fileEl   = document.getElementById('doc-file');
  const file     = fileEl.files[0];

  if (!name) { alert('Enter a document name.'); return; }
  if (!file) { alert('Select a file to upload.'); return; }

  const maxMB = 10;
  if (file.size > maxMB * 1024 * 1024) {
    alert(`File is too large. Maximum size is ${maxMB}MB.`);
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const docs = STORE.get('pf_docs', []);
    docs.unshift({
      id:       Date.now(),
      name,
      category,
      expiry,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      data:     e.target.result, // base64 data URL
    });
    STORE.set('pf_docs', docs);
    document.getElementById('doc-form-card').classList.add('hidden');
    document.getElementById('add-doc-btn').classList.remove('hidden');
    resetDocForm();
    renderDocs();
    showToast('Document saved');
  };
  reader.readAsDataURL(file);
}

function resetDocForm() {
  document.getElementById('doc-name').value = '';
  document.getElementById('doc-expiry').value = '';
  document.getElementById('doc-file').value = '';
  document.getElementById('doc-file-info').classList.add('hidden');
}

function renderDocs() {
  const docs = STORE.get('pf_docs', []);
  const container = document.getElementById('docs-list');

  // Expiry warnings
  const today = new Date();
  today.setHours(0,0,0,0);
  const soon = new Date(today); soon.setDate(soon.getDate() + 30);
  const expiring = docs.filter(d => d.expiry && new Date(d.expiry) <= soon);
  const banner = document.getElementById('doc-expiry-banner');
  if (expiring.length) {
    banner.classList.remove('hidden');
    banner.innerHTML = expiring.map(d => {
      const exp = new Date(d.expiry);
      const expired = exp < today;
      return `<strong>${d.name}</strong> — ${expired ? 'EXPIRED' : 'expires'} ${exp.toLocaleDateString('en-GB')}`;
    }).join('<br>');
  } else {
    banner.classList.add('hidden');
  }

  if (!docs.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        No documents stored yet.<br>Add your insurance, qualifications, and permissions here.
      </div>`;
    return;
  }

  container.innerHTML = docs.map(d => {
    const expiryBadge = docExpiryBadge(d.expiry);
    const sizeMB = (d.fileSize / 1024 / 1024).toFixed(2);
    return `
      <div class="doc-item">
        <div class="doc-icon ${DOC_ICON_CLASS[d.category] || 'other'}">${DOC_ICONS[d.category] || '📄'}</div>
        <div class="doc-info">
          <div class="doc-name">${d.name}</div>
          <div class="doc-meta">
            <span>${d.category}</span>
            <span>${sizeMB}MB</span>
            ${expiryBadge}
          </div>
        </div>
        <div class="doc-actions">
          <button class="doc-view-btn" onclick="viewDoc(${d.id})">VIEW</button>
          <button class="delete-btn" onclick="deleteDoc(${d.id})">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>`;
  }).join('');
}

function docExpiryBadge(expiry) {
  if (!expiry) return '';
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(expiry);
  const days  = Math.round((exp - today) / (1000 * 60 * 60 * 24));
  if (days < 0)  return `<span class="doc-expiry-badge expired">EXPIRED</span>`;
  if (days <= 30) return `<span class="doc-expiry-badge warning">EXP ${exp.toLocaleDateString('en-GB', {day:'numeric',month:'short'})}</span>`;
  return `<span class="doc-expiry-badge ok">EXP ${exp.toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'2-digit'})}</span>`;
}

function viewDoc(id) {
  const docs = STORE.get('pf_docs', []);
  const doc  = docs.find(d => d.id === id);
  if (!doc) return;

  // Create or reuse viewer modal
  let viewer = document.getElementById('doc-viewer-modal');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'doc-viewer-modal';
    viewer.className = 'doc-viewer-modal';
    viewer.innerHTML = `
      <div class="doc-viewer-header">
        <span class="doc-viewer-title" id="dv-title"></span>
        <button class="icon-btn" onclick="document.getElementById('doc-viewer-modal').classList.add('hidden')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="doc-viewer-body" id="dv-body"></div>`;
    document.body.appendChild(viewer);
  }

  document.getElementById('dv-title').textContent = doc.name;
  const body = document.getElementById('dv-body');

  if (doc.fileType === 'application/pdf') {
    body.innerHTML = `<iframe src="${doc.data}" style="width:100%;height:100%;min-height:70vh;"></iframe>`;
  } else {
    body.innerHTML = `<img src="${doc.data}" alt="${doc.name}">`;
  }

  viewer.classList.remove('hidden');
}

function deleteDoc(id) {
  if (!confirm('Delete this document? This cannot be undone.')) return;
  const docs = STORE.get('pf_docs', []).filter(d => d.id !== id);
  STORE.set('pf_docs', docs);
  renderDocs();
  showToast('Document deleted');
}
