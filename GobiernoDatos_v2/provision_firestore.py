"""
==============================================================================
🛡️ SCRIPT AUTOMÁTICO DE PROVISIONAMIENTO DE COLECCIONES Y DATOS EN FIRESTORE
==============================================================================
Este script inicializa automáticamente la base de datos Firestore (Native)
creando las colecciones y documentos por defecto para cualquier proyecto GCP.

Colecciones Creadas:
  - governance_users
  - governance_sessions
  - governance_connectors
  - catalog_metadata
  - quality_rules
  - sdp_templates
==============================================================================
"""

import os
import sys
import time
import json
import logging
import subprocess
from pathlib import Path
try:
    import dotenv
    dotenv.load_dotenv(override=True)
except ImportError:
    pass

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("provision_firestore")

import google.oauth2.credentials

class NonRefreshingCredentials(google.oauth2.credentials.Credentials):
    def refresh(self, request):
        pass

def get_firestore_client(project_id: str):
    from google.cloud import firestore
    try:
        token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
        creds = NonRefreshingCredentials(token=token, scopes=["https://www.googleapis.com/auth/cloud-platform"])
        db = firestore.Client(project=project_id, credentials=creds)
        logger.info(f"✅ Cliente Firestore autenticado exitosamente mediante gcloud access token.")
        return db
    except Exception as e:
        logger.info(f"Fallback a cliente default de Google Cloud: {e}")
        return firestore.Client(project=project_id)

def provision_firestore_database(project_id: str):
    logger.info(f"🔥 Iniciando provisionamiento de colecciones Firestore en el proyecto '{project_id}'...")

    try:
        db = get_firestore_client(project_id)
    except Exception as e:
        logger.error(f"❌ Error al conectar a la base de datos Firestore: {e}")
        sys.exit(1)

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # 1. Colección: governance_users (Usuarios de Prueba Iniciales)
    logger.info("📦 Creando colección 'governance_users'...")
    default_users = [
        {
            "email": "cdo@empresa.com",
            "name": "Javier Mendoza",
            "role": "CDO",
            "domain": "empresa.com",
            "auth_provider": "Default Governance Seed",
            "created_at": now_iso,
            "gcp_host_project": project_id
        },
        {
            "email": "steward@empresa.com",
            "name": "Ana Quevedo",
            "role": "Lead Data Architect",
            "domain": "empresa.com",
            "auth_provider": "Default Governance Seed",
            "created_at": now_iso,
            "gcp_host_project": project_id
        },
        {
            "email": "billing@empresa.com",
            "name": "Carlos Benítez",
            "role": "FinOps Lead / Administrador del Billing",
            "domain": "empresa.com",
            "auth_provider": "Default Governance Seed",
            "created_at": now_iso,
            "gcp_host_project": project_id
        }
    ]
    for u in default_users:
        db.collection("governance_users").document(u["email"]).set(u, merge=True)

    # 2. Colección: governance_connectors (Conectores GCP, Cloud SQL y MySQL)
    logger.info("📦 Creando colección 'governance_connectors'...")
    default_connectors = [
        {
            "id": "gcp",
            "name": "Google Cloud Platform",
            "cloud": "GCP",
            "type": "GCP",
            "services": ["BigQuery", "Dataplex DQ", "Cloud DLP", "Firestore"],
            "project_id": project_id,
            "target_resource": f"Project ID: {project_id} (us-central1)",
            "description": "Almacén Data Lakehouse, Análisis DLP & Calidad Automática Dataplex",
            "status": "CONNECTED",
            "updated_at": now_iso
        },
        {
            "id": "cloud_sql_postgres",
            "name": "Google Cloud SQL (PostgreSQL)",
            "cloud": "GCP_POSTGRES",
            "type": "Cloud SQL PostgreSQL",
            "services": ["Cloud SQL Engine", "PostgreSQL 15", "Schema Profiling", "Zero-Copy API"],
            "target_resource": "34.71.91.85:5432/bdanita",
            "description": "Instancia Gestionada Cloud SQL PostgreSQL & Gobierno de Datos en Vivo",
            "status": "CONNECTED",
            "updated_at": now_iso
        }
    ]
    for c in default_connectors:
        db.collection("governance_connectors").document(c["id"]).set(c, merge=True)

    # 3. Colección: catalog_metadata (Metadatos de Catálogo de Gobierno)
    logger.info("📦 Creando colección 'catalog_metadata'...")
    default_assets = [
        {
            "asset_id": "onprem_pg_inventory_core",
            "display_name": "Core Inventory Data Lake",
            "cloud": "GCP",
            "type": "Table",
            "project_id": project_id,
            "dataset_id": "inventory_domain",
            "table_id": "core_inventory",
            "steward": "Ana Quevedo (Lead Data Architect)",
            "governed": True,
            "quality_score": 98.5,
            "confidentiality": "Restricted (PII)",
            "created_at": now_iso
        }
    ]
    for a in default_assets:
        db.collection("catalog_metadata").document(a["asset_id"]).set(a, merge=True)

    # 4. Colección: quality_rules (Reglas de Calidad Dataplex)
    logger.info("📦 Creando colección 'quality_rules'...")
    default_rules = [
        {
            "rule_id": "rule_email_format",
            "dimension": "Validity",
            "column": "email",
            "type": "REGEX_MATCH",
            "threshold": 99.0,
            "status": "ACTIVE",
            "created_at": now_iso
        },
        {
            "rule_id": "rule_not_null_id",
            "dimension": "Completeness",
            "column": "user_id",
            "type": "NOT_NULL",
            "threshold": 100.0,
            "status": "ACTIVE",
            "created_at": now_iso
        }
    ]
    for r in default_rules:
        db.collection("quality_rules").document(r["rule_id"]).set(r, merge=True)

    # 5. Colección: sdp_templates (Plantillas DLP LATAM Standard)
    logger.info("📦 Creando colección 'sdp_templates'...")
    default_templates = [
        {
            "template_id": "tmpl_pii_latam_standard",
            "display_name": "Plantilla DLP PII Estándar LATAM",
            "infotypes": ["EMAIL_ADDRESS", "PHONE_NUMBER", "PASSPORT_NUMBER", "CREDIT_CARD_NUMBER"],
            "likelihood": "LIKELY",
            "created_at": now_iso
        }
    ]
    for t in default_templates:
        db.collection("sdp_templates").document(t["template_id"]).set(t, merge=True)

    # 6. Colección: governance_profiles (Perfiles de Gobierno incluyendo Administrador del Billing)
    logger.info("📦 Creando colección 'governance_profiles'...")
    profiles_file = Path(__file__).parent / "config" / "firestore_profiles_db.json"
    if profiles_file.exists():
        try:
            with open(profiles_file, "r", encoding="utf-8") as f:
                prof_data = json.load(f)
            for p in prof_data.get("profiles", []):
                doc_id = p["id"]
                p_copy = dict(p)
                p_copy["updated_at"] = now_iso
                p_copy["gcp_host_project"] = project_id
                db.collection("governance_profiles").document(doc_id).set(p_copy, merge=True)
                logger.info(f"   ✓ Perfil '{doc_id}' guardado en Firestore")
        except Exception as pe:
            logger.error(f"Error cargando perfiles locales para Firestore: {pe}")

    # 7. Colección: governance_billing (Presupuestos, Facturación y FinOps)
    logger.info("📦 Creando colección 'governance_billing'...")
    billing_seed = {
        "project_id": project_id,
        "currency": "USD",
        "monthly_budget": 2500.0,
        "current_spend": 1420.75,
        "forecast_spend": 2180.50,
        "burn_rate_pct": 56.8,
        "billing_period": "2026-08",
        "status": "HEALTHY",
        "alert_thresholds": [50, 80, 95, 100],
        "services_breakdown": [
            {"service": "BigQuery (Analysis & Slots)", "spend": 620.40, "pct": 43.7, "trend": "+4.2%"},
            {"service": "Cloud Storage (Buckets/Operations)", "spend": 285.15, "pct": 20.1, "trend": "-1.5%"},
            {"service": "Compute Engine (VMs & Disks)", "spend": 240.20, "pct": 16.9, "trend": "0.0%"},
            {"service": "Vertex AI (Gemini APIs / Endpoints)", "spend": 165.00, "pct": 11.6, "trend": "+12.8%"},
            {"service": "Cloud DLP / Dataplex DQ", "spend": 85.00, "pct": 6.0, "trend": "+2.1%"},
            {"service": "Cloud Run & Functions", "spend": 25.00, "pct": 1.7, "trend": "-0.5%"}
        ],
        "updated_at": now_iso
    }
    db.collection("governance_billing").document("overview").set(billing_seed, merge=True)

    # 8. Colección: governance_quotas (Cuotas y Límites de Consumo GCP)
    logger.info("📦 Creando colección 'governance_quotas'...")
    default_quotas = [
        {
            "id": "bq_queries_per_day",
            "name": "BigQuery Query Usage (TB / Día)",
            "service": "BigQuery",
            "metric": "bigquery.googleapis.com/quota/query/usage",
            "region": "global",
            "current_usage": 7.4,
            "limit": 10.0,
            "unit": "TB/día",
            "usage_pct": 74.0,
            "status": "WARNING",
            "description": "Volumen diario procesado por consultas SQL interactivas y programadas",
            "updated_at": now_iso
        },
        {
            "id": "bq_concurrent_queries",
            "name": "Consultas Concurrentes Interactivas",
            "service": "BigQuery",
            "metric": "bigquery.googleapis.com/quota/query/concurrent",
            "region": "global",
            "current_usage": 32,
            "limit": 100,
            "unit": "queries",
            "usage_pct": 32.0,
            "status": "NORMAL",
            "description": "Límite de consultas concurrentes simultáneas por proyecto",
            "updated_at": now_iso
        },
        {
            "id": "gce_cpus_us_central1",
            "name": "Compute Engine vCPUs (us-central1)",
            "service": "Compute Engine",
            "metric": "compute.googleapis.com/cpus",
            "region": "us-central1",
            "current_usage": 18,
            "limit": 24,
            "unit": "vCPUs",
            "usage_pct": 75.0,
            "status": "WARNING",
            "description": "Núcleos virtuales asignados para VMs de procesamiento y ETLs",
            "updated_at": now_iso
        },
        {
            "id": "gce_disks_ssd_tb",
            "name": "Persistent Disk SSD Total (TB)",
            "service": "Compute Engine",
            "metric": "compute.googleapis.com/ssd_total_storage",
            "region": "us-central1",
            "current_usage": 2.1,
            "limit": 10.0,
            "unit": "TB",
            "usage_pct": 21.0,
            "status": "NORMAL",
            "description": "Almacenamiento en disco SSD de alta velocidad montado",
            "updated_at": now_iso
        },
        {
            "id": "vertex_predict_concurrent",
            "name": "Vertex AI Online Prediction Concurrent",
            "service": "Vertex AI",
            "metric": "aiplatform.googleapis.com/online_prediction_requests",
            "region": "us-central1",
            "current_usage": 185,
            "limit": 200,
            "unit": "req/min",
            "usage_pct": 92.5,
            "status": "CRITICAL",
            "description": "Rendimiento y solicitudes por minuto hacia modelos Gemini y RAG",
            "updated_at": now_iso
        },
        {
            "id": "dlp_inspect_mb_min",
            "name": "Cloud DLP / SDP Inspection Throughput",
            "service": "Cloud DLP",
            "metric": "dlp.googleapis.com/inspection_units",
            "region": "global",
            "current_usage": 45,
            "limit": 100,
            "unit": "MB/min",
            "usage_pct": 45.0,
            "status": "NORMAL",
            "description": "Capacidad de inspección de datos sensibles y PII en tiempo real",
            "updated_at": now_iso
        }
    ]
    for q in default_quotas:
        db.collection("governance_quotas").document(q["id"]).set(q, merge=True)

    logger.info("🎉 ¡Provisionamiento de colecciones Firestore completado exitosamente con datos semilla!")

if __name__ == "__main__":
    host_proj = os.getenv("GCP_HOST_PROJECT_ID") or "gobiernodatos"
    if len(sys.argv) > 1 and sys.argv[1].strip():
        host_proj = sys.argv[1].strip()
    provision_firestore_database(host_proj)
