/**
 * Policy as Code & Knowledge Catalog MCP Engine Controller
 */

function initPolicies() {
  loadPolicies();
}

async function loadPolicies() {
  try {
    await Promise.all([
      loadComplianceScorecard(),
      loadPolicyViolations(),
      loadPoliciesRegistry()
    ]);
  } catch (err) {
    console.error("Error loading policies module:", err);
  }
}

async function loadComplianceScorecard() {
  const container = document.getElementById("compliance-scorecard-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/policies/scorecard`);
    const data = await res.json();
    if (data.status === "success" && data.data) {
      const sc = data.data;
      const score = sc.compliance_score || 0;
      let badgeClass = "badge-green";
      if (score < 70) badgeClass = "badge-rose";
      else if (score < 90) badgeClass = "badge-amber";

      container.innerHTML = `
        <div class="pastel-card" style="margin-bottom: 1.25rem;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; align-items: center;">
            <div style="text-align: center; border-right: 1px solid var(--border-light); padding-right: 1rem;">
              <div style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Índice Global de Cumplimiento</div>
              <div style="font-size: 2.2rem; font-weight: 800; color: var(--text-main); margin: 0.2rem 0;">${score}%</div>
              <span class="stat-metric-badge ${badgeClass}">${score >= 80 ? 'Cumplimiento Alto' : 'Acción Requerida'}</span>
            </div>
            <div>
              <div style="font-size: 0.78rem; color: var(--text-muted);"><strong>Políticas Activas:</strong> ${sc.total_policies || 0}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.3rem;"><strong>Violaciones Abiertas:</strong> ${sc.active_violations || 0}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.3rem;"><strong>Remediaciones Automáticas:</strong> ${sc.remediated_count || 0}</div>
            </div>
            <div>
              <div style="font-size: 0.78rem; color: var(--text-muted);"><strong>Última Auditoría:</strong> ${escapeHtml(sc.last_audit_timestamp || "Reciente")}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.3rem;"><strong>Motor:</strong> Knowledge Catalog & Dataplex Policy Engine</div>
            </div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading scorecard:", err);
  }
}

async function loadPolicyViolations() {
  const container = document.getElementById("violations-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/policies/violations`);
    const data = await res.json();
    if (data.status === "success") {
      const violations = data.data || [];
      if (violations.length === 0) {
        container.innerHTML = `
          <div style="padding: 1rem; background: var(--gcp-pastel-green-bg); border: 1px solid var(--gcp-pastel-green-border); border-radius: var(--radius-md); color: var(--gcp-pastel-green-text); font-size: 0.85rem; font-weight: 600;">
            🎉 ¡No hay violaciones activas detectadas! Todas las políticas se están cumpliendo adecuadamente.
          </div>
        `;
        return;
      }

      container.innerHTML = violations.map(v => {
        let badgeStyle = "badge-rose";
        if (v.severity === "MEDIUM") badgeStyle = "badge-amber";
        if (v.severity === "LOW") badgeStyle = "badge-blue";

        return `
          <div style="background: #ffffff; border: 1px solid var(--border-light); border-left: 4px solid var(--gcp-red); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="flex: 1; min-width: 260px;">
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <span class="stat-metric-badge ${badgeStyle}">${escapeHtml(v.severity || "HIGH")}</span>
                <strong style="font-size: 0.9rem; color: var(--text-main);">${escapeHtml(v.policy_id || v.title)}</strong>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem;">
                <strong>Activo Afectado:</strong> <code>${escapeHtml(v.asset_id || v.asset)}</code>
              </div>
              <div style="font-size: 0.8rem; color: var(--text-main); margin-top: 0.2rem;">
                ${escapeHtml(v.description || v.details)}
              </div>
            </div>
            <div>
              <button class="btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="remediatePolicyViolation('${escapeHtml(v.id)}')">
                ⚡ Auto-Remediar Ahora
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    console.error("Error loading policy violations:", err);
  }
}

async function loadPoliciesRegistry() {
  const tbody = document.getElementById("policies-table-body");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/policies`);
    const data = await res.json();
    if (data.status === "success") {
      const policies = data.data || [];
      if (policies.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay políticas registradas.</td></tr>`;
        return;
      }

      tbody.innerHTML = policies.map(p => `
        <tr>
          <td>
            <strong style="color: var(--text-main); font-size: 0.85rem;">${escapeHtml(p.name || p.id)}</strong>
            <div style="font-size: 0.76rem; color: var(--text-muted);">${escapeHtml(p.description || "")}</div>
          </td>
          <td><span class="stat-metric-badge badge-blue">${escapeHtml(p.category || "Gobernanza")}</span></td>
          <td><span class="stat-metric-badge badge-rose">${escapeHtml(p.severity || "MEDIUM")}</span></td>
          <td><code>v${escapeHtml(p.version || "1.0")}</code></td>
          <td>
            <span class="stat-metric-badge ${p.enabled !== false ? 'badge-green' : 'badge-amber'}">
              ${p.enabled !== false ? 'Activa' : 'Inactiva'}
            </span>
          </td>
        </tr>
      `).join("");
    }
  } catch (err) {
    console.error("Error loading policies registry:", err);
  }
}

async function triggerExecutePoliciesSuite() {
  try {
    showToast("Ejecutando suite de comprobación de políticas...", "info");
    const res = await fetch(`${API_BASE}/api/policies/execute`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast("Suite de políticas ejecutada exitosamente", "success");
      loadPolicies();
    } else {
      showToast("Error al ejecutar suite de políticas", "error");
    }
  } catch (err) {
    console.error("Error executing policies:", err);
    showToast("Error al conectar con la API de políticas", "error");
  }
}

function exportViolationsToCSV() {
  window.open(`${API_BASE}/api/policies/export_csv`, "_blank");
}

async function triggerGeneratePolicyFromPrompt() {
  const input = document.getElementById("policy-prompt-input");
  if (!input || !input.value.trim()) {
    showToast("Por favor ingresa un prompt en lenguaje natural para la política", "info");
    return;
  }

  const promptText = input.value.trim();
  try {
    showToast("Generando política as code con Inteligencia Artificial...", "info");
    const res = await fetch(`${API_BASE}/api/policies/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();
    if (data.status === "success") {
      showToast("¡Política generada y desplegada exitosamente!", "success");
      input.value = "";
      loadPolicies();
    } else {
      showToast("Error al generar política: " + (data.message || "Desconocido"), "error");
    }
  } catch (err) {
    console.error("Error generating policy:", err);
    showToast("Error de conexión al generar la política", "error");
  }
}

async function remediatePolicyViolation(violationId) {
  try {
    showToast("Aplicando auto-remediación sobre la violación...", "info");
    const res = await fetch(`${API_BASE}/api/policies/remediate/${violationId}`, { method: "POST" });
    const data = await res.json();
    if (data.status === "success") {
      showToast("¡Violación remediada exitosamente!", "success");
      loadPolicies();
    } else {
      showToast("Error en auto-remediación: " + (data.detail || data.message || ""), "error");
    }
  } catch (err) {
    console.error("Error remediating violation:", err);
    showToast("Error de conexión al auto-remediar", "error");
  }
}
