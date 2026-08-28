#!/usr/bin/env bash
# ==============================================================================
# 🛡️ CONFIGURACIÓN DE BASE DE DATOS FIRESTORE & APIS GOOGLE OAUTH
# ==============================================================================
# Uso:
#   ./setup_firestore_oauth.sh [PROJECT_ID] [REGION]
#
# Ejemplo:
#   ./setup_firestore_oauth.sh gobiernodatos us-central1
# ==============================================================================

set -eo pipefail

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

TARGET_PROJECT="${1:-${GCP_HOST_PROJECT_ID}}"
REGION="${2:-${GCP_LOCATION:-us-central1}}"

if [ -z "$TARGET_PROJECT" ]; then
  TARGET_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

if [ -z "$TARGET_PROJECT" ]; then
  echo "❌ Error: Debe especificar un PROJECT_ID o definir GCP_HOST_PROJECT_ID en .env"
  exit 1
fi

echo "======================================================================"
echo "🚀 Habilitando APIs e Infraestructura Firestore para Agente de Gobierno"
echo "🎯 Proyecto Target: $TARGET_PROJECT"
echo "📍 Región: $REGION"
echo "======================================================================"

# 1. Habilitar APIs necesarias en GCP
echo "⚙️ Habilitando APIs necesarias en GCP..."
gcloud services enable \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  iap.googleapis.com \
  bigquery.googleapis.com \
  datacatalog.googleapis.com \
  dataplex.googleapis.com \
  dlp.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  --project="$TARGET_PROJECT" --quiet

echo "✅ APIs de GCP habilitadas exitosamente."

# 2. Crear Base de Datos Firestore en modo Nativo si no existe
echo "🔥 Verificando/Creando base de datos Firestore en modo Nativo..."
if gcloud firestore databases describe --project="$TARGET_PROJECT" >/dev/null 2>&1; then
  echo "ℹ️ La base de datos Firestore ya existe en el proyecto '$TARGET_PROJECT'."
else
  echo "📦 Creando base de datos Firestore Native..."
  gcloud firestore databases create \
    --location="$REGION" \
    --type=firestore-native \
    --project="$TARGET_PROJECT" --quiet || true
  echo "✅ Base de datos Firestore creada exitosamente."
fi

# 3. Otorgar permisos de Datastore/Firestore a la Service Account de Compute/Cloud Run
PROJECT_NUM=$(gcloud projects describe "$TARGET_PROJECT" --format="value(projectNumber)" 2>/dev/null || true)
if [ -n "$PROJECT_NUM" ]; then
  echo "🔐 Otorgando rol 'roles/datastore.user' a la Service Account del Agente..."
  gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
    --member="serviceAccount:${PROJECT_NUM}-compute@developer.gserviceaccount.com" \
    --role="roles/datastore.user" --quiet 2>/dev/null || true
fi

echo ""
echo "======================================================================"
echo "🎉 ¡Configuración de Firestore y OAuth completada con éxito!"
echo "======================================================================"
