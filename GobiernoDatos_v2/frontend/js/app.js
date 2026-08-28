/**
 * Master Application State & Global UI Controller
 */

const API_BASE = "";

const AppState = {
  activeTab: "chat-tab",
  assets: [],
  glossary: [],
  selectedAsset: null,
  healthData: null
};

// Global HTML Escaper
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Global Tab Navigator
function navigateToTab(tabId) {
  const tabBtn = document.querySelector(`.nav-tab-btn[data-target="${tabId}"]`);
  if (tabBtn) {
    tabBtn.click();
  } else {
    document.querySelectorAll(".nav-tab-btn").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    const pane = document.getElementById(tabId);
    if (pane) pane.classList.add("active");
  }
}

// Global Modal Closer
function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(m => m.style.display = "none");
  const editItModal = document.getElementById("infotype-edit-modal");
  if (editItModal) editItModal.style.display = "none";
  const testItModal = document.getElementById("infotype-test-modal");
  if (testItModal) testItModal.style.display = "none";
  const gcpModal = document.getElementById("gcp-config-modal");
  if (gcpModal) gcpModal.style.display = "none";
  const extDbModal = document.getElementById("external-db-modal");
  if (extDbModal) extDbModal.style.display = "none";
}

// Global GCP Config Modal Handler
function openGCPConfigModal() {
  let modalEl = document.getElementById("gcp-config-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "gcp-config-modal";
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

  let currentProject = "agentspace-demos-466121";
  let currentLocation = "us-central1";
  let currentCreds = "APPLICATION_DEFAULT_CREDENTIALS";
  let currentLake = "enterprise-data-lake";
  let currentDlpTemplate = "projects/agentspace-demos-466121/locations/global/inspectTemplates/default-pii-template";

  modalEl.innerHTML = `
    <div class="pastel-card" style="max-width: 640px; width: 92%; max-height: 90vh; overflow-y: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div style="font-size: 1.5rem;">☁️</div>
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">
              Configuración de Despliegue Google Cloud Platform (GCP)
            </h3>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">
              Especifica el ID del Proyecto GCP, región de Dataplex y credenciales del entorno.
            </div>
          </div>
        </div>
        <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);" onclick="closeGCPConfigModal()">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.9rem;">
        <div style="background: var(--pastel-blue-bg); border: 1px solid var(--pastel-blue-border); border-radius: 8px; padding: 0.75rem; font-size: 0.78rem; color: var(--pastel-blue-text);">
          💡 <strong>Proyecto por Defecto:</strong> Tu entorno está conectado actualmente a <code id="gcp-config-project-display">${escapeHtml(currentProject)}</code>. Todos los análisis de BigQuery, scans de Dataplex DQ y Firestore usan este ID.
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">GCP Project ID:</label>
            <input type="text" id="gcp-config-project-id" class="form-input" style="font-family: monospace; font-weight: 700; color: var(--pastel-blue-text); width: 100%;" value="${escapeHtml(currentProject)}">
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Región / Ubicación GCP:</label>
            <input type="text" id="gcp-config-location" class="form-input" style="width: 100%;" value="${escapeHtml(currentLocation)}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Tipo de Autenticación / Credenciales:</label>
            <select id="gcp-config-creds" class="form-input" style="width: 100%;">
              <option value="APPLICATION_DEFAULT_CREDENTIALS">Application Default Credentials (ADC / gcloud)</option>
              <option value="SERVICE_ACCOUNT_KEY">Service Account Key JSON</option>
            </select>
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Dataplex Data Lake ID:</label>
            <input type="text" id="gcp-config-lake" class="form-input" style="width: 100%;" value="${escapeHtml(currentLake)}">
          </div>
        </div>

        <div>
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Plantilla de Inspección Cloud DLP (Template Path):</label>
          <input type="text" id="gcp-config-dlp-template" class="form-input" style="font-family: monospace; font-size: 0.78rem; width: 100%;" value="${escapeHtml(currentDlpTemplate)}">
        </div>

        <div style="font-size: 0.72rem; color: var(--text-muted); background: var(--bg-app); padding: 0.5rem 0.75rem; border-radius: 6px;">
          ⚙️ <strong>Ubicación en Código:</strong> Esta configuración se guarda directamente en <code>config/connectors_config.yaml</code> y actualiza los clientes en tiempo real.
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
        <button class="btn-secondary" onclick="closeGCPConfigModal()">Cancelar</button>
        <button class="btn-primary" onclick="submitGCPConfigSave()">💾 Guardar Configuración GCP</button>
      </div>
    </div>
  `;

  fetch(`${API_BASE}/api/config/gcp`)
    .then(res => res.json())
    .then(data => {
      if (data.status === "success" && data.data) {
        if (document.getElementById("gcp-config-project-id")) document.getElementById("gcp-config-project-id").value = data.data.project_id || currentProject;
        if (document.getElementById("gcp-config-location")) document.getElementById("gcp-config-location").value = data.data.location || currentLocation;
        if (document.getElementById("gcp-config-creds")) document.getElementById("gcp-config-creds").value = data.data.credentials_type || currentCreds;
        if (document.getElementById("gcp-config-lake")) document.getElementById("gcp-config-lake").value = data.data.dataplex_lake || currentLake;
        if (document.getElementById("gcp-config-dlp-template")) document.getElementById("gcp-config-dlp-template").value = data.data.dlp_inspection_template || currentDlpTemplate;
        if (document.getElementById("gcp-config-project-display")) document.getElementById("gcp-config-project-display").innerText = data.data.project_id || currentProject;
      }
    })
    .catch(err => console.warn("Background fetch GCP config error:", err));
}

function closeGCPConfigModal() {
  const modalEl = document.getElementById("gcp-config-modal");
  if (modalEl) modalEl.style.display = "none";
}

async function submitGCPConfigSave() {
  const projectId = document.getElementById("gcp-config-project-id")?.value.trim();
  const location = document.getElementById("gcp-config-location")?.value.trim();
  const creds = document.getElementById("gcp-config-creds")?.value;
  const lake = document.getElementById("gcp-config-lake")?.value.trim();
  const dlpTemplate = document.getElementById("gcp-config-dlp-template")?.value.trim();

  if (!projectId) {
    showToast("Por favor ingresa un GCP Project ID válido.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/config/gcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        location: location,
        credentials_type: creds,
        dataplex_lake: lake,
        dlp_inspection_template: dlpTemplate
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || `Proyecto GCP actualizado a ${projectId}`, "success");
      closeGCPConfigModal();

      const badgeEl = document.getElementById("gcp-header-badge");
      if (badgeEl) {
        badgeEl.innerHTML = `☁️ GCP Project: ${escapeHtml(projectId)} (${escapeHtml(location)})`;
      }
    } else {
      showToast(data.detail || "Error al guardar configuración GCP", "error");
    }
  } catch (err) {
    showToast("Error de conexión al guardar configuración GCP", "error");
  }
}

window.openGCPConfigModal = openGCPConfigModal;
window.closeGCPConfigModal = closeGCPConfigModal;
window.submitGCPConfigSave = submitGCPConfigSave;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  loadGlobalHealth();
  initToast();

  // Load authentication and initial sub-modules safely
  try { if (typeof initAuth === "function") initAuth(); } catch(e) { console.error("Error initAuth:", e); }
  try { if (typeof initProfiles === "function") initProfiles(); } catch(e) { console.error("Error initProfiles:", e); }
  try { if (typeof initChat === "function") initChat(); } catch(e) { console.error("Error initChat:", e); }
  try { if (typeof initCatalog === "function") initCatalog(); } catch(e) { console.error("Error initCatalog:", e); }
  try { if (typeof initDLP === "function") initDLP(); } catch(e) { console.error("Error initDLP:", e); }
  try { if (typeof initQuality === "function") initQuality(); } catch(e) { console.error("Error initQuality:", e); }
  try { if (typeof initLineage === "function") initLineage(); } catch(e) { console.error("Error initLineage:", e); }
  try { if (typeof initStewards === "function") initStewards(); } catch(e) { console.error("Error initStewards:", e); }
  try { if (typeof initConnectors === "function") initConnectors(); } catch(e) { console.error("Error initConnectors:", e); }
  try { if (typeof initPolicies === "function") initPolicies(); } catch(e) { console.error("Error initPolicies:", e); }
  try { if (typeof initLooker === "function") initLooker(); } catch(e) { console.error("Error initLooker:", e); }
  try { if (typeof initTagging === "function") initTagging(); } catch(e) { console.error("Error initTagging:", e); }
});

function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = tab.getAttribute("data-target");
      document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.remove("active");
      });
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add("active");
        AppState.activeTab = targetId;

        // Trigger sub-module updates
        if (targetId === "lineage-tab" && typeof renderCurrentLineage === "function") {
          renderCurrentLineage();
        }
        if (targetId === "profiles-tab" && typeof loadProfiles === "function") {
          loadProfiles();
        }
      }
    });
  });
}

async function loadGlobalHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/quality/health`);
    const data = await res.json();
    if (data.status === "success") {
      AppState.healthData = data.data;
      updateRibbonStats(data.data);
    }
  } catch (err) {
    console.error("Error loading health metrics:", err);
  }
}

function updateRibbonStats(health) {
  const healthEl = document.getElementById("stat-avg-quality");
  if (healthEl) healthEl.innerText = `${health.average_score}%`;

  const totalEl = document.getElementById("stat-total-assets");
  if (totalEl) totalEl.innerText = health.total_assets;

  const passedEl = document.getElementById("stat-passed-rules");
  if (passedEl) passedEl.innerText = health.status_breakdown?.passed || "0";
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container") || document.body;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerText = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function initToast() {
  if (!document.getElementById("toast-container")) {
    const cont = document.createElement("div");
    cont.id = "toast-container";
    cont.className = "toast-container";
    document.body.appendChild(cont);
  }
}
