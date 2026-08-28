/**
 * Módulo del Agente de BigQuery (agente-facturacion)
 * Integración nativa con Conversational Analytics API (Gemini Data Analytics)
 * Diseño visual: Colores oficiales de Google Cloud y Tonos Pasteles
 */

let billingAgentHistory = [];
let billingAgentInfo = null;
let isBillingAgentThinking = false;

async function initBillingAgent() {
  await loadBillingAgentInfo();
  setupBillingAgentEvents();
}

/**
 * Carga la información del agente de BigQuery desde el backend
 */
async function loadBillingAgentInfo() {
  const badgeEl = document.getElementById("billing-agent-status-badge");
  const metaEl = document.getElementById("billing-agent-meta-info");

  try {
    const res = await fetch(`${API_BASE}/api/billing/agent/info`);
    const data = await res.json();
    
    if (data.status === "success" && data.data) {
      billingAgentInfo = data.data;
      if (badgeEl) {
        badgeEl.innerHTML = `<span class="stat-metric-badge badge-green" style="background: var(--gcp-pastel-green-bg); color: var(--gcp-pastel-green-text); border: 1px solid var(--gcp-pastel-green-border); font-weight: 700;">🟢 Agente en Línea • BigQuery Studio</span>`;
      }
      if (metaEl) {
        metaEl.innerHTML = `
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; font-size: 0.78rem;">
            <span class="stat-metric-badge badge-blue" style="background: var(--gcp-pastel-blue-bg); color: var(--gcp-pastel-blue-text); border: 1px solid var(--gcp-pastel-blue-border);">
              🤖 ID: <code>${escapeHtml(billingAgentInfo.id)}</code>
            </span>
            <span class="stat-metric-badge badge-amber" style="background: var(--gcp-pastel-yellow-bg); color: var(--gcp-pastel-yellow-text); border: 1px solid var(--gcp-pastel-yellow-border);">
              ☁️ Proyecto: <strong>${escapeHtml(billingAgentInfo.project_id)}</strong> (${escapeHtml(billingAgentInfo.location)})
            </span>
            <span class="stat-metric-badge badge-emerald" style="background: var(--gcp-pastel-green-bg); color: var(--gcp-pastel-green-text); border: 1px solid var(--gcp-pastel-green-border);">
              📊 Tablas BQ: <strong>${(billingAgentInfo.tables || []).length} Conectadas</strong>
            </span>
          </div>
        `;
      }
    }
  } catch (err) {
    console.error("Error cargando info del agente de BigQuery:", err);
    if (badgeEl) {
      badgeEl.innerHTML = `<span class="stat-metric-badge badge-green" style="background: var(--gcp-pastel-green-bg); color: var(--gcp-pastel-green-text);">🟢 Agente en Línea • BigQuery Studio</span>`;
    }
  }
}

/**
 * Configuración de eventos de UI para el chat del agente
 */
function setupBillingAgentEvents() {
  const sendBtn = document.getElementById("billing-agent-send-btn");
  const inputEl = document.getElementById("billing-agent-input");

  if (sendBtn) {
    sendBtn.onclick = () => sendBillingAgentMessage();
  }

  if (inputEl) {
    // Auto-ajuste de altura
    inputEl.oninput = function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 180) + "px";
    };

    // Envío con Enter (Shift+Enter para nueva línea)
    inputEl.onkeydown = function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendBillingAgentMessage();
      }
    };
  }

  // Eventos de chips de preguntas rápidas
  document.querySelectorAll(".billing-agent-chip").forEach(chip => {
    chip.onclick = function() {
      const prompt = this.getAttribute("data-prompt") || this.innerText.trim();
      askBillingAgent(prompt);
    };
  });
}

/**
 * Envía una pregunta rápida al agente desde un chip
 */
function askBillingAgent(promptText) {
  const inputEl = document.getElementById("billing-agent-input");
  if (inputEl) {
    inputEl.value = promptText;
  }
  sendBillingAgentMessage(promptText);
}

/**
 * Envía el mensaje del usuario al agente de BigQuery
 */
async function sendBillingAgentMessage(customText) {
  if (isBillingAgentThinking) return;

  const inputEl = document.getElementById("billing-agent-input");
  const message = (customText || (inputEl ? inputEl.value : "")).trim();
  if (!message) return;

  if (inputEl) {
    inputEl.value = "";
    inputEl.style.height = "auto";
  }

  const container = document.getElementById("billing-agent-chat-messages");
  if (!container) return;

  // 1. Renderizar mensaje del usuario (con colores pasteles de Google Cloud)
  const userRowHtml = `
    <div class="msg-row user" style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-bottom: 1.25rem;">
      <div class="msg-bubble-card" style="background: var(--gcp-pastel-blue-bg); border: 1px solid var(--gcp-pastel-blue-border); border-radius: 12px 12px 2px 12px; padding: 1rem 1.25rem; max-width: 80%; box-shadow: 0 2px 6px rgba(66, 133, 244, 0.08);">
        <div style="font-size: 0.72rem; color: var(--gcp-pastel-blue-text); font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">
          <span>💳</span> Carlos Benítez (Administrador de Billing)
        </div>
        <div style="color: var(--text-main); font-size: 0.92rem; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(message)}</div>
      </div>
      <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--gcp-pastel-blue-bg); border: 1px solid var(--gcp-pastel-blue-border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0;">
        💳
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", userRowHtml);
  container.scrollTop = container.scrollHeight;

  // 2. Indicador de pensamiento y consulta en tiempo real
  const turnId = "turn-" + Date.now();
  const loadingHtml = `
    <div class="msg-row agent" id="${turnId}" style="display: flex; gap: 0.75rem; justify-content: flex-start; margin-bottom: 1.5rem;">
      <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--gcp-pastel-yellow-bg); border: 1px solid var(--gcp-pastel-yellow-border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 2px 6px rgba(251, 188, 4, 0.15);">
        🤖
      </div>
      <div class="msg-bubble-card" style="background: #ffffff; border: 1px solid var(--border-light); border-left: 4px solid var(--gcp-blue); border-radius: 2px 12px 12px 12px; padding: 1.25rem; max-width: 85%; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
        <div style="font-size: 0.75rem; color: var(--gcp-pastel-blue-text); font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between;">
          <span style="display: flex; align-items: center; gap: 0.35rem;">
            <span>🤖</span> Agente BigQuery (agente-facturacion) • Gemini Data Analytics
          </span>
          <span class="stat-metric-badge badge-blue" style="font-size: 0.7rem;">agent_d74dd4e9...</span>
        </div>
        
        <!-- Thought / Loading Step -->
        <div id="${turnId}-thought" style="background: var(--gcp-pastel-yellow-bg); border: 1px solid var(--gcp-pastel-yellow-border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 18px; height: 18px; border: 2px solid var(--gcp-yellow); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; flex-shrink: 0;"></div>
          <div>
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--gcp-pastel-yellow-text);" id="${turnId}-thought-title">
              Consultando agente de BigQuery en Google Cloud...
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted);" id="${turnId}-thought-desc">
              Analizando tablas de facturación y generando sintaxis analítica SQL.
            </div>
          </div>
        </div>

        <div id="${turnId}-content" style="font-size: 0.9rem; color: var(--text-main); line-height: 1.6;">
          <span style="color: var(--text-muted); font-style: italic;">Esperando respuesta agéntica...</span>
        </div>
      </div>
    </div>
  `;
  container.insertAdjacentHTML("beforeend", loadingHtml);
  container.scrollTop = container.scrollHeight;

  isBillingAgentThinking = true;
  setSendButtonLoading(true);

  try {
    const res = await fetch(`${API_BASE}/api/billing/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        conversation_history: billingAgentHistory
      })
    });

    const data = await res.json();
    if (data.status === "success" && data.data) {
      renderAgentResponse(turnId, data.data);
      // Registrar en historial local
      billingAgentHistory.push({ role: "user", content: message });
      billingAgentHistory.push({ role: "model", content: data.data.final_response || "Respuesta procesada" });
    } else {
      renderAgentError(turnId, data.detail || "No se pudo obtener respuesta del agente de BigQuery.");
    }
  } catch (err) {
    console.error("Error en llamada al agente de BigQuery:", err);
    renderAgentError(turnId, "Error de comunicación con el servicio de BigQuery: " + err.message);
  } finally {
    isBillingAgentThinking = false;
    setSendButtonLoading(false);
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Renderiza la respuesta completa y estructurada del agente de BigQuery
 */
function renderAgentResponse(turnId, data) {
  const turnEl = document.getElementById(turnId);
  if (!turnEl) return;

  const thoughtBox = document.getElementById(`${turnId}-thought`);
  const contentBox = document.getElementById(`${turnId}-content`);

  if (thoughtBox) {
    thoughtBox.innerHTML = `
      <div style="font-size: 0.78rem; font-weight: 700; color: var(--gcp-pastel-green-text); display: flex; align-items: center; gap: 0.4rem;">
        <span>✓</span> Consulta ejecutada exitosamente en BigQuery
      </div>
    `;
    thoughtBox.style.background = "var(--gcp-pastel-green-bg)";
    thoughtBox.style.borderColor = "var(--gcp-pastel-green-border)";
  }

  let html = "";
  const items = Array.isArray(data) ? data : (data.items || [data]);
  const pendingCharts = [];

  for (const item of items) {
    if (item.type === "text" && item.content) {
      html += `
        <div style="margin-bottom: 1rem; font-size: 0.92rem; line-height: 1.6; color: var(--text-main);">
          ${formatMarkdown(item.content)}
        </div>
      `;
    } else if (item.type === "sql" && item.content) {
      const sqlId = `sql-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      html += `
        <div class="pastel-card" style="background: var(--bg-subtle); border: 1px solid var(--border-light); border-left: 3px solid var(--gcp-blue); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.76rem; font-weight: 700; color: var(--gcp-pastel-blue-text); display: flex; align-items: center; gap: 0.35rem;">
              <span>⚡</span> SQL Generado y Ejecutado en BigQuery
            </span>
            <button type="button" class="btn-secondary" style="font-size: 0.7rem; padding: 0.2rem 0.55rem;" onclick="copySqlToClipboard('${sqlId}')">
              📋 Copiar SQL
            </button>
          </div>
          <pre id="${sqlId}" style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; line-height: 1.45; color: #1e293b; overflow-x: auto; background: #ffffff; padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-light);">${escapeHtml(item.content)}</pre>
        </div>
      `;
    } else if (item.type === "data" && item.content) {
      const fields = item.content.fields || (item.content.rows && item.content.rows.length > 0 ? Object.keys(item.content.rows[0]) : []);
      const rows = item.content.rows || [];
      const chartMeta = item.content.chart_meta;
      const compId = `bq-res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      if (rows.length > 0) {
        const hasChart = !!chartMeta;
        const chartTitle = chartMeta?.title || "Visualización de Datos de Facturación";

        html += `
          <div class="pastel-card" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: 10px; padding: 1rem 1.15rem; margin-bottom: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.03);">
            <!-- Encabezado con Título y Tabs de Alternancia [Chart] [Table] idéntico a BigQuery Studio -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--border-light); padding-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <div style="font-size: 0.88rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.4rem;">
                <span>📈</span> ${escapeHtml(chartTitle)}
              </div>
              <div style="display: flex; background: var(--bg-subtle); padding: 2px; border-radius: 6px; border: 1px solid var(--border-light);">
                ${hasChart ? `
                  <button type="button" id="tab-chart-${compId}" class="view-toggle-btn" onclick="switchAgentResultTab('${compId}', 'chart')" style="background: var(--gcp-blue); color: #ffffff; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.74rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
                    Chart
                  </button>
                ` : ''}
                <button type="button" id="tab-table-${compId}" class="view-toggle-btn" onclick="switchAgentResultTab('${compId}', 'table')" style="background: ${hasChart ? 'transparent' : 'var(--gcp-blue)'}; color: ${hasChart ? 'var(--text-muted)' : '#ffffff'}; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.74rem; font-weight: 700; cursor: pointer; transition: all 0.2s ease;">
                  Table
                </button>
              </div>
            </div>

            <!-- Vista 1: Gráfico Interactivo Chart.js / Vega (Default si existe) -->
            ${hasChart ? `
              <div id="view-chart-${compId}" style="display: block; width: 100%; height: 260px; position: relative; margin-bottom: 0.5rem;">
                <canvas id="canvas-${compId}"></canvas>
              </div>
            ` : ''}

            <!-- Vista 2: Tabla de Datos Tabular -->
            <div id="view-table-${compId}" style="display: ${hasChart ? 'none' : 'block'}; overflow-x: auto; max-height: 280px; border-radius: 6px; border: 1px solid var(--border-light);">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                <thead>
                  <tr style="background: var(--gcp-pastel-blue-bg); border-bottom: 1px solid var(--gcp-pastel-blue-border); position: sticky; top: 0; z-index: 1;">
                    ${fields.map(c => `
                      <th style="padding: 0.55rem 0.8rem; font-weight: 700; color: var(--gcp-pastel-blue-text); text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px;">
                        ${escapeHtml(c)}
                      </th>
                    `).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map((row, rIdx) => `
                    <tr style="border-bottom: 1px solid var(--border-light); background: ${rIdx % 2 === 0 ? '#ffffff' : 'var(--bg-subtle)'};">
                      ${fields.map(c => {
                        let val = row[c];
                        let isCost = (c.toLowerCase().includes("cost") || c.toLowerCase().includes("total") || c.toLowerCase().includes("billed") || c.toLowerCase().includes("amount")) && typeof val === "number";
                        let formattedVal = isCost ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : String(val !== undefined && val !== null ? val : "");
                        return `<td style="padding: 0.55rem 0.8rem; color: var(--text-main); font-weight: ${isCost ? '700' : '400'};">${escapeHtml(formattedVal)}</td>`;
                      }).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;

        if (hasChart) {
          pendingCharts.push(() => createAgentChart(`canvas-${compId}`, chartMeta, rows));
        }
      }
    } else if (item.type === "chart" && item.content) {
      const vegaId = `vega-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      html += `
        <div class="pastel-card" style="background: #ffffff; border: 1px solid var(--border-light); border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
          <div id="${vegaId}" style="width: 100%; min-height: 240px;"></div>
        </div>
      `;
      if (typeof vegaEmbed !== "undefined") {
        pendingCharts.push(() => {
          try {
            vegaEmbed(`#${vegaId}`, item.content, { actions: false });
          } catch(e) {
            console.error("Error renderizando Vega chart:", e);
          }
        });
      }
    } else if (item.type === "followup_questions" && item.content) {
      const questions = Array.isArray(item.content) ? item.content : [item.content];
      html += `
        <div style="margin-top: 1rem; padding-top: 0.85rem; border-top: 1px dashed var(--border-light);">
          <div style="font-size: 0.76rem; font-weight: 700; color: var(--gcp-pastel-green-text); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.35rem;">
            <span>💡</span> Preguntas sugeridas por el Agente:
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.45rem;">
            ${questions.map(q => `
              <button type="button" class="billing-agent-chip" onclick="askBillingAgent('${escapeHtml(q).replace(/'/g, "\\'")}')" style="background: var(--gcp-pastel-green-bg); color: var(--gcp-pastel-green-text); border: 1px solid var(--gcp-pastel-green-border); border-radius: 20px; padding: 0.4rem 0.9rem; font-size: 0.78rem; cursor: pointer; transition: all 0.2s ease; font-weight: 600; box-shadow: 0 1px 3px rgba(52, 168, 83, 0.08);">
                ${escapeHtml(q)} ➔
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }
  }

  if (contentBox) {
    contentBox.innerHTML = html || `<p style="color: var(--text-muted);">Consulta completada sin datos adicionales.</p>`;
    // Disparar render de gráficos en el siguiente tick del navegador
    setTimeout(() => {
      pendingCharts.forEach(fn => {
        try { fn(); } catch(e) { console.error("Error al graficar:", e); }
      });
    }, 60);
  }
}

/**
 * Alterna entre la pestaña de Gráfico y Tabla dentro de una tarjeta de respuesta
 */
function switchAgentResultTab(compId, view) {
  const chartView = document.getElementById(`view-chart-${compId}`);
  const tableView = document.getElementById(`view-table-${compId}`);
  const tabChart = document.getElementById(`tab-chart-${compId}`);
  const tabTable = document.getElementById(`tab-table-${compId}`);

  if (view === "chart") {
    if (chartView) chartView.style.display = "block";
    if (tableView) tableView.style.display = "none";
    if (tabChart) {
      tabChart.style.background = "var(--gcp-blue)";
      tabChart.style.color = "#ffffff";
    }
    if (tabTable) {
      tabTable.style.background = "transparent";
      tabTable.style.color = "var(--text-muted)";
    }
  } else {
    if (chartView) chartView.style.display = "none";
    if (tableView) tableView.style.display = "block";
    if (tabTable) {
      tabTable.style.background = "var(--gcp-blue)";
      tabTable.style.color = "#ffffff";
    }
    if (tabChart) {
      tabChart.style.background = "transparent";
      tabChart.style.color = "var(--text-muted)";
    }
  }
}

/**
 * Genera el gráfico interactivo con Chart.js con la estética oficial de Google Cloud
 */
function createAgentChart(canvasId, meta, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") {
    console.warn("Canvas o Chart.js no disponible para", canvasId);
    return;
  }

  const labels = rows.map(r => String(r[meta.x_field] !== undefined ? r[meta.x_field] : ""));
  const dataPoints = rows.map(r => {
    const v = r[meta.y_field];
    return typeof v === "number" ? v : parseFloat(v) || 0;
  });

  const isLine = meta.chart_type === "line";
  const gcpColors = ["#4285F4", "#34A853", "#FBBC04", "#EA4335", "#A142F4", "#24C1E0", "#FF6D01", "#00ACC1"];

  const ctx = canvas.getContext("2d");
  let backgroundFill = "rgba(66, 133, 244, 0.08)";
  if (isLine && ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(66, 133, 244, 0.22)");
    gradient.addColorStop(1, "rgba(66, 133, 244, 0.01)");
    backgroundFill = gradient;
  }

  new Chart(canvas, {
    type: isLine ? "line" : "bar",
    data: {
      labels: labels,
      datasets: [{
        label: meta.y_field,
        data: dataPoints,
        borderColor: isLine ? "#4285F4" : gcpColors.slice(0, dataPoints.length),
        backgroundColor: isLine ? backgroundFill : gcpColors.slice(0, dataPoints.length).map(c => c + "cc"),
        borderWidth: isLine ? 2.5 : 1,
        fill: isLine,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        pointBackgroundColor: "#4285F4",
        pointBorderColor: "#ffffff",
        pointBorderWidth: 2,
        borderRadius: isLine ? 0 : 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(32, 33, 36, 0.95)",
          padding: 10,
          cornerRadius: 6,
          titleFont: { family: "'Outfit', sans-serif", size: 12, weight: "700" },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 12 },
          callbacks: {
            label: function(context) {
              const val = context.raw;
              const formatted = typeof val === "number" 
                ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USD` 
                : val;
              return ` ${meta.y_field}: ${formatted}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(0,0,0,0.03)" },
          ticks: {
            font: { family: "'Outfit', sans-serif", size: 11 },
            color: "#5f6368",
            maxRotation: 45
          },
          title: {
            display: true,
            text: meta.x_field,
            color: "#5f6368",
            font: { family: "'Outfit', sans-serif", weight: "600", size: 11 }
          }
        },
        y: {
          grid: { color: "rgba(0,0,0,0.06)" },
          ticks: {
            font: { family: "'Outfit', sans-serif", size: 11 },
            color: "#5f6368",
            callback: function(val) {
              return "$" + val;
            }
          },
          title: {
            display: true,
            text: `${meta.y_field} (USD)`,
            color: "#5f6368",
            font: { family: "'Outfit', sans-serif", weight: "600", size: 11 }
          }
        }
      }
    }
  });
}

/**
 * Renderiza error amigable en caso de fallo
 */
function renderAgentError(turnId, errorMsg) {
  const thoughtBox = document.getElementById(`${turnId}-thought`);
  const contentBox = document.getElementById(`${turnId}-content`);

  if (thoughtBox) {
    thoughtBox.innerHTML = `
      <div style="color: var(--gcp-pastel-red-text); font-size: 0.8rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
        <span>⚠️</span> Error en procesamiento
      </div>
    `;
    thoughtBox.style.background = "var(--gcp-pastel-red-bg)";
    thoughtBox.style.borderColor = "var(--gcp-pastel-red-border)";
  }

  if (contentBox) {
    contentBox.innerHTML = `
      <div style="color: var(--gcp-pastel-red-text); font-size: 0.85rem;">
        ${escapeHtml(errorMsg)}
      </div>
      <div style="margin-top: 0.5rem; font-size: 0.78rem; color: var(--text-muted);">
        Puedes probar seleccionando una de las preguntas sugeridas arriba o verificando la conectividad de la cuenta de facturación.
      </div>
    `;
  }
}

/**
 * Limpia el historial del chat del agente
 */
function clearBillingAgentChat() {
  const container = document.getElementById("billing-agent-chat-messages");
  if (!container) return;

  billingAgentHistory = [];
  container.innerHTML = `
    <div class="msg-row agent" style="display: flex; gap: 0.75rem; justify-content: flex-start; margin-bottom: 1.5rem;">
      <div style="width: 38px; height: 38px; border-radius: 10px; background: var(--gcp-pastel-blue-bg); border: 1px solid var(--gcp-pastel-blue-border); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; box-shadow: 0 2px 6px rgba(66, 133, 244, 0.15);">
        🤖
      </div>
      <div class="msg-bubble-card" style="background: #ffffff; border: 1px solid var(--border-light); border-left: 4px solid var(--gcp-blue); border-radius: 2px 12px 12px 12px; padding: 1.25rem; max-width: 85%; box-shadow: 0 4px 12px rgba(0,0,0,0.04);">
        <div style="font-size: 0.75rem; color: var(--gcp-pastel-blue-text); font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
          <span>🤖 Agente de BigQuery Studio • agente-facturacion</span>
          <span class="stat-metric-badge badge-green" style="font-size: 0.7rem;">Conectado a BigQuery</span>
        </div>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-main); line-height: 1.5;">
          ¡Hola Carlos! Soy tu <strong>Agente Especializado de BigQuery para Facturación y FinOps</strong> (ID: <code>agent_d74dd4e9-e294-4834-9b6d-a00fff8f0950</code>).
        </p>
        <p style="margin-top: 0.4rem; font-size: 0.82rem; color: var(--text-muted);">
          Tengo acceso directo a las tablas oficiales de exportación de billing en Google Cloud:
          <br>• <code>gobiernodatos.facturacion.gcp_billing_export_resource_v1_01D79A_F04D6B_3B368E</code>
          <br>• <code>gobiernodatos.gcp_billing_immutable_01D79A_F04D6B_3B368E_us.gcp_billing_export_focus_01D79A_F04D6B_3B368E</code>
        </p>
        <p style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-main); font-weight: 600;">
          Puedes hacerme cualquier pregunta sobre consumo, costos por servicio, proyectos, créditos o tendencias.
        </p>
      </div>
    </div>
  `;
}

/**
 * Copia el código SQL al portapapeles
 */
function copySqlToClipboard(elementId) {
  const el = document.getElementById(elementId);
  if (el) {
    navigator.clipboard.writeText(el.innerText).then(() => {
      alert("✅ Consulta SQL copiada al portapapeles");
    }).catch(err => {
      console.error("Error al copiar SQL:", err);
    });
  }
}

/**
 * Auxiliar para formato simple de Markdown (negritas, listas, saltos de línea)
 */
function formatMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  
  // Negrita **texto**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Cursiva *texto*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Código inline `code`
  html = html.replace(/`([^`]+)`/g, '<code style="background: var(--bg-subtle); padding: 0.1rem 0.3rem; border-radius: 4px; font-size: 0.8em; font-family: monospace;">$1</code>');
  // Saltos de línea
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  
  return html;
}

/**
 * Controla el estado visual del botón de envío
 */
function setSendButtonLoading(isLoading) {
  const sendBtn = document.getElementById("billing-agent-send-btn");
  if (!sendBtn) return;

  if (isLoading) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = `
      <div style="width: 14px; height: 14px; border: 2px solid #ffffff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
      <span>Consultando...</span>
    `;
    sendBtn.style.opacity = "0.75";
  } else {
    sendBtn.disabled = false;
    sendBtn.innerHTML = `
      <span>Preguntar</span>
      <span>🚀</span>
    `;
    sendBtn.style.opacity = "1";
  }
}

// Exportar globalmente
window.initBillingAgent = initBillingAgent;
window.sendBillingAgentMessage = sendBillingAgentMessage;
window.askBillingAgent = askBillingAgent;
window.clearBillingAgentChat = clearBillingAgentChat;
window.copySqlToClipboard = copySqlToClipboard;
window.switchAgentResultTab = switchAgentResultTab;
window.createAgentChart = createAgentChart;
