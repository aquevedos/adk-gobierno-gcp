"""GCP Client Utility Helper for Real Data Governance Executions on Google Cloud Platform."""

import logging
import os
import subprocess
from typing import Optional

import google.auth
from google.cloud import bigquery, datacatalog_v1, dataplex_v1, dlp_v2
from google.cloud.datacatalog_lineage_v1 import LineageClient
from google.oauth2.credentials import Credentials

logger = logging.getLogger("gcp_utils")

DEFAULT_PROJECT_ID = os.getenv("GCP_HOST_PROJECT_ID") or os.getenv("GCP_PROJECT_ID") or "cmiagentes"
DEFAULT_LOCATION = os.getenv("GCP_LOCATION", "us-central1")


def get_active_project_id() -> str:
    """Obtiene el ID del proyecto GCP configurado o activo en gcloud / .env."""
    project_id = os.getenv("GCP_HOST_PROJECT_ID") or os.getenv("GCP_PROJECT_ID")
    if not project_id:
        try:
            res = subprocess.check_output(["gcloud", "config", "get-value", "project"], text=True).strip()
            if res and "(" not in res:
                project_id = res
        except Exception:
            pass
    return project_id or DEFAULT_PROJECT_ID


def get_gcp_credentials(project_id: Optional[str] = None) -> Optional[Credentials]:
    """Obtiene credenciales válidas de GCP para peticiones API reales usando ADC o fallback con token de gcloud."""
    # 1. Intentar ADC nativo (Cloud Run, Compute Engine, GKE o local)
    try:
        creds, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
        if creds:
            # En Cloud Run / GCE la cuenta de servicio gestiona tokens automáticamente
            if os.getenv("K_SERVICE"):
                return creds
            # En entorno de desarrollo local, intentar refrescar
            try:
                import google.auth.transport.requests
                auth_req = google.auth.transport.requests.Request()
                creds.refresh(auth_req)
                return creds
            except Exception:
                pass
    except Exception as e:
        logger.debug(f"google.auth.default: {e}")

    # 2. Fallback para desarrollo local usando CLI gcloud
    try:
        token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True, stderr=subprocess.DEVNULL).strip()
        if token:
            from google.oauth2.credentials import Credentials as OAuthCredentials
            return OAuthCredentials(token=token)
    except Exception:
        pass

    # Si estamos en entorno Cloud Run, retornar None para que el SDK de Google use ADC por defecto
    if os.getenv("K_SERVICE"):
        return None

    raise RuntimeError("No se pudieron obtener credenciales válidas de GCP. Ejecuta 'gcloud auth application-default login' en la terminal.")


def get_bigquery_client(project_id: Optional[str] = None) -> bigquery.Client:
    """Retorna un cliente real de Google Cloud BigQuery."""
    proj = project_id or get_active_project_id()
    creds = get_gcp_credentials(proj)
    return bigquery.Client(credentials=creds, project=proj)


def get_dlp_client(project_id: Optional[str] = None) -> dlp_v2.DlpServiceClient:
    """Retorna un cliente real de Google Cloud Sensitive Data Protection (Cloud DLP)."""
    proj = project_id or get_active_project_id()
    creds = get_gcp_credentials(proj)
    return dlp_v2.DlpServiceClient(credentials=creds, client_options={"quota_project_id": proj})


def get_datacatalog_client(project_id: Optional[str] = None) -> datacatalog_v1.DataCatalogClient:
    """Retorna un cliente real de Google Cloud Data Catalog (Knowledge Catalog)."""
    proj = project_id or get_active_project_id()
    creds = get_gcp_credentials(proj)
    return datacatalog_v1.DataCatalogClient(credentials=creds, client_options={"quota_project_id": proj})


def get_lineage_client(project_id: Optional[str] = None) -> LineageClient:
    """Retorna un cliente real de Data Catalog Lineage API."""
    proj = project_id or get_active_project_id()
    creds = get_gcp_credentials(proj)
    return LineageClient(credentials=creds, client_options={"quota_project_id": proj})


def get_dataplex_client(project_id: Optional[str] = None) -> dataplex_v1.DataplexServiceClient:
    """Retorna un cliente real de Google Cloud Dataplex."""
    proj = project_id or get_active_project_id()
    creds = get_gcp_credentials(proj)
    return dataplex_v1.DataplexServiceClient(credentials=creds, client_options={"quota_project_id": proj})
