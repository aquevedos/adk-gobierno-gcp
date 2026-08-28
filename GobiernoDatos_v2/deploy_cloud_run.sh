#!/usr/bin/env bash
# ==============================================================================
# 🛡️ SCRIPT DE DESPLIEGUE SERVERLESS EN GOOGLE CLOUD RUN / CLOUD RUN FUNCTIONS
# ==============================================================================
# Uso:
#   ./deploy_cloud_run.sh [SERVICE_NAME] [PROJECT_ID] [REGION]
#
# Ejemplo:
#   ./deploy_cloud_run.sh gobierno-datos-agent cmiagentes us-central1
# ==============================================================================

set -eo pipefail

# Cargar variables desde .env si existe
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

SERVICE_NAME="${1:-gobierno-datos-agent}"
TARGET_PROJECT="${2:-${GCP_HOST_PROJECT_ID}}"
REGION="${3:-${GCP_LOCATION:-us-central1}}"

if [ -z "$TARGET_PROJECT" ]; then
  TARGET_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

if [ -z "$TARGET_PROJECT" ]; then
  echo "❌ Error: Debe especificar un PROJECT_ID o definir GCP_HOST_PROJECT_ID en .env"
  exit 1
fi

echo "======================================================================"
echo "🚀 Desplegando Agente Inteligente de Gobierno de Datos en Google Cloud"
echo "🎯 Servicio: $SERVICE_NAME"
echo "🎯 Proyecto: $TARGET_PROJECT"
echo "📍 Región: $REGION"
echo "======================================================================"

# 1. Habilitar servicios de Cloud Run y Cloud Build
echo "⚙️ Habilitando servicios necesarios de GCP (Cloud Run, Cloud Build, Artifact Registry)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$TARGET_PROJECT" --quiet

# Otorgar permiso de Cloud Build a la Service Account predeterminada
PROJECT_NUM=$(gcloud projects describe "$TARGET_PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
if [ -n "$PROJECT_NUM" ]; then
  gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
    --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.builder" --quiet 2>/dev/null || true
fi
# Provisionar automáticamente la base de datos Firestore Native y colecciones semilla
echo "🔥 Provisionando base de datos Firestore Native y colecciones en '$TARGET_PROJECT'..."
./setup_firestore_oauth.sh "$TARGET_PROJECT" "$REGION" || true
uv run python provision_firestore.py "$TARGET_PROJECT" || python3 provision_firestore.py "$TARGET_PROJECT" || true

# 2. Generar archivo dinámico env_vars.yaml para evitar errores de sintaxis en valores con comas
cat <<EOF > env_vars.yaml
GCP_HOST_PROJECT_ID: "${TARGET_PROJECT}"
GCP_LOCATION: "${REGION}"
GCP_GOVERNED_PROJECTS: "${GCP_GOVERNED_PROJECTS:-$TARGET_PROJECT}"
EOF

# 3. Desplegar en Cloud Run (Servidor Serverless)
echo "📦 Compilando fuente y desplegando en Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --source=. \
  --allow-unauthenticated \
  --clear-base-image \
  --env-vars-file=env_vars.yaml \
  --quiet

echo ""
echo "======================================================================"
echo "✅ ¡Despliegue Serverless en Cloud Run completado con éxito!"
echo "🌐 Servicio disponible en el proyecto: $TARGET_PROJECT"
echo "======================================================================"
