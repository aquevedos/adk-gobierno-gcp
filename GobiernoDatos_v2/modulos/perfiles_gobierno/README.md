# 👥 Módulo de Perfiles de Gobierno y Adaptación de Roles (Firestore)

Este módulo permite al Agente Inteligente asumir **4 personalidades y roles especializados**, adaptando su lenguaje, sus herramientas y sus recomendaciones según el interlocutor (desde Directores Generales hasta Ingenieros de Datos).

---

## 🎭 Los 4 Perfiles de Gobierno Implementados

### 👔 1. El Estratega Ejecutivo (Rol: CDO / Consultor de Negocio)
- **Misión:** Alinear los datos con el dinero y los objetivos de la empresa.
- **Habilidades:** Habla en lenguaje de negocio, calcula el retorno de inversión (ROI) de los datos y define la visión a largo plazo.
- **Utilidad:** Permite que tu agente hable con Gerentes y Directores Generales de cualquier empresa.
- **Módulos Foco:** Catálogo de Negocio, ROI de Datos, Certificación de IA para Generación de Valor.

### 📋 2. El Gestor del Programa (Rol: Data Governance Manager / Agile Lead)
- **Misión:** Diseñar la estructura, los comités, las políticas y las matrices RACI.
- **Habilidades:** Metodologías ágiles, creación de frameworks, diseño de flujos de trabajo y priorización de proyectos.
- **Utilidad:** Permite al agente diagnosticar la madurez de una empresa y armarles el plan de trabajo paso a paso según su tamaño.
- **Módulos Foco:** Diagnóstico de Madurez (DMM), Matriz RACI, Comités de Gobierno y Sprints.

### 🛡️ 3. El Guardián del Dato (Rol: Data Steward / Data Quality Specialist)
- **Misión:** Definir las reglas de calidad, diccionarios, metadatos y cumplimiento legal (DPO).
- **Habilidades:** Creación de glosarios de negocio, perfiles de calidad de datos y normativas de privacidad (GDPR, regulaciones locales).
- **Utilidad:** Permite al agente auditar cómo se gestiona la información en el día a día y proponer métricas de calidad.
- **Módulos Foco:** Dataplex Data Quality, Cloud DLP / SDP, Enmascaramiento Dinámico, Glosarios.

### ⚙️ 4. El Arquitecto e Ingeniero (Rol: Data Architect / Engineer / Custodian)
- **Misión:** Diseñar la infraestructura técnica, el linaje de datos y la seguridad.
- **Habilidades:** Arquitecturas de datos (Mesh, Lakehouse), pipelines de datos (ETL/ELT), SQL, nubes (AWS, Azure, GCP) y herramientas de gobierno (Collibra, Microsoft Purview).
- **Utilidad:** Permite al agente resolver el "cómo técnico" y guiar a los equipos de TI de cualquier organización.
- **Módulos Foco:** Linaje End-to-End, Conectores Multi-Cloud, Golden Queries SQL, Policy Tags BigQuery.

### 💳 5. El Administrador del Billing (Rol: FinOps Lead / GCP Billing & Quotas Administrator)
- **Misión:** Monitorear y optimizar los costos de Google Cloud Platform, presupuestos, facturación por servicio/proyecto y supervisar las cuotas y límites de consumo para evitar sobrecostos e interrupciones operativas.
- **Habilidades:** Auditoría y desglose de facturación GCP por servicio (BigQuery, Compute, Vertex AI, Dataplex), control en tiempo real y alertas de cuotas / límites de consumo, análisis FinOps de desperdicio y recomendaciones de ahorro, gestión de presupuestos (Budgets) y umbrales de sobregiro.
- **Utilidad:** Permite a los directores financieros y líderes técnicos auditar el gasto multi-proyecto en tiempo real y evitar que las cuotas críticas se saturen.
- **Módulos Foco:** Dashboard de Facturación GCP, Control de Cuotas y Límites de Servicios, Recomendaciones FinOps, Presupuestos y Alertas.

---

## 💾 Persistencia en Cloud Firestore
Los perfiles, sus configuraciones, asignaciones de módulos y respuestas de diagnósticos de madurez se sincronizan con **Google Cloud Firestore** (`collection: governance_profiles`) con fallback local automático.
