#!/usr/bin/env bash
# ==============================================================================
# 🛡️ SCRIPT DE HABILITACIÓN DE APIS GCP PARA EL HOST Y PROYECTOS DE GOBIERNO
# ==============================================================================
# Uso:
#   ./enable_gcp_apis.sh [PROJECT_ID]
#
# Si no se especifica PROJECT_ID, tomará GCP_HOST_PROJECT_ID desde el archivo .env
# o desde la configuración activa de gcloud.
# ==============================================================================

set -eo pipefail

# Intentar cargar .env si existe
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

TARGET_PROJECT="${1:-${GCP_HOST_PROJECT_ID}}"

if [ -z "$TARGET_PROJECT" ]; then
  TARGET_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

if [ -z "$TARGET_PROJECT" ]; then
  echo "❌ Error: Debe especificar un PROJECT_ID o definir GCP_HOST_PROJECT_ID en .env"
  echo "Ejemplo: ./enable_gcp_apis.sh mi-proyecto-host-gcp"
  exit 1
fi

echo "======================================================================"
echo "🚀 Habilitando APIs necesarias de GCP para Gobierno de Datos"
echo "🎯 Proyecto Objetivo: $TARGET_PROJECT"
echo "======================================================================"

APIS=(
  "serviceusage.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "bigquery.googleapis.com"
  "datacatalog.googleapis.com"
  "dataplex.googleapis.com"
  "dlp.googleapis.com"
  "firestore.googleapis.com"
  "iam.googleapis.com"
  "run.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "cloudfunctions.googleapis.com"
)

for api in "${APIS[@]}"; do
  echo "⚙️ Habilitando $api en $TARGET_PROJECT..."
  gcloud services enable "$api" --project="$TARGET_PROJECT" || {
    echo "⚠️ Advertencia: No se pudo habilitar $api (verifique permisos de IAM)."
  }
done

echo ""
echo "✅ Habilitación de APIs completada con éxito en el proyecto: $TARGET_PROJECT"
echo "💡 Recuerde asegurar que la Service Account o usuario tenga los roles de IAM:"
echo "   - BigQuery Admin / Data Viewer"
echo "   - Data Catalog Admin"
echo "   - Dataplex Admin"
echo "   - DLP Administrator"
echo "======================================================================"
