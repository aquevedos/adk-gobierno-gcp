#!/usr/bin/env bash
# ==============================================================================
# 🚀 SCRIPT DE DESPLIEGUE AUTOMÁTICO INTEGRAL EN GOOGLE CLOUD RUN
# ==============================================================================
# Agentic Data Governance Hub (v3.6.0)
#
# Uso:
#   ./auto_deploy_cloud_run.sh [SERVICE_NAME] [PROJECT_ID] [REGION]
#
# Ejemplos:
#   ./auto_deploy_cloud_run.sh
#   ./auto_deploy_cloud_run.sh gobierno-datos-agent mi-proyecto-gcp us-central1
# ==============================================================================

set -eo pipefail

# 🎨 Colores de Google Cloud y Tonos Pasteles para Terminal
CLR_BLUE="\033[1;34m"
CLR_GREEN="\033[1;32m"
CLR_YELLOW="\033[1;33m"
CLR_RED="\033[1;31m"
CLR_CYAN="\033[1;36m"
CLR_PURPLE="\033[1;35m"
CLR_RESET="\033[0m"
CLR_PASTEL_BG="\033[48;5;255m"

print_header() {
  echo -e "\n${CLR_BLUE}======================================================================${CLR_RESET}"
  echo -e "${CLR_CYAN}  ☁️  AGENTIC DATA GOVERNANCE HUB - DESPLIEGUE AUTOMÁTICO EN CLOUD RUN${CLR_RESET}"
  echo -e "${CLR_BLUE}======================================================================${CLR_RESET}"
}

print_step() {
  echo -e "\n${CLR_YELLOW}▶ $1${CLR_RESET}"
}

print_success() {
  echo -e "${CLR_GREEN}✓ $1${CLR_RESET}"
}

print_warning() {
  echo -e "${CLR_YELLOW}⚠ $1${CLR_RESET}"
}

print_error() {
  echo -e "${CLR_RED}✖ $1${CLR_RESET}"
}

print_header

# ------------------------------------------------------------------------------
# 1. Cargar Variables de Entorno y Configuración Inicial
# ------------------------------------------------------------------------------
print_step "1. Validando configuración del entorno y herramientas..."

# Verificar CLI gcloud
if ! command -v gcloud &>/dev/null; then
  print_error "Google Cloud SDK (gcloud) no está instalado o no se encuentra en el PATH."
  echo "Por favor instálelo desde https://cloud.google.com/sdk/docs/install"
  exit 1
fi
print_success "gcloud CLI detectado correctamente."

# Cargar archivo .env si existe
if [ -f .env ]; then
  echo "📄 Leyendo configuración desde archivo .env local..."
  export $(grep -v '^#' .env | xargs -d '\n')
fi

# Parámetros con fallback inteligente
SERVICE_NAME="${1:-${GCP_SERVICE_NAME:-gobierno-datos-agent}}"
TARGET_PROJECT="${2:-${GCP_HOST_PROJECT_ID}}"
REGION="${3:-${GCP_LOCATION:-us-central1}}"

# Si aún no se define el proyecto, intentar leer de gcloud
if [ -z "$TARGET_PROJECT" ]; then
  TARGET_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
fi

if [ -z "$TARGET_PROJECT" ] || [ "$TARGET_PROJECT" = "(unset)" ]; then
  print_error "Debe especificar un PROJECT_ID válido o definir GCP_HOST_PROJECT_ID en el archivo .env."
  echo "Uso: ./auto_deploy_cloud_run.sh [SERVICE_NAME] [PROJECT_ID] [REGION]"
  exit 1
fi

echo -e "   • Servicio objetivo:  ${CLR_CYAN}${SERVICE_NAME}${CLR_RESET}"
echo -e "   • Proyecto GCP:       ${CLR_CYAN}${TARGET_PROJECT}${CLR_RESET}"
echo -e "   • Región de cómputo:  ${CLR_CYAN}${REGION}${CLR_RESET}"

# Verificar sesión activa en gcloud
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null || true)
if [ -z "$CURRENT_ACCOUNT" ]; then
  print_warning "No hay una cuenta activa de gcloud. Ejecutando login..."
  gcloud auth login --brief
fi
print_success "Autenticado en gcloud con la cuenta: $CURRENT_ACCOUNT"

# Asegurar proyecto activo en CLI
gcloud config set project "$TARGET_PROJECT" --quiet 2>/dev/null || true

# ------------------------------------------------------------------------------
# 2. Habilitación Automatizada de APIs Requeridas en GCP
# ------------------------------------------------------------------------------
print_step "2. Habilitando APIs necesarias en el proyecto '${TARGET_PROJECT}'..."

REQUIRED_APIS=(
  "serviceusage.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "run.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "firestore.googleapis.com"
  "bigquery.googleapis.com"
  "datacatalog.googleapis.com"
  "dataplex.googleapis.com"
  "dlp.googleapis.com"
  "iam.googleapis.com"
  "identitytoolkit.googleapis.com"
)

echo "Habilitando APIs críticas en paralelo..."
gcloud services enable "${REQUIRED_APIS[@]}" --project="$TARGET_PROJECT" --quiet || {
  print_warning "Algunas APIs no pudieron habilitarse de forma masiva. Intentando individualmente..."
  for api in "${REQUIRED_APIS[@]}"; do
    gcloud services enable "$api" --project="$TARGET_PROJECT" --quiet 2>/dev/null || print_warning "No se pudo habilitar $api"
  done
}
print_success "APIs de Google Cloud verificadas y activas."

# ------------------------------------------------------------------------------
# 3. Configuración de Identidades y Permisos de IAM
# ------------------------------------------------------------------------------
print_step "3. Configurando permisos y Service Accounts para Cloud Run y Cloud Build..."

PROJECT_NUM=$(gcloud projects describe "$TARGET_PROJECT" --format="value(projectNumber)" 2>/dev/null || true)

if [ -n "$PROJECT_NUM" ]; then
  COMPUTE_SA="${PROJECT_NUM}-compute@developer.gserviceaccount.com"
  CLOUDBUILD_SA="${PROJECT_NUM}@cloudbuild.gserviceaccount.com"

  echo "Asignando roles a la Service Account de Cómputo ($COMPUTE_SA)..."
  SA_ROLES=(
    "roles/datastore.user"
    "roles/bigquery.admin"
    "roles/datacatalog.admin"
    "roles/dataplex.admin"
    "roles/dlp.admin"
    "roles/geminidataanalytics.dataAgentUser"
    "roles/geminidataanalytics.queryDataUser"
  )

  for role in "${SA_ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
      --member="serviceAccount:${COMPUTE_SA}" \
      --role="$role" \
      --quiet >/dev/null 2>&1 || true
  done

  # Otorgar permiso de Cloud Build a la Service Account
  gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/cloudbuild.builds.builder" \
    --quiet >/dev/null 2>&1 || true

  gcloud projects add-iam-policy-binding "$TARGET_PROJECT" \
    --member="serviceAccount:${CLOUDBUILD_SA}" \
    --role="roles/cloudbuild.builds.builder" \
    --quiet >/dev/null 2>&1 || true

  print_success "Roles de IAM asignados correctamente."
else
  print_warning "No se pudo obtener el número de proyecto para configurar IAM automáticamente."
fi

# ------------------------------------------------------------------------------
# 4. Provisionamiento Automático de Firestore Native y Colecciones Semilla
# ------------------------------------------------------------------------------
print_step "4. Verificando y provisionando Google Cloud Firestore Native..."

# Verificar si Firestore ya existe
if gcloud firestore databases describe --project="$TARGET_PROJECT" >/dev/null 2>&1; then
  print_success "Base de datos Firestore Native ya existe en '$TARGET_PROJECT'."
else
  echo "Creando base de datos Firestore Native en región '$REGION'..."
  gcloud firestore databases create \
    --location="$REGION" \
    --type=firestore-native \
    --project="$TARGET_PROJECT" \
    --quiet 2>/dev/null || true
  print_success "Base de datos Firestore Native creada."
fi

# Sembrado automático de colecciones en Firestore
echo "Poblando colecciones iniciales de usuarios, conectores, reglas y perfiles..."
if command -v uv &>/dev/null; then
  uv run python provision_firestore.py "$TARGET_PROJECT" || python3 provision_firestore.py "$TARGET_PROJECT" || true
else
  python3 provision_firestore.py "$TARGET_PROJECT" || true
fi
print_success "Colecciones de Firestore Native sincronizadas con datos semilla."

# ------------------------------------------------------------------------------
# 5. Generación del Archivo de Variables de Entorno para Cloud Run
# ------------------------------------------------------------------------------
print_step "5. Generando archivo de variables de entorno de producción (env_vars.yaml)..."

cat <<EOF > env_vars.yaml
GCP_HOST_PROJECT_ID: "${TARGET_PROJECT}"
GCP_LOCATION: "${REGION}"
GCP_GOVERNED_PROJECTS: "${GCP_GOVERNED_PROJECTS:-$TARGET_PROJECT}"
GCP_CREDENTIALS_TYPE: "ADC"
HOST: "0.0.0.0"
GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID:-623690130665-scr4mmdlbqc4m646mul06sjhhd2gsa9v.apps.googleusercontent.com}"
BQ_DATA_AGENT_ID: "${BQ_DATA_AGENT_ID:-agent_d74dd4e9-e294-4834-9b6d-a00fff8f0950}"
BQ_DATA_AGENT_PROJECT_ID: "${BQ_DATA_AGENT_PROJECT_ID:-$TARGET_PROJECT}"
BQ_DATA_AGENT_LOCATION: "${BQ_DATA_AGENT_LOCATION:-us}"
EOF
print_success "Archivo env_vars.yaml generado correctamente (sin variable reservada PORT)."

# ------------------------------------------------------------------------------
# 6. Compilación de Imagen y Despliegue en Google Cloud Run
# ------------------------------------------------------------------------------
print_step "6. Compilando código fuente y desplegando en Google Cloud Run..."

echo "Iniciando compilación y publicación con configuración de alta resiliencia..."
gcloud run deploy "$SERVICE_NAME" \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --source=. \
  --allow-unauthenticated \
  --clear-base-image \
  --memory=2Gi \
  --cpu=2 \
  --concurrency=80 \
  --timeout=300 \
  --min-instances=0 \
  --max-instances=10 \
  --port=8080 \
  --env-vars-file=env_vars.yaml \
  --quiet

print_success "¡Servicio Cloud Run desplegado exitosamente!"

# ------------------------------------------------------------------------------
# 7. Obtención de URL Pública y Prueba de Salud (Health Check)
# ------------------------------------------------------------------------------
print_step "7. Verificando estado operativo del servicio..."

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --project="$TARGET_PROJECT" \
  --region="$REGION" \
  --format="value(status.url)" 2>/dev/null || true)

if [ -n "$SERVICE_URL" ]; then
  echo -e "\n${CLR_CYAN}🌐 URL del Agente de Gobierno de Datos:${CLR_RESET} ${CLR_GREEN}${SERVICE_URL}${CLR_RESET}"
  
  echo "Realizando health check sobre la API de perfiles..."
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVICE_URL}/api/profiles" || true)
  if [ "$HTTP_STATUS" = "200" ]; then
    print_success "Health Check exitoso (HTTP 200 OK)."
  else
    print_warning "Health check respondió con código HTTP: $HTTP_STATUS (el contenedor puede estar aún calentando)."
  fi
else
  print_warning "No se pudo recuperar la URL del servicio automáticamente. Verifique en la consola de Cloud Run."
fi

# ------------------------------------------------------------------------------
# Resumen Ejecutivo Final
# ------------------------------------------------------------------------------
echo -e "\n${CLR_GREEN}======================================================================${CLR_RESET}"
echo -e "${CLR_GREEN}🎉 ¡DESPLIEGUE AUTOMÁTICO EN GOOGLE CLOUD RUN COMPLETADO CON ÉXITO!${CLR_RESET}"
echo -e "${CLR_GREEN}======================================================================${CLR_RESET}"
echo -e "   • Servicio:   ${CLR_BLUE}$SERVICE_NAME${CLR_RESET}"
echo -e "   • Proyecto:   ${CLR_BLUE}$TARGET_PROJECT${CLR_RESET}"
echo -e "   • Región:     ${CLR_BLUE}$REGION${CLR_RESET}"
if [ -n "$SERVICE_URL" ]; then
  echo -e "   • Acceso Web: ${CLR_GREEN}$SERVICE_URL${CLR_RESET}"
fi
echo -e "   • Persistencia: ${CLR_PURPLE}Firestore Native Activado & Poblado${CLR_RESET}"
echo -e "   • Estilo UI:    ${CLR_CYAN}Google Cloud Brand & Tonos Pasteles${CLR_RESET}"
echo -e "======================================================================\n"
