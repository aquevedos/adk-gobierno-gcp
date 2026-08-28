#!/usr/bin/env bash
# ==============================================================================
# 🛡️ CONFIGURACIÓN DE IAP, AUDIENCIAS PERSONALIZADAS E IAM INVOKER
# ==============================================================================
# Uso:
#   ./setup_iap_and_custom_audiences.sh [FUNCTION_NAME] [PROJECT_ID] [REGION]
#
# Ejemplo:
#   ./setup_iap_and_custom_audiences.sh gobierno-datos-function gobiernodatos us-central1
# ==============================================================================

set -eo pipefail

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

FUNCTION_NAME="${1:-gobierno-datos-function}"
TARGET_PROJECT="${2:-${GCP_HOST_PROJECT_ID}}"
REGION="${3:-${GCP_LOCATION:-us-central1}}"

if [ -z "$TARGET_PROJECT" ]; then
  TARGET_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

echo "======================================================================"
echo "🚀 Configurando Custom Audiences e IAM Invoker para Cloud Run Function"
echo "🎯 Función: $FUNCTION_NAME"
echo "🎯 Proyecto: $TARGET_PROJECT"
echo "📍 Región: $REGION"
echo "======================================================================"

# 1. Configurar Audiencias Personalizadas en Cloud Run Service
FUNCTION_URL="https://${REGION}-${TARGET_PROJECT}.cloudfunctions.net/${FUNCTION_NAME}"
echo "⚙️ Añadiendo audiencia personalizada: $FUNCTION_URL..."

gcloud run services update "$FUNCTION_NAME" \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --add-custom-audiences="$FUNCTION_URL" --quiet || true

# 2. Otorgar permisos de Invocación (roles/run.invoker) al usuario actual y dominio
USER_EMAIL=$(gcloud config get-value account 2>/dev/null || true)
DOMAIN_NAME=$(echo "$USER_EMAIL" | cut -d'@' -f2 || true)

if [ -n "$USER_EMAIL" ]; then
  echo "🔐 Otorgando rol 'roles/run.invoker' al usuario: $USER_EMAIL..."
  gcloud run services add-iam-policy-binding "$FUNCTION_NAME" \
    --project="$TARGET_PROJECT" \
    --region="$REGION" \
    --member="user:$USER_EMAIL" \
    --role="roles/run.invoker" --quiet || true
fi

if [ -n "$DOMAIN_NAME" ]; then
  echo "🔐 Otorgando rol 'roles/run.invoker' al dominio: $DOMAIN_NAME..."
  gcloud run services add-iam-policy-binding "$FUNCTION_NAME" \
    --project="$TARGET_PROJECT" \
    --region="$REGION" \
    --member="domain:$DOMAIN_NAME" \
    --role="roles/run.invoker" --quiet || true
fi

echo ""
echo "======================================================================"
echo "✅ ¡Configuración de Custom Audiences e IAM completada exitosamente!"
echo "======================================================================"
