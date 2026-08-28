/**
 * Sensitive Data Protection (Cloud DLP / SDP) Full Suite Controller
 * 
 * Includes:
 * 0. Executive Dashboard (Summary Overview - Looker Studio SDP Template)
 * 1. Discovery Profiles & Heatmap with Source Type filtering
 * 2. Inspection Suite: Built-in InfoTypes, Custom InfoTypes Creator & Sandbox, Inspect Jobs, Job Triggers (Filtered by source)
 * 3. BigQuery-Exclusive Risk Analysis (k-anonymity, l-diversity, delta-presence) with architecture alerts for non-BigQuery
 * 4. Configuration & Governance: Templates, Stored InfoTypes, Content Policies (Filtered by source)
 * 5. Persona-Adapted Views & Permissions
 */

let sdpState = {
  activeSubtab: "dashboard",
  selectedAssetId: null,
  dashboardData: null,
  dashboardFilters: {
    project: "-",
    asset_type: "-",
    data_risk: "-",
    encryption: "-",
    date_range: "-",
    data_asset: "-",
    infotype: "-",
    data_sensitivity: "-",
    is_public: "-",
    data_location: "-"
  },
  builtinInfotypes: [],
  customInfotypes: [],
  discoveryProfiles: [],
  inspectJobs: [],
  jobTriggers: [],
  riskReport: null,
  inspectTemplates: [],
  deidentifyTemplates: [],
  contentPolicies: [],
  discoveryFilterSource: "ALL",
  discoveryFilterRisk: "ALL",
  discoverySearchQuery: ""
};

function initDLP() {
  initSDP();
}

async function initSDP() {
  const container = document.getElementById("pane-dlp");
  if (!container) return;

  await loadAllSDPData();
  renderSDPLayout();
}

async function loadAllSDPData() {
  try {
    const [profilesRes, builtinRes, customRes, jobsRes, triggersRes, inspectTmplRes, deidTmplRes, policiesRes] = await Promise.all([
      fetch(`${API_BASE}/api/sdp/discovery/profiles`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/infotypes/builtin`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/infotypes/custom`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/inspect/jobs`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/inspect/triggers`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/templates/inspect`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/templates/deidentify`).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${API_BASE}/api/sdp/policies`).then(r => r.json()).catch(() => ({ data: [] }))
    ]);

    sdpState.discoveryProfiles = profilesRes.data || [];
    sdpState.builtinInfotypes = builtinRes.data || [];
    sdpState.customInfotypes = customRes.data || [];
    sdpState.inspectJobs = jobsRes.data || [];
    sdpState.jobTriggers = triggersRes.data || [];
    sdpState.inspectTemplates = inspectTmplRes.data || [];
    sdpState.deidentifyTemplates = deidTmplRes.data || [];
    sdpState.contentPolicies = policiesRes.data || [];

    if (!sdpState.selectedAssetId && sdpState.discoveryProfiles.length > 0) {
      sdpState.selectedAssetId = sdpState.discoveryProfiles[0].asset_id;
    }
  } catch (err) {
    console.error("Error loading SDP data:", err);
  }
}

function getActiveRoleProfile() {
  try {
    const raw = localStorage.getItem("governance_user");
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { id: "guardian_dato", name: "El Guardián del Dato", role: "Data Steward / DPO", avatar: "🛡️" };
}

function renderSDPLayout() {
  const container = document.getElementById("pane-dlp");
  if (!container) return;

  const role = getActiveRoleProfile();

  let roleContextBadge = "";
  if (role.id === "guardian_dato") {
    roleContextBadge = `<span class="stat-metric-badge badge-emerald">● Control Total de Privacidad & SDP (DPO / Steward)</span>`;
  } else if (role.id === "arquitecto_ingeniero") {
    roleContextBadge = `<span class="stat-metric-badge badge-blue">● Monitoreo de Pipelines, Triggers & CMEK (Lead Architect)</span>`;
  } else if (role.id === "gestor_programa") {
    roleContextBadge = `<span class="stat-metric-badge badge-purple">● Supervisión de Content Policies & Sprints (Governance Lead)</span>`;
  } else {
    roleContextBadge = `<span class="stat-metric-badge badge-purple">● Visión Ejecutiva de Sensibilidad & Riesgo PII (CDO)</span>`;
  }

  container.innerHTML = `
    <div class="sdp-container">
      <!-- 1. Header Banner con Perfil Responsable -->
      <div class="sdp-persona-banner">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 2rem; background: var(--bg-app); border: 1px solid var(--border-light); width: 50px; height: 50px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: center;">
            🛡️
          </div>
          <div>
            <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.15rem;">
              Sensitive Data Protection (Cloud DLP / SDP Suite)
            </h2>
            <p style="font-size: 0.8rem; color: var(--text-muted);">
              Descubrimiento continuo, inspección de InfoTypes, disparadores automatizados y análisis de re-identificación en BigQuery.
            </p>
          </div>
        </div>
        <div>
          ${roleContextBadge}
        </div>
      </div>

      <!-- 2. Sub-Navegación de SDP -->
      <div class="sdp-subnav">
        <button class="sdp-subnav-btn ${sdpState.activeSubtab === 'dashboard' ? 'active' : ''}" onclick="switchSDPSubtab('dashboard')">
          📊 1. Dashboard Ejecutivo (Summary Overview)
        </button>
        <button class="sdp-subnav-btn ${sdpState.activeSubtab === 'discovery' ? 'active' : ''}" onclick="switchSDPSubtab('discovery')">
          🌐 2. Perfiles de Descubrimiento (Discovery Profiles)
        </button>
        <button class="sdp-subnav-btn ${sdpState.activeSubtab === 'inspection' ? 'active' : ''}" onclick="switchSDPSubtab('inspection')">
          🔍 3. Inspección & InfoTypes (Jobs y Triggers)
        </button>
        <button class="sdp-subnav-btn ${sdpState.activeSubtab === 'risk' ? 'active' : ''}" onclick="switchSDPSubtab('risk')">
          📈 4. Análisis de Riesgo (BigQuery)
        </button>
        <button class="sdp-subnav-btn ${sdpState.activeSubtab === 'config' ? 'active' : ''}" onclick="switchSDPSubtab('config')">
          ⚙️ 5. Configuración & Gobernanza
        </button>
      </div>

      <!-- 3. BARRA GLOBAL PERSISTENTE DE FILTRO POR FUENTE (Para subtabs 2-5) -->
      <div id="sdp-global-filter-container">
        <!-- Rendered by renderSDPGlobalFilterBar -->
      </div>

      <!-- 4. Contenedor Dinámico del Submódulo -->
      <div id="sdp-subtab-content">
        <!-- Rendered by switchSDPSubtab -->
      </div>
    </div>
  `;

  if (sdpState.activeSubtab !== "dashboard") {
    renderSDPGlobalFilterBar();
  }
  renderActiveSDPSubtab();
}

function switchSDPSubtab(subtabName) {
  sdpState.activeSubtab = subtabName;
  document.querySelectorAll(".sdp-subnav-btn").forEach(b => b.classList.remove("active"));
  const activeBtn = document.querySelector(`.sdp-subnav-btn[onclick="switchSDPSubtab('${subtabName}')"]`);
  if (activeBtn) activeBtn.classList.add("active");

  const filterContainer = document.getElementById("sdp-global-filter-container");
  if (filterContainer) {
    if (subtabName === "dashboard") {
      filterContainer.style.display = "none";
    } else {
      filterContainer.style.display = "block";
      renderSDPGlobalFilterBar();
    }
  }
  renderActiveSDPSubtab();
}

function renderActiveSDPSubtab() {
  const contentEl = document.getElementById("sdp-subtab-content");
  if (!contentEl) return;

  if (sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  } else if (sdpState.activeSubtab === "discovery") {
    renderSDPDiscovery(contentEl);
  } else if (sdpState.activeSubtab === "inspection") {
    renderSDPInspection(contentEl);
  } else if (sdpState.activeSubtab === "risk") {
    renderSDPRiskAnalysis(contentEl);
  } else if (sdpState.activeSubtab === "config") {
    renderSDPConfiguration(contentEl);
  }
}

// ============================================================================
// 0. SUBMÓDULO: DASHBOARD EJECUTIVO SENSITIVE DATA PROTECTION (LOOKER STUDIO)
// ============================================================================
async function loadSDPDashboardData() {
  try {
    const f = sdpState.dashboardFilters;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) {
      if (v && v !== "-") {
        params.append(k, v);
      }
    }
    const res = await fetch(`${API_BASE}/api/sdp/dashboard/overview?${params.toString()}`);
    const data = await res.json();
    if (data.status === "success") {
      sdpState.dashboardData = data;
    }
  } catch (err) {
    console.error("Error loading SDP dashboard data:", err);
  }
}

async function renderSDPDashboardOverview(container) {
  if (!container) return;

  if (!sdpState.dashboardData) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
        <em>Cargando Sensitive Data Protection Dashboard (Summary Overview)...</em>
      </div>
    `;
    await loadSDPDashboardData();
  }

  const data = sdpState.dashboardData;
  if (!data) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: var(--pastel-rose-text);">
        ⚠️ No se pudieron cargar los datos de Sensitive Data Protection. Por favor intenta nuevamente.
      </div>
    `;
    return;
  }

  const f = sdpState.dashboardFilters;
  const opts = data.filter_options || {};

  const makeOptions = (list, selected) => {
    return (list || ["-"]).map(val => `<option value="${escapeHtml(val)}" ${selected === val ? 'selected' : ''}>${val === '-' ? '—' : escapeHtml(val)}</option>`).join("");
  };

  const maxRiskVal = Math.max(data.data_risk.RISK_LOW || 1, data.data_risk.RISK_HIGH || 1, data.data_risk.RISK_MODERATE || 1, 6000);
  const maxSensVal = Math.max(data.data_sensitivity.SENSITIVITY_LOW || 1, data.data_sensitivity.SENSITIVITY_HIGH || 1, data.data_sensitivity.SENSITIVITY_MODERATE || 1, 6000);

  const riskHighPct = ((data.data_risk.RISK_HIGH / maxRiskVal) * 100).toFixed(1);
  const riskLowPct = ((data.data_risk.RISK_LOW / maxRiskVal) * 100).toFixed(1);
  const riskModPct = Math.max(2, ((data.data_risk.RISK_MODERATE / maxRiskVal) * 100)).toFixed(1);

  const sensHighPct = ((data.data_sensitivity.SENSITIVITY_HIGH / maxSensVal) * 100).toFixed(1);
  const sensLowPct = ((data.data_sensitivity.SENSITIVITY_LOW / maxSensVal) * 100).toFixed(1);
  const sensModPct = Math.max(2, ((data.data_sensitivity.SENSITIVITY_MODERATE / maxSensVal) * 100)).toFixed(1);

  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  const donutCircles = (data.infotypes_distribution || []).map(item => {
    const dash = (item.pct / 100) * circumference;
    const circle = `
      <circle cx="85" cy="85" r="${radius}" fill="transparent" 
        stroke="${item.color}" stroke-width="26" 
        stroke-dasharray="${dash.toFixed(2)} ${(circumference - dash).toFixed(2)}" 
        stroke-dashoffset="${(-currentOffset).toFixed(2)}"
        style="cursor: pointer; transition: stroke-width 0.2s;"
        title="${item.label}: ${item.pct}% (${item.count.toLocaleString()} assets)"
        onclick="applySDPInfoTypeFilter('${escapeHtml(item.name)}')"
      />
    `;
    currentOffset += dash;
    return circle;
  }).join("");

  const legendItemsHtml = (data.infotypes_distribution || []).map(item => `
    <div class="sdp-looker-legend-item ${f.infotype === item.name ? 'active-filter' : ''}" onclick="applySDPInfoTypeFilter('${escapeHtml(item.name)}')">
      <div class="sdp-looker-legend-left">
        <span class="sdp-looker-legend-dot" style="background: ${item.color};"></span>
        <span class="sdp-looker-legend-name" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
      </div>
      <span class="sdp-looker-legend-pct">${item.pct}%</span>
    </div>
  `).join("");

  const issuesHtml = (data.security_issues || []).map(iss => {
    let countClass = "";
    if (iss.severity === "CRITICAL") countClass = "count-danger";
    else if (iss.severity === "HIGH") countClass = "count-danger";
    else countClass = "count-warning";

    return `
      <div class="sdp-looker-issue-row">
        <div class="sdp-looker-issue-info">
          <div class="sdp-looker-issue-title">${escapeHtml(iss.title)}</div>
          <button class="sdp-looker-issue-action-btn" onclick="triggerSDPIssueRemediation('${escapeHtml(iss.id)}')">
            ⚡ ${escapeHtml(iss.action_label)}
          </button>
        </div>
        <div class="sdp-looker-issue-count ${countClass}">
          ${iss.count.toLocaleString()}
        </div>
      </div>
    `;
  }).join("");

  const timePoints = data.time_series || [];
  const svgWidth = 500;
  const svgHeight = 140;
  const paddingLeft = 32;
  const paddingRight = 15;
  const paddingTop = 12;
  const paddingBottom = 22;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = svgHeight - paddingTop - paddingBottom;
  const maxSeriesVal = 500;

  const getY = (val) => {
    const ratio = Math.min(1, Math.max(0, val / maxSeriesVal));
    return paddingTop + chartH - (ratio * chartH);
  };
  const getX = (idx) => {
    return paddingLeft + (idx / (timePoints.length - 1 || 1)) * chartW;
  };

  let pathLow = "";
  let pathHigh = "";
  let pathMod = "";

  timePoints.forEach((pt, i) => {
    const x = getX(i);
    const yLow = getY(pt.low);
    const yHigh = getY(pt.high);
    const yMod = getY(pt.moderate);

    if (i === 0) {
      pathLow = `M ${x} ${yLow}`;
      pathHigh = `M ${x} ${yHigh}`;
      pathMod = `M ${x} ${yMod}`;
    } else {
      pathLow += ` L ${x} ${yLow}`;
      pathHigh += ` L ${x} ${yHigh}`;
      pathMod += ` L ${x} ${yMod}`;
    }
  });

  container.innerHTML = `
    <div class="sdp-looker-wrapper">
      <!-- 1. HEADER (Looker Studio SDP Blue Theme) -->
      <div class="sdp-looker-header">
        <div class="sdp-looker-brand">
          <div class="sdp-looker-icon">🛡️</div>
          <div class="sdp-looker-title-box">
            <h2>Sensitive Data Protection <span>Dashboard</span></h2>
            <p>Summary Overview</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button class="btn-secondary" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3); font-size: 0.78rem;" onclick="refreshSDPDashboard()">
            🔄 Actualizar Datos
          </button>
          <button class="btn-secondary" style="background: rgba(255,255,255,0.25); color: #fff; border: 1px solid rgba(255,255,255,0.4); font-size: 0.78rem;" onclick="switchSDPSubtab('discovery')">
            🌐 Perfiles Detallados ➔
          </button>
        </div>
      </div>

      <!-- 2. BODY CONTENT -->
      <div class="sdp-looker-body">
        <!-- Multi-Filter Bar -->
        <div class="sdp-looker-filters-container">
          <!-- Row 1 -->
          <div class="sdp-looker-filter-row">
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Project</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('project', this.value)">
                ${makeOptions(opts.projects, f.project)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Asset Type</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('asset_type', this.value)">
                ${makeOptions(opts.asset_types, f.asset_type)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Data Risk</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('data_risk', this.value)">
                ${makeOptions(opts.data_risks, f.data_risk)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Encryption</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('encryption', this.value)">
                ${makeOptions(opts.encryptions, f.encryption)}
              </select>
            </div>
            <div class="sdp-looker-filter-item" style="grid-column: span 2; min-width: 320px; position: relative;">
              <label class="sdp-looker-filter-label" style="display: flex; justify-content: space-between;">
                <span>📅 Select Date Range (Date Picker Interactivo)</span>
                <span style="font-size: 0.72rem; color: var(--pastel-blue-text); font-weight: 700;">
                  ${(f.date_from && f.date_to) ? `${escapeHtml(f.date_from)} ➔ ${escapeHtml(f.date_to)}` : 'Selección Libre'}
                </span>
              </label>
              
              <div class="custom-datepicker-container">
                <button type="button" class="custom-datepicker-trigger" onclick="toggleCustomDatePickerPopover(event)">
                  <span>📅 ${ (f.date_from && f.date_to) ? `${f.date_from} ➔ ${f.date_to}` : 'Escoger Rango de Fechas...' }</span>
                  <span style="font-size: 0.7rem; color: var(--text-muted);">▼</span>
                </button>

                <!-- Custom Popover Calendar -->
                <div id="sdp-datepicker-popover" class="custom-datepicker-popover" onclick="event.stopPropagation()">
                  <div class="datepicker-header">
                    <button type="button" class="datepicker-nav-btn" onclick="navigateCalendarMonth(-1)">◀</button>
                    <span id="sdp-datepicker-month-title" class="datepicker-month-title">Mes Año</span>
                    <button type="button" class="datepicker-nav-btn" onclick="navigateCalendarMonth(1)">▶</button>
                  </div>

                  <div class="datepicker-weekdays">
                    <span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span><span>Dom</span>
                  </div>

                  <div id="sdp-datepicker-days" class="datepicker-days-grid">
                    <!-- Dynamic Day Buttons -->
                  </div>

                  <div class="datepicker-presets-row">
                    <button type="button" class="datepicker-preset-chip" onclick="applyCustomDatePreset('today')">Hoy</button>
                    <button type="button" class="datepicker-preset-chip" onclick="applyCustomDatePreset('last_7')">7 días</button>
                    <button type="button" class="datepicker-preset-chip" onclick="applyCustomDatePreset('last_30')">30 días</button>
                    <button type="button" class="datepicker-preset-chip" onclick="applyCustomDatePreset('last_90')">90 días</button>
                    <button type="button" class="datepicker-preset-chip" onclick="applyCustomDatePreset('year_2024')">Año 2024</button>
                  </div>

                  <div style="margin-top: 0.5rem; font-size: 0.7rem; font-weight: 600; color: var(--pastel-blue-text);" id="sdp-datepicker-selection-label">
                    Sin selección
                  </div>

                  <div class="datepicker-actions">
                    <button type="button" class="datepicker-btn-clear" onclick="clearCustomDatePickerRange()">Limpiar</button>
                    <button type="button" class="datepicker-btn-apply" onclick="applyCustomDatePickerRange()">Aplicar Rango</button>
                  </div>
                </div>
              </div>
            </div>
            <button class="sdp-looker-btn-reset" onclick="resetSDPFilters()">
              <span>Reset all filters</span>
            </button>
          </div>

          <!-- Row 2 -->
          <div class="sdp-looker-filter-row" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Data Asset</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('data_asset', this.value)">
                ${makeOptions(opts.data_assets, f.data_asset)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">infoType</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('infotype', this.value)">
                ${makeOptions(opts.infotypes, f.infotype)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Data Sensitivity</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('data_sensitivity', this.value)">
                ${makeOptions(opts.data_sensitivities, f.data_sensitivity)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Is Public</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('is_public', this.value)">
                ${makeOptions(opts.is_public_options, f.is_public)}
              </select>
            </div>
            <div class="sdp-looker-filter-item">
              <label class="sdp-looker-filter-label">Data Location</label>
              <select class="sdp-looker-select" onchange="updateSDPFilter('data_location', this.value)">
                ${makeOptions(opts.data_locations, f.data_location)}
              </select>
            </div>
          </div>
        </div>

        <!-- 3 KPI Scorecards -->
        <div class="sdp-looker-scorecards">
          <div class="sdp-looker-scorecard">
            <div class="sdp-looker-scorecard-label">Data Assets Profiled</div>
            <div class="sdp-looker-scorecard-value">${data.kpis.data_assets_profiled.toLocaleString()}</div>
            <div class="sdp-looker-scorecard-sub">Activos inspeccionados continuamente</div>
          </div>
          <div class="sdp-looker-scorecard">
            <div class="sdp-looker-scorecard-label">Data Locations Discovered</div>
            <div class="sdp-looker-scorecard-value">${data.kpis.data_locations_discovered}</div>
            <div class="sdp-looker-scorecard-sub">Regiones y proyectos multi-cloud</div>
          </div>
          <div class="sdp-looker-scorecard scorecard-red">
            <div class="sdp-looker-scorecard-label">Highly Sensitive Assets</div>
            <div class="sdp-looker-scorecard-value" style="color: #e11d48;">${data.kpis.highly_sensitive_assets.toLocaleString()}</div>
            <div class="sdp-looker-scorecard-sub">Requieren control estricto de gobernanza</div>
          </div>
        </div>

        <!-- 2x2 Grid Visualizations -->
        <div class="sdp-looker-viz-grid">
          <!-- Card 1: Data Risk & Data Sensitivity Bar Gauges -->
          <div class="sdp-looker-card">
            <div>
              <div class="sdp-looker-card-title" style="margin-bottom: 0.6rem;">Data risk</div>
              <div class="sdp-looker-bar-group">
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #e11d48;">RISK_HIGH</span>
                    <span>${data.data_risk.RISK_HIGH.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-high" style="width: ${riskHighPct}%;"></div>
                  </div>
                </div>
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #64748b;">RISK_LOW</span>
                    <span>${data.data_risk.RISK_LOW.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-low" style="width: ${riskLowPct}%;"></div>
                  </div>
                </div>
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #f59e0b;">RISK_MODERATE</span>
                    <span>${data.data_risk.RISK_MODERATE.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-moderate" style="width: ${riskModPct}%;"></div>
                  </div>
                </div>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
              <div class="sdp-looker-card-title" style="margin-bottom: 0.6rem;">Data sensitivity</div>
              <div class="sdp-looker-bar-group">
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #e11d48;">SENSITIVITY_HIGH</span>
                    <span>${data.data_sensitivity.SENSITIVITY_HIGH.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-high" style="width: ${sensHighPct}%;"></div>
                  </div>
                </div>
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #64748b;">SENSITIVITY_LOW</span>
                    <span>${data.data_sensitivity.SENSITIVITY_LOW.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-low" style="width: ${sensLowPct}%;"></div>
                  </div>
                </div>
                <div class="sdp-looker-bar-item">
                  <div class="sdp-looker-bar-labels">
                    <span style="color: #f59e0b;">SENSITIVITY_MODERATE</span>
                    <span>${data.data_sensitivity.SENSITIVITY_MODERATE.toLocaleString()}</span>
                  </div>
                  <div class="sdp-looker-bar-track">
                    <div class="sdp-looker-bar-fill bar-moderate" style="width: ${sensModPct}%;"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Card 2: Donut Chart predicted infoTypes -->
          <div class="sdp-looker-card">
            <div class="sdp-looker-card-header">
              <div class="sdp-looker-card-title">Data Assets with predicted infoTypes</div>
            </div>
            <div class="sdp-looker-donut-container">
              <div class="sdp-looker-donut-svg-box">
                <svg width="170" height="170" viewBox="0 0 170 170" style="transform: rotate(-90deg);">
                  ${donutCircles}
                </svg>
                <div class="sdp-looker-donut-center">
                  <div class="sdp-looker-donut-center-val">${data.kpis.data_assets_profiled.toLocaleString()}</div>
                  <div class="sdp-looker-donut-center-lbl">Assets</div>
                </div>
              </div>
              <div class="sdp-looker-donut-legend">
                ${legendItemsHtml}
              </div>
            </div>
          </div>

          <!-- Card 3: Data Security Issues -->
          <div class="sdp-looker-card">
            <div class="sdp-looker-card-header">
              <div class="sdp-looker-card-title">Data Security Issues</div>
              <span class="stat-metric-badge badge-red">● Riesgos Detectados</span>
            </div>
            <div class="sdp-looker-issues-list">
              ${issuesHtml}
            </div>
          </div>

          <!-- Card 4: Profiled Data Over Time Line Chart -->
          <div class="sdp-looker-card">
            <div class="sdp-looker-card-header">
              <div class="sdp-looker-card-title">Profiled data over time</div>
              <div class="sdp-looker-time-legend">
                <div class="sdp-looker-time-legend-item">
                  <span class="sdp-looker-time-legend-line" style="background: #64748b;"></span>
                  <span>RISK_LOW</span>
                </div>
                <div class="sdp-looker-time-legend-item">
                  <span class="sdp-looker-time-legend-line" style="background: #e11d48;"></span>
                  <span>RISK_HIGH</span>
                </div>
                <div class="sdp-looker-time-legend-item">
                  <span class="sdp-looker-time-legend-line" style="background: #f59e0b;"></span>
                  <span>RISK_MODERATE</span>
                </div>
              </div>
            </div>

            <div class="sdp-looker-time-chart-box">
              <svg width="100%" height="100%" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none" style="overflow: visible;">
                <!-- Grid lines & Y Axis -->
                <line x1="${paddingLeft}" y1="${getY(500)}" x2="${svgWidth - paddingRight}" y2="${getY(500)}" stroke="var(--border-light)" stroke-dasharray="3 3" />
                <text x="${paddingLeft - 6}" y="${getY(500) + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">500</text>

                <line x1="${paddingLeft}" y1="${getY(100)}" x2="${svgWidth - paddingRight}" y2="${getY(100)}" stroke="var(--border-light)" stroke-dasharray="3 3" />
                <text x="${paddingLeft - 6}" y="${getY(100) + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">100</text>

                <line x1="${paddingLeft}" y1="${getY(50)}" x2="${svgWidth - paddingRight}" y2="${getY(50)}" stroke="var(--border-light)" stroke-dasharray="3 3" />
                <text x="${paddingLeft - 6}" y="${getY(50) + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">50</text>

                <line x1="${paddingLeft}" y1="${getY(10)}" x2="${svgWidth - paddingRight}" y2="${getY(10)}" stroke="var(--border-light)" stroke-dasharray="3 3" />
                <text x="${paddingLeft - 6}" y="${getY(10) + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">10</text>

                <line x1="${paddingLeft}" y1="${getY(1)}" x2="${svgWidth - paddingRight}" y2="${getY(1)}" stroke="var(--border-light)" />
                <text x="${paddingLeft - 6}" y="${getY(1) + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">1</text>

                <!-- Curves -->
                <path d="${pathLow}" fill="none" stroke="#64748b" stroke-width="2" stroke-linejoin="round" />
                <path d="${pathHigh}" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linejoin="round" />
                <path d="${pathMod}" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linejoin="round" />

                <!-- X Axis Dates -->
                <text x="${getX(0)}" y="${svgHeight - 3}" fill="var(--text-muted)" font-size="8" text-anchor="start">Sep 25, 2023</text>
                <text x="${getX(Math.floor(timePoints.length / 4))}" y="${svgHeight - 3}" fill="var(--text-muted)" font-size="8" text-anchor="middle">Nov 12, 2023</text>
                <text x="${getX(Math.floor(timePoints.length / 2))}" y="${svgHeight - 3}" fill="var(--text-muted)" font-size="8" text-anchor="middle">Jan 11, 2024</text>
                <text x="${getX(Math.floor(timePoints.length * 0.75))}" y="${svgHeight - 3}" fill="var(--text-muted)" font-size="8" text-anchor="middle">Feb 16, 2024</text>
                <text x="${getX(timePoints.length - 1)}" y="${svgHeight - 3}" fill="var(--text-muted)" font-size="8" text-anchor="end">Mar 11, 2024</text>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

}

// State for custom datepicker calendar view
let datepickerCurrentYear = new Date().getFullYear();
let datepickerCurrentMonth = new Date().getMonth();
let datepickerTempFrom = "";
let datepickerTempTo = "";

function toggleCustomDatePickerPopover(evt) {
  if (evt) evt.stopPropagation();
  const popover = document.getElementById("sdp-datepicker-popover");
  if (!popover) return;
  const isOpening = !popover.classList.contains("active");
  
  document.querySelectorAll(".custom-datepicker-popover").forEach(el => el.classList.remove("active"));
  
  if (isOpening) {
    popover.classList.add("active");
    datepickerTempFrom = sdpState.dashboardFilters.date_from || "";
    datepickerTempTo = sdpState.dashboardFilters.date_to || "";
    renderCalendarGrid();
  }
}

document.addEventListener("click", () => {
  document.querySelectorAll(".custom-datepicker-popover").forEach(el => el.classList.remove("active"));
});

function navigateCalendarMonth(delta) {
  datepickerCurrentMonth += delta;
  if (datepickerCurrentMonth > 11) {
    datepickerCurrentMonth = 0;
    datepickerCurrentYear++;
  } else if (datepickerCurrentMonth < 0) {
    datepickerCurrentMonth = 11;
    datepickerCurrentYear--;
  }
  renderCalendarGrid();
}

function handleCalendarDayClick(dateIsoStr) {
  if (!datepickerTempFrom || (datepickerTempFrom && datepickerTempTo)) {
    datepickerTempFrom = dateIsoStr;
    datepickerTempTo = "";
  } else if (datepickerTempFrom && !datepickerTempTo) {
    if (dateIsoStr >= datepickerTempFrom) {
      datepickerTempTo = dateIsoStr;
    } else {
      datepickerTempTo = datepickerTempFrom;
      datepickerTempFrom = dateIsoStr;
    }
  }
  renderCalendarGrid();
}

function renderCalendarGrid() {
  const titleEl = document.getElementById("sdp-datepicker-month-title");
  const daysGridEl = document.getElementById("sdp-datepicker-days");
  if (!titleEl || !daysGridEl) return;

  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  titleEl.textContent = `${monthNames[datepickerCurrentMonth]} ${datepickerCurrentYear}`;

  const firstDay = new Date(datepickerCurrentYear, datepickerCurrentMonth, 1).getDay();
  const daysInMonth = new Date(datepickerCurrentYear, datepickerCurrentMonth + 1, 0).getDate();
  
  let offset = (firstDay === 0) ? 6 : firstDay - 1;

  let html = "";
  for (let i = 0; i < offset; i++) {
    html += `<button type="button" class="datepicker-day empty" disabled></button>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = d < 10 ? `0${d}` : `${d}`;
    const mStr = (datepickerCurrentMonth + 1) < 10 ? `0${datepickerCurrentMonth + 1}` : `${datepickerCurrentMonth + 1}`;
    const isoDate = `${datepickerCurrentYear}-${mStr}-${dayStr}`;

    let classes = "datepicker-day";
    if (isoDate === datepickerTempFrom) classes += " selected-start";
    if (isoDate === datepickerTempTo) classes += " selected-end";
    if (datepickerTempFrom && datepickerTempTo && isoDate > datepickerTempFrom && isoDate < datepickerTempTo) {
      classes += " in-range";
    }

    html += `<button type="button" class="${classes}" onclick="handleCalendarDayClick('${isoDate}')">${d}</button>`;
  }

  daysGridEl.innerHTML = html;
  updateDatePickerSelectedText();
}

function updateDatePickerSelectedText() {
  const labelEl = document.getElementById("sdp-datepicker-selection-label");
  if (labelEl) {
    if (datepickerTempFrom && datepickerTempTo) {
      labelEl.textContent = `Seleccionado: ${datepickerTempFrom} ➔ ${datepickerTempTo}`;
    } else if (datepickerTempFrom) {
      labelEl.textContent = `Desde: ${datepickerTempFrom} (Selecciona fecha fin)`;
    } else {
      labelEl.textContent = "Sin selección de rango";
    }
  }
}

function applyCustomDatePreset(presetKey) {
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  if (presetKey === "today") {
    datepickerTempFrom = formatDate(today);
    datepickerTempTo = formatDate(today);
  } else if (presetKey === "last_7") {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    datepickerTempFrom = formatDate(from);
    datepickerTempTo = formatDate(today);
  } else if (presetKey === "last_30") {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    datepickerTempFrom = formatDate(from);
    datepickerTempTo = formatDate(today);
  } else if (presetKey === "last_90") {
    const from = new Date(today);
    from.setDate(from.getDate() - 90);
    datepickerTempFrom = formatDate(from);
    datepickerTempTo = formatDate(today);
  } else if (presetKey === "year_2024") {
    datepickerTempFrom = "2024-01-01";
    datepickerTempTo = "2024-12-31";
  }

  renderCalendarGrid();
}

function applyCustomDatePickerRange() {
  sdpState.dashboardFilters.date_from = datepickerTempFrom;
  sdpState.dashboardFilters.date_to = datepickerTempTo;
  sdpState.dashboardFilters.date_range = (datepickerTempFrom && datepickerTempTo) ? "custom" : "-";
  
  const popover = document.getElementById("sdp-datepicker-popover");
  if (popover) popover.classList.remove("active");

  loadSDPDashboardData().then(() => {
    const contentEl = document.getElementById("sdp-subtab-content");
    if (contentEl && sdpState.activeSubtab === "dashboard") {
      renderSDPDashboardOverview(contentEl);
    }
  });
}

function clearCustomDatePickerRange() {
  datepickerTempFrom = "";
  datepickerTempTo = "";
  sdpState.dashboardFilters.date_from = "";
  sdpState.dashboardFilters.date_to = "";
  sdpState.dashboardFilters.date_range = "-";
  
  const popover = document.getElementById("sdp-datepicker-popover");
  if (popover) popover.classList.remove("active");

  loadSDPDashboardData().then(() => {
    const contentEl = document.getElementById("sdp-subtab-content");
    if (contentEl && sdpState.activeSubtab === "dashboard") {
      renderSDPDashboardOverview(contentEl);
    }
  });
}

async function handleSDPDatePresetChange(preset) {
  sdpState.dashboardFilters.date_range = preset;
  const today = new Date();
  const formatDate = (d) => d.toISOString().split('T')[0];

  if (preset === "today") {
    sdpState.dashboardFilters.date_from = formatDate(today);
    sdpState.dashboardFilters.date_to = formatDate(today);
  } else if (preset === "last_7_days") {
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    sdpState.dashboardFilters.date_from = formatDate(from);
    sdpState.dashboardFilters.date_to = formatDate(today);
  } else if (preset === "last_30_days") {
    const from = new Date(today);
    from.setDate(from.getDate() - 30);
    sdpState.dashboardFilters.date_from = formatDate(from);
    sdpState.dashboardFilters.date_to = formatDate(today);
  } else if (preset === "last_90_days") {
    const from = new Date(today);
    from.setDate(from.getDate() - 90);
    sdpState.dashboardFilters.date_from = formatDate(from);
    sdpState.dashboardFilters.date_to = formatDate(today);
  } else if (preset === "year_2024") {
    sdpState.dashboardFilters.date_from = "2024-01-01";
    sdpState.dashboardFilters.date_to = "2024-12-31";
  } else {
    sdpState.dashboardFilters.date_from = "";
    sdpState.dashboardFilters.date_to = "";
  }

  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
}

async function updateSDPCustomDateFilter() {
  const fromVal = document.getElementById("sdp-date-from")?.value || "";
  const toVal = document.getElementById("sdp-date-to")?.value || "";
  sdpState.dashboardFilters.date_from = fromVal;
  sdpState.dashboardFilters.date_to = toVal;
  sdpState.dashboardFilters.date_range = "custom";
  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
}

async function updateSDPFilter(key, value) {
  sdpState.dashboardFilters[key] = value;
  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
}

async function resetSDPFilters() {
  sdpState.dashboardFilters = {
    project: "-",
    asset_type: "-",
    data_risk: "-",
    encryption: "-",
    date_range: "-",
    date_from: "",
    date_to: "",
    data_asset: "-",
    infotype: "-",
    data_sensitivity: "-",
    is_public: "-",
    data_location: "-"
  };
  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
  showToast("Filtros del Dashboard restablecidos.", "info");
}

async function applySDPInfoTypeFilter(itName) {
  if (sdpState.dashboardFilters.infotype === itName) {
    sdpState.dashboardFilters.infotype = "-";
  } else {
    sdpState.dashboardFilters.infotype = itName;
  }
  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
  showToast(`Filtro infoType: ${sdpState.dashboardFilters.infotype}`, "info");
}

async function refreshSDPDashboard() {
  await loadSDPDashboardData();
  const contentEl = document.getElementById("sdp-subtab-content");
  if (contentEl && sdpState.activeSubtab === "dashboard") {
    renderSDPDashboardOverview(contentEl);
  }
  showToast("Métricas del Dashboard SDP actualizadas.", "success");
}

async function triggerSDPIssueRemediation(issueId) {
  try {
    const res = await fetch(`${API_BASE}/api/sdp/dashboard/remediate/${issueId}`, {
      method: "POST"
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message, "success");
      await loadSDPDashboardData();
      const contentEl = document.getElementById("sdp-subtab-content");
      if (contentEl && sdpState.activeSubtab === "dashboard") {
        renderSDPDashboardOverview(contentEl);
      }
    } else {
      showToast(data.detail || "Error al ejecutar la remediación.", "error");
    }
  } catch (err) {
    console.error("Error remediating issue:", err);
    showToast("Error de conexión al aplicar la remediación.", "error");
  }
}

// ============================================================================
// HELPERS DE CLASIFICACIÓN Y FILTRADO POR FUENTE DE DATOS
// ============================================================================
function getProfileSourceCategory(p) {
  if (!p) return "other";
  const cloud = (p.cloud || "").toLowerCase();
  const service = (p.service || "").toLowerCase();
  const loc = (p.resource_location || "").toLowerCase();
  const id = (p.asset_id || "").toLowerCase();

  if (service.includes("bigquery")) return "bigquery";
  if (cloud.includes("mysql") || service.includes("mysql") || loc.includes("bdcomercial") || id.includes("mysql")) return "mysql";
  if (service.includes("storage") || service.includes("gcs") || loc.startsWith("gs://") || id.includes("gcs")) return "gcs";
  if (cloud.includes("azure") || service.includes("synapse")) return "azure";
  if (cloud.includes("aws") || service.includes("redshift")) return "aws";
  if (cloud.includes("postgres") || service.includes("postgres")) return "postgres";
  return "other";
}

function getJobSourceCategory(j) {
  if (!j) return "other";
  const profile = (sdpState.discoveryProfiles || []).find(p => p.asset_id === j.target_asset_id);
  if (profile) return getProfileSourceCategory(profile);

  const targetType = (j.target_type || "").toLowerCase();
  const targetName = (j.target_name || "").toLowerCase();
  const targetId = (j.target_asset_id || "").toLowerCase();
  const loc = (j.target_location || "").toLowerCase();

  if (targetType.includes("mysql") || targetName.includes("mysql") || targetId.includes("mysql") || loc.includes("bdcomercial")) return "mysql";
  if (targetType.includes("storage") || targetType.includes("gcs") || targetId.includes("gcs") || loc.startsWith("gs://")) return "gcs";
  if (targetType.includes("synapse") || targetType.includes("azure") || targetId.includes("azure")) return "azure";
  if (targetType.includes("redshift") || targetType.includes("aws") || targetId.includes("aws")) return "aws";
  if (targetType.includes("postgres") || targetId.includes("postgres")) return "postgres";
  return "bigquery";
}

function getTriggerSourceCategory(t) {
  if (!t) return "other";
  const profile = (sdpState.discoveryProfiles || []).find(p => p.asset_id === t.target_asset_id);
  if (profile) return getProfileSourceCategory(profile);

  const targetId = (t.target_asset_id || "").toLowerCase();
  const targetName = (t.target_name || "").toLowerCase();
  const desc = (t.description || "").toLowerCase();

  if (targetId.includes("mysql") || targetName.includes("mysql") || desc.includes("mysql")) return "mysql";
  if (targetId.includes("gcs") || targetName.includes("gcs") || desc.includes("gcs")) return "gcs";
  if (targetId.includes("azure") || targetName.includes("azure") || desc.includes("azure")) return "azure";
  if (targetId.includes("aws") || targetName.includes("aws") || desc.includes("aws")) return "aws";
  if (targetId.includes("postgres") || targetName.includes("postgres") || desc.includes("postgres")) return "postgres";
  return "bigquery";
}

function getFilteredDiscoveryProfiles() {
  const all = sdpState.discoveryProfiles || [];
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  const activeRisk = sdpState.discoveryFilterRisk || "ALL";
  const q = (sdpState.discoverySearchQuery || "").toLowerCase().trim();

  return all.filter(p => {
    if (activeSource !== "ALL" && getProfileSourceCategory(p) !== activeSource) return false;
    if (activeRisk !== "ALL") {
      if (activeRisk === "HIGH" && p.data_risk_level !== "HIGH" && p.sensitivity_level !== "HIGH") return false;
      if (activeRisk === "MODERATE" && p.data_risk_level !== "MODERATE" && p.sensitivity_level !== "MODERATE") return false;
      if (activeRisk === "LOW" && p.data_risk_level !== "LOW" && p.sensitivity_level !== "LOW") return false;
    }
    if (q) {
      const name = (p.name || "").toLowerCase();
      const loc = (p.resource_location || "").toLowerCase();
      const srv = (p.service || "").toLowerCase();
      const cld = (p.cloud || "").toLowerCase();
      const infotypes = (p.predicted_infotypes || []).join(" ").toLowerCase();
      if (!name.includes(q) && !loc.includes(q) && !srv.includes(q) && !cld.includes(q) && !infotypes.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

function getFilteredInspectJobs() {
  const allJobs = sdpState.inspectJobs || [];
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  if (activeSource === "ALL") return allJobs;
  return allJobs.filter(j => getJobSourceCategory(j) === activeSource);
}

function getFilteredJobTriggers() {
  const allTriggers = sdpState.jobTriggers || [];
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  if (activeSource === "ALL") return allTriggers;
  return allTriggers.filter(t => getTriggerSourceCategory(t) === activeSource);
}

function getFilteredPolicies() {
  const allPolicies = sdpState.contentPolicies || [];
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  if (activeSource === "ALL") return allPolicies;

  return allPolicies.filter(pol => {
    const scope = (pol.cloud_scope || "").toLowerCase();
    if (activeSource === "bigquery" && (scope.includes("bigquery") || scope.includes("gcp"))) return true;
    if (activeSource === "mysql" && (scope.includes("mysql") || scope.includes("extern") || scope.includes("multi-cloud") || scope.includes("híbrido"))) return true;
    if (activeSource === "gcs" && (scope.includes("storage") || scope.includes("gcs"))) return true;
    if (activeSource === "azure" && (scope.includes("azure") || scope.includes("multi-cloud"))) return true;
    if (activeSource === "aws" && (scope.includes("aws") || scope.includes("multi-cloud"))) return true;
    return false;
  });
}

// ============================================================================
// BARRA GLOBAL DE FILTROS SDP (PERSISTE EN TODOS LOS SUB-PASOS)
// ============================================================================
function renderSDPGlobalFilterBar() {
  const container = document.getElementById("sdp-global-filter-container");
  if (!container) return;

  const allProfiles = sdpState.discoveryProfiles || [];
  const sourceCounts = {
    ALL: allProfiles.length,
    bigquery: allProfiles.filter(p => getProfileSourceCategory(p) === "bigquery").length,
    mysql: allProfiles.filter(p => getProfileSourceCategory(p) === "mysql").length,
    gcs: allProfiles.filter(p => getProfileSourceCategory(p) === "gcs").length,
    azure: allProfiles.filter(p => getProfileSourceCategory(p) === "azure").length,
    aws: allProfiles.filter(p => getProfileSourceCategory(p) === "aws").length,
    postgres: allProfiles.filter(p => getProfileSourceCategory(p) === "postgres").length
  };

  const activeSource = sdpState.discoveryFilterSource || "ALL";

  const sourcePills = [
    { id: "ALL", label: "🌟 Fuentes Conectadas", count: sourceCounts.ALL, disabled: false },
    { id: "bigquery", label: "🔷 BigQuery (GCP)", count: sourceCounts.bigquery, disabled: false },
    { id: "mysql", label: "🐬 MySQL (On-Prem / Aiven)", count: sourceCounts.mysql, disabled: false },
    { id: "gcs", label: "🗄️ Cloud Storage (GCS)", count: sourceCounts.gcs, disabled: false },
    { id: "azure", label: "🔒 Azure (Deshabilitado)", count: 0, disabled: true },
    { id: "aws", label: "🔒 AWS (Deshabilitado)", count: 0, disabled: true }
  ];
  if (sourceCounts.postgres > 0) {
    sourcePills.push({ id: "postgres", label: "🐘 PostgreSQL (On-Prem)", count: sourceCounts.postgres, disabled: false });
  }

  const pillsHtml = sourcePills.map(sp => `
    <button class="sdp-filter-pill ${activeSource === sp.id ? 'active' : ''} ${sp.disabled ? 'disabled-pill' : ''}" style="${sp.disabled ? 'opacity: 0.55; cursor: not-allowed;' : ''}" onclick="setSDPGlobalSourceFilter('${sp.id}')" title="${sp.disabled ? 'Deshabilitado: Solo GCP y On-Premise están conectados' : ''}">
      <span>${sp.label}</span>
      ${!sp.disabled ? `<span class="pill-count">${sp.count}</span>` : ''}
    </button>
  `).join("");

  const activeLabel = sourcePills.find(s => s.id === activeSource)?.label || activeSource;

  container.innerHTML = `
    <div class="sdp-filter-bar" style="margin-bottom: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
          <span>🎯 Filtro Global de Fuente SDP:</span>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--pastel-blue-accent); background: var(--bg-app); padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-light);">
            ${activeLabel}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">
          Fuentes activas conectadas: <strong>Google Cloud Platform</strong> y <strong>On-Premises</strong>.
        </div>
      </div>
      <div class="sdp-filter-pills-row">
        ${pillsHtml}
      </div>
    </div>
  `;
}

function setSDPGlobalSourceFilter(sourceKey) {
  if (sourceKey === "azure" || sourceKey === "aws") {
    showToast(`⚠️ La fuente de ${sourceKey.toUpperCase()} está deshabilitada ya que actualmente solo se han conectado GCP y On-Premise.`, "warning");
    return;
  }
  sdpState.discoveryFilterSource = sourceKey;
  renderSDPGlobalFilterBar();
  renderActiveSDPSubtab();
}

// ============================================================================
// 1. SUBMÓDULO: DISCOVERY PROFILES & HEATMAP
// ============================================================================
function renderSDPDiscovery(container) {
  const allProfiles = sdpState.discoveryProfiles || [];
  const filteredProfiles = getFilteredDiscoveryProfiles();

  const activeSource = sdpState.discoveryFilterSource || "ALL";
  const activeRisk = sdpState.discoveryFilterRisk || "ALL";

  const highSensCount = filteredProfiles.filter(p => p.sensitivity_level === "HIGH").length;
  const highRiskCount = filteredProfiles.filter(p => p.data_risk_level === "HIGH").length;
  const totalTables = filteredProfiles.length;
  const protectedCount = filteredProfiles.filter(p => (p.encryption_type && p.encryption_type.includes("CMEK")) || p.sensitivity_level === "LOW").length;

  const rowsHtml = filteredProfiles.length > 0 ? filteredProfiles.map(p => {
    const sensBadge = p.sensitivity_level === "HIGH" ? `<span class="sdp-badge sdp-badge-high">ALTA</span>` : (p.sensitivity_level === "MODERATE" ? `<span class="sdp-badge sdp-badge-mod">MODERADA</span>` : `<span class="sdp-badge sdp-badge-low">BAJA</span>`);
    const riskBadge = p.data_risk_level === "HIGH" ? `<span class="sdp-badge sdp-badge-high">ALTO</span>` : (p.data_risk_level === "MODERATE" ? `<span class="sdp-badge sdp-badge-mod">MEDIO</span>` : `<span class="sdp-badge sdp-badge-low">BAJO</span>`);
    const infotypesHtml = (p.predicted_infotypes || []).map(it => `<span class="sdp-infotype-tag">${escapeHtml(it)}</span>`).join("") || `<span style="color:#94a3b8; font-size:0.75rem;">Sin PII detectada</span>`;

    let engineIcon = "🔷";
    const srcCat = getProfileSourceCategory(p);
    if (srcCat === "mysql") engineIcon = "🐬";
    else if (srcCat === "gcs") engineIcon = "🗄️";
    else if (srcCat === "azure") engineIcon = "☁️";
    else if (srcCat === "aws") engineIcon = "🔶";
    else if (srcCat === "postgres") engineIcon = "🐘";

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(p.name)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(p.resource_location)}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.35rem;">
            <span>${engineIcon}</span>
            <span class="stat-metric-badge badge-blue">${escapeHtml(p.cloud)}</span>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.15rem;">${escapeHtml(p.service)}</div>
        </td>
        <td>${sensBadge}</td>
        <td>${riskBadge}</td>
        <td>${infotypesHtml}</td>
        <td>
          <span style="font-size: 0.75rem; color: #166534; background: #f0fdf4; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid #bbf7d0;">
            🔒 ${escapeHtml(p.encryption_type || 'Google-Managed')}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="triggerDiscoveryScanForAsset('${p.asset_id}')">
              🔄 Re-escanear
            </button>
            <button class="btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="jumpToInspectionForAsset('${p.asset_id}')">
              🔍 Inspeccionar
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🔍</div>
        <strong>No se encontraron activos para los filtros aplicados (${activeSource.toUpperCase()}).</strong>
        <p style="font-size: 0.8rem; margin-top: 0.35rem;">Prueba seleccionando "Todas las Fuentes" o limpiando el texto de búsqueda.</p>
        <button class="btn-secondary" style="margin-top: 0.75rem; font-size: 0.78rem;" onclick="resetSDPDiscoveryFilters()">🔄 Restablecer Filtros</button>
      </td>
    </tr>
  `;

  const activeScanLabel = activeSource === "ALL" ? "Global" : activeSource.toUpperCase();

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      
      <!-- Controles de Búsqueda y Filtro de Riesgo en Descubrimiento -->
      <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 0.85rem 1.25rem; display: grid; grid-template-columns: 1fr 220px auto auto; gap: 0.75rem; align-items: center;">
        <div style="position: relative;">
          <input 
            type="text" 
            class="form-input" 
            style="width: 100%; padding-left: 2rem; font-size: 0.82rem;" 
            placeholder="🔍 Buscar por nombre de tabla, dataset o InfoType (ej. clientes, correo, rfc)..." 
            value="${escapeHtml(sdpState.discoverySearchQuery)}" 
            oninput="onSDPDiscoverySearch(this.value)"
          >
          <span style="position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;">🔍</span>
        </div>

        <div>
          <select class="form-input" style="width: 100%; font-size: 0.8rem;" onchange="onSDPDiscoveryRiskFilter(this.value)">
            <option value="ALL" ${activeRisk === 'ALL' ? 'selected' : ''}>Todos los Niveles de Riesgo</option>
            <option value="HIGH" ${activeRisk === 'HIGH' ? 'selected' : ''}>🚨 Riesgo Alto (PII Crítica)</option>
            <option value="MODERATE" ${activeRisk === 'MODERATE' ? 'selected' : ''}>⚠️ Riesgo Medio</option>
            <option value="LOW" ${activeRisk === 'LOW' ? 'selected' : ''}>✅ Riesgo Bajo / Sin PII</option>
          </select>
        </div>

        <button class="btn-primary" style="font-size: 0.78rem; padding: 0.4rem 0.85rem;" onclick="triggerDiscoveryScanByActiveFilter()">
          🚀 Auto-Discovery (${activeScanLabel})
        </button>

        <button class="btn-secondary" style="font-size: 0.78rem; padding: 0.4rem 0.75rem;" onclick="resetSDPDiscoveryFilters()">
          🔄 Limpiar
        </button>
      </div>

      <!-- KPIs Dinámicos según Filtro -->
      <div class="sdp-kpi-grid">
        <div class="sdp-kpi-card">
          <div class="sdp-kpi-label">Tablas Filtradas (${activeSource.toUpperCase()})</div>
          <div class="sdp-kpi-value" style="color: var(--pastel-blue-accent);">${totalTables} Activos</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${activeSource === 'ALL' ? 'Multi-Cloud & Híbrido' : `Motor: ${activeSource}`}</div>
        </div>
        <div class="sdp-kpi-card">
          <div class="sdp-kpi-label">Sensibilidad Alta (PII Crítica)</div>
          <div class="sdp-kpi-value" style="color: var(--pastel-rose-accent);">${highSensCount} Tablas</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Requieren Dynamic Data Masking</div>
        </div>
        <div class="sdp-kpi-card">
          <div class="sdp-kpi-label">Nivel de Riesgo Elevado</div>
          <div class="sdp-kpi-value" style="color: var(--pastel-amber-accent);">${highRiskCount} Tablas</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Monitoreo continuo con Job Triggers</div>
        </div>
        <div class="sdp-kpi-card">
          <div class="sdp-kpi-label">Cifrado & Control CMEK</div>
          <div class="sdp-kpi-value" style="color: var(--pastel-emerald-accent);">${protectedCount} / ${totalTables}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Conforme a Política de Encriptación</div>
        </div>
      </div>

      <!-- Tabla de Discovery Profiles Filtrada -->
      <div class="sdp-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
              Perfiles de Descubrimiento Automatizados (Data Profiles)
            </h3>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Mostrando ${filteredProfiles.length} tablas de ${allProfiles.length} totales en catálogo.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn-secondary" onclick="triggerDiscoveryScanAll()">
              🌐 Escanear Todo el Catálogo (Global)
            </button>
          </div>
        </div>

        <div style="overflow-x: auto;">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Tabla / Activo de Datos</th>
                <th>Nube / Motor</th>
                <th>Sensibilidad</th>
                <th>Riesgo SDP</th>
                <th>InfoTypes Detectados</th>
                <th>Cifrado en Reposo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function onSDPDiscoverySearch(query) {
  sdpState.discoverySearchQuery = query;
  const container = document.getElementById("sdp-subtab-content");
  if (container) renderSDPDiscovery(container);
}

function onSDPDiscoveryRiskFilter(riskLevel) {
  sdpState.discoveryFilterRisk = riskLevel;
  const container = document.getElementById("sdp-subtab-content");
  if (container) renderSDPDiscovery(container);
}

function resetSDPDiscoveryFilters() {
  sdpState.discoveryFilterSource = "ALL";
  sdpState.discoveryFilterRisk = "ALL";
  sdpState.discoverySearchQuery = "";
  renderSDPGlobalFilterBar();
  const container = document.getElementById("sdp-subtab-content");
  if (container) renderSDPDiscovery(container);
}

async function triggerDiscoveryScanByActiveFilter() {
  const src = sdpState.discoveryFilterSource || "ALL";
  const label = src === "ALL" ? "todas las fuentes" : `la fuente: ${src.toUpperCase()}`;
  showToast(`Iniciando Auto-Discovery para ${label}...`, "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/discovery/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_type: src === "ALL" ? null : src })
    });
    const data = await res.json();
    if (data.status === "success" || data.profiles_updated) {
      showToast(data.message || `Auto-Discovery completado para ${label}`, "success");
      await loadAllSDPData();
      renderSDPGlobalFilterBar();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al ejecutar Auto-Discovery", "error");
  }
}

async function triggerDiscoveryScanAll() {
  showToast("Iniciando escaneo de Discovery global en todas las fuentes...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/discovery/scan`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderSDPGlobalFilterBar();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al ejecutar Discovery global", "error");
  }
}

async function triggerDiscoveryScanForAsset(assetId) {
  showToast(`Re-escaneando perfil de descubrimiento para ${assetId}...`, "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/discovery/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset_id: assetId })
    });
    const data = await res.json();
    if (data.status === "success") {
      showToast("Perfil de descubrimiento actualizado con éxito", "success");
      await loadAllSDPData();
      renderSDPGlobalFilterBar();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al actualizar perfil", "error");
  }
}

function jumpToInspectionForAsset(assetId) {
  sdpState.selectedAssetId = assetId;
  const profile = (sdpState.discoveryProfiles || []).find(p => p.asset_id === assetId);
  if (profile) {
    sdpState.discoveryFilterSource = getProfileSourceCategory(profile);
  }
  switchSDPSubtab("inspection");
}

// ============================================================================
// 2. SUBMÓDULO: INSPECCIÓN COMPLETA (FILTRADO POR FUENTE DE DATOS)
// ============================================================================
function renderSDPInspection(container) {
  const builtin = sdpState.builtinInfotypes || [];
  const custom = sdpState.customInfotypes || [];
  
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  const filteredProfiles = getFilteredDiscoveryProfiles();
  const filteredJobs = getFilteredInspectJobs();
  const filteredTriggers = getFilteredJobTriggers();

  // Custom infotypes table
  const customRows = custom.map(c => {
    const cat = c.category || "PII";
    const sens = c.sensitivity_level || "HIGH";
    const act = c.protection_action || "DYNAMIC_MASKING";
    const sensBadge = sens === "CRITICAL" ? "badge-rose" : (sens === "HIGH" ? "badge-amber" : "badge-blue");

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main);">${escapeHtml(c.display_name)}</strong>
          <div style="font-size: 0.72rem; color: var(--pastel-purple-text); font-family: monospace;">${escapeHtml(c.name)}</div>
        </td>
        <td><span class="stat-metric-badge badge-blue">🏷️ ${escapeHtml(cat)}</span></td>
        <td>
          <span class="stat-metric-badge badge-purple">${escapeHtml(c.type)}</span>
          <div style="font-family: monospace; font-size: 0.75rem; color: #0284c7; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 0.2rem;">
            ${escapeHtml(c.regex_pattern || (c.dictionary_words || []).join(", "))}
          </div>
        </td>
        <td>
          <span class="stat-metric-badge ${sensBadge}">Riesgo: ${escapeHtml(sens)}</span>
          <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 0.2rem;">⚡ ${escapeHtml(act)}</div>
        </td>
        <td><span class="sdp-badge sdp-badge-low">${escapeHtml(c.likelihood)}</span></td>
        <td>${escapeHtml(c.created_by)}</td>
        <td>
          <button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;" onclick="openTestModalForCustom('${c.id}')" title="Probar Regex en Vivo">
            🧪 Probar
          </button>
          <button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; color: var(--pastel-blue-text);" onclick="openEditModalForCustom('${c.id}')" title="Editar InfoType">
            ✏️ Editar
          </button>
          <button class="btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.72rem; color: #e11d48;" onclick="deleteCustomInfoType('${c.id}')" title="Eliminar InfoType">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Inspect jobs rows filtered
  const jobsRows = filteredJobs.length > 0 ? filteredJobs.map(j => {
    let engIcon = "🔷";
    const src = getJobSourceCategory(j);
    if (src === "mysql") engIcon = "🐬";
    else if (src === "gcs") engIcon = "🗄️";
    else if (src === "azure") engIcon = "☁️";
    else if (src === "aws") engIcon = "🔶";

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(j.name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">ID: ${escapeHtml(j.job_id)}</div>
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <span>${engIcon}</span>
            <strong>${escapeHtml(j.target_name)}</strong>
          </div>
          <div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${escapeHtml(j.target_location || j.target_type)}</div>
        </td>
        <td>
          <span class="sdp-badge sdp-badge-low">✅ ${escapeHtml(j.status)}</span>
        </td>
        <td><strong>${(j.rows_scanned || 0).toLocaleString()}</strong> filas</td>
        <td>
          <span style="font-weight: 700; color: ${(j.findings_count || 0) > 0 ? '#e11d48' : '#166534'};">
            ${j.findings_count} Columnas PII
          </span>
        </td>
        <td>${escapeHtml(j.created_at)}</td>
        <td>
          <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="viewJobFindingsModal('${j.job_id}')">
            👁️ Ver Hallazgos
          </button>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">🔍</div>
        <strong>No hay Inspect Jobs ejecutados aún para la fuente: ${activeSource.toUpperCase()}.</strong>
        <p style="font-size: 0.78rem; margin-top: 0.25rem;">Puedes lanzar un Inspect Job on-demand seleccionando una tabla de ${activeSource.toUpperCase()}.</p>
        <button class="btn-primary" style="margin-top: 0.5rem; font-size: 0.78rem;" onclick="openCreateInspectJobModal()">
          ➕ Lanzar Inspect Job (${activeSource.toUpperCase()})
        </button>
      </td>
    </tr>
  `;

  // Job triggers rows filtered
  const triggersRows = filteredTriggers.length > 0 ? filteredTriggers.map(t => {
    const isAct = t.status === "ACTIVE";
    let engIcon = "🔷";
    const src = getTriggerSourceCategory(t);
    if (src === "mysql") engIcon = "🐬";
    else if (src === "gcs") engIcon = "🗄️";
    else if (src === "azure") engIcon = "☁️";
    else if (src === "aws") engIcon = "🔶";

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(t.name)}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(t.description)}</div>
        </td>
        <td><span class="stat-metric-badge badge-purple">⏰ ${escapeHtml(t.schedule)}</span></td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.3rem;">
            <span>${engIcon}</span>
            <span>${escapeHtml(t.target_name)}</span>
          </div>
        </td>
        <td>
          <span class="sdp-badge ${isAct ? 'sdp-badge-low' : 'sdp-badge-mod'}">
            ${isAct ? '● ACTIVO' : '⏸️ PAUSADO'}
          </span>
        </td>
        <td>${escapeHtml(t.last_run)}</td>
        <td>
          <div style="display: flex; gap: 0.35rem;">
            <button class="btn-primary" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;" onclick="runTriggerNow('${t.trigger_id}')">
              ⚡ Disparar Ahora
            </button>
            <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;" onclick="toggleTriggerStatus('${t.trigger_id}')">
              ${isAct ? 'Pausar' : 'Activar'}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">⏰</div>
        <strong>No hay Job Triggers configurados para la fuente: ${activeSource.toUpperCase()}.</strong>
        <p style="font-size: 0.78rem; margin-top: 0.25rem;">Programa un disparador periódico de inspección para tus tablas de ${activeSource.toUpperCase()}.</p>
        <button class="btn-primary" style="margin-top: 0.5rem; font-size: 0.78rem;" onclick="openCreateTriggerModal()">
          ⏰ Nuevo Trigger (${activeSource.toUpperCase()})
        </button>
      </td>
    </tr>
  `;

  const activeSourceLabel = activeSource === "ALL" ? "Todas las Fuentes" : activeSource.toUpperCase();

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- SECCIÓN A: INFOYPES BUILT-IN & CREADOR DE CUSTOM INFOTYPES -->
      <div class="sdp-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">1. InfoTypes Disponibles & Creador de Custom InfoTypes</h3>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Usa los ${builtin.length} InfoTypes nativos de Google Cloud o crea patrones personalizados (Regex / Diccionarios) asignando Categoría, Sensibilidad y Acción de Enmascaramiento con probador en vivo.
            </p>
          </div>
          <div>
            <button class="btn-primary" onclick="toggleCustomInfoTypeForm()">
              ➕ Crear mi Propio InfoType
            </button>
          </div>
        </div>

        <!-- Formulario Plegable para Crear Custom InfoType -->
        <div id="custom-infotype-create-box" style="display: none; background: var(--bg-app); border: 1px solid var(--pastel-blue-border); border-radius: var(--radius-md); padding: 1.25rem; margin-top: 0.75rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--pastel-blue-text); margin-bottom: 0.75rem;">
            🛠️ Diseñador de Custom InfoType (Sensitive Data Protection)
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem; margin-bottom: 0.85rem;">
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Nombre Técnico (ej. CUSTOM_EMPLOYEE_ID):</label>
              <input type="text" id="new-it-name" class="form-input" placeholder="CUSTOM_PROJECT_SECRET">
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Nombre Visible (Display Name):</label>
              <input type="text" id="new-it-display" class="form-input" placeholder="Código Secreto de Proyecto">
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Categoría de Negocio:</label>
              <select id="new-it-category" class="form-input">
                <option value="PII Datos Personales" selected>PII (Datos Personales)</option>
                <option value="Financiero (PCI/Cuentas)">Financiero (PCI / Cuentas)</option>
                <option value="Identidad Gubernamental">Identidad Gubernamental (DNI/NIT/RFC)</option>
                <option value="Salud (PHI/Médico)">Salud (PHI / Médico)</option>
                <option value="Comercial / Confidencial">Comercial / Confidencial (Secretos)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Patrón / Criterio de Regla:</label>
              <select id="new-it-type" class="form-input" onchange="toggleRuleInputType(this.value)">
                <option value="REGEX">Expresión Regular (Regex)</option>
                <option value="DICTIONARY">Diccionario de Palabras / Frases</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Nivel de Sensibilidad / Riesgo:</label>
              <select id="new-it-sensitivity" class="form-input">
                <option value="CRITICAL">CRITICAL (Crítica - Tarjetas/Claves)</option>
                <option value="HIGH" selected>HIGH (Alta - PII Identificable)</option>
                <option value="MODERATE">MODERATE (Moderada - Interno)</option>
                <option value="LOW">LOW (Baja - Datos Públicos)</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Acción de Protección Requerida:</label>
              <select id="new-it-action" class="form-input">
                <option value="DYNAMIC_MASKING" selected>Dynamic Data Masking (Enmascarar ej: EMP-*****)</option>
                <option value="TOKENIZATION">Tokenización Crypto (Token Hash)</option>
                <option value="FULL_REDACTION">Redacción Completa ([REDACTADO])</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Probabilidad (Likelihood):</label>
              <select id="new-it-likelihood" class="form-input">
                <option value="VERY_LIKELY">VERY_LIKELY (Muy Probable)</option>
                <option value="LIKELY" selected>LIKELY (Probable)</option>
                <option value="POSSIBLE">POSSIBLE (Posible)</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 0.85rem;" id="box-regex-input">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Patrón Regex de Criterio:</label>
            <input type="text" id="new-it-regex" class="form-input" placeholder="\\bEMP-[0-9]{5,6}\\b">
          </div>

          <div style="margin-bottom: 0.85rem; display: none;" id="box-dict-input">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Palabras del Diccionario de Criterio (separadas por comas):</label>
            <input type="text" id="new-it-words" class="form-input" placeholder="Proyecto Titan, AlphaSecret, Algoritmo Quasar">
          </div>

          <div style="margin-bottom: 0.85rem;">
            <label style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 0.2rem;">Hotwords de Proximidad (Palabras clave adyacentes en columnas/encabezados):</label>
            <input type="text" id="new-it-hotwords" class="form-input" placeholder="empleado, código, payroll, secreto">
          </div>

          <!-- Sandbox de prueba interactivo -->
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-main);">🧪 Sandbox de Prueba en Tiempo Real (Validador de InfoType)</div>
              <span class="stat-metric-badge badge-blue">Verificación en Vivo</span>
            </div>
            <textarea id="sandbox-test-text" class="form-input" rows="2" placeholder="Escribe aquí un texto de prueba del cliente para verificar si el InfoType realmente funciona (ej. 'El colaborador con código EMP-98234 procesó la nómina')"></textarea>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <button class="btn-primary" style="font-size: 0.78rem;" onclick="testCustomInfoTypeSandbox()">
                🧪 Probar si Funciona el InfoType
              </button>
              <div id="sandbox-test-result" style="font-size: 0.75rem; color: var(--text-muted);">
                Listo para probar.
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="btn-secondary" onclick="toggleCustomInfoTypeForm()">Cancelar</button>
            <button class="btn-primary" onclick="submitCreateCustomInfoType()">💾 Guardar Custom InfoType</button>
          </div>
        </div>

        <!-- Lista de Custom InfoTypes Creados -->
        <h4 style="font-size: 0.9rem; font-weight: 700; color: var(--text-main); margin-top: 0.5rem;">InfoTypes Personalizados Registrados</h4>
        <div style="overflow-x: auto;">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Nombre InfoType</th>
                <th>Categoría</th>
                <th>Criterio de Regla</th>
                <th>Sensibilidad & Acción</th>
                <th>Probabilidad</th>
                <th>Creado Por</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${customRows.length > 0 ? customRows : '<tr><td colspan="7" style="text-align:center; color:#94a3b8;">No has creado Custom InfoTypes aún. Haz clic en "Crear mi Propio InfoType".</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>


      <!-- SECCIÓN B: INSPECT JOBS & JOB TRIGGERS (FILTRADOS POR FUENTE) -->
      <div style="display: grid; grid-template-columns: 1fr; gap: 1.5rem;">
        
        <!-- 2. Inspect Jobs History Filtrado -->
        <div class="sdp-section-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                2. Inspect Jobs On-Demand — Fuente: <span style="color: var(--pastel-blue-accent);">${activeSourceLabel}</span>
              </h3>
              <p style="font-size: 0.75rem; color: var(--text-muted);">
                Historial de escaneos y hallazgos ejecutados sobre activos de ${activeSourceLabel}.
              </p>
            </div>
            <button class="btn-primary" style="font-size: 0.8rem;" onclick="openCreateInspectJobModal()">
              ➕ Lanzar Inspect Job (${activeSourceLabel})
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table class="table-clean">
              <thead>
                <tr>
                  <th>Nombre del Job</th>
                  <th>Tabla Objetivo</th>
                  <th>Estado</th>
                  <th>Volumen</th>
                  <th>Hallazgos</th>
                  <th>Fecha</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                ${jobsRows}
              </tbody>
            </table>
          </div>
        </div>

        <!-- 3. Job Triggers Filtrado -->
        <div class="sdp-section-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">
                3. Job Triggers (Disparadores Automáticos) — Fuente: <span style="color: var(--pastel-blue-accent);">${activeSourceLabel}</span>
              </h3>
              <p style="font-size: 0.75rem; color: var(--text-muted);">
                Automatiza inspecciones continuas por cronograma o eventos en tablas de ${activeSourceLabel}.
              </p>
            </div>
            <button class="btn-primary" style="font-size: 0.8rem;" onclick="openCreateTriggerModal()">
              ⏰ Nuevo Trigger (${activeSourceLabel})
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table class="table-clean">
              <thead>
                <tr>
                  <th>Nombre del Disparador</th>
                  <th>Frecuencia</th>
                  <th>Tabla Objetivo</th>
                  <th>Estado</th>
                  <th>Última Ejecución</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${triggersRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

function toggleCustomInfoTypeForm() {
  const box = document.getElementById("custom-infotype-create-box");
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
  }
}

function toggleRuleInputType(type) {
  const regexBox = document.getElementById("box-regex-input");
  const dictBox = document.getElementById("box-dict-input");
  if (type === "REGEX") {
    if (regexBox) regexBox.style.display = "block";
    if (dictBox) dictBox.style.display = "none";
  } else {
    if (regexBox) regexBox.style.display = "none";
    if (dictBox) dictBox.style.display = "block";
  }
}

async function testCustomInfoTypeSandbox() {
  const type = document.getElementById("new-it-type")?.value || "REGEX";
  const regex = document.getElementById("new-it-regex")?.value || "";
  const wordsStr = document.getElementById("new-it-words")?.value || "";
  const text = document.getElementById("sandbox-test-text")?.value || "";
  const hwStr = document.getElementById("new-it-hotwords")?.value || "";
  const action = document.getElementById("new-it-action")?.value || "DYNAMIC_MASKING";
  const resEl = document.getElementById("sandbox-test-result");

  const words = wordsStr.split(",").map(w => w.trim()).filter(Boolean);
  const hotwords = hwStr.split(",").map(h => h.trim()).filter(Boolean);

  if (!text) {
    if (resEl) resEl.innerHTML = `<span style="color: #e11d48; font-weight: 600;">⚠️ Ingresa un texto de muestra primero.</span>`;
    return;
  }

  if (resEl) resEl.innerHTML = `<span style="color: var(--pastel-blue-text);">⏳ Probando regla contra muestra...</span>`;

  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: type,
        regex_pattern: regex,
        dictionary_words: words,
        sample_text: text,
        hotwords: hotwords,
        protection_action: action
      })
    });
    const data = await res.json();
    if (data.status === "success") {
      if (data.matches_found > 0) {
        const matchesSample = data.matches.map(m => `<code style="background:#e0f2fe; color:#0369a1; padding:0.1rem 0.35rem; border-radius:3px;">${escapeHtml(m.value)}</code>`).join(", ");
        const maskedOutput = escapeHtml(data.masked_sample || text);

        if (resEl) resEl.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 0.6rem 0.85rem; margin-top: 0.4rem;">
            <div style="color: #166534; font-weight: 700; margin-bottom: 0.25rem;">
              🟢 ¡FUNCIONAL! ${data.matches_found} Coincidencia(s) Detectada(s) (${data.estimated_likelihood})
            </div>
            <div style="font-size: 0.75rem; color: #15803d; margin-bottom: 0.3rem;">
              Valores encontrados: ${matchesSample}
            </div>
            <div style="font-size: 0.75rem; color: #1e293b; background: #ffffff; padding: 0.4rem; border-radius: 4px; border: 1px solid #cbd5e1;">
              <strong>🛡️ Resultado Protegido (${escapeHtml(action)}):</strong> <br>
              <em style="font-family: monospace; color: #0284c7;">"${maskedOutput}"</em>
            </div>
          </div>
        `;
      } else {
        if (resEl) resEl.innerHTML = `
          <div style="background: #fffbebf1; border: 1px solid #fde68a; border-radius: 6px; padding: 0.5rem 0.75rem; margin-top: 0.4rem;">
            <span style="color: #b45309; font-weight:700;">🔴 SIN COINCIDENCIAS (0 matches)</span>
            <div style="font-size: 0.72rem; color: #78350f; margin-top: 0.15rem;">
              El texto de muestra no cumple el patrón de regla Regex/Diccionario configurado. Revisa la sintaxis o agrega el término a las palabras clave.
            </div>
          </div>
        `;
      }
    } else {
      if (resEl) resEl.innerHTML = `<span style="color: #e11d48; font-weight: 600;">❌ Error: ${escapeHtml(data.message)}</span>`;
    }
  } catch (err) {
    if (resEl) resEl.innerHTML = `<span style="color: #e11d48; font-weight: 600;">Error de red al ejecutar prueba.</span>`;
  }
}

async function submitCreateCustomInfoType() {
  const name = document.getElementById("new-it-name")?.value || "";
  const display = document.getElementById("new-it-display")?.value || "";
  const category = document.getElementById("new-it-category")?.value || "PII Datos Personales";
  const type = document.getElementById("new-it-type")?.value || "REGEX";
  const sensitivity = document.getElementById("new-it-sensitivity")?.value || "HIGH";
  const action = document.getElementById("new-it-action")?.value || "DYNAMIC_MASKING";
  const regex = document.getElementById("new-it-regex")?.value || "";
  const wordsStr = document.getElementById("new-it-words")?.value || "";
  const likelihood = document.getElementById("new-it-likelihood")?.value || "LIKELY";
  const hwStr = document.getElementById("new-it-hotwords")?.value || "";

  if (!name.trim()) {
    showToast("Ingresa un nombre técnico para el InfoType", "error");
    return;
  }

  const words = wordsStr.split(",").map(w => w.trim()).filter(Boolean);
  const hotwords = hwStr.split(",").map(h => h.trim()).filter(Boolean);
  const user = getActiveRoleProfile();

  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        display_name: display,
        category: category,
        type: type,
        sensitivity_level: sensitivity,
        protection_action: action,
        regex_pattern: regex,
        dictionary_words: words,
        likelihood: likelihood,
        hotwords: hotwords,
        created_by: user.user_name || user.name
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message, "success");
      toggleCustomInfoTypeForm();
      await loadAllSDPData();
      renderActiveSDPSubtab();
    } else {
      showToast(data.detail || "Error al crear InfoType", "error");
    }
  } catch (err) {
    showToast("Error de conexión al crear InfoType", "error");
  }
}

function sampleValueForRegex(name, regex) {
  const n = (name || "").toUpperCase();
  const r = (regex || "").toUpperCase();

  if (n.includes("CORREO") || n.includes("EMAIL") || r.includes("@") || r.includes("MAIL")) return "usuario.cliente@empresa.com";
  if (n.includes("EMPLOYEE") || n.includes("EMPLEADO") || r.includes("EMP-")) return "EMP-98234";
  if (n.includes("VAULT") || n.includes("FINANCIAL") || r.includes("VAULT-")) return "VAULT-REF-A98B7C12";
  if (n.includes("RUT") || r.includes("RUT")) return "12.345.678-K";
  if (n.includes("DNI") || r.includes("DNI")) return "76543210";
  if (n.includes("PHONE") || n.includes("TELEFONO") || r.includes("PHONE")) return "+56 9 8765 4321";
  if (r.includes("[0-9]") || r.includes("\\D") || r.includes("\\D+")) return "EMP-98234";
  return "VAL-894120";
}

function openTestModalForCustom(id) {
  const custom = sdpState.customInfotypes || [];
  const found = custom.find(c => c.id === id || c.name === id || (c.name && c.name.toLowerCase() === String(id).toLowerCase()));
  if (!found) {
    showToast("InfoType no encontrado para probar.", "error");
    return;
  }

  let modalEl = document.getElementById("infotype-test-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "infotype-test-modal";
    document.body.appendChild(modalEl);
  }

  modalEl.style.position = "fixed";
  modalEl.style.inset = "0";
  modalEl.style.background = "rgba(15, 23, 42, 0.65)";
  modalEl.style.backdropFilter = "blur(4px)";
  modalEl.style.display = "flex";
  modalEl.style.alignItems = "center";
  modalEl.style.justifyContent = "center";
  modalEl.style.zIndex = "9999";

  const sampleDefault = found.type === "REGEX"
    ? `Muestra de prueba para ${found.display_name}: se procesó la transacción con código ${sampleValueForRegex(found.name, found.regex_pattern)} en el sistema de nómina.`
    : `En esta nota confidencial se menciona el término ${(found.dictionary_words || ['Proyecto Titan'])[0]} como dato sensible.`;

  const regexVal = found.regex_pattern || (found.dictionary_words || []).join(", ");
  const hotwordsVal = (found.hotwords || []).join(", ");

  modalEl.innerHTML = `
    <div class="pastel-card" style="max-width: 680px; width: 92%; max-height: 90vh; overflow-y: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0;">
            🧪 Probador en Vivo de Expresión Regular (Cloud DLP)
          </h3>
          <div style="font-size: 0.78rem; color: var(--pastel-blue-text); font-family: monospace; font-weight: 600; margin-top: 0.2rem;">
            ${escapeHtml(found.display_name)} &nbsp;<span style="color: var(--text-muted);">(${escapeHtml(found.name)})</span>
          </div>
        </div>
        <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);" onclick="closeInfoTypeTestModal()">&times;</button>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 0.9rem;">
        <!-- Metadata summary pills -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; background: var(--pastel-blue-bg); border: 1px solid var(--pastel-blue-border); padding: 0.65rem 0.85rem; border-radius: 8px; font-size: 0.75rem;">
          <div><strong>Tipo de Regla:</strong> <span class="stat-metric-badge badge-purple">${escapeHtml(found.type)}</span></div>
          <div><strong>Categoría:</strong> <span class="stat-metric-badge badge-blue">${escapeHtml(found.category || 'PII')}</span></div>
          <div><strong>Nivel Sensibilidad:</strong> <span class="stat-metric-badge badge-amber">${escapeHtml(found.sensitivity_level || 'HIGH')}</span></div>
          <div><strong>Acción DLP:</strong> <span class="stat-metric-badge badge-emerald">${escapeHtml(found.protection_action || 'DYNAMIC_MASKING')}</span></div>
        </div>

        <!-- Editable Regex Pattern -->
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.25rem;">
            🔤 Regla / Patrón de Expresión Regular (REGEX) Configurado:
          </label>
          <input type="text" id="modal-test-regex-input" class="form-input" style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #0284c7; background: #f0f9ff; border: 1px solid #7dd3fc; width: 100%; font-weight: 600;" value="${escapeHtml(regexVal)}" placeholder="ej. \\bEMP-[0-9]{5,6}\\b">
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.2rem;">Puedes editar el patrón Regex directamente aquí para probar diferentes sintaxis antes de guardar.</div>
        </div>

        <!-- Editable Hotwords -->
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.25rem;">
            🏷️ Hotwords de Proximidad Adyacentes (Opcional):
          </label>
          <input type="text" id="modal-test-hotwords-input" class="form-input" style="font-size: 0.8rem; width: 100%;" value="${escapeHtml(hotwordsVal)}" placeholder="empleado, código, payroll, secreto">
        </div>

        <!-- Customer Sample Text Area -->
        <div>
          <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-main); display: block; margin-bottom: 0.25rem;">
            ✍️ Muestra de Texto del Cliente para Probar Detección:
          </label>
          <textarea id="modal-test-sample-text" class="form-input" rows="3" style="font-size: 0.82rem; font-family: inherit; width: 100%;" placeholder="Ingresa aquí un texto de prueba del cliente...">${escapeHtml(sampleDefault)}</textarea>
        </div>

        <!-- Action buttons inside modal -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.2rem;">
          <button class="btn-primary" style="font-size: 0.82rem; padding: 0.45rem 1rem;" onclick="runModalLiveInfoTypeTest('${escapeHtml(found.id)}')">
            🧪 Ejecutar Verificación en Vivo
          </button>
          <button class="btn-secondary" style="font-size: 0.78rem;" onclick="updateCustomInfoTypeRegexFromModal('${escapeHtml(found.id)}')">
            💾 Guardar Nuevo Regex
          </button>
        </div>

        <!-- Results area -->
        <div id="modal-test-live-results" style="margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">Ejecutando verificación...</span>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
        <button class="btn-secondary" onclick="closeInfoTypeTestModal()">Cerrar Probador</button>
      </div>
    </div>
  `;

  runModalLiveInfoTypeTest(found.id);
}

function closeInfoTypeTestModal() {
  const modalEl = document.getElementById("infotype-test-modal");
  if (modalEl) modalEl.style.display = "none";
}

async function runModalLiveInfoTypeTest(id) {
  const custom = sdpState.customInfotypes || [];
  const found = custom.find(c => c.id === id || c.name === id || (c.name && c.name.toLowerCase() === String(id).toLowerCase()));
  const resContainer = document.getElementById("modal-test-live-results");
  const textVal = document.getElementById("modal-test-sample-text")?.value || "";
  const regexInputVal = document.getElementById("modal-test-regex-input")?.value || (found ? found.regex_pattern : "");
  const hotwordsInputVal = document.getElementById("modal-test-hotwords-input")?.value || "";

  if (!resContainer) return;
  if (!textVal.trim()) {
    resContainer.innerHTML = `<div style="color: #e11d48; font-size: 0.78rem; font-weight: 600;">⚠️ Ingresa un texto de prueba en el cuadro superior.</div>`;
    return;
  }

  resContainer.innerHTML = `<div style="font-size: 0.78rem; color: var(--pastel-blue-text);">⏳ Analizando coincidencia Regex con Cloud DLP Inspection Suite...</div>`;

  const hotwordsList = hotwordsInputVal ? hotwordsInputVal.split(",").map(h => h.trim()).filter(Boolean) : (found ? found.hotwords : []);

  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: found ? found.type : "REGEX",
        regex_pattern: regexInputVal,
        dictionary_words: found && found.type === "DICTIONARY" ? regexInputVal.split(",").map(w => w.trim()) : [],
        sample_text: textVal,
        hotwords: hotwordsList,
        protection_action: found ? (found.protection_action || "DYNAMIC_MASKING") : "DYNAMIC_MASKING"
      })
    });

    const data = await res.json();
    if (data.status === "success") {
      if (data.matches_found > 0) {
        const matchesSample = data.matches.map(m => `<code style="background:#e0f2fe; color:#0369a1; padding:0.15rem 0.4rem; border-radius:4px; font-weight:700;">${escapeHtml(m.value)}</code>`).join(", ");
        const maskedOutput = escapeHtml(data.masked_sample || textVal);
        const actionLabel = found ? (found.protection_action || "DYNAMIC_MASKING") : "DYNAMIC_MASKING";

        resContainer.innerHTML = `
          <div style="background: var(--pastel-emerald-bg); border: 1px solid var(--pastel-emerald-border); border-radius: 8px; padding: 0.85rem;">
            <div style="color: var(--pastel-emerald-text); font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem;">
              🟢 ¡EXPRESIÓN REGULAR FUNCIONAL! ${data.matches_found} Coincidencia(s) Detectada(s)
            </div>
            <div style="font-size: 0.78rem; color: var(--pastel-emerald-text); margin-bottom: 0.45rem;">
              <strong>Valores PII Coincidentes:</strong> ${matchesSample}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-main); background: #ffffff; padding: 0.6rem 0.75rem; border-radius: 6px; border: 1px solid var(--pastel-blue-border);">
              <strong style="color: var(--pastel-blue-text);">🛡️ Resultado Protegido / Enmascarado (${escapeHtml(actionLabel)}):</strong> <br>
              <em style="font-family: 'JetBrains Mono', monospace; color: #0284c7; display: block; margin-top: 0.25rem;">"${maskedOutput}"</em>
            </div>
          </div>
        `;
      } else {
        resContainer.innerHTML = `
          <div style="background: var(--pastel-amber-bg); border: 1px solid var(--pastel-amber-border); border-radius: 8px; padding: 0.85rem;">
            <span style="color: var(--pastel-amber-text); font-weight:700; font-size: 0.85rem;">🔴 SIN COINCIDENCIAS (0 matches)</span>
            <div style="font-size: 0.76rem; color: var(--pastel-amber-text); margin-top: 0.25rem;">
              El texto ingresado no coincide con el patrón Regex <code>${escapeHtml(regexInputVal)}</code>. Intenta ajustar el patrón o el texto de muestra.
            </div>
          </div>
        `;
      }
    } else {
      resContainer.innerHTML = `<div style="color: #e11d48; font-size: 0.78rem; background: #ffe4e6; padding: 0.6rem; border-radius: 6px;">❌ Error de Expresión Regular: ${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    resContainer.innerHTML = `<div style="color: #e11d48; font-size: 0.78rem;">Error de conexión al probar InfoType.</div>`;
  }
}

async function updateCustomInfoTypeRegexFromModal(id) {
  const custom = sdpState.customInfotypes || [];
  const found = custom.find(c => c.id === id || c.name === id);
  if (!found) return;

  const newRegex = document.getElementById("modal-test-regex-input")?.value.trim();
  const newHotwordsText = document.getElementById("modal-test-hotwords-input")?.value.trim();
  const newHotwords = newHotwordsText ? newHotwordsText.split(",").map(h => h.trim()).filter(Boolean) : [];

  if (!newRegex) {
    showToast("Por favor ingresa una expresión regular válida.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/${found.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        regex_pattern: newRegex,
        hotwords: newHotwords
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(`Patrón Regex actualizado para '${found.display_name}'`, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    } else {
      showToast(data.detail || "Error al guardar Regex", "error");
    }
  } catch (err) {
    showToast("Error de conexión al guardar Regex", "error");
  }
}

function openEditModalForCustom(id) {
  const custom = sdpState.customInfotypes || [];
  const found = custom.find(c => c.id === id || c.name === id || (c.name && c.name.toLowerCase() === String(id).toLowerCase()));
  if (!found) {
    showToast("InfoType no encontrado para editar.", "error");
    return;
  }

  let modalEl = document.getElementById("infotype-edit-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "infotype-edit-modal";
    document.body.appendChild(modalEl);
  }

  modalEl.style.position = "fixed";
  modalEl.style.inset = "0";
  modalEl.style.background = "rgba(15, 23, 42, 0.65)";
  modalEl.style.backdropFilter = "blur(4px)";
  modalEl.style.display = "flex";
  modalEl.style.alignItems = "center";
  modalEl.style.justifyContent = "center";
  modalEl.style.zIndex = "9999";

  modalEl.innerHTML = `
    <div class="pastel-card" style="max-width: 680px; width: 92%; max-height: 90vh; overflow-y: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
        <div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0;">
            ✏️ Editar Custom InfoType
          </h3>
          <div style="font-size: 0.78rem; color: var(--pastel-blue-text); font-family: monospace; font-weight: 600; margin-top: 0.2rem;">
            ${escapeHtml(found.display_name)} &nbsp;<span style="color: var(--text-muted);">(${escapeHtml(found.name)})</span>
          </div>
        </div>
        <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);" onclick="closeInfoTypeEditModal()">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.9rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Nombre Visible (Display Name):</label>
            <input type="text" id="edit-it-display" class="form-input" style="width: 100%;" value="${escapeHtml(found.display_name)}">
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Categoría:</label>
            <input type="text" id="edit-it-category" class="form-input" style="width: 100%;" value="${escapeHtml(found.category || 'PII Financiera')}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Sensibilidad / Riesgo:</label>
            <select id="edit-it-sensitivity" class="form-input" style="width: 100%;">
              <option value="CRITICAL" ${found.sensitivity_level === 'CRITICAL' ? 'selected' : ''}>CRITICAL (Crítica - Tarjetas/Bancos)</option>
              <option value="HIGH" ${found.sensitivity_level === 'HIGH' ? 'selected' : ''}>HIGH (Alta - PII Identificable)</option>
              <option value="MODERATE" ${found.sensitivity_level === 'MODERATE' ? 'selected' : ''}>MODERATE (Moderada - Interno)</option>
              <option value="LOW" ${found.sensitivity_level === 'LOW' ? 'selected' : ''}>LOW (Baja - Datos Públicos)</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Acción de Protección:</label>
            <select id="edit-it-action" class="form-input" style="width: 100%;">
              <option value="DYNAMIC_MASKING" ${found.protection_action === 'DYNAMIC_MASKING' ? 'selected' : ''}>Dynamic Data Masking (Enmascarar)</option>
              <option value="TOKENIZATION" ${found.protection_action === 'TOKENIZATION' ? 'selected' : ''}>Tokenización Crypto (Hash)</option>
              <option value="FULL_REDACTION" ${found.protection_action === 'FULL_REDACTION' ? 'selected' : ''}>Redacción Completa ([REDACTADO])</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Probabilidad (Likelihood):</label>
            <select id="edit-it-likelihood" class="form-input" style="width: 100%;">
              <option value="VERY_LIKELY" ${found.likelihood === 'VERY_LIKELY' ? 'selected' : ''}>VERY_LIKELY (Muy Probable)</option>
              <option value="LIKELY" ${found.likelihood === 'LIKELY' ? 'selected' : ''}>LIKELY (Probable)</option>
              <option value="POSSIBLE" ${found.likelihood === 'POSSIBLE' ? 'selected' : ''}>POSSIBLE (Posible)</option>
            </select>
          </div>
        </div>

        <div>
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Expresión Regular (REGEX) o Términos:</label>
          <input type="text" id="edit-it-regex" class="form-input" style="font-family: 'JetBrains Mono', monospace; font-size: 0.82rem; color: #0284c7; background: #f0f9ff; border: 1px solid #7dd3fc; width: 100%; font-weight: 600;" value="${escapeHtml(found.regex_pattern || (found.dictionary_words || []).join(', '))}">
        </div>

        <div>
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Hotwords de Proximidad Adyacentes (separadas por coma):</label>
          <input type="text" id="edit-it-hotwords" class="form-input" style="font-size: 0.8rem; width: 100%;" value="${escapeHtml((found.hotwords || []).join(', '))}">
        </div>

        <div>
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Descripción:</label>
          <input type="text" id="edit-it-description" class="form-input" style="font-size: 0.8rem; width: 100%;" value="${escapeHtml(found.description || '')}">
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
        <button class="btn-secondary" onclick="closeInfoTypeEditModal()">Cancelar</button>
        <button class="btn-primary" onclick="submitEditCustomInfoType('${escapeHtml(found.id)}')">💾 Guardar Cambios</button>
      </div>
    </div>
  `;
}

function closeInfoTypeEditModal() {
  const modalEl = document.getElementById("infotype-edit-modal");
  if (modalEl) modalEl.style.display = "none";
}

async function submitEditCustomInfoType(id) {
  const display = document.getElementById("edit-it-display")?.value.trim();
  const category = document.getElementById("edit-it-category")?.value.trim();
  const sensitivity = document.getElementById("edit-it-sensitivity")?.value;
  const action = document.getElementById("edit-it-action")?.value;
  const likelihood = document.getElementById("edit-it-likelihood")?.value;
  const regex = document.getElementById("edit-it-regex")?.value.trim();
  const hotwordsStr = document.getElementById("edit-it-hotwords")?.value.trim() || "";
  const description = document.getElementById("edit-it-description")?.value.trim();

  const hotwords = hotwordsStr ? hotwordsStr.split(",").map(h => h.trim()).filter(Boolean) : [];

  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: display,
        category: category,
        sensitivity_level: sensitivity,
        protection_action: action,
        likelihood: likelihood,
        regex_pattern: regex,
        hotwords: hotwords,
        description: description
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || "InfoType actualizado correctamente", "success");
      closeInfoTypeEditModal();
      await loadAllSDPData();
      renderActiveSDPSubtab();
    } else {
      showToast(data.detail || "Error al actualizar InfoType", "error");
    }
  } catch (err) {
    showToast("Error de conexión al actualizar InfoType", "error");
  }
}



async function deleteCustomInfoType(id) {
  if (!confirm("¿Deseas eliminar este Custom InfoType?")) return;
  try {
    const res = await fetch(`${API_BASE}/api/sdp/infotypes/custom/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al eliminar InfoType", "error");
  }
}

async function toggleTriggerStatus(triggerId) {
  try {
    const res = await fetch(`${API_BASE}/api/sdp/inspect/triggers/${triggerId}/toggle`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(`Trigger cambiado a: ${data.new_status}`, "info");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al cambiar estado del trigger", "error");
  }
}

async function runTriggerNow(triggerId) {
  showToast("Ejecutando Job Trigger bajo demanda...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/inspect/triggers/${triggerId}/run_now`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al ejecutar trigger", "error");
  }
}

function openCreateInspectJobModal() {
  const filteredProfiles = getFilteredDiscoveryProfiles();
  if (filteredProfiles.length === 0) {
    showToast("No hay activos disponibles para la fuente seleccionada.", "error");
    return;
  }

  const activeSrc = sdpState.discoveryFilterSource || "ALL";
  const defaultAsset = filteredProfiles[0];
  const optionsHtml = filteredProfiles.map(p => `
    <option value="${p.asset_id}">[${p.cloud}] ${p.name} (${p.service})</option>
  `).join("");

  const modalHtml = `
    <div id="sdp-job-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px);">
      <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; max-width: 520px; width: 90%; box-shadow: var(--shadow-card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">➕ Lanzar Inspect Job On-Demand</h3>
          <button onclick="closeSDPModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;">
          <div>
            <label class="form-label">Nombre del Job:</label>
            <input type="text" id="modal-job-name" class="form-input" value="Inspección On-Demand SDP (${activeSrc.toUpperCase()})">
          </div>
          <div>
            <label class="form-label">Tabla / Activo Objetivo (${filteredProfiles.length} disponibles en ${activeSrc.toUpperCase()}):</label>
            <select id="modal-job-asset" class="form-input">
              ${optionsHtml}
            </select>
          </div>
          <div>
            <label class="form-label">Umbral Mínimo de Probabilidad (Likelihood):</label>
            <select id="modal-job-likelihood" class="form-input">
              <option value="VERY_LIKELY">VERY_LIKELY (Muy Probable)</option>
              <option value="LIKELY" selected>LIKELY (Probable)</option>
              <option value="POSSIBLE">POSSIBLE (Posible)</option>
            </select>
          </div>
          <div>
            <label class="form-label">Muestreo de Filas (%):</label>
            <input type="number" id="modal-job-sampling" class="form-input" value="100" min="10" max="100">
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button class="btn-secondary" onclick="closeSDPModal()">Cancelar</button>
          <button class="btn-primary" onclick="submitCreateInspectJobFromModal()">🚀 Ejecutar Inspección</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

function closeSDPModal() {
  const modal = document.getElementById("sdp-job-modal-backdrop");
  if (modal) modal.remove();
}

async function submitCreateInspectJobFromModal() {
  const name = document.getElementById("modal-job-name")?.value || "Inspect Job SDP";
  const assetId = document.getElementById("modal-job-asset")?.value;
  const likelihood = document.getElementById("modal-job-likelihood")?.value || "LIKELY";
  const sampling = parseInt(document.getElementById("modal-job-sampling")?.value || "100", 10);

  if (!assetId) {
    showToast("Selecciona un activo válido", "error");
    return;
  }

  closeSDPModal();
  showToast(`Iniciando Inspect Job para ${assetId}...`, "info");
  const user = getActiveRoleProfile();

  try {
    const res = await fetch(`${API_BASE}/api/sdp/inspect/jobs/create_and_run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        target_asset_id: assetId,
        infotypes_selected: ["EMAIL_ADDRESS", "PERSON_NAME", "PHONE_NUMBER", "CREDIT_CARD_NUMBER", "CUSTOM_EMPLOYEE_ID"],
        min_likelihood: likelihood,
        sampling_pct: sampling,
        auto_apply_tags: true,
        created_by: user.user_name || user.name
      })
    });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al ejecutar Inspect Job", "error");
  }
}

function openCreateTriggerModal() {
  const filteredProfiles = getFilteredDiscoveryProfiles();
  if (filteredProfiles.length === 0) {
    showToast("No hay activos disponibles para la fuente seleccionada.", "error");
    return;
  }

  const activeSrc = sdpState.discoveryFilterSource || "ALL";
  const optionsHtml = filteredProfiles.map(p => `
    <option value="${p.asset_id}">[${p.cloud}] ${p.name} (${p.service})</option>
  `).join("");

  const modalHtml = `
    <div id="sdp-job-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px);">
      <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; max-width: 520px; width: 90%; box-shadow: var(--shadow-card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">⏰ Programar Nuevo Job Trigger</h3>
          <button onclick="closeSDPModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;">
          <div>
            <label class="form-label">Nombre del Trigger:</label>
            <input type="text" id="modal-trig-name" class="form-input" value="Disparador Periódico SDP - ${activeSrc.toUpperCase()}">
          </div>
          <div>
            <label class="form-label">Tabla Objetivo (${filteredProfiles.length} disponibles en ${activeSrc.toUpperCase()}):</label>
            <select id="modal-trig-asset" class="form-input">
              ${optionsHtml}
            </select>
          </div>
          <div>
            <label class="form-label">Frecuencia / Cronograma:</label>
            <select id="modal-trig-schedule" class="form-input">
              <option value="Todos los días a las 02:00 UTC">Todos los días a las 02:00 UTC (Cron: 0 2 * * *)</option>
              <option value="Lunes a las 04:00 UTC">Semanal: Lunes a las 04:00 UTC (Cron: 0 4 * * 1)</option>
              <option value="En cada evento de modificación">Event-Driven: En cada inserción / cambio</option>
            </select>
          </div>
          <div>
            <label class="form-label">Plantilla de Inspección:</label>
            <select id="modal-trig-template" class="form-input">
              <option value="tmpl_pii_latam_standard">Plantilla Estándar PII Latinoamérica</option>
              <option value="tmpl_pci_financial_strict">Plantilla Estricta PCI-DSS & Financiero</option>
              <option value="tmpl_secops_credentials_leak">Plantilla SecOps Fuga de Credenciales</option>
            </select>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
          <button class="btn-secondary" onclick="closeSDPModal()">Cancelar</button>
          <button class="btn-primary" onclick="submitCreateTriggerFromModal()">💾 Guardar & Activar Trigger</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

async function submitCreateTriggerFromModal() {
  const name = document.getElementById("modal-trig-name")?.value || "Job Trigger SDP";
  const assetId = document.getElementById("modal-trig-asset")?.value;
  const schedule = document.getElementById("modal-trig-schedule")?.value || "Todos los días a las 02:00 UTC";
  const templateId = document.getElementById("modal-trig-template")?.value || "tmpl_pii_latam_standard";

  if (!assetId) {
    showToast("Selecciona un activo válido", "error");
    return;
  }

  closeSDPModal();
  const user = getActiveRoleProfile();

  try {
    const res = await fetch(`${API_BASE}/api/sdp/inspect/triggers/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name,
        description: `Inspección automática continua para ${assetId}`,
        schedule: schedule,
        target_asset_id: assetId,
        template_id: templateId,
        created_by: user.user_name || user.name
      })
    });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al crear Trigger", "error");
  }
}

function viewJobFindingsModal(jobId) {
  const job = (sdpState.inspectJobs || []).find(j => j.job_id === jobId);
  if (!job) return;

  const findingsList = (job.findings_breakdown || []).map(f => `
    <tr>
      <td><strong>${escapeHtml(f.column)}</strong></td>
      <td><span class="sdp-infotype-tag">${escapeHtml(f.infotype)}</span></td>
      <td>${(f.count || 0).toLocaleString()}</td>
      <td><span class="sdp-badge sdp-badge-low">${escapeHtml(f.likelihood)}</span></td>
    </tr>
  `).join("") || '<tr><td colspan="4" style="text-align:center; color:#94a3b8;">Sin hallazgos específicos registrados.</td></tr>';

  const modalHtml = `
    <div id="sdp-job-modal-backdrop" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(2px);">
      <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-lg); padding: 1.5rem; max-width: 600px; width: 90%; box-shadow: var(--shadow-card);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">🔍 Hallazgos: ${escapeHtml(job.name)}</h3>
          <button onclick="closeSDPModal()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: var(--text-muted);">✕</button>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.75rem;">
          Tabla: <strong>${escapeHtml(job.target_name)}</strong> | Filas Escaneadas: <strong>${(job.rows_scanned || 0).toLocaleString()}</strong> | Columnas PII: <strong>${job.findings_count}</strong>
        </p>

        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 1rem;">
          <table class="table-clean">
            <thead>
              <tr>
                <th>Columna</th>
                <th>InfoType</th>
                <th>Coincidencias</th>
                <th>Confianza</th>
              </tr>
            </thead>
            <tbody>
              ${findingsList}
            </tbody>
          </table>
        </div>

        <div style="background: var(--bg-app); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">
          <strong>Acciones Ejecutadas:</strong> ${escapeHtml(job.actions_executed?.join(' • ') || 'Auditoría completada.')}
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn-primary" onclick="closeSDPModal()">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", modalHtml);
}

// ============================================================================
// 3. SUBMÓDULO: RISK ANALYSIS (FILTRADO POR FUENTE & EXCLUSIVO BIGQUERY)
// ============================================================================
function renderSDPRiskAnalysis(container) {
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  const filteredProfiles = getFilteredDiscoveryProfiles();
  const allProfiles = sdpState.discoveryProfiles || [];

  // Find active selected asset
  let selectedProfile = filteredProfiles.find(p => p.asset_id === sdpState.selectedAssetId) || filteredProfiles[0] || allProfiles[0];
  if (selectedProfile && selectedProfile.asset_id !== sdpState.selectedAssetId) {
    sdpState.selectedAssetId = selectedProfile.asset_id;
  }

  const isBigQuery = selectedProfile && (
    selectedProfile.cloud === "GCP" && (selectedProfile.service === "BigQuery" || selectedProfile.resource_location?.includes("agentspace-demos-466121"))
  );

  const assetSelectorHtml = (filteredProfiles.length > 0 ? filteredProfiles : allProfiles).map(p => `
    <option value="${p.asset_id}" ${p.asset_id === selectedProfile?.asset_id ? 'selected' : ''}>
      [${p.cloud}] ${p.name} (${p.service})
    </option>
  `).join("");

  let mainBodyHtml = "";

  if (!isBigQuery) {
    // AVISO EXPLICATIVO SI LA FUENTE O ACTIVO NO ES BIGQUERY
    const currentSrcName = selectedProfile ? `${selectedProfile.cloud} (${selectedProfile.service})` : activeSource.toUpperCase();
    mainBodyHtml = `
      <div class="sdp-callout-warning" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 700; color: #b45309;">
          <span>⚠️</span>
          <span>Restricción de Arquitectura: Análisis Cuantitativo de Riesgo Exclusivo para BigQuery</span>
        </div>
        <p style="font-size: 0.84rem; color: #92400e; line-height: 1.5;">
          El módulo de <strong>Risk Analysis de Sensitive Data Protection</strong> (cálculo estadístico distribuido de <em>k-anonymity</em>, <em>l-diversity</em> y <em>delta-presence</em>) 
          está soportado nativamente por Google Cloud exclusivamente para conjuntos de datos almacenados en <strong>Google Cloud BigQuery</strong>.
          <br><br>
          La fuente activa seleccionada es <strong>${escapeHtml(currentSrcName)}</strong>. Tus tablas de ${escapeHtml(currentSrcName)} son descubiertas y protegidas con <strong>InfoTypes</strong> en los Pasos 1 y 2. Para calcular métricas de re-identificación sobre este activo, se recomienda sincronizarlo a BigQuery o seleccionar una tabla de BigQuery.
        </p>
        <div>
          <button class="btn-primary" onclick="setSDPGlobalSourceFilter('bigquery')">
            👉 Cambiar Fuente a BigQuery (dim_clientes_360)
          </button>
        </div>
      </div>
    `;
  } else {
    // RENDERIZAR MÉTRICAS DE RISK ANALYSIS PARA BIGQUERY
    mainBodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Controles de Quasi-Identifiers y Atributos Sensibles -->
        <div style="background: var(--bg-app); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Modelo de Riesgo Cuantitativo BigQuery</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Quasi-Identifiers: <code>full_name, phone_number, customer_segment</code> | Atributos Sensibles: <code>credit_card_hash, total_spend_ytd</code></div>
          </div>
          <button class="btn-primary" onclick="calculateRiskAnalysisForSelected()">
            ⚡ Recalcular Métricas SDP (BigQuery)
          </button>
        </div>

        <!-- Tarjetas de Métricas k-anonymity y l-diversity -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          
          <!-- k-anonymity Card -->
          <div class="sdp-section-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">MÉTRICA K-ANONYMITY</span>
              <span class="sdp-badge sdp-badge-mod">Requiere Generalización</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.25rem;">
              <span style="font-size: 2rem; font-weight: 800; color: var(--text-main);">k = 1</span>
              <span style="font-size: 0.8rem; color: #e11d48; font-weight: 700;">(385 registros únicos vulnerables)</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Existe un 0.25% de registros donde la combinación de quasi-identificadores identifica inequívocamente a una sola persona.
            </p>
            <div style="background: var(--bg-subtle); padding: 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">
              <strong>Clases de Equivalencia:</strong> 48,200 grupos formados
            </div>
          </div>

          <!-- l-diversity Card -->
          <div class="sdp-section-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">MÉTRICA L-DIVERSITY</span>
              <span class="sdp-badge sdp-badge-low">Diversidad Moderada</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.25rem;">
              <span style="font-size: 2rem; font-weight: 800; color: var(--pastel-emerald-text);">l = 1</span>
              <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">(Promedio 4.8 valores distintos)</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Atributo evaluado: <code>total_spend_ytd</code>. En el 1.2% de los grupos no hay diversidad de gasto.
            </p>
            <div style="background: var(--bg-subtle); padding: 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">
              <strong>Evaluación:</strong> Requiere mezclar con atributos no correlacionados
            </div>
          </div>

          <!-- Delta-presence / Re-identificación Card -->
          <div class="sdp-section-card" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted);">DELTA-PRESENCE / RE-IDENTIFICACIÓN</span>
              <span class="sdp-badge sdp-badge-mod">Riesgo Moderado</span>
            </div>
            <div style="display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.25rem;">
              <span style="font-size: 2rem; font-weight: 800; color: #d97706;">14.8%</span>
              <span style="font-size: 0.8rem; color: var(--text-muted);">probabilidad de re-identificación</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted);">
              Calculado frente a la base pública general de clientes del CRM corporativo.
            </p>
            <div style="background: var(--bg-subtle); padding: 0.5rem; border-radius: var(--radius-sm); font-size: 0.75rem;">
              <strong>Benchmark:</strong> Registro Nacional de Clientes
            </div>
          </div>
        </div>

        <!-- Tabla de Distribución de k-anonymity y Recomendaciones -->
        <div class="sdp-section-card">
          <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">Distribución de Clases de Equivalencia k-anonymity en BigQuery</h4>
          <table class="table-clean">
            <thead>
              <tr>
                <th>Rango de Tamaño (k)</th>
                <th>Registros</th>
                <th>Porcentaje</th>
                <th>Nivel de Exposición</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>k = 1 (Identificable Directo)</strong></td>
                <td>385</td>
                <td><span style="color:#e11d48; font-weight:700;">0.25%</span></td>
                <td><span class="sdp-badge sdp-badge-high">Crítico</span></td>
              </tr>
              <tr>
                <td><strong>k = 2 - 4 (Riesgo Significativo)</strong></td>
                <td>1,035</td>
                <td>0.67%</td>
                <td><span class="sdp-badge sdp-badge-mod">Medio</span></td>
              </tr>
              <tr>
                <td><strong>k = 5 - 19 (Moderadamente Anónimo)</strong></td>
                <td>18,500</td>
                <td>12.00%</td>
                <td><span class="sdp-badge sdp-badge-low">Bajo</span></td>
              </tr>
              <tr>
                <td><strong>k >= 20 (Altamente Protegido)</strong></td>
                <td>134,280</td>
                <td><span style="color:#166534; font-weight:700;">87.08%</span></td>
                <td><span class="sdp-badge sdp-badge-low">Mínimo</span></td>
              </tr>
            </tbody>
          </table>

          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; margin-top: 0.5rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">
              💡 Recomendaciones de Anonimización de Sensitive Data Protection:
            </div>
            <ul style="font-size: 0.8rem; color: var(--text-muted); display: flex; flex-direction: column; gap: 0.35rem; padding-left: 1.25rem;">
              <li><strong>Bucketization de Gasto / Edad:</strong> Agrupar <code>total_spend_ytd</code> en rangos ($0-$500, $501-$2000, >$2000) para elevar k-anonymity a k >= 5.</li>
              <li><strong>Dynamic Data Masking (DDM):</strong> Aplicar SHA-256 en <code>full_name</code> y <code>phone_number</code> en BigQuery.</li>
              <li><strong>Tokenización Determinística:</strong> Reemplazar UUIDs con claves Cloud KMS para preservar joins analíticos.</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <!-- Selector de Activo para Risk Analysis -->
      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <label style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">Seleccionar Tabla para Análisis de Riesgo:</label>
        <select class="form-input" style="min-width: 320px;" onchange="changeRiskAsset(this.value)">
          ${assetSelectorHtml}
        </select>
        <span class="stat-metric-badge badge-blue">● Motor Cuantitativo BigQuery</span>
      </div>

      ${mainBodyHtml}
    </div>
  `;
}

function changeRiskAsset(assetId) {
  sdpState.selectedAssetId = assetId;
  renderActiveSDPSubtab();
}

async function calculateRiskAnalysisForSelected() {
  showToast("Calculando métricas de k-anonymity y l-diversity en BigQuery...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/risk_analysis/evaluate/${sdpState.selectedAssetId}`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast("Métricas de Risk Analysis actualizadas con éxito", "success");
      renderActiveSDPSubtab();
    } else {
      showToast(data.detail || "Error calculando riesgo", "error");
    }
  } catch (err) {
    showToast("Error en Risk Analysis", "error");
  }
}

// ============================================================================
// 4. SUBMÓDULO: CONFIGURACIÓN & GOBERNANZA (FILTRADO POR FUENTE)
// ============================================================================
function renderSDPConfiguration(container) {
  const inspectTmpl = sdpState.inspectTemplates || [];
  const deidTmpl = sdpState.deidentifyTemplates || [];
  const activeSource = sdpState.discoveryFilterSource || "ALL";
  const filteredPolicies = getFilteredPolicies();

  const inspectTmplCards = inspectTmpl.map(t => `
    <div style="background: var(--bg-app); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">${escapeHtml(t.name)}</span>
        <span class="stat-metric-badge badge-blue">${escapeHtml(t.min_likelihood)}</span>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(t.description)}</div>
      <div style="margin-top: 0.25rem;">
        ${(t.infotypes || []).map(it => `<span class="sdp-infotype-tag">${escapeHtml(it)}</span>`).join("")}
      </div>
    </div>
  `).join("");

  const deidTmplCards = deidTmpl.map(d => `
    <div style="background: var(--bg-app); border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: var(--text-main); font-size: 0.88rem;">${escapeHtml(d.name)}</span>
        <span class="stat-metric-badge badge-purple">${escapeHtml(d.transformation_type)}</span>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(d.description)}</div>
      <div style="background: #ffffff; border: 1px solid var(--border-light); border-radius: 4px; padding: 0.5rem; font-size: 0.72rem; margin-top: 0.25rem;">
        <div>📥 Entrada: <code>${escapeHtml(d.sample_input)}</code></div>
        <div style="color: #166534; font-weight:600; margin-top: 0.15rem;">🔒 Salida: <code>${escapeHtml(d.sample_output)}</code></div>
      </div>
    </div>
  `).join("");

  const policyRows = filteredPolicies.length > 0 ? filteredPolicies.map(pol => {
    const isEn = pol.status === "ENABLED";
    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(pol.name)}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(pol.description)}</div>
        </td>
        <td>
          <span class="stat-metric-badge ${pol.severity === 'CRÍTICO' ? 'badge-rose' : 'badge-amber'}">${escapeHtml(pol.severity)}</span>
        </td>
        <td><span class="stat-metric-badge badge-blue">${escapeHtml(pol.cloud_scope)}</span></td>
        <td>
          <span class="sdp-badge ${isEn ? 'sdp-badge-low' : 'sdp-badge-mod'}">
            ${isEn ? '● ACTIVA' : 'DESACTIVADA'}
          </span>
        </td>
        <td><strong>${pol.compliance_rate_pct}%</strong> (${pol.enforced_count} ejecuciones)</td>
        <td>
          <button class="btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.75rem;" onclick="toggleContentPolicy('${pol.policy_id}')">
            ${isEn ? 'Desactivar' : 'Activar'}
          </button>
        </td>
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="6" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
        No hay políticas específicas para el filtro ${activeSource.toUpperCase()}. Mostrando reglas globales.
      </td>
    </tr>
  `;

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      <!-- Content Policies -->
      <div class="sdp-section-card">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">
              1. Content Policies de Sensitive Data Protection — Alcance: <span style="color: var(--pastel-blue-accent);">${activeSource.toUpperCase()}</span>
            </h3>
            <p style="font-size: 0.78rem; color: var(--text-muted);">Reglas automáticas de seguridad: auto-enmascaramiento en BigQuery, cuarentena en GCS, y control de salida en bases de datos externas.</p>
          </div>
          <button class="btn-primary" onclick="evaluateContentPoliciesNow()">
            ⚡ Evaluar Políticas Ahora
          </button>
        </div>

        <table class="table-clean">
          <thead>
            <tr>
              <th>Nombre de la Política</th>
              <th>Severidad</th>
              <th>Alcance</th>
              <th>Estado</th>
              <th>Cumplimiento</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            ${policyRows}
          </tbody>
        </table>
      </div>

      <!-- Plantillas de Inspección y Desidentificación -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        
        <!-- Inspect Templates -->
        <div class="sdp-section-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">2. Plantillas de Inspección (Inspect Templates)</h3>
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Configuraciones reutilizables de InfoTypes y umbrales de probabilidad.</p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${inspectTmplCards}
          </div>
        </div>

        <!-- De-identify Templates -->
        <div class="sdp-section-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main);">3. Plantillas de Desidentificación (De-identify)</h3>
          </div>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Reglas de enmascaramiento, hash SHA-256, tokenización reversible y date shifting.</p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${deidTmplCards}
          </div>
        </div>
      </div>
    </div>
  `;
}

async function toggleContentPolicy(policyId) {
  try {
    const res = await fetch(`${API_BASE}/api/sdp/policies/${policyId}/toggle`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(`Política cambiada a: ${data.new_status}`, "info");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al alternar política", "error");
  }
}

async function evaluateContentPoliciesNow() {
  showToast("Evaluando todas las Content Policies...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/sdp/policies/evaluate`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast(data.message, "success");
      await loadAllSDPData();
      renderActiveSDPSubtab();
    }
  } catch (err) {
    showToast("Error al evaluar políticas", "error");
  }
}

window.toggleCustomDatePickerPopover = toggleCustomDatePickerPopover;
window.navigateCalendarMonth = navigateCalendarMonth;
window.handleCalendarDayClick = handleCalendarDayClick;
window.applyCustomDatePreset = applyCustomDatePreset;
window.applyCustomDatePickerRange = applyCustomDatePickerRange;
window.clearCustomDatePickerRange = clearCustomDatePickerRange;
window.handleSDPDatePresetChange = handleSDPDatePresetChange;
window.updateSDPCustomDateFilter = updateSDPCustomDateFilter;
window.updateSDPFilter = updateSDPFilter;
window.resetSDPFilters = resetSDPFilters;
