/**
 * Connectors & Automated External Database Discovery Controller
 * Supports MySQL Online (FreeMySQLDatabase), Azure SQL Server, Postgres, BigQuery, AWS
 */

function initConnectors() {
  loadConnectorsStatus();
}

let latestConnectorsState = [];
let activeGcpProject = "agente-newyork";

let gcpGovernedProjects = [
  { id: "agente-newyork", name: "agente-newyork", desc: "Proyecto GCP (Organización)", checked: true },
  { id: "agentspace-demos-466121", name: "agentspace-demos-466121", desc: "Proyecto GCP (Organización)", checked: true },
  { id: "project-data-anita", name: "project-data-anita", desc: "Proyecto GCP (Organización)", checked: true },
  { id: "proy-gemini-enterprise-final", name: "proy-gemini-enterprise-final", desc: "Proyecto GCP (Organización)", checked: true },
  { id: "courses-agent", name: "courses-agent", desc: "Proyecto GCP (Organización)", checked: false }
];

async function fetchCurrentGCPConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/config/gcp`);
    const data = await res.json();
    if (data.status === "success" && data.data) {
      activeGcpProject = data.data.project_id || "agente-newyork";
    }
  } catch (e) {}
}

async function switchPrimaryGCPProject(projectId) {
  if (!projectId) return;
  try {
    showToast(`Configurando Host Principal de Gobierno GCP en '${projectId}'...`, "info");
    const res = await fetch(`${API_BASE}/api/config/gcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId })
    });
    const data = await res.json();
    if (data.status === "success") {
      activeGcpProject = projectId;
      showToast(`🎯 ¡Proyecto Principal Host establecido en: '${projectId}'!`, "success");
      const badge = document.getElementById("gcp-header-badge");
      if (badge) {
        badge.innerHTML = `☁️ GCP Project: ${escapeHtml(projectId)} (us-central1)`;
      }
      loadConnectorsStatus();
    } else {
      showToast("Error al actualizar proyecto GCP principal", "error");
    }
  } catch (err) {
    console.error("Error switching primary GCP project:", err);
    showToast("Error de conexión al actualizar proyecto GCP", "error");
  }
}

function openGCPConfigModal() {
  const modal = document.getElementById("gcp-config-modal");
  if (!modal) return;
  const input = document.getElementById("gcp-modal-project-id");
  if (input) input.value = activeGcpProject || "gobiernodatos";
  modal.style.display = "flex";
}

function setModalGCPProject(projectId) {
  const input = document.getElementById("gcp-modal-project-id");
  if (input) input.value = projectId;
}

async function saveGCPConfigOnly() {
  const projectId = document.getElementById("gcp-modal-project-id")?.value?.trim();
  if (!projectId) {
    showToast("Por favor ingresa un Project ID válido.", "warning");
    return;
  }
  await switchPrimaryGCPProject(projectId);
  closeAllModals();
}

async function executeGCPDeploymentFromModal() {
  const projectId = document.getElementById("gcp-modal-project-id")?.value?.trim();
  const region = document.getElementById("gcp-modal-region")?.value || "us-central1";
  const deployTarget = document.getElementById("gcp-modal-deploy-target")?.value || "cloud_function";
  
  if (!projectId) {
    showToast("Por favor ingresa un Project ID válido para el despliegue.", "warning");
    return;
  }

  const consoleBox = document.getElementById("gcp-deploy-console-box");
  const consoleText = document.getElementById("gcp-deploy-console-text");

  if (consoleBox && consoleText) {
    consoleBox.style.display = "block";
    consoleText.innerHTML = `🚀 Iniciando proceso de despliegue en Google Cloud (${deployTarget === 'cloud_function' ? 'Cloud Run Functions 2nd Gen' : 'Cloud Run App Container'})...\n🎯 Proyecto Target: ${projectId}\n📍 Región: ${region}\n\n⚙️ Compilando imagen y configurando IAM... Espere unos momentos.\n`;
  }

  showToast(`Iniciando despliegue en GCP para el proyecto '${projectId}'...`, "info");

  try {
    const res = await fetch(`${API_BASE}/api/deploy/gcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        region: region,
        deploy_target: deployTarget
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      if (consoleText) {
        consoleText.innerHTML += `\n✅ ¡DESPLIEGUE EXITOSO EN GOOGLE CLOUD!\n🔗 URL del Servicio: ${data.deployment_url}\n\n${data.logs || ''}`;
      }
      showToast(data.message, "success");
      activeGcpProject = projectId;
      const badge = document.getElementById("gcp-header-badge");
      if (badge) {
        badge.innerHTML = `☁️ GCP Project: ${escapeHtml(projectId)} (${region})`;
      }
    } else {
      if (consoleText) {
        consoleText.innerHTML += `\n❌ FALLO EN EL DESPLIEGUE:\n${data.detail || data.message || 'Error desconocido'}\n${data.logs || ''}`;
      }
      showToast(data.detail || data.message || "Error al desplegar en Google Cloud", "error");
    }
  } catch (err) {
    console.error("Error en petición de despliegue:", err);
    if (consoleText) {
      consoleText.innerHTML += `\n❌ ERROR DE CONEXIÓN AL BACKEND: ${err.message}`;
    }
    showToast("Error de conexión al ejecutar el despliegue", "error");
  }
}

async function fetchOrgGCPProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/connectors/gcp_real_projects`);
    const data = await res.json();
    if (data.status === "success" && Array.isArray(data.data) && data.data.length > 0) {
      const currentCheckedIds = new Set(gcpGovernedProjects.filter(p => p.checked).map(p => p.id));
      let fetchedProjects = data.data.map(p => ({
        ...p,
        checked: currentCheckedIds.size > 0 ? (currentCheckedIds.has(p.id) || p.id === activeGcpProject) : p.checked
      }));

      // Ensure activeGcpProject from .env is at the top of the list
      if (activeGcpProject) {
        const activeIdx = fetchedProjects.findIndex(p => p.id === activeGcpProject);
        if (activeIdx > 0) {
          const [activeItem] = fetchedProjects.splice(activeIdx, 1);
          activeItem.checked = true;
          fetchedProjects.unshift(activeItem);
        } else if (activeIdx === -1) {
          fetchedProjects.unshift({
            id: activeGcpProject,
            name: activeGcpProject,
            desc: "Proyecto GCP Host Principal (.env)",
            checked: true
          });
        } else if (activeIdx === 0) {
          fetchedProjects[0].checked = true;
        }
      }

      gcpGovernedProjects = fetchedProjects;
      saveGCPGovernedProjects();
      renderConnectorsGrid(latestConnectorsState);
    }
  } catch (err) {
    console.error("Error fetching org GCP projects:", err);
  }
}

async function loadGCPGovernedProjects() {
  await fetchOrgGCPProjects();
}

function saveGCPGovernedProjects() {
  localStorage.setItem("gcp_governed_projects", JSON.stringify(gcpGovernedProjects));
}

function toggleGCPProject(projectId) {
  const proj = gcpGovernedProjects.find(p => p.id === projectId);
  if (proj) {
    proj.checked = !proj.checked;
    saveGCPGovernedProjects();
    renderConnectorsGrid(latestConnectorsState);
    if (proj.checked) {
      showToast(`✅ Proyecto GCP '${proj.id}' habilitado para Gobierno Agéntico`, "success");
    } else {
      showToast(`ℹ️ Proyecto GCP '${proj.id}' excluido del alcance de Gobierno`, "info");
    }
  }
}

function addCustomGCPProject() {
  const projId = prompt("Ingresa el ID del nuevo Proyecto GCP a incluir en Gobierno de Datos:");
  if (projId && projId.trim()) {
    const cleanId = projId.trim().toLowerCase();
    if (!gcpGovernedProjects.some(p => p.id === cleanId)) {
      gcpGovernedProjects.push({
        id: cleanId,
        name: cleanId,
        desc: "Proyecto GCP Agregado Manualmente",
        checked: true
      });
      saveGCPGovernedProjects();
      renderConnectorsGrid(latestConnectorsState);
      showToast(`✅ Proyecto GCP '${cleanId}' agregado y habilitado`, "success");
    } else {
      showToast("El proyecto GCP ya se encuentra en la lista", "info");
    }
  }
}

async function initConnectors() {
  await fetchCurrentGCPConfig();
  await loadGCPGovernedProjects();
  loadConnectorsStatus();
}

async function loadConnectorsStatus() {
  try {
    const res = await fetch(`${API_BASE}/api/connectors/status`);
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      latestConnectorsState = data.data || [];
      renderConnectorsGrid(latestConnectorsState);
      updateHeaderBadges(latestConnectorsState);
    }
  } catch (err) {
    console.error("Error loading connectors:", err);
  }
}

function updateHeaderBadges(connectors) {
  const mysqlConn = connectors.find(c => c.id === "mysql");
  const pgConn = connectors.find(c => c.id === "cloud_sql_postgres");

  const mysqlBadge = document.getElementById("mysql-header-badge");
  if (mysqlBadge && mysqlConn) {
    const isConn = mysqlConn.status === "CONNECTED";
    mysqlBadge.textContent = `● MySQL Online (${isConn ? 'Conectado' : 'No Conectado'})`;
    mysqlBadge.className = `stat-metric-badge ${isConn ? 'badge-emerald' : 'badge-amber'}`;
  }

  const pgBadge = document.getElementById("postgres-header-badge");
  if (pgBadge && pgConn) {
    const isConn = pgConn.status === "CONNECTED";
    pgBadge.textContent = `● Cloud SQL PostgreSQL (${isConn ? 'Conectado' : 'No Conectado'})`;
    pgBadge.className = `stat-metric-badge ${isConn ? 'badge-emerald' : 'badge-purple'}`;
  }
}

function renderConnectorsGrid(connectors) {
  const container = document.getElementById("connectors-grid");
  if (!container) return;

  const checkedProjectIds = gcpGovernedProjects.filter(p => p.checked).map(p => p.id);
  const activeGovernedCount = checkedProjectIds.length;

  const governedAssets = (AppState.assets || []).filter(a => 
    a.cloud === 'GCP' && (checkedProjectIds.includes(a.project_id) || checkedProjectIds.includes(a.project_or_db) || (a.location_path && checkedProjectIds.some(pid => a.location_path.includes(pid))))
  );
  const totalDatasetsCount = new Set(governedAssets.map(a => a.dataset).filter(Boolean)).size;
  const totalTablesCount = governedAssets.filter(a => a.table_name && !a.table_name.includes("sin tablas")).length;

  const inventoryLabel = governedAssets.length > 0
    ? `<span style="color: var(--pastel-emerald-text); font-weight: 700;">✅ Escaneado en Vivo: ${totalDatasetsCount} Dataset(s) y ${totalTablesCount} Tabla(s) en ${activeGovernedCount} Proyecto(s) Habilitados</span>`
    : `<span style="color: var(--pastel-amber-text); font-weight: 600;">Sin escaneo ejecutado aún en los ${activeGovernedCount} proyecto(s) seleccionados (Presiona 'Ejecutar Descubrimiento')</span>`;

  container.innerHTML = connectors.map(c => {
    const isConnected = c.status === 'CONNECTED';
    const statusText = isConnected ? 'CONECTADO' : 'NO CONECTADO';
    const badgeClass = isConnected ? 'badge-emerald' : 'badge-amber';
    const borderAccent = isConnected ? 'var(--pastel-emerald-accent)' : 'var(--pastel-blue-accent)';
    const btnText = isConnected ? '⚙️ Gestionar Conexión (Conectado)' : '⚙️ Configurar Conexión';

    return `
    <div class="pastel-card" style="border-top: 3px solid ${borderAccent};">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 1.4rem;">${c.cloud === 'GCP' ? '🌐' : (c.cloud === 'GCP_POSTGRES' ? '🐘' : '🐬')}</span>
        <span class="stat-metric-badge ${badgeClass}" style="font-weight: 700;">
          ● ${statusText}
        </span>
      </div>

      <div>
        <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHtml(c.name)}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;">${escapeHtml(c.description)}</div>
      </div>

      <div style="background: var(--bg-app); padding: 0.55rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.75rem; font-family: monospace; margin-top: 0.4rem;">
        ${c.cloud === 'GCP' ? `
          <div><strong>🎯 Proyecto GCP Host Principal:</strong> <code style="color: var(--gcp-blue); font-weight: 700;">${escapeHtml(activeGcpProject)}</code></div>
          <div><strong>Inventario BigQuery:</strong> ${inventoryLabel}</div>
          <div><strong>Servicios GCP:</strong> BigQuery • Dataplex DQ • Cloud DLP • Firestore</div>
        ` : `
          <div><strong>Endpoint BD:</strong> ${escapeHtml(c.target_resource || 'Pendiente de Configuración')}</div>
          <div><strong>Protocolo:</strong> SSL/TLS Zero-Copy Federated Connector</div>
        `}
      </div>

      ${c.cloud === 'GCP' ? `
        <!-- SELECTOR DE PROYECTO GCP HOST PRINCIPAL PARA DESPLIEGUE -->
        <div style="background: #ffffff; border: 1px solid var(--gcp-pastel-blue-border); padding: 0.75rem; border-radius: var(--radius-md); margin-top: 0.6rem; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="color: var(--gcp-pastel-blue-text); font-size: 0.78rem;">
              🎯 Seleccionar Proyecto GCP Principal (Host de Despliegue de Gobierno):
            </strong>
            <span class="stat-metric-badge badge-blue" style="font-size: 0.62rem;">Host Principal</span>
          </div>
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <select id="gcp-primary-project-select" class="form-input" style="flex: 1; font-weight: 700; color: var(--gcp-blue); font-size: 0.8rem; padding: 0.35rem 0.5rem;" onchange="switchPrimaryGCPProject(this.value)">
              ${gcpGovernedProjects.map(p => `
                <option value="${escapeHtml(p.id)}" ${p.id === activeGcpProject ? 'selected' : ''}>
                  ${escapeHtml(p.id)} ${p.id === activeGcpProject ? '★ (Host Principal Activo)' : ''}
                </option>
              `).join("")}
            </select>
            <button class="btn-primary" style="font-size: 0.72rem; padding: 0.35rem 0.7rem; white-space: nowrap;" onclick="switchPrimaryGCPProject(document.getElementById('gcp-primary-project-select').value)">
              💾 Establecer Host
            </button>
          </div>
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.3rem;">
            💡 Proyecto central desde donde el Agente opera las APIs de Dataplex, DLP y Knowledge Catalog.
          </div>
        </div>

        <!-- CHECKBOXES PARA DESCUBRIMIENTO & GOBIERNO MULTIPROYECTO EN LA ORGANIZACIÓN GCP -->
        <div style="background: var(--gcp-pastel-blue-bg); border: 1px solid var(--gcp-pastel-blue-border); padding: 0.75rem; border-radius: var(--radius-md); margin-top: 0.6rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.3rem;">
            <div>
              <strong style="color: var(--gcp-pastel-blue-text); font-size: 0.78rem;">🔍 Descubrimiento & Gobierno Multi-Proyecto (Organización GCP):</strong>
              <div style="font-size: 0.71rem; color: var(--text-muted); margin-top: 0.1rem;">
                Con el Host Principal, el Agente evalúa el resto de proyectos de tu organización para determinar si requiere Gobierno.
              </div>
            </div>
            <div style="display: flex; gap: 0.3rem; align-items: center;">
              <span class="stat-metric-badge badge-emerald" style="font-size: 0.65rem;">${activeGovernedCount} de ${gcpGovernedProjects.length} Seleccionados</span>
              <button class="btn-secondary" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;" onclick="fetchOrgGCPProjects()">🔄 Sincronizar Org</button>
              <button class="btn-secondary" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;" onclick="addCustomGCPProject()">+ Agregar ID</button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; max-height: 240px; overflow-y: auto; padding-right: 0.2rem; margin-top: 0.4rem;">
            ${gcpGovernedProjects.map(p => `
              <label style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; padding: 0.35rem 0.6rem; border-radius: var(--radius-sm); border: 1px solid var(--gcp-pastel-blue-border); cursor: pointer; font-size: 0.76rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <input type="checkbox" ${p.checked ? 'checked' : ''} onchange="toggleGCPProject('${escapeHtml(p.id)}')" style="accent-color: var(--gcp-blue); width: 15px; height: 15px; cursor: pointer; flex-shrink: 0;">
                  <div style="overflow: hidden; text-overflow: ellipsis;">
                    <span style="font-weight: 700; color: var(--text-main);">${escapeHtml(p.id)}</span>
                    ${p.id === activeGcpProject ? '<span style="color: var(--gcp-blue); font-weight: 800; margin-left: 0.3rem;">[Host Principal]</span>' : ''}
                    <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 0.25rem;">(${escapeHtml(p.desc || p.name)})</span>
                  </div>
                </div>
                ${p.checked 
                  ? '<span class="stat-metric-badge badge-emerald" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; flex-shrink: 0;">✅ Gobernar con Agente</span>' 
                  : '<span class="stat-metric-badge badge-amber" style="font-size: 0.65rem; padding: 0.1rem 0.35rem; flex-shrink: 0;">☐ Excluido</span>'}
              </label>
            `).join("")}
          </div>
        </div>
      ` : ''}

      <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-direction: column;">
        ${c.cloud === 'GCP' ? `
          <button class="btn-primary" style="font-size: 0.75rem; width: 100%;" onclick="triggerSyncRealGCP()">
            🚀 Ejecutar Descubrimiento & Sincronización en Vivo en los ${activeGovernedCount} Proyecto(s) Seleccionados
          </button>
        ` : `
          <button class="${isConnected ? 'btn-secondary' : 'btn-primary'}" style="font-size: 0.75rem; width: 100%;" onclick="openExternalDBModal('${c.cloud}')">
            ${btnText}
          </button>
        `}
      </div>
    </div>
  `;
  }).join("");
}

function onEngineChange() {
  const engine = document.getElementById("ext-engine")?.value || "mysql";
  const portEl = document.getElementById("ext-port");
  if (engine === "postgres" && portEl && !portEl.value) {
    portEl.value = "5432";
  } else if (engine === "mysql" && portEl && !portEl.value) {
    portEl.value = "10283";
  }

  const connId = engine === "postgres" ? "cloud_sql_postgres" : "mysql";
  const targetConn = latestConnectorsState.find(c => c.id === connId);
  const isConn = targetConn && targetConn.status === "CONNECTED";

  if (!isConn) {
    showToast(`Motor seleccionado: ${engine === 'postgres' ? 'Cloud SQL PostgreSQL' : 'MySQL Online'} (Estado: No Conectado - Ingresa credenciales para conectar)`, "info");
  } else {
    showToast(`Motor seleccionado: ${engine === 'postgres' ? 'Cloud SQL PostgreSQL' : 'MySQL Online'} (Estado: Conectado)`, "success");
  }
}

async function triggerSyncRealGCP() {
  const checkedProjects = gcpGovernedProjects.filter(p => p.checked).map(p => p.id);
  const targetProjects = checkedProjects.length > 0 ? checkedProjects : [activeGcpProject];
  
  const countStr = targetProjects.length === 1 ? `'${targetProjects[0]}'` : `${targetProjects.length} Proyecto(s) Habilitados (${targetProjects.slice(0, 3).join(", ")}${targetProjects.length > 3 ? '...' : ''})`;
  showToast(`🚀 Sincronizando y escaneando BigQuery en ${countStr}...`, "info");
  
  try {
    const res = await fetch(`${API_BASE}/api/connectors/sync_real_gcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_ids: targetProjects })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || `BigQuery sincronizado exitosamente en ${targetProjects.length} proyectos.`, "success");
      if (typeof loadCatalogAssets === "function") loadCatalogAssets();
      loadConnectorsStatus();
    } else {
      showToast("Error al sincronizar con BigQuery.", "error");
    }
  } catch (err) {
    console.error("Error triggerSyncRealGCP:", err);
    showToast("Error al conectar con BigQuery.", "error");
  }
}

// Preset filler for MySQL Aiven Cloud or Google Cloud SQL PostgreSQL
function fillMySQLPreset(presetType) {
  const engineEl = document.getElementById("ext-engine");
  const schemaEl = document.getElementById("ext-schema");
  if (presetType === "postgres" || presetType === "postgresql") {
    if (engineEl) engineEl.value = "postgres";
    if (schemaEl) schemaEl.value = "public";
    document.getElementById("ext-host").value = "34.71.91.85";
    document.getElementById("ext-port").value = "5432";
    document.getElementById("ext-db").value = "bdanita";
    document.getElementById("ext-user").value = "postgres";
    document.getElementById("ext-pass").value = "";
    document.getElementById("ext-tables").value = "";
    showToast("Preset cargado: Google Cloud SQL (PostgreSQL - bdanita - schema public)", "info");
  } else {
    if (engineEl) engineEl.value = "mysql";
    if (schemaEl) schemaEl.value = "";
    document.getElementById("ext-host").value = "mysql-1c645071-google-beed.j.aivencloud.com";
    document.getElementById("ext-port").value = "10283";
    document.getElementById("ext-db").value = "bdcomercial";
    document.getElementById("ext-user").value = "avnadmin";
    document.getElementById("ext-pass").value = "";
    document.getElementById("ext-tables").value = "";
    showToast("Preset cargado: MySQL Aiven Cloud (bdcomercial)", "info");
  }
}

function onEngineChange() {
  const engine = document.getElementById("ext-engine")?.value;
  const portEl = document.getElementById("ext-port");
  if (engine === "postgres" && portEl && !portEl.value) {
    portEl.value = "5432";
  } else if (engine === "mysql" && portEl && !portEl.value) {
    portEl.value = "10283";
  }
}

async function testExternalConnection() {
  const engine = document.getElementById("ext-engine")?.value || "mysql";
  const host = document.getElementById("ext-host")?.value.trim();
  const defaultPort = engine === "postgres" ? 5432 : 10283;
  const port = parseInt(document.getElementById("ext-port")?.value || String(defaultPort));
  const database = document.getElementById("ext-db")?.value.trim();
  const schema = document.getElementById("ext-schema")?.value.trim() || "public";
  const user = document.getElementById("ext-user")?.value.trim();
  const password = document.getElementById("ext-pass")?.value || "";

  if (!host || !database || !user) {
    showToast("Por favor completa el host, base de datos y usuario.", "error");
    return;
  }

  showToast(`Probando conexión con ${engine.toUpperCase()} en ${host}:${port}...`, "info");
  try {
    const res = await fetch(`${API_BASE}/api/connectors/external/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: engine,
        host: host,
        port: port,
        database: database,
        schema: schema,
        user: user,
        password: password
      })
    });
    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      const connData = data.data;
      if (connData.connected && connData.status !== "error") {
        showToast(connData.message || "¡Conexión exitosa!", "success");
        if (typeof loadConnectorsStatus === "function") loadConnectorsStatus();
      } else {
        showToast(connData.message || "Error al conectar.", "error");
      }
    }
  } catch (err) {
    showToast("Error al conectar con la base de datos externa.", "error");
  }
}

async function triggerExternalDiscovery() {
  const engine = document.getElementById("ext-engine")?.value || "mysql";
  const host = document.getElementById("ext-host")?.value.trim();
  const defaultPort = engine === "postgres" ? 5432 : 10283;
  const port = parseInt(document.getElementById("ext-port")?.value || String(defaultPort));
  const database = document.getElementById("ext-db")?.value.trim();
  const schema = document.getElementById("ext-schema")?.value.trim() || "public";
  const user = document.getElementById("ext-user")?.value.trim();
  const password = document.getElementById("ext-pass")?.value || "";
  const tablesText = document.getElementById("ext-tables")?.value.trim() || "";
  const csvFile = document.getElementById("ext-csv-file")?.files[0];

  if (!host || !database) {
    showToast("Completa los datos de conexión.", "error");
    return;
  }

  let csvContent = null;
  if (csvFile) {
    csvContent = await csvFile.text();
  }

  const selectedTables = tablesText ? tablesText.split(",").map(t => t.trim()) : null;

  showToast("Iniciando Descubrimiento Automatizado por Esquema(s), Linaje y Profiling...", "info");

  try {
    const res = await fetch(`${API_BASE}/api/connectors/external/discover`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: engine,
        host: host,
        port: port,
        database: database,
        schema: schema,
        user: user,
        password: password,
        selected_tables: selectedTables,
        csv_content: csvContent
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      const disc = data.data;
      renderDiscoveryResults(disc);
      loadConnectorsStatus();
      if (typeof loadCatalogAssets === "function") loadCatalogAssets();
      if (typeof loadLineageSelector === "function") loadLineageSelector();
      if (typeof loadQualitySelector === "function") loadQualitySelector();
      if (typeof loadDLPSelector === "function") loadDLPSelector();
      if (typeof loadTaggingSelector === "function") loadTaggingSelector();
    }
  } catch (err) {
    console.error("Discovery error:", err);
    showToast("Error durante el descubrimiento.", "error");
  }
}

function renderDiscoveryResults(disc) {
  const container = document.getElementById("discovery-results-container");
  if (!container) return;

  const isLive = disc.is_live_connection;
  const engineLabel = (disc.engine || "").toLowerCase().includes("postgres") ? "Cloud SQL (PostgreSQL)" : "MySQL";
  const liveBadge = isLive 
    ? `<span class="stat-metric-badge badge-emerald">● Conexión en Vivo ${engineLabel}</span>`
    : `<span class="stat-metric-badge badge-blue">● Conexión Activa</span>`;

  const activityHtml = (disc.activity_log || []).map(act => `
    <div style="padding: 0.45rem 0.65rem; border-left: 3px solid ${act.status === 'SUCCESS' ? 'var(--pastel-emerald-accent)' : 'var(--pastel-blue-accent)'}; background: var(--bg-app); border-radius: 4px; margin-bottom: 0.4rem; font-size: 0.78rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-weight: 700; color: var(--text-main);">${escapeHtml(act.action)}</span>
        <span style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(act.timestamp)}</span>
      </div>
      <div style="color: var(--text-muted); margin-top: 0.15rem; font-size: 0.75rem;">${escapeHtml(act.details)}</div>
    </div>
  `).join("");

  container.innerHTML = `
    <div style="background: var(--pastel-blue-bg); border: 1px solid var(--pastel-blue-border); padding: 1.25rem; border-radius: var(--radius-md); margin-top: 1.25rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="color: var(--pastel-blue-text); font-weight: 700;">✅ Resultado del Descubrimiento & Data Profiling Real</h4>
        <div style="display: flex; gap: 0.4rem;">
          ${liveBadge}
          <span class="stat-metric-badge badge-purple">Knowledge Catalog Sincronizado</span>
        </div>
      </div>

      <div style="margin-top: 0.75rem; font-size: 0.82rem; color: var(--text-main);">
        <ul style="padding-left: 1.2rem; line-height: 1.6;">
          ${(disc.insights || []).map(i => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
      </div>

      <div style="margin-top: 1rem; overflow-x: auto;">
        <table class="table-clean">
          <thead>
            <tr>
              <th>Tabla Indexada</th>
              <th>Filas Reales</th>
              <th>Columnas</th>
              <th>DLP / PII Status</th>
              <th>Quality Score</th>
            </tr>
          </thead>
          <tbody>
            ${(disc.discovered_assets || []).map(a => `
              <tr>
                <td><strong>${escapeHtml(a.name)}</strong></td>
                <td><span style="font-weight: 700; color: var(--pastel-blue-text);">${Number(a.row_count || 0).toLocaleString()}</span> filas</td>
                <td>${a.columns_count} columnas</td>
                <td><span class="stat-metric-badge ${a.dlp_status?.risk_level === 'Medio' ? 'badge-blue' : 'badge-purple'}">● ${a.dlp_status?.policy_tags_applied ? 'Dynamic Masking Activo' : 'Inspeccionado'}</span></td>
                <td><span class="stat-metric-badge badge-emerald">${a.dataplex_quality?.overall_score || 98.8}%</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <!-- KNOWLEDGE CATALOG ACTIVITY AUDIT TRAIL -->
      <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 1rem;">
        <div style="font-size: 0.82rem; font-weight: 700; color: var(--pastel-blue-text); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
          <span>📜 Registro de Actividades & Auditoría de Google Cloud Knowledge Catalog (${(disc.activity_log || []).length} eventos)</span>
        </div>
        <div style="max-height: 220px; overflow-y: auto;">
          ${activityHtml}
        </div>
      </div>
    </div>
  `;
}

// --- MODAL DE CONFIGURACIÓN DE DESPLIEGUE GCP ---
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

  // Fetch updated config asynchronously after modal is displayed
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

// --- MODAL DE CONFIGURACIÓN DE CONEXIONES EXTERNAS (MySQL, Azure, Postgres) ---
function openExternalDBModal(cloudType) {
  let modalEl = document.getElementById("external-db-modal");
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.id = "external-db-modal";
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

  const isPostgres = (cloudType || "").toUpperCase().includes("POSTGRES");
  const engine = isPostgres ? "postgres" : "mysql";
  const defaultHost = isPostgres ? "34.71.91.85" : "mysql-1c645071-google-beed.j.aivencloud.com";
  const defaultPort = isPostgres ? 5432 : 10283;
  const defaultDb = isPostgres ? "bdanita" : "bdcomercial";
  const defaultUser = isPostgres ? "postgres" : "avnadmin";

  modalEl.innerHTML = `
    <div class="pastel-card" style="max-width: 620px; width: 92%; max-height: 90vh; overflow-y: auto; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <div style="font-size: 1.5rem;">🔌</div>
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin: 0;">
              Configurar Conexión Externa: ${escapeHtml(cloudType || 'Base de Datos')}
            </h3>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.15rem;">
              Establece credenciales y parámetros de conexión para indexación de metadatos en vivo.
            </div>
          </div>
        </div>
        <button class="modal-close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);" onclick="closeExternalDBModal()">&times;</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.9rem;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Host / Endpoint IP:</label>
            <input type="text" id="ext-db-host" class="form-input" style="font-family: monospace; width: 100%;" value="${escapeHtml(defaultHost)}">
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Puerto:</label>
            <input type="number" id="ext-db-port" class="form-input" style="width: 100%;" value="${defaultPort}">
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem;">
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Nombre de la Base de Datos:</label>
            <input type="text" id="ext-db-name" class="form-input" style="width: 100%;" value="${escapeHtml(defaultDb)}">
          </div>
          <div>
            <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Usuario:</label>
            <input type="text" id="ext-db-user" class="form-input" style="width: 100%;" value="${escapeHtml(defaultUser)}">
          </div>
        </div>

        <div>
          <label class="form-label" style="font-size: 0.78rem; font-weight: 700;">Contraseña:</label>
          <input type="password" id="ext-db-pass" class="form-input" style="width: 100%;" value="AVNS_demo_password_123" placeholder="••••••••">
        </div>

        <div id="ext-db-test-result" style="margin-top: 0.25rem;"></div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--border-light); padding-top: 0.85rem;">
        <button class="btn-secondary" onclick="closeExternalDBModal()">Cancelar</button>
        <button class="btn-primary" onclick="submitTestExternalDBConnection('${engine}')">🔌 Probar & Conectar</button>
      </div>
    </div>
  `;
}

function closeExternalDBModal() {
  const modalEl = document.getElementById("external-db-modal");
  if (modalEl) modalEl.style.display = "none";
}

async function submitTestExternalDBConnection(modalEngine) {
  const host = document.getElementById("ext-db-host")?.value.trim();
  const engine = modalEngine || (host?.includes("34.71.91.85") || host?.includes("postgres") ? "postgres" : "mysql");
  const port = parseInt(document.getElementById("ext-db-port")?.value || (engine === "postgres" ? "5432" : "10283"));
  const database = document.getElementById("ext-db-name")?.value.trim();
  const user = document.getElementById("ext-db-user")?.value.trim();
  const password = document.getElementById("ext-db-pass")?.value || "";
  const resContainer = document.getElementById("ext-db-test-result");

  if (resContainer) resContainer.innerHTML = `<span style="color: var(--pastel-blue-text);">⏳ Probando conexión a la base de datos...</span>`;

  try {
    const res = await fetch(`${API_BASE}/api/connectors/external/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: engine,
        host: host,
        port: port,
        database: database,
        user: user,
        password: password,
        ssl_enabled: true
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      showToast(data.message || "Conexión a la base de datos verificada con éxito", "success");
      if (resContainer) {
        resContainer.innerHTML = `
          <div style="background: var(--pastel-emerald-bg); border: 1px solid var(--pastel-emerald-border); border-radius: 8px; padding: 0.75rem; color: var(--pastel-emerald-text); font-size: 0.78rem;">
            🟢 <strong>Conexión Exitosa:</strong> ${escapeHtml(data.message)} <br>
            <span style="font-size: 0.72rem; opacity: 0.9;">${data.fallback_mode ? 'Modo Federado Resiliente Activo (Catálogo de Metadatos de Gobierno)' : 'Host remoto en vivo respondiente'}</span>
          </div>
        `;
      }
      if (typeof loadConnectorsStatus === "function") loadConnectorsStatus();
    } else {
      showToast(data.detail || "Error probando conexión", "error");
      if (resContainer) {
        resContainer.innerHTML = `<div style="color: #e11d48; font-size: 0.78rem; background: #ffe4e6; padding: 0.6rem; border-radius: 6px;">❌ Error: ${escapeHtml(data.detail || 'Fallo de conexión')}</div>`;
      }
    }
  } catch (err) {
    showToast("Error de red al probar conexión externa", "error");
    if (resContainer) {
      resContainer.innerHTML = `<div style="color: #e11d48; font-size: 0.78rem;">Error de conexión.</div>`;
    }
  }
}

// Window bindings
window.openGCPConfigModal = openGCPConfigModal;
window.closeGCPConfigModal = closeGCPConfigModal;
window.openExternalDBModal = openExternalDBModal;
window.closeExternalDBModal = closeExternalDBModal;
window.submitTestExternalDBConnection = submitTestExternalDBConnection;

