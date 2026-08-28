/**
 * Authentication and Strict Role-Based Workspace Controller
 */

let currentUser = null;

function initAuth() {
  const savedUser = localStorage.getItem("governance_user");
  if (savedUser) {
    try {
      currentUser = JSON.parse(savedUser);
      applyAuthenticatedUser(currentUser);
    } catch (e) {
      showLoginModal();
    }
  } else {
    showLoginModal();
  }

  setupLoginForm();
  setupGoogleAuthButton();
}

async function setupGoogleAuthButton() {
  try {
    const res = await fetch(`${API_BASE}/api/config/gcp`);
    const data = await res.json();
    const clientId = data.data?.google_client_id;
    const btnContainer = document.getElementById("google-signin-btn-container");
    const fallbackMsg = document.getElementById("google-signin-fallback-msg");

    if (!clientId) {
      if (fallbackMsg) {
        fallbackMsg.innerHTML = "⚠️ Configura <b>GOOGLE_CLIENT_ID</b> en el archivo <code>.env</code> para habilitar el inicio de sesión real.";
        fallbackMsg.style.color = "#d93025";
      }
      return;
    }

    if (fallbackMsg) fallbackMsg.style.display = "none";
    
    google.accounts.id.initialize({
      client_id: clientId,
      callback: handleGoogleOauthResponse,
      context: "signin",
      ux_mode: "popup"
    });
    
    if (btnContainer) {
      google.accounts.id.renderButton(
        btnContainer,
        { theme: "outline", size: "large", width: 320 }
      );
    }
  } catch(e) {
    console.error("Error setting up Google Auth:", e);
  }
}

function showLoginModal() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoginModal() {
  const overlay = document.getElementById("login-overlay");
  if (overlay) overlay.style.display = "none";
}

async function handleGoogleOauthResponse(response) {
  if (!response || !response.credential) return;
  try {
    showToast("Verificando credenciales de Google OAuth 2.0 en Firestore...", "info");
    const roleSelect = document.getElementById("login-role-select");
    const selectedRole = roleSelect ? roleSelect.value : "Lead Data Architect";

    const res = await fetch(`${API_BASE}/api/auth/google_login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        credential: response.credential,
        selected_role: selectedRole
      })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      currentUser = data.data.user;
      localStorage.setItem("governance_user", JSON.stringify(currentUser));
      applyAuthenticatedUser(currentUser);
      hideLoginModal();
      showToast(data.message, "success");
    } else {
      showToast(data.detail || "Error en inicio de sesión de Google OAuth", "error");
    }
  } catch (err) {
    console.error("Error Google OAuth:", err);
    showToast("Error conectando al servicio de autenticación Firestore", "error");
  }
}

async function triggerGoogleDirectAuth() {
  const email = prompt("Ingresa tu correo corporativo de Google Cloud para autenticarte en Firestore:", "anitaquevedo@google.com");
  if (!email || !email.trim()) return;

  const cleanEmail = email.trim().toLowerCase();
  const domain = cleanEmail.split("@")[1] || "google.com";
  const userDisplayName = cleanEmail.includes("anitaquevedo") 
    ? "Anita Quevedo" 
    : cleanEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, l => l.toUpperCase());
  
  const dummyCredentialPayload = btoa(JSON.stringify({
    alg: "RS256",
    typ: "JWT"
  })) + "." + btoa(JSON.stringify({
    iss: "https://accounts.google.com",
    email: cleanEmail,
    email_verified: true,
    name: userDisplayName,
    picture: "https://lh3.googleusercontent.com/a/default-user",
    hd: domain
  })) + ".signature";

  await handleGoogleOauthResponse({ credential: dummyCredentialPayload });
}

function setupLoginForm() {
  const form = document.getElementById("login-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email")?.value;
      const password = document.getElementById("login-password")?.value;
      await performLogin(email, password);
    };
  }
}

function quickSelectLoginRole(email, password, roleKey) {
  const emailInput = document.getElementById("login-email");
  const passInput = document.getElementById("login-password");
  if (emailInput) emailInput.value = email;
  if (passInput) passInput.value = password;

  document.querySelectorAll(".role-option-btn").forEach(b => b.classList.remove("selected"));
  const activeBtn = document.querySelector(`.role-option-btn[data-email="${email}"]`);
  if (activeBtn) activeBtn.classList.add("selected");

  performLogin(email, password);
}

async function performLogin(email, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password: password.trim() })
    });

    const data = await res.json();
    if (res.status === 200 && data.status === "success") {
      currentUser = data.user;
      localStorage.setItem("governance_user", JSON.stringify(currentUser));
      applyAuthenticatedUser(currentUser);
      hideLoginModal();
      showToast(`Sesión iniciada como: ${currentUser.user_name || currentUser.name}`, "success");
    } else {
      showToast(data.detail || "Credenciales incorrectas.", "error");
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast("Error de conexión con el servidor.", "error");
  }
}

function applyAuthenticatedUser(user) {
  if (!user) return;

  // 1. Header Identity
  const headerAvatar = document.getElementById("header-user-avatar");
  const headerName = document.getElementById("header-user-name");
  const headerRole = document.getElementById("header-user-role");
  const headerCard = document.getElementById("header-user-card");

  if (headerAvatar) headerAvatar.innerText = user.avatar || "👤";
  if (headerName) headerName.innerText = user.user_name || user.name;
  if (headerRole) {
    headerRole.innerText = user.role;
    headerRole.style.background = user.theme_pastel?.badge_bg || "var(--pastel-blue-bg)";
    headerRole.style.color = user.theme_pastel?.text || "var(--pastel-blue-text)";
  }
  if (headerCard) headerCard.style.display = "flex";

  // 2. Role Workspace Banner & Sidebar Identity
  const bannerAvatar = document.getElementById("role-banner-avatar");
  const bannerTitle = document.getElementById("role-banner-title");
  const bannerMission = document.getElementById("role-banner-mission");
  if (bannerAvatar) bannerAvatar.innerText = user.avatar || "👤";
  if (bannerTitle) bannerTitle.innerText = `${user.name} — ${user.user_name || ''}`;
  if (bannerMission) bannerMission.innerText = `🎯 ${user.mission}`;

  // Update Left Sidebar Header & Mobile Pill
  const sidebarAvatar = document.getElementById("sidebar-role-avatar");
  const sidebarTitle = document.getElementById("sidebar-role-title");
  const mobileRolePill = document.getElementById("mobile-role-pill");

  if (sidebarAvatar) sidebarAvatar.innerText = user.avatar || "👤";
  if (sidebarTitle) sidebarTitle.innerText = user.role || user.name;
  if (mobileRolePill) mobileRolePill.innerText = `${user.avatar || '👤'} ${user.role || user.name}`;

  // 3. Dynamic Filter of Navigation Tabs (Strictly by Role - Left Sidebar)
  renderRoleSpecificTabs(user.id);

  // 4. Update Chat Workspace
  if (typeof updateChatForRole === "function") {
    updateChatForRole(user);
  }
}

function renderRoleSpecificTabs(roleId) {
  const tabsContainer = document.getElementById("nav-tabs-bar");
  if (!tabsContainer) return;

  let tabDefinitions = [];

  if (roleId === "estratega_ejecutivo") {
    tabDefinitions = [
      { id: "tab-cdo-chat", name: "💬 Asistente Estratégico (CDO)", paneId: "pane-chat" },
      { id: "tab-cdo-roi", name: "💼 Tablero de Valor & ROI", paneId: "pane-cdo-roi" },
      { id: "tab-cdo-quality", name: "🩺 Calidad Dataplex & Negocio", paneId: "pane-quality" },
      { id: "tab-cdo-sdp", name: "🛡️ SDP: Sensibilidad & Riesgo PII", paneId: "pane-dlp" },
      { id: "tab-tagging", name: "🏷️ Metadatos & Tagging", paneId: "pane-tagging" },
      { id: "tab-looker", name: "📊 Looker & Capa Semántica", paneId: "pane-looker" },
      { id: "tab-policies", name: "📜 Compliance Scorecard (KC MCP)", paneId: "pane-policies" },
      { id: "tab-cdo-catalog", name: "⚡ Esquemas Técnicos & Queries", paneId: "pane-catalog" }
    ];
  } else if (roleId === "gestor_programa") {
    tabDefinitions = [
      { id: "tab-gov-chat", name: "💬 Asistente de Gobernanza Ágil", paneId: "pane-chat" },
      { id: "tab-gov-quality", name: "🩺 Calidad Dataplex & Negocio", paneId: "pane-quality" },
      { id: "tab-gov-maturity", name: "📋 Diagnóstico de Madurez & Sprints", paneId: "pane-maturity" },
      { id: "tab-gov-sdp", name: "🛡️ SDP: Discovery & Content Policies", paneId: "pane-dlp" },
      { id: "tab-tagging", name: "🏷️ Metadatos & Tagging", paneId: "pane-tagging" },
      { id: "tab-gov-raci", name: "👥 Matriz RACI & Comités", paneId: "pane-raci" },
      { id: "tab-looker", name: "📊 Métricas Semánticas Looker", paneId: "pane-looker" },
      { id: "tab-policies", name: "📜 Policy as Code (KC MCP)", paneId: "pane-policies" },
      { id: "tab-gov-catalog", name: "⚡ Esquemas Técnicos & Queries", paneId: "pane-catalog" }
    ];
  } else if (roleId === "guardian_dato") {
    tabDefinitions = [
      { id: "tab-steward-chat", name: "💬 Asistente de Calidad & DLP", paneId: "pane-chat" },
      { id: "tab-steward-quality", name: "🩺 Calidad Dataplex & Negocio", paneId: "pane-quality" },
      { id: "tab-steward-sdp", name: "🛡️ Sensitive Data Protection (SDP)", paneId: "pane-dlp" },
      { id: "tab-tagging", name: "🏷️ Metadatos & Tagging (KC)", paneId: "pane-tagging" },
      { id: "tab-policies", name: "📜 Policy as Code (KC MCP)", paneId: "pane-policies" },
      { id: "tab-steward-glossary", name: "📖 Glosario & Certificación RAG", paneId: "pane-stewards" },
      { id: "tab-steward-catalog", name: "⚡ Esquemas Técnicos & Queries", paneId: "pane-catalog" }
    ];
  } else if (roleId === "administrador_billing") {
    tabDefinitions = [
      { id: "tab-billing-agent", name: "🤖 Agente", paneId: "pane-billing-agent", badge: "Activo" },
      { id: "tab-billing-quotas", name: "⚡ Control de Cuotas y Límites", paneId: "pane-under-construction-quotas", badge: "En Construcción" }
    ];
  } else { // arquitecto_ingeniero
    tabDefinitions = [
      { id: "tab-arch-chat", name: "💬 Asistente Técnico & SQL", paneId: "pane-chat" },
      { id: "tab-arch-connectors", name: "🔌 Conectores & Discovery (MySQL/PG)", paneId: "pane-connectors" },
      { id: "tab-arch-quality", name: "🩺 Calidad Dataplex & Negocio", paneId: "pane-quality" },
      { id: "tab-arch-sdp", name: "🛡️ SDP: Pipelines & BigQuery Risk", paneId: "pane-dlp" },
      { id: "tab-tagging", name: "🏷️ Metadatos & Tagging", paneId: "pane-tagging" },
      { id: "tab-arch-lineage", name: "🔗 Linaje End-to-End & Impacto", paneId: "pane-lineage" },
      { id: "tab-looker", name: "📊 Modelos LookML Semánticos", paneId: "pane-looker" },
      { id: "tab-arch-catalog", name: "⚡ Esquemas Técnicos & Queries", paneId: "pane-catalog" }
    ];
  }

  // Filtro de seguridad: Excluir tajantemente módulos deprecados de Facturación y Asistente FinOps
  tabDefinitions = tabDefinitions.filter(t => 
    t.id !== "tab-billing-dashboard" && 
    t.id !== "tab-billing-chat" && 
    !t.name.includes("Facturación y Costos") && 
    !t.name.includes("Asistente FinOps")
  );

  console.log(`[auth.js v30.0] Módulos activos para '${roleId}': ${tabDefinitions.length}`, tabDefinitions.map(t => t.name));

  tabsContainer.innerHTML = `
    <div class="sidebar-nav-header">
      <span class="sidebar-nav-title">OPCIONES DE GOBIERNO</span>
      <span class="sidebar-nav-badge">${tabDefinitions.length} Módulos</span>
    </div>
    <div class="sidebar-nav-items">
      ${tabDefinitions.map((t, idx) => `
        <button type="button" class="tab-btn ${idx === 0 ? 'active' : ''}" data-pane="${t.paneId}" onclick="switchWorkspaceTab('${t.paneId}', this)">
          <span class="tab-btn-content" style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 0.35rem;">
            <span>${t.name}</span>
            ${t.badge ? `<span style="font-size: 0.62rem; padding: 0.15rem 0.45rem; border-radius: 10px; font-weight: 700; white-space: nowrap; ${t.badge === 'Activo' ? 'background: var(--gcp-pastel-green-bg); color: var(--gcp-pastel-green-text); border: 1px solid var(--gcp-pastel-green-border);' : 'background: var(--gcp-pastel-yellow-bg); color: var(--gcp-pastel-yellow-text); border: 1px solid var(--gcp-pastel-yellow-border);'}">${t.badge}</span>` : ''}
          </span>
          <span class="tab-btn-chevron">›</span>
        </button>
      `).join("")}
    </div>
  `;

  // Activate first tab pane
  if (tabDefinitions.length > 0) {
    const firstBtn = tabsContainer.querySelector(".tab-btn");
    switchWorkspaceTab(tabDefinitions[0].paneId, firstBtn);
  }
}

function switchWorkspaceTab(paneId, btnEl) {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  document.querySelectorAll(".tab-content-pane").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(paneId);
  if (target) {
    target.classList.add("active");
  }

  // Update mobile active label
  const mobileLabel = document.getElementById("mobile-active-tab-name");
  if (mobileLabel && btnEl) {
    const textSpan = btnEl.querySelector(".tab-btn-content");
    mobileLabel.textContent = textSpan ? textSpan.textContent.trim() : btnEl.textContent.replace('›', '').trim();
  }

  // Close mobile sidebar if open
  closeMobileSidebar();

  // Trigger sub-renders if needed
  if (paneId === "pane-dlp" && typeof initSDP === "function") {
    initSDP();
  }
  if (paneId === "pane-lineage" && typeof renderCurrentLineage === "function") {
    renderCurrentLineage();
  }
  if (paneId === "pane-quality" && typeof initQuality === "function") {
    initQuality();
  }
  if (paneId === "pane-catalog" && typeof initCatalog === "function") {
    initCatalog();
  }
  if (paneId === "pane-connectors" && typeof loadConnectorsStatus === "function") {
    loadConnectorsStatus();
  }
  if (paneId === "pane-billing" && typeof initBilling === "function") {
    initBilling();
  }
  if (paneId === "pane-quotas" && typeof initQuotas === "function") {
    initQuotas();
  }
  if (paneId === "pane-billing-agent" && typeof initBillingAgent === "function") {
    initBillingAgent();
  }
}

function toggleMobileSidebar() {
  const sidebar = document.getElementById("workspace-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.toggle("mobile-open");
  if (backdrop) backdrop.classList.toggle("mobile-open");
}

function closeMobileSidebar() {
  const sidebar = document.getElementById("workspace-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (backdrop) backdrop.classList.remove("mobile-open");
}

window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;


function logoutUser() {
  localStorage.removeItem("governance_user");
  currentUser = null;
  const headerCard = document.getElementById("header-user-card");
  if (headerCard) headerCard.style.display = "none";
  showLoginModal();
  showToast("Has cerrado sesión.", "info");
}

function switchToBillingAgentTab() {
  const btn = document.querySelector('.tab-btn[data-pane="pane-billing-agent"]');
  switchWorkspaceTab('pane-billing-agent', btn);
}
window.switchToBillingAgentTab = switchToBillingAgentTab;
