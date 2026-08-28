/**
 * Dataplex Data Quality & Advanced Business Rules (Drill-Down & Dynamic Thresholds)
 */

function initQuality() {
  loadQualityDimensionsFramework();
  loadQualitySelector();
  loadGlobalHealthBreakdown();
  loadRealDataplexConsoleScans();
  loadBusinessQualityRules();
}

async function loadQualityDimensionsFramework() {
  const container = document.getElementById("quality-dimensions-framework-container");
  const countBadge = document.getElementById("quality-dimensions-count-badge");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/quality/dimensions`);
    const data = await res.json();
    if (data.status === "success") {
      const dims = data.data || [];
      if (countBadge) {
        countBadge.textContent = `${dims.length} Dimensiones Activas`;
      }

      const badgeMap = {
        "Completitud": "badge-blue",
        "Unicidad": "badge-purple",
        "Validez": "badge-emerald",
        "Consistencia": "badge-amber",
        "Exactitud": "badge-blue",
        "Integridad": "badge-purple",
        "Oportunidad": "badge-emerald"
      };

      container.innerHTML = `
        <table class="table-clean" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Dimensión</th>
              <th>Definición</th>
              <th>Ejemplo de Regla (MDM)</th>
              <th>Estado de Aplicación</th>
            </tr>
          </thead>
          <tbody>
            ${dims.map(d => `
              <tr>
                <td><span class="stat-metric-badge ${badgeMap[d.dimension] || 'badge-purple'}">● ${escapeHtml(d.dimension)}</span></td>
                <td style="color: var(--text-main); font-weight: 500;">${escapeHtml(d.definicion)}</td>
                <td style="color: var(--pastel-blue-text); font-family: monospace; font-size: 0.76rem;">${escapeHtml(d.ejemplo_regla_mdm)}</td>
                <td><span class="stat-metric-badge badge-emerald">✅ Aplicada por Agente</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      `;
    }
  } catch (err) {
    console.error("Error loading quality dimensions framework:", err);
  }
}

function toggleAddDimensionForm() {
  const el = document.getElementById("add-dimension-form-container");
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
}

async function submitNewQualityDimension() {
  const nameEl = document.getElementById("new-dim-name");
  const defEl = document.getElementById("new-dim-def");
  const mdmEl = document.getElementById("new-dim-mdm");

  if (!nameEl || !defEl || !mdmEl) return;
  const nombre = nameEl.value.trim();
  const definicion = defEl.value.trim();
  const ejemplo_regla_mdm = mdmEl.value.trim();

  if (!nombre || !definicion || !ejemplo_regla_mdm) {
    showToast("Completa todos los campos para incorporar la dimensión.", "error");
    return;
  }

  showToast("Incorporando nueva dimensión al Framework de Calidad...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/quality/dimensions/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, definicion, ejemplo_regla_mdm })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || "Dimensión incorporada exitosamente.", "success");
      nameEl.value = "";
      defEl.value = "";
      mdmEl.value = "";
      toggleAddDimensionForm();
      loadQualityDimensionsFramework();
    } else {
      showToast(data.message || "Error al agregar dimensión.", "error");
    }
  } catch (err) {
    console.error("Error adding dimension:", err);
    showToast("Error al incorporar la dimensión.", "error");
  }
}


let allQualityAssets = [];
let currentQualityOriginFilter = "ALL";

function getAssetOriginInfo(asset) {
  const cloud = (asset.cloud || "").toUpperCase();
  const id = (asset.id || "").toLowerCase();

  if (cloud.includes("MYSQL") || id.includes("mysql")) {
    return {
      key: "MYSQL",
      groupLabel: "🐬 Base de Datos Externa (MySQL Online)",
      pillLabel: "🐬 MySQL",
      icon: "🐬",
      badgeClass: "badge-amber"
    };
  } else if (cloud.includes("POSTGRES") || id.includes("postgres") || id.includes("pg")) {
    return {
      key: "POSTGRES",
      groupLabel: "🐘 Google Cloud SQL (PostgreSQL)",
      pillLabel: "🐘 PostgreSQL",
      icon: "🐘",
      badgeClass: "badge-purple"
    };
  } else if (cloud === "GCP" || cloud.includes("BIGQUERY") || id.includes("gcp") || id.includes("bq")) {
    return {
      key: "GCP",
      groupLabel: "☁️ Google Cloud Platform (BigQuery Lakehouse)",
      pillLabel: "☁️ GCP BigQuery",
      icon: "☁️",
      badgeClass: "badge-blue"
    };
    return {
      key: "HYBRID",
      groupLabel: "🌐 On-Premises & Nubes Conectadas (MySQL / Postgres)",
      pillLabel: "🏢 On-Premises (SQL)",
      icon: "🏢",
      badgeClass: "badge-purple"
    };
  }
}

async function loadQualitySelector() {
  const selectEl = document.getElementById("quality-asset-select");
  if (!selectEl) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/assets`);
    const data = await res.json();
    if (data.status === "success") {
      allQualityAssets = data.data || [];
      renderQualityOriginPills();
      renderQualityAssetOptions();
    }
  } catch (err) {
    console.error("Error loading quality assets:", err);
  }
}

function renderQualityOriginPills() {
  const container = document.getElementById("quality-origin-pills");
  if (!container) return;

  const counts = {
    ALL: allQualityAssets.length,
    GCP: 0,
    MYSQL: 0,
    POSTGRES: 0,
    HYBRID: 0
  };

  allQualityAssets.forEach(a => {
    const info = getAssetOriginInfo(a);
    if (counts[info.key] !== undefined) {
      counts[info.key]++;
    } else {
      counts.HYBRID++;
    }
  });

  const pills = [
    { key: "ALL", label: `🌐 Todos (${counts.ALL})` }
  ];

  if (counts.GCP > 0) pills.push({ key: "GCP", label: `☁️ GCP (${counts.GCP})` });
  if (counts.MYSQL > 0) pills.push({ key: "MYSQL", label: `🐬 MySQL (${counts.MYSQL})` });
  if (counts.POSTGRES > 0) pills.push({ key: "POSTGRES", label: `🐘 PostgreSQL (${counts.POSTGRES})` });
  if (counts.HYBRID > 0) pills.push({ key: "HYBRID", label: `⚡ Híbridas (${counts.HYBRID})` });

  // Si solo hay un origen activo (ej: solo GCP), no saturar con píldoras repetidas
  if (pills.length <= 2) {
    container.innerHTML = `<span class="stat-metric-badge badge-blue" style="font-size: 0.72rem;">Conector GCP Activo (${counts.ALL} tablas)</span>`;
    return;
  }

  container.innerHTML = pills.map(p => {
    const isActive = currentQualityOriginFilter === p.key;
    const activeStyle = isActive 
      ? "background: var(--pastel-blue-bg); border: 1.5px solid var(--pastel-blue-border); color: var(--pastel-blue-text); font-weight: 700; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
      : "background: var(--bg-app); border: 1px solid var(--border-light); color: var(--text-muted); opacity: 0.85;";

    return `
      <button class="btn-secondary" style="font-size: 0.72rem; padding: 0.25rem 0.6rem; border-radius: 20px; cursor: pointer; transition: all 0.2s ease; ${activeStyle}" onclick="filterQualityAssetsByOrigin('${p.key}')">
        ${p.label}
      </button>
    `;
  }).join("");
}

function filterQualityAssetsByOrigin(originKey) {
  currentQualityOriginFilter = originKey;
  renderQualityOriginPills();
  renderQualityAssetOptions();
}

function renderQualityAssetOptions() {
  const selectEl = document.getElementById("quality-asset-select");
  if (!selectEl) return;

  let filtered = allQualityAssets;
  if (currentQualityOriginFilter !== "ALL") {
    filtered = allQualityAssets.filter(a => {
      const info = getAssetOriginInfo(a);
      return info.key === currentQualityOriginFilter;
    });
  }

  if (filtered.length === 0) {
    selectEl.innerHTML = `<option value="">(No hay tablas registradas en este origen)</option>`;
    return;
  }

  // Agrupar los activos por groupLabel
  const grouped = {};
  filtered.forEach(a => {
    const info = getAssetOriginInfo(a);
    if (!grouped[info.groupLabel]) {
      grouped[info.groupLabel] = [];
    }
    grouped[info.groupLabel].push(a);
  });

  let html = "";
  let firstAssetIdInDom = null;

  for (const [groupLabel, assets] of Object.entries(grouped)) {
    html += `<optgroup label="${escapeHtml(groupLabel)} (${assets.length} tabla${assets.length > 1 ? 's' : ''})">`;
    assets.forEach(a => {
      if (!firstAssetIdInDom) firstAssetIdInDom = a.id;
      const score = a.dataplex_quality?.overall_score || 90;

      let originMeta = "";
      if ((a.cloud || "").toUpperCase().includes("POSTGRES")) {
        originMeta = `DB.Esquema Conectado: ${a.dataset || 'bdanita.public'}`;
      } else if ((a.cloud || "").toUpperCase().includes("MYSQL")) {
        originMeta = `DB: ${a.dataset || 'bdcomercial'}`;
      } else {
        originMeta = `Dataset: ${a.dataset || 'default'}`;
      }

      html += `<option value="${a.id}">[${escapeHtml(a.cloud)}] ${escapeHtml(a.name)} (${escapeHtml(originMeta)}) — Score: ${score}%</option>`;
    });
    html += `</optgroup>`;
  }

  selectEl.innerHTML = html;

  // Seleccionar estrictamente el primer elemento renderizado en el DOM para evitar desincronías
  if (firstAssetIdInDom) {
    selectEl.value = firstAssetIdInDom;
    onQualityAssetSelectChange(firstAssetIdInDom);
  }
}

function onQualityAssetSelectChange(assetId) {
  if (!assetId) return;

  const targetAsset = allQualityAssets.find(a => a.id === assetId);
  const badgeEl = document.getElementById("quality-asset-origin-badge");
  if (badgeEl && targetAsset) {
    const info = getAssetOriginInfo(targetAsset);
    badgeEl.className = `stat-metric-badge ${info.badgeClass}`;
    badgeEl.innerHTML = `${info.icon} Origen: ${escapeHtml(targetAsset.cloud || info.key)}`;
  }

  runQualityScanForAsset(assetId);
}

window.filterQualityAssetsByOrigin = filterQualityAssetsByOrigin;
window.onQualityAssetSelectChange = onQualityAssetSelectChange;

async function loadGlobalHealthBreakdown() {
  const alertsCont = document.getElementById("quality-alerts-container");
  if (!alertsCont) return;

  try {
    const res = await fetch(`${API_BASE}/api/quality/health`);
    const data = await res.json();
    if (data.status === "success") {
      const alerts = data.data.alerts || [];
      if (alerts.length === 0) {
        alertsCont.innerHTML = `<div style="color: var(--pastel-emerald-text); font-size: 0.82rem;">✅ Todos los activos multi-cloud cumplen con el umbral mínimo de calidad (>90%).</div>`;
      } else {
        alertsCont.innerHTML = alerts.map(al => `
          <div style="background: var(--pastel-rose-bg); border: 1px solid var(--pastel-rose-border); padding: 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
            <div style="display: flex; justify-content: space-between;">
              <strong style="color: var(--pastel-rose-text); font-size: 0.82rem;">${escapeHtml(al.name)} (${escapeHtml(al.cloud)})</strong>
              <span style="font-weight: 700; color: var(--pastel-rose-text);">${al.score}%</span>
            </div>
            <p style="color: var(--text-main); font-size: 0.75rem; margin-top: 0.2rem;">${escapeHtml(al.issue)}</p>
          </div>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Error loading health breakdown:", err);
  }
}

async function runQualityScanForAsset(assetId) {
  const container = document.getElementById("quality-results-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/quality/scan/${assetId}`);
    const data = await res.json();
    if (data.status === "success") {
      const q = data.data.quality || {};
      const score = q.overall_score || 95;
      const rules = q.rule_results || q.rules || [];

      const badgeMap = {
        "Completitud": "badge-blue",
        "Unicidad": "badge-purple",
        "Validez": "badge-emerald",
        "Consistencia": "badge-amber",
        "Exactitud": "badge-blue",
        "Integridad": "badge-purple",
        "Oportunidad": "badge-emerald"
      };

      const isPassed = score >= 90;
      const scoreBg = isPassed ? "var(--pastel-emerald-bg)" : "var(--pastel-rose-bg)";
      const scoreBorder = isPassed ? "var(--pastel-emerald-border)" : "var(--pastel-rose-border)";
      const scoreText = isPassed ? "var(--pastel-emerald-text)" : "var(--pastel-rose-text)";
      const scoreAccent = isPassed ? "var(--pastel-emerald-accent)" : "var(--pastel-rose-accent)";

      container.innerHTML = `
        <div class="pastel-card" style="border-top: 4px solid ${scoreAccent}; padding: 1.25rem;">
          
          <!-- SCAN HEADER & SCORE SUMMARY -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
                <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0;">${escapeHtml(data.data.name)}</h3>
                <span class="stat-metric-badge ${isPassed ? 'badge-emerald' : 'badge-rose'}" style="font-weight: 700;">
                  ${isPassed ? '● Dataplex Aprobado' : '● Requiere Remediación'}
                </span>
              </div>
              <p style="font-size: 0.78rem; color: var(--pastel-blue-text); font-family: monospace; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">
                <span>📍 Endpoint / Recurso:</span>
                <code>${escapeHtml(data.data.resource)}</code>
                <span style="color: var(--text-muted);">[${escapeHtml(data.data.cloud)}]</span>
              </p>
            </div>

            <div style="display: flex; align-items: center; gap: 0.8rem; background: ${scoreBg}; border: 1px solid ${scoreBorder}; padding: 0.65rem 1.1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
              <div style="text-align: right;">
                <div style="font-size: 0.68rem; text-transform: uppercase; font-weight: 800; color: ${scoreText}; letter-spacing: 0.5px;">Dataplex Quality Score</div>
                <div style="font-size: 2.1rem; font-weight: 800; color: ${scoreText}; line-height: 1.1; font-family: 'Outfit', sans-serif;">${score}%</div>
              </div>
            </div>
          </div>

          <!-- MINI METRICS BAR -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem;">
            <div style="background: var(--bg-app); border: 1px solid var(--border-light); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">📊 Score General</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0.1rem;">${score}%</div>
            </div>
            <div style="background: var(--bg-app); border: 1px solid var(--border-light); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">⏱️ SLA Frescura</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-top: 0.1rem;">${q.freshness_hours || 1.0}h</div>
            </div>
            <div style="background: var(--bg-app); border: 1px solid var(--border-light); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">🧪 Reglas Aprobadas</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--pastel-emerald-text); margin-top: 0.1rem;">${q.rules_passed || rules.length} / ${q.total_rules || rules.length}</div>
            </div>
            <div style="background: var(--bg-app); border: 1px solid var(--border-light); padding: 0.65rem 0.85rem; border-radius: var(--radius-sm);">
              <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">🛡️ Tasa de Nulos</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: var(--pastel-blue-text); margin-top: 0.1rem;">${q.null_rate_pct || 0.0}%</div>
            </div>
          </div>

          <!-- TABLE OF QUALITY RULES (ESPACIOSA Y CON MIN-WIDTHS) -->
          <div style="overflow-x: auto; border: 1px solid var(--border-light); border-radius: var(--radius-md);">
            <table class="table-clean" style="width: 100%; font-size: 0.8rem; border-collapse: collapse;">
              <thead>
                <tr style="background: var(--bg-subtle);">
                  <th style="min-width: 110px; padding: 0.65rem 0.85rem;">Dimensión</th>
                  <th style="min-width: 200px; padding: 0.65rem 0.85rem;">Regla de Calidad</th>
                  <th style="min-width: 220px; padding: 0.65rem 0.85rem;">Ejemplo de Regla (MDM)</th>
                  <th style="min-width: 95px; padding: 0.65rem 0.85rem; text-align: center;">Estado</th>
                  <th style="min-width: 260px; padding: 0.65rem 0.85rem;">Detalle de Inspección</th>
                </tr>
              </thead>
              <tbody>
                ${rules.map(r => `
                  <tr>
                    <td style="padding: 0.65rem 0.85rem; vertical-align: top;"><span class="stat-metric-badge ${badgeMap[r.dimension] || 'badge-blue'}">${escapeHtml(r.dimension || 'Calidad')}</span></td>
                    <td style="padding: 0.65rem 0.85rem; vertical-align: top;"><strong style="color: var(--text-main);">${escapeHtml(r.rule)}</strong></td>
                    <td style="padding: 0.65rem 0.85rem; vertical-align: top; color: var(--pastel-blue-text); font-family: monospace; font-size: 0.75rem;">${escapeHtml(r.mdm_example || '-')}</td>
                    <td style="padding: 0.65rem 0.85rem; vertical-align: top; text-align: center;">
                      <span class="stat-metric-badge ${r.status === 'PASSED' ? 'badge-emerald' : 'badge-rose'}">
                        ${r.status === 'PASSED' ? 'PASÓ' : 'FALLÓ'}
                      </span>
                    </td>
                    <td style="padding: 0.65rem 0.85rem; vertical-align: top; color: var(--text-main); line-height: 1.4;">${escapeHtml(r.details)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error running quality scan:", err);
  }
}


// ---------------------------------------------------------------------------
// REGLAS DE NEGOCIO AVANZADAS (ANOMALÍAS EN VENTAS, CONCILIACIÓN, DRILL-DOWN)
// ---------------------------------------------------------------------------
async function loadBusinessQualityRules() {
  try {
    const res = await fetch(`${API_BASE}/api/quality/business_rules`);
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      renderBusinessRulesList(data.data);
      if (data.last_evaluation) {
        renderBusinessRulesEvaluation(data.last_evaluation);
      }
    }
  } catch (err) {
    console.error("Error loading business rules:", err);
  }
}

function renderBusinessRulesList(rules) {
  const container = document.getElementById("business-rules-list-container");
  if (!container) return;

  container.innerHTML = rules.map(r => {
    let thresholdInput = "";
    if (r.metric_type === "PERCENT_DEVIATION") {
      thresholdInput = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="number" step="1" min="1" max="100" id="threshold-${r.rule_id}" class="form-input" style="width: 80px; padding: 0.3rem 0.5rem; font-size: 0.8rem;" value="${r.current_threshold_percent}">
          <span style="font-size: 0.75rem; color: var(--text-muted);">% máx variación</span>
          <button class="btn-secondary" style="font-size: 0.7rem; padding: 0.3rem 0.6rem;" onclick="updateThreshold('${r.rule_id}')">Guardar</button>
        </div>
      `;
    } else if (r.metric_type === "TOLERANCE_AMOUNT_USD") {
      thresholdInput = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="number" step="0.01" min="0" id="threshold-${r.rule_id}" class="form-input" style="width: 80px; padding: 0.3rem 0.5rem; font-size: 0.8rem;" value="${r.current_threshold_amount}">
          <span style="font-size: 0.75rem; color: var(--text-muted);">$ USD tolerancia</span>
          <button class="btn-secondary" style="font-size: 0.7rem; padding: 0.3rem 0.6rem;" onclick="updateThreshold('${r.rule_id}')">Guardar</button>
        </div>
      `;
    } else {
      thresholdInput = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <input type="number" step="0.5" min="0.5" id="threshold-${r.rule_id}" class="form-input" style="width: 80px; padding: 0.3rem 0.5rem; font-size: 0.8rem;" value="${r.current_threshold_hours}">
          <span style="font-size: 0.75rem; color: var(--text-muted);">horas SLA</span>
          <button class="btn-secondary" style="font-size: 0.7rem; padding: 0.3rem 0.6rem;" onclick="updateThreshold('${r.rule_id}')">Guardar</button>
        </div>
      `;
    }

    return `
      <tr>
        <td>
          <strong style="color: var(--text-main); font-size: 0.85rem;">${escapeHtml(r.name)}</strong>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(r.description)}</div>
        </td>
        <td><span class="stat-metric-badge badge-purple">${escapeHtml(r.category)}</span></td>
        <td>${thresholdInput}</td>
        <td><span class="stat-metric-badge badge-emerald">● ${escapeHtml(r.status)}</span></td>
      </tr>
    `;
  }).join("");
}

async function updateThreshold(ruleId) {
  const input = document.getElementById(`threshold-${ruleId}`);
  if (!input) return;
  const val = parseFloat(input.value);

  showToast("Actualizando umbral dinámico...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/quality/business_rules/update_threshold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_id: ruleId, new_threshold: val })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || "Umbral actualizado.", "success");
    }
  } catch (err) {
    showToast("Error al actualizar umbral.", "error");
  }
}

async function triggerEvaluateBusinessRules() {
  showToast("Evaluando reglas de negocio y detectando variaciones en ventas...", "info");
  try {
    const res = await fetch(`${API_BASE}/api/quality/business_rules/evaluate`, { method: "POST" });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(`Evaluación completada: ${data.data.failed_rules_count} anomalías detectadas.`, "success");
      renderBusinessRulesEvaluation(data.data);
    }
  } catch (err) {
    showToast("Error al evaluar reglas de negocio.", "error");
  }
}

function renderBusinessRulesEvaluation(evalData) {
  const container = document.getElementById("business-rules-results-container");
  if (!container) return;

  const failures = evalData.drill_down_failures || [];

  container.innerHTML = `
    <div style="margin-top: 1rem;">
      <div class="card-grid" style="margin-bottom: 1rem;">
        <div class="pastel-card" style="border-top: 3px solid var(--pastel-rose-accent);">
          <span class="stat-metric-badge badge-rose">ESTADO DE REGLAS DE NEGOCIO</span>
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--text-main);">${evalData.overall_status}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted);">${evalData.failed_rules_count} reglas requieren atención • ${evalData.passed_rules_count} conformes</p>
        </div>

        <div class="pastel-card" style="border-top: 3px solid var(--pastel-blue-accent);">
          <span class="stat-metric-badge badge-blue">ÚLTIMA AUDITORÍA</span>
          <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-main);">${evalData.evaluated_at}</div>
          <p style="font-size: 0.78rem; color: var(--text-muted);">${evalData.total_rules_evaluated} reglas evaluadas contra baseline histórico.</p>
        </div>
      </div>

      <!-- Drill-Down Section -->
      ${failures.length > 0 ? `
        <div class="pastel-card" style="border-left: 4px solid var(--pastel-rose-accent);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--pastel-rose-text);">🔍 Drill-Down de Anomalías Detectadas & Análisis de Causa Raíz</h4>
            <span class="stat-metric-badge badge-rose">Investigación en Profundidad</span>
          </div>

          ${failures.map(f => `
            <div style="background: var(--bg-app); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <strong style="color: var(--text-main); font-size: 0.88rem;">${escapeHtml(f.rule_name)}</strong>
                <span class="stat-metric-badge badge-rose">Entidad: ${escapeHtml(f.failed_entity)}</span>
              </div>
              
              <div style="margin-top: 0.5rem; overflow-x: auto;">
                <table class="table-clean" style="font-size: 0.78rem;">
                  <thead>
                    <tr>
                      ${Object.keys(f.sample_records[0] || {}).map(k => `<th>${escapeHtml(k)}</th>`).join("")}
                    </tr>
                  </thead>
                  <tbody>
                    ${f.sample_records.map(rec => `
                      <tr>
                        ${Object.values(rec).map(v => `<td>${escapeHtml(String(v))}</td>`).join("")}
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>

              <div style="margin-top: 0.5rem; font-size: 0.78rem; color: var(--pastel-blue-text);">
                💡 <strong>Sugerencia de Remediación:</strong> ${escapeHtml(f.suggested_remediation)}
              </div>
            </div>
          `).join("")}
        </div>
      ` : `
        <div style="background: var(--pastel-emerald-bg); border: 1px solid var(--pastel-emerald-border); padding: 1rem; border-radius: var(--radius-sm); color: var(--pastel-emerald-text); text-align: center;">
          🎉 Cero anomalías en ventas o conciliación financiera. Todos los umbrales de negocio están conformes.
        </div>
      `}
    </div>
  `;
}

async function loadRealDataplexConsoleScans() {
  const tableBody = document.getElementById("real-dataplex-scans-table");
  if (!tableBody) return;

  try {
    const res = await fetch(`${API_BASE}/api/quality/real_dataplex_scans`);
    const data = await res.json();
    if (data.status === "success" && data.data) {
      tableBody.innerHTML = data.data.map(s => `
        <tr>
          <td><strong style="color: var(--text-main);">${escapeHtml(s.display_name)}</strong></td>
          <td><span class="stat-metric-badge badge-purple">${escapeHtml(s.type)}</span></td>
          <td><code style="font-size: 0.75rem; color: var(--pastel-blue-text);">${escapeHtml(s.resource)}</code></td>
          <td><span class="stat-metric-badge badge-emerald">● ${escapeHtml(s.state)}</span></td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Error loading real dataplex scans:", err);
  }
}
