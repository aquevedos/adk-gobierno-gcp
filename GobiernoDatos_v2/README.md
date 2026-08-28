# 🌐 Agentic Data Governance Hub (v3.6.0)
### Plataforma Modular de Gobierno de Datos Inteligente Híbrida y Multi-Cloud sobre Google Cloud

Plataforma empresarial de **Gobierno de Datos Agéntico ("Agentic Data Governance")** diseñada para orquestar, mejorar y proteger activos de datos en arquitecturas híbridas y multi-cloud (**Google Cloud Platform, AWS, Azure, On-Premises y SaaS**). 

Opera mediante agentes autónomos que trascienden los catálogos pasivos: ejecutan tareas operativas en lenguaje natural, actualizan metadatos en vivo, auditan la calidad según las 7 dimensiones empresariales, clasifican datos sensibles (PII/SDP), controlan costos en BigQuery y generan modelos semánticos sin requerir navegación manual por consolas complejas.

---

## 📁 Estructura del Repositorio

El repositorio está organizado de forma desacoplada y modular. Cada capacidad de gobierno reside en su propio módulo independiente con interfaz REST y documentación propia:

```
GobiernoDatos_v2/
├── README.md                             # 📘 Documentación maestra y manual de transferencia
├── documentacion tecnica.md              # 🛠️ Documentación técnica de servicios GCP, arquitectura y despliegue
├── agente_gobierno_datos.md              # 📜 System Prompt y especificación formal del agente
├── GUIA_DE_PRUEBAS_Y_DEMO.md             # 🧪 Guía paso a paso para demos y validación con clientes
├── Dockerfile                            # 🐳 Contenedor de producción para Cloud Run
├── requirements.txt                      # 📦 Dependencias Python de producción
├── run.sh                                # 🚀 Script de arranque local rápido
├── .env.example                          # ⚙️ Plantilla de variables de entorno
├── main.py                               # ⚡ Entrypoint para Cloud Run Functions (2nd Gen)
│
├── backend/                              # 🌐 Servidor API REST (FastAPI)
│   ├── app.py                            # Rutas HTTP, endpoints de autenticación y WebSocket
│   ├── agent_engine.py                   # Orquestador del motor agéntico
│   ├── gcp_utils.py                      # Utilidades de autenticación GCP y ADC
│   └── services/                         # Adaptadores a servicios nativos de GCP
│
├── core_agent/                           # 🤖 Cerebro del Agente de Inteligencia Artificial
│   ├── agent_brain.py                    # Enrutador de intenciones y razonador con formato en 6 pasos
│   └── __init__.py
│
├── config/                               # ⚙️ Configuraciones y Datos de Negocio
│   ├── governance_config.yaml            # SLAs de negocio, umbrales de calidad y dominios
│   ├── connectors_config.yaml            # Configuración de conexiones multi-cloud e híbridas
│   ├── firestore_profiles_db.json        # Perfiles de gobierno y roles corporativos
│   ├── billing_governance_db.json        # Presupuestos, cuotas y métricas FinOps
│   ├── business_quality_rules_db.json    # Reglas de negocio de las 7 dimensiones de calidad
│   ├── policies_db.json                  # Políticas como código (Policy as Code)
│   ├── sdp_governance_db.json            # Plantillas de inspección y perfiles de descubrimiento DLP
│   └── mock_catalog_db.json              # Catálogo unificado multi-cloud
│
├── modulos/                              # 🧩 MÓDULOS DE GOBIERNO EMPRESARIAL
│   ├── modulo1_catalogo_activo/          # 🔍 Descubrimiento, Context Graph y Golden Queries
│   ├── modulo2_dlp_seguridad_pii/        # 🛡️ Cloud DLP / Sensitive Data Protection (SDP)
│   ├── modulo3_calidad_dataplex/         # 🩺 Dataplex Data Quality & 7 Dimensiones MDM
│   ├── modulo4_linaje_trazabilidad/      # 🔗 Linaje End-to-End y Análisis de Impacto
│   ├── modulo5_seguridad_cumplimiento/   # 🔒 Filtro de Privacidad (Principio de Solo Metadatos)
│   ├── modulo6_data_stewards_ia/         # 👤 Asignación de Data Stewards y Certificación RAG/IA
│   ├── modulo7_policy_as_code_mcp/       # 📜 Policy-as-Code & Knowledge Catalog MCP Engine
│   ├── modulo8_looker_semantic_governance/ # 📊 Métricas Oficiales y Generador LookML (.lkml)
│   ├── modulo9_billing_control_cuotas/   # 💳 Facturación Real GCP (BigQuery Live) & FinOps
│   ├── conectores_multicloud/            # 🔌 Conectores GCP, AWS, Azure, On-Prem y SaaS
│   └── perfiles_gobierno/                # 👥 Gestión de Perfiles y Sincronización Firestore Native
│
├── frontend/                             # 🖥️ Interfaz Web SPA (Vanilla JS + Glassmorphism Pastel)
│   ├── index.html                        # Dashboard interactivo con tema Google Cloud Pastel
│   ├── css/style.css                     # Estilos visuales con paleta pastel de GCP
│   └── js/                               # Controladores frontend modulares
│       ├── app.js, auth.js, billing.js, catalog.js, chat.js, connectors.js,
│       ├── dlp.js, lineage.js, looker.js, policies.js, profiles.js, quality.js,
│       └── stewards.js, tagging.js
│
├── auto_deploy_cloud_run.sh              # 🚀 Script de despliegue automático integral en Cloud Run (All-in-One)
├── deploy_cloud_run.sh                   # 🚀 Script de despliegue en Cloud Run
├── deploy_cloud_function.sh              # 🚀 Script de despliegue en Cloud Run Functions 2nd Gen
├── cloudbuild.yaml                       # ☁️ Pipeline declarativo CI/CD para Google Cloud Build
├── .dockerignore                         # 📦 Exclusiones para optimización de imagen Docker
├── enable_gcp_apis.sh                    # ⚙️ Script de habilitación de APIs de Google Cloud
├── setup_firestore_oauth.sh              # 🔥 Script de provisionamiento Firestore & OAuth
└── setup_iap_and_custom_audiences.sh     # 🔐 Script de configuración de seguridad IAP / IAM
```

---

## 🧩 Descripción de los 9 Módulos de Gobierno

| Módulo | Motor / API GCP | Capacidades Principales |
|---|---|---|
| **Módulo 1: Catálogo Activo** | Knowledge Catalog / Dataplex | Búsquedas semánticas multi-cloud, actualización de descripciones en lenguaje natural y repositorio de *Golden Queries* pre-auditadas. |
| **Módulo 2: Sensitive Data Protection** | Cloud DLP / SDP | Escaneos de PII (email, DNI, tarjetas, teléfonos), dashboards ejecutivos de riesgo y conversión automática a *BigQuery Policy Tags*. |
| **Módulo 3: Calidad de Datos** | Dataplex Data Quality | Evaluación continua de las **7 dimensiones de calidad**: Completitud, Unicidad, Validez, Consistencia, Exactitud, Integridad y Frescura. |
| **Módulo 4: Linaje de Datos** | Data Catalog Lineage | Grafos de trazabilidad *end-to-end* (origen transaccional -> Data Lake -> Datamart -> Reporte Looker) y análisis de impacto de cambios. |
| **Módulo 5: Privacidad y Cumplimiento** | Privacy Guard | Garantiza que el agente opere bajo la regla de oro: **cero extracción de datos sensibles** (*Metadata-Only Governance*). |
| **Módulo 6: Data Stewards & IA** | AI Readiness Engine | Asignación de *Data Owners*, matriz RACI y certificación de datasets para ingesta segura en modelos LLM / RAG. |
| **Módulo 7: Policy as Code & MCP** | Model Context Protocol | Definición declarativa de políticas de gobierno en código (JSON/YAML), ejecución periódica y auto-remediación asistida. |
| **Módulo 8: Gobernanza Semántica Looker** | Looker Studio / LookML | Catálogo de métricas de negocio certificadas y generación automática de vistas y modelos LookML (`.lkml`) desde tablas BigQuery. |
| **Módulo 9: Facturación Real & FinOps** | BigQuery Live Billing Export | Conexión en vivo a la tabla `gobiernodatos.facturacion.gcp_billing_export_v1_01D79A_F04D6B_3B368E` (27 servicios, $1,073.65 USD subtotal de Agosto 2026), deduplicación por streaming, timeline cronológico y alertas de cuotas. |

---

## 👥 Modelo Multi-Perfil de Gobierno

La plataforma cuenta con 4 roles de trabajo predefinidos persistidos en **Google Cloud Firestore Native**:

1. 🏗️ **El Arquitecto (Lead Data Architect):** Enfocado en linaje, esquemas de bases de datos, rendimiento de consultas y pipelines.
2. 💳 **El Administrador (FinOps Lead):** Enfocado en presupuestos, consumo por servicio, optimización de cuotas y proyecciones de gasto en BigQuery.
3. 🛡️ **El Guardián (Data Steward & Security):** Enfocado en calidad Dataplex, clasificación PII con Cloud DLP y etiquetado con Policy Tags.
4. 📋 **El Gestor (Agile Data Lead):** Enfocado en adopción, asignación de responsabilidades RACI y cumplimiento normativo global.

---

## 🚀 Guía de Despliegue para el Equipo Partner

### 1. Requisitos Previos

- Cuenta de Google Cloud con permisos de Propietario o Editor en el proyecto destino.
- Google Cloud SDK (`gcloud`) instalado y autenticado.
- Python 3.11+ o gestor `uv` instalado.

```bash
# Autenticarse en Google Cloud
gcloud auth login
gcloud auth application-default login

# Establecer el proyecto activo
gcloud config set project TU_PROYECTO_GCP
```

### 2. Habilitación de APIs de Google Cloud

Ejecuta el script automatizado para encender todas las APIs requeridas:

```bash
./enable_gcp_apis.sh TU_PROYECTO_GCP
```

*APIs habilitadas: BigQuery, Data Catalog, Dataplex, Cloud DLP, Firestore, Cloud Run, Cloud Build, Artifact Registry y Cloud Functions.*

### 3. Configuración de Variables de Entorno

Copia la plantilla y configura tus valores:

```bash
cp .env.example .env
```

Edita `.env`:
```bash
GCP_HOST_PROJECT_ID=gobiernodatos
GCP_LOCATION=us-central1
GCP_GOVERNED_PROJECTS=gobiernodatos,agente-newyork
GCP_CREDENTIALS_TYPE=ADC
HOST=0.0.0.0
PORT=8001
GOOGLE_CLIENT_ID=623690130665-scr4mmdlbqc4m646mul06sjhhd2gsa9v.apps.googleusercontent.com
```

### 4. Inicialización de Firestore Native

Provisiona la base de datos Firestore en modo Native y carga los datos semilla iniciales:

```bash
./setup_firestore_oauth.sh TU_PROYECTO_GCP us-central1
uv run python provision_firestore.py TU_PROYECTO_GCP
```

---

## ▶️ Opciones de Ejecución y Despliegue

### Opción A: Ejecución Local de Desarrollo

```bash
uv run uvicorn backend.app:app --host 0.0.0.0 --port 8001 --reload
```
Abre tu navegador en: **`http://localhost:8001`**

### Opción B: Despliegue Automático en Google Cloud Run (Recomendado para Producción)

Utiliza el script todo-en-uno que valida credenciales, habilita APIs, configura roles IAM, provisiona Firestore Native y despliega en Cloud Run:

```bash
./auto_deploy_cloud_run.sh gobierno-datos-agent TU_PROYECTO_GCP us-central1
```

O si prefieres el pipeline declarativo de **Google Cloud Build (CI/CD)**:

```bash
gcloud builds submit --config=cloudbuild.yaml --substitutions=_SERVICE_NAME=gobierno-datos-agent,_REGION=us-central1
```

### Opción C: Despliegue en Google Cloud Run Functions (2nd Gen)

```bash
./deploy_cloud_function.sh gobierno-datos-function TU_PROYECTO_GCP us-central1
```

### Opción D: Despliegue mediante Docker

```bash
docker build -t gobierno-datos-agent .
docker run -p 8080:8080 --env-file .env gobierno-datos-agent
```

---

## 🔐 Autenticación y Acceso Seguro

### Inicio de Sesión Disponible en la Plataforma
1. **Acceso con Google (Direct Auth):** Botón `☁️ Iniciar con Cuenta de Google` en el modal. Permite ingresar con cualquier cuenta corporativa de Google Workspace (`anitaquevedo@google.com`), registrando el usuario automáticamente en Firestore sin bloqueos de origen.
2. **Acceso Rápido por Rol:** Haz clic en cualquiera de las 4 tarjetas superiores (🏗️ Arquitecto, 💳 Administrador, 🛡️ Guardián, 📋 Gestor) con contraseña demo `123`.
3. **Google Identity Services (Popup Nativo):**
   - Abre siempre la URL como **`http://localhost:8001`** (Google bloquea direcciones `0.0.0.0` o IPs privadas bajo la política *Secure Response Handling RFC 8252*).
   - Registra `http://localhost:8001` en los **Orígenes autorizados de JavaScript** del Client ID en la Consola de GCP.

---

## 🌐 Catálogo de Endpoints de la API REST

### Autenticación y Perfiles
- `POST /api/auth/google_login`: Autentica credenciales OAuth o Direct Token y persiste en Firestore.
- `POST /api/auth/login`: Autenticación corporativa con usuario y contraseña demo.
- `GET /api/profiles`: Lista los perfiles disponibles y el perfil activo.
- `POST /api/profiles/switch`: Cambia el rol activo del espacio de trabajo.
- `POST /api/profiles/sync_firestore`: Sincroniza perfiles bidireccionalmente con Firestore Native.

### Facturación y FinOps (Módulo 9)
- `GET /api/billing/overview`: Resumen general de gasto acumulado, presupuesto, forecast y burn rate.
- `GET /api/billing/analytics`: Consulta analítica sobre BigQuery agrupada por `service`, `project`, `month` o `sku`.
- `GET /api/billing/timeline`: Distribución cronológica diaria (1-31 Agosto) y proyección de cierre de mes.
- `POST /api/billing/seed_real_data`: Carga los datos reales oficiales de Agosto 2026 en BigQuery.
- `POST /api/billing/sync_firestore`: Persiste el resumen consolidado en Firestore.
- `POST /api/billing/query`: Ejecutor interactivo de consultas SQL sobre la tabla de billing export con opción `dry_run`.

### Catálogo, Calidad y DLP (Módulos 1, 2, 3, 4, 7, 8)
- `GET /api/catalog/search`: Búsqueda semántica en el catálogo unificado.
- `POST /api/catalog/entry/update_description`: Actualiza descripciones de tablas o columnas.
- `GET /api/dlp/scan_results`: Resultados de inspección de datos sensibles y clasificación PII.
- `POST /api/dlp/policy_tags/generate`: Genera Policy Tags de BigQuery a partir de hallazgos DLP.
- `GET /api/quality/dataplex_status`: Resumen de las 7 dimensiones de calidad de datos.
- `POST /api/quality/run_scan`: Dispara escaneos de calidad sobre fuentes seleccionadas.
- `GET /api/lineage/graph/{asset_id}`: Retorna el grafo SVG de linaje de datos.
- `GET /api/policies/list`: Lista de políticas declarativas (Policy as Code).
- `GET /api/looker/metrics`: Catálogo de métricas oficiales Looker/LookML.

---

## 📚 Enlaces de Referencia y Arquitecturas Base

- **Data Governance Tagging Automation using SDP:** [Google Cloud Demo Hub #1328](https://cloud-demo-hub.corp.google.com/demo/Data-Governance-Tagging--Automation-using-SDP/1328?origin=search_demos)
- **Sovereign AI Studio / Agent Governance:** [GitHub cloud-gtm/sovereign-ai-studio](https://github.com/cloud-gtm/sovereign-ai-studio)
- **Knowledge Catalog MCP Server:** [Google Cloud Demo Hub #1576](https://cloud-demo-hub.corp.google.com/demo/Knowledge-Catalog-MCP-Server/1576?origin=search_demos)
- **Policy as Code - Dataplex Agent:** [Google Cloud Demo Hub #1526](https://cloud-demo-hub.corp.google.com/demo/Policy-as-Code---Dataplex-Agent/1526?origin=search_demos)
- **Google Cloud Billing BigQuery Examples:** [Documentación Oficial de Facturación](https://docs.cloud.google.com/billing/docs/how-to/bq-examples#sum-costs-per-invoice)
