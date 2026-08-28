/**
 * Knowledge Catalog & Context Graph UI Controller
 */

let currentCatalogCloudFilter = "all";
let currentCatalogDomainFilter = "all";

function initCatalog() {
  loadCatalogAssets();

  const searchInput = document.getElementById("catalog-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", debounce(() => {
      const q = searchInput.value.trim();
      if (q.length > 0) {
        searchAssets(q);
      } else {
        loadCatalogAssets(currentCatalogCloudFilter);
      }
    }, 300));
  }
}

function handleDisabledCloudClick(cloudName) {
  showToast(`⚠️ La opción de ${cloudName} se encuentra deshabilitada ya que actualmente solo se han conectado fuentes de Google Cloud (GCP) y On-Premise (MySQL / PostgreSQL).`, "warning");
}

function selectCatalogCloudFilter(cloud, btnEl) {
  if (cloud === "AWS" || cloud === "Azure") {
    handleDisabledCloudClick(cloud === "AWS" ? "Amazon Web Services (AWS)" : "Microsoft Azure");
    return;
  }

  currentCatalogCloudFilter = cloud;

  // Update pills UI
  document.querySelectorAll(".catalog-cloud-pill").forEach(p => p.classList.remove("active"));
  if (btnEl) {
    btnEl.classList.add("active");
  } else {
    const matchingPill = document.querySelector(`.catalog-cloud-pill[data-cloud="${cloud}"]`);
    if (matchingPill) matchingPill.classList.add("active");
  }

  // Sync select element if present
  const selectEl = document.getElementById("filter-cloud");
  if (selectEl && selectEl.value !== cloud) {
    selectEl.value = cloud;
  }

  loadCatalogAssets(cloud);
}

function onCatalogCloudSelectChange(cloudVal) {
  if (cloudVal === "AWS" || cloudVal === "Azure") {
    handleDisabledCloudClick(cloudVal === "AWS" ? "Amazon Web Services (AWS)" : "Microsoft Azure");
    const selectEl = document.getElementById("filter-cloud");
    if (selectEl) selectEl.value = currentCatalogCloudFilter;
    return;
  }

  selectCatalogCloudFilter(cloudVal);
}

function onCatalogDomainSelectChange(domainVal) {
  currentCatalogDomainFilter = domainVal || "all";
  loadCatalogAssets(currentCatalogCloudFilter);
}

async function loadCatalogAssets(cloud = "all") {
  try {
    let url = `${API_BASE}/api/catalog/assets`;
    const params = [];
    if (cloud && cloud !== "all") {
      params.push(`cloud=${encodeURIComponent(cloud)}`);
    }
    if (currentCatalogDomainFilter && currentCatalogDomainFilter !== "all") {
      params.push(`domain=${encodeURIComponent(currentCatalogDomainFilter)}`);
    }
    if (params.length > 0) {
      url += `?${params.join("&")}`;
    }

    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "success") {
      let filteredAssets = data.data || [];

      // Filter out disabled clouds (AWS / Azure) in all view since only GCP and On-Premises are connected
      if (cloud === "all") {
        filteredAssets = filteredAssets.filter(a => {
          const c = (a.cloud || "").toUpperCase();
          return c !== "AWS" && c !== "AZURE";
        });
      }

      // Domain filter on client side if needed
      if (currentCatalogDomainFilter && currentCatalogDomainFilter !== "all") {
        filteredAssets = filteredAssets.filter(a => (a.domain || "").toLowerCase() === currentCatalogDomainFilter.toLowerCase());
      }

      AppState.assets = filteredAssets;
      renderAssetCards(filteredAssets);
    }
  } catch (err) {
    console.error("Error loading catalog assets:", err);
  }
}

async function searchAssets(query) {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.status === "success") {
      let results = data.data || [];
      // Filter out disabled clouds (AWS/Azure)
      results = results.filter(a => {
        const c = (a.cloud || "").toUpperCase();
        return c !== "AWS" && c !== "AZURE";
      });
      renderAssetCards(results);
    }
  } catch (err) {
    console.error("Error searching assets:", err);
  }
}

function renderAssetCards(assets) {
  const grid = document.getElementById("assets-grid");
  if (!grid) return;

  if (!assets || assets.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: #ffffff; border: 1px dashed var(--border-light); border-radius: var(--radius-lg);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
        <strong style="color: var(--text-main); font-size: 1rem;">No se encontraron esquemas técnicos ni tablas activas</strong>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
          Prueba cambiando los filtros de nubes conectadas (GCP / On-Premises) o busca otro término.
        </p>
      </div>
    `;
    return;
  }

  grid.innerHTML = assets.map(asset => {
    const cloudRaw = (asset.cloud || "").toUpperCase();
    const isAwsOrAzure = cloudRaw.includes("AWS") || cloudRaw.includes("AZURE");
    
    // Cloud badge styling
    let cloudIcon = "☁️";
    let cloudBadgeClass = "badge-blue";
    let cloudDisplayName = `${asset.cloud} • ${asset.service || 'Data Lakehouse'}`;

    if (cloudRaw.includes("GCP") || cloudRaw.includes("BIGQUERY")) {
      cloudIcon = "☁️";
      cloudBadgeClass = "badge-blue";
      cloudDisplayName = `GCP • BigQuery`;
    } else if (cloudRaw.includes("MYSQL") || (asset.id && asset.id.includes("mysql"))) {
      cloudIcon = "🐬";
      cloudBadgeClass = "badge-emerald";
      cloudDisplayName = `On-Premises • MySQL`;
    } else if (cloudRaw.includes("POSTGRES") || (asset.id && asset.id.includes("pg"))) {
      cloudIcon = "🐘";
      cloudBadgeClass = "badge-purple";
      cloudDisplayName = `On-Premises • Cloud SQL PG`;
    } else if (isAwsOrAzure) {
      cloudIcon = "🔒";
      cloudBadgeClass = "badge-gray";
      cloudDisplayName = `${asset.cloud} • Deshabilitado`;
    }

    const qualityScore = asset.dataplex_quality?.overall_score || 95;
    const qualityBadgeColor = qualityScore >= 90 ? "var(--pastel-emerald-text)" : "var(--pastel-amber-text)";
    const dlpRisk = asset.dlp_status?.risk_level || "Bajo";

    return `
      <div class="asset-card ${isAwsOrAzure ? 'asset-card-disabled' : ''}" style="${isAwsOrAzure ? 'opacity: 0.65; border: 1px dashed var(--border-light);' : 'border-top: 3px solid var(--gcp-pastel-blue-border);'}">
        <div class="asset-header">
          <div style="width: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="stat-metric-badge ${cloudBadgeClass}" style="font-weight: 700;">
                ${cloudIcon} ${cloudDisplayName}
              </span>
              ${isAwsOrAzure ? '<span class="stat-metric-badge badge-gray" style="font-size: 0.65rem;">🔒 NO CONECTADO</span>' : '<span class="stat-metric-badge badge-emerald" style="font-size: 0.65rem;">● ACTIVO</span>'}
            </div>
            <h3 class="asset-name" style="margin-top: 0.45rem; font-size: 1.05rem;">${escapeHtml(asset.name)}</h3>
            <span class="asset-table-sub" style="font-family: 'JetBrains Mono', monospace; font-size: 0.74rem;">${escapeHtml(asset.project_or_db)}.${escapeHtml(asset.dataset)}.${escapeHtml(asset.table_name)}</span>
          </div>
        </div>

        <p class="asset-desc" style="font-size: 0.8rem; line-height: 1.4; color: var(--text-muted);">${escapeHtml(asset.description)}</p>

        <div class="metrics-row" style="background: var(--bg-app); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 0.5rem 0.75rem; margin: 0.6rem 0;">
          <div>
            <span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">CALIDAD DATAPLEX</span>
            <div style="font-weight: 800; color: ${qualityBadgeColor}; font-size: 0.95rem;">${qualityScore}%</div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">RIESGO DLP</span>
            <div style="font-weight: 800; color: ${dlpRisk.includes('Alto') || dlpRisk.includes('Crítico') ? 'var(--pastel-rose-text)' : 'var(--pastel-blue-text)'}; font-size: 0.95rem;">${dlpRisk}</div>
          </div>
          <div>
            <span style="color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">COLUMNAS</span>
            <div style="font-weight: 800; color: var(--text-main); font-size: 0.95rem;">${asset.columns?.length || 0}</div>
          </div>
        </div>

        ${isAwsOrAzure ? `
          <div style="font-size: 0.72rem; color: var(--text-muted); padding: 0.4rem; background: var(--bg-subtle); border-radius: var(--radius-sm); text-align: center;">
            🔒 <em>Fuente no disponible. Solo GCP y On-Premise están activos.</em>
          </div>
        ` : `
          <div class="asset-actions" style="display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: auto;">
            <button class="btn-secondary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="runSQLDryRunForAsset('${asset.id}')">⚡ Dry Run SQL</button>
            <button class="btn-secondary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="generateLookMLForAsset('${asset.id}')">📊 LookML</button>
            <button class="btn-secondary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="openAssetDetailModal('${asset.id}')">📋 Esquema</button>
            <button class="btn-secondary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="viewLineageForAsset('${asset.id}')">🔗 Linaje</button>
            <button class="btn-secondary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="navigateToAssetTagging('${asset.id}')">🏷️ Tags</button>
            <button class="btn-primary" style="font-size: 0.74rem; padding: 0.35rem 0.6rem;" onclick="openMetadataEditModal('${asset.id}')">✏️ Editar</button>
          </div>
        `}
      </div>
    `;
  }).join("");
}

function navigateToAssetTagging(assetId) {
  const taggingBtn = document.querySelector('[data-pane="pane-tagging"]');
  if (taggingBtn) {
    taggingBtn.click();
  } else {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content-pane").forEach(p => p.classList.remove("active"));
    const pane = document.getElementById("pane-tagging");
    if (pane) pane.classList.add("active");
  }
  if (typeof selectTaggingAsset === "function") {
    selectTaggingAsset(assetId);
  }
}

async function openAssetDetailModal(assetId) {
  try {
    const res = await fetch(`${API_BASE}/api/catalog/assets/${assetId}`);
    const data = await res.json();
    if (data.status !== "success") return;

    const asset = data.data;
    AppState.selectedAsset = asset;

    const modal = document.getElementById("asset-detail-modal");
    const titleEl = document.getElementById("modal-asset-title");
    const bodyEl = document.getElementById("modal-asset-body");

    if (titleEl) titleEl.innerText = `${asset.name} (${asset.cloud} - ${asset.service})`;

    const columnsHtml = (asset.columns || []).map(col => `
      <tr>
        <td><strong>${escapeHtml(col.name)}</strong></td>
        <td><code>${escapeHtml(col.type)}</code></td>
        <td>${escapeHtml(col.description || "-")}</td>
        <td>${col.is_pii ? `<span class="pii-badge">${escapeHtml(col.dlp_info_type || 'PII')}</span>` : `<span style="color: #9ca3af;">No</span>`}</td>
        <td>${col.policy_tag ? `<span class="tag-badge">${escapeHtml(col.policy_tag)}</span>` : `<span style="color: #6b7280;">Ninguno</span>`}</td>
        <td>${col.masked ? `🔒 Enmascarado` : `👁️ Visible`}</td>
      </tr>
    `).join("");

    bodyEl.innerHTML = `
      <div>
        <p style="color: #d1d5db; margin-bottom: 0.5rem;"><strong>Descripción:</strong> ${escapeHtml(asset.description)}</p>
        <p style="color: #9ca3af; font-size: 0.85rem;"><strong>Data Steward:</strong> ${escapeHtml(asset.steward || "No asignado")}</p>
        <p style="color: #9ca3af; font-size: 0.85rem;"><strong>Ubicación Física:</strong> <code>${escapeHtml(asset.project_or_db)}.${escapeHtml(asset.dataset)}.${escapeHtml(asset.table_name)}</code></p>
      </div>

      <h4 style="margin-top: 0.75rem; color: #93c5fd; font-size: 0.95rem;">Esquema y Clasificación de Columnas</h4>
      <div style="overflow-x: auto;">
        <table class="governance-table">
          <thead>
            <tr>
              <th>Columna</th>
              <th>Tipo</th>
              <th>Descripción</th>
              <th>DLP PII</th>
              <th>Policy Tag</th>
              <th>Enmascaramiento</th>
            </tr>
          </thead>
          <tbody>
            ${columnsHtml}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 1rem;">
        <h4 style="color: #93c5fd; font-size: 0.95rem; margin-bottom: 0.4rem;">Golden Query Pre-Aprobada</h4>
        <pre><code>${escapeHtml(asset.golden_query || "SELECT * FROM dataset.table LIMIT 10;")}</code></pre>
      </div>
    `;

    if (modal) modal.style.display = "flex";
  } catch (err) {
    console.error("Error opening asset modal:", err);
  }
}

function openMetadataEditModal(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;

  const modal = document.getElementById("metadata-modal");
  const idInput = document.getElementById("edit-asset-id");
  const locDiv = document.getElementById("edit-asset-location");
  const descInput = document.getElementById("edit-asset-description");
  const stewardInput = document.getElementById("edit-asset-steward");
  const goldenInput = document.getElementById("edit-asset-golden-query");
  const titleEl = document.getElementById("modal-asset-title");

  if (idInput) idInput.value = asset.id;
  if (titleEl) titleEl.innerText = `Editar Metadatos: ${asset.name}`;
  if (locDiv) locDiv.innerText = `${asset.project_or_db}.${asset.dataset}.${asset.table_name}`;
  if (descInput) descInput.value = asset.description || "";
  if (stewardInput) stewardInput.value = asset.steward || "";
  if (goldenInput) goldenInput.value = asset.golden_query || "";

  if (modal) modal.style.display = "flex";
}

async function saveMetadataEdits() {
  const assetId = document.getElementById("edit-asset-id")?.value;
  const description = document.getElementById("edit-asset-description")?.value.trim();
  const steward = document.getElementById("edit-asset-steward")?.value.trim();
  const golden_query = document.getElementById("edit-asset-golden-query")?.value.trim();

  if (!assetId) return;

  try {
    const res = await fetch(`${API_BASE}/api/catalog/assets/${assetId}/update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, steward, golden_query })
    });
    const data = await res.json();
    if (data.status === "success") {
      showToast("Metadatos actualizados en Knowledge Catalog", "success");
      closeAllModals();
      loadCatalogAssets(currentCatalogCloudFilter);
    }
  } catch (err) {
    console.error("Error updating metadata:", err);
    showToast("Error al guardar cambios de metadatos", "error");
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-backdrop").forEach(m => m.style.display = "none");
}

async function runSQLDryRunForAsset(assetId) {
  const asset = AppState.assets.find(a => a.id === assetId);
  if (!asset) return;
  const sql = asset.golden_query || `SELECT * FROM \`${asset.project_or_db}.${asset.dataset}.${asset.table_name}\` LIMIT 100;`;
  
  try {
    showToast("Ejecutando Dry Run en BigQuery GCP...", "info");
    const res = await fetch(`${API_BASE}/api/sql/dry_run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql, project_id: asset.project_or_db })
    });
    const data = await res.json();
    if (data.status === "success") {
      alert(`⚡ RESULTADO DRY RUN BIGQUERY REAL (GCP Project: ${data.project_id}):\n\n` +
            `• Tabla: ${asset.project_or_db}.${asset.dataset}.${asset.table_name}\n` +
            `• Bytes Escaneados: ${data.bytes_processed.toLocaleString()} bytes\n` +
            `• Megabytes Processed: ${data.mb_processed} MB\n` +
            `• Gigabytes Processed: ${data.gb_processed} GB\n` +
            `• Costo Estimado: $${data.estimated_cost_usd} USD\n` +
            `• Columnas en Esquema: ${data.schema_fields.length}\n\n` +
            `¡Consulta SQL lista para ser ejecutada en BigQuery!`);
    } else {
      showToast("Error en Dry Run: " + (data.detail || "Consulta inválida"), "error");
    }
  } catch (err) {
    console.error("Error en SQL Dry Run:", err);
    showToast("Error conectando con BigQuery GCP", "error");
  }
}

async function generateLookMLForAsset(assetId) {
  try {
    showToast("Generando código LookML (.lkml) desde esquema BigQuery...", "info");
    const res = await fetch(`${API_BASE}/api/looker/generate_lookml/${assetId}`);
    const data = await res.json();
    if (data.status === "success") {
      const modal = document.getElementById("asset-detail-modal");
      const titleEl = document.getElementById("modal-asset-title");
      const bodyEl = document.getElementById("modal-asset-body");

      if (titleEl) titleEl.innerText = `📊 Modelo LookML Generado: ${data.table_name}.view.lkml`;
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="margin-bottom: 0.75rem;">
            <span class="stat-metric-badge badge-blue">GCP LookML Model</span>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">
              Vista LookML semántica generada a partir de los metadatos y campos de BigQuery para la tabla <code>${escapeHtml(data.table_name)}</code>.
            </p>
          </div>
          <pre class="sql-code-box"><code>${escapeHtml(data.lookml_code)}</code></pre>
        `;
      }
      if (modal) modal.style.display = "flex";
    }
  } catch (err) {
    console.error("Error generando LookML:", err);
    showToast("Error al generar LookML", "error");
  }
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Global window attachments
window.selectCatalogCloudFilter = selectCatalogCloudFilter;
window.handleDisabledCloudClick = handleDisabledCloudClick;
window.onCatalogCloudSelectChange = onCatalogCloudSelectChange;
window.onCatalogDomainSelectChange = onCatalogDomainSelectChange;
window.openAssetDetailModal = openAssetDetailModal;
window.openMetadataEditModal = openMetadataEditModal;
window.saveMetadataEdits = saveMetadataEdits;
window.runSQLDryRunForAsset = runSQLDryRunForAsset;
window.generateLookMLForAsset = generateLookMLForAsset;
window.navigateToAssetTagging = navigateToAssetTagging;
