#!/usr/bin/env bash
# ==============================================================================
# 🛡️ SCRIPT DE DESPLIEGUE EN CLOUD RUN FUNCTIONS (2ND GEN)
# ==============================================================================
# Uso:
#   ./deploy_cloud_function.sh [FUNCTION_NAME] [PROJECT_ID] [REGION]
#
# Ejemplo:
#   ./deploy_cloud_function.sh gobierno-datos-function cmiagentes us-central1
# ==============================================================================

set -eo pipefail

# Cargar variables desde .env si existe
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

FUNCTION_NAME="${1:-gobierno-datos-function}"
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
echo "🚀 Desplegando en Google Cloud Run Functions (2nd Gen)"
echo "🎯 Función: $FUNCTION_NAME"
echo "🎯 Proyecto: $TARGET_PROJECT"
echo "📍 Región: $REGION"
echo "======================================================================"

# 1. Habilitar servicios de Cloud Functions (2nd Gen) y Cloud Run
echo "⚙️ Habilitando APIs de Cloud Functions y Cloud Run..."
gcloud services enable cloudfunctions.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="$TARGET_PROJECT" --quiet

# Otorgar permiso de Cloud Build a la Service Account predeterminada
PROJECT_NUM=$(gcloud projects describe "$TARGET_PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
if [ -n "$PROJECT_NUM" ]; then
  gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
    --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/cloudbuild.builds.builder" --quiet 2>/dev/null || true
fi

# Crear repositorio de Artifact Registry si no existe para evitar bug de gcloud
echo "📦 Verificando/Creando repositorio en Artifact Registry..."
gcloud artifacts repositories create gcf-artifacts \
  --repository-format=docker \
  --location="$REGION" \
  --project="$TARGET_PROJECT" \
  --description="Cloud Functions Artifacts Repository" --quiet 2>/dev/null || true

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

# 3. Desplegar Función HTTP en Cloud Run Functions 2nd Gen
echo "📦 Compilando fuente y desplegando Cloud Run Function 2nd Gen..."
gcloud functions deploy "$FUNCTION_NAME" \
  --gen2 \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --runtime=python311 \
  --source=. \
  --entry-point=governance_hub \
  --trigger-http \
  --docker-repository="projects/$TARGET_PROJECT/locations/$REGION/repositories/gcf-artifacts" \
  --allow-unauthenticated \
  --env-vars-file=env_vars.yaml \
  --quiet

# 4. Otorgar permisos de Invocador Público (allUsers) y Usuario
echo "🔐 Otorgando permisos de Invocación Pública en Cloud Functions 2nd Gen..."
gcloud functions add-invoker-policy-binding "$FUNCTION_NAME" \
  --gen2 \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --member="allUsers" --quiet 2>/dev/null || true

echo ""
echo "======================================================================"
echo "✅ ¡Despliegue en Cloud Run Functions (2nd Gen) completado con éxito!"
echo "======================================================================"
