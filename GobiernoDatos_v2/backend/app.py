"""FastAPI Backend and Web Server for Agentic Data Governance Platform."""

import asyncio
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

import dotenv
dotenv.load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

# Importaciones directas desde la estructura modular
from modulos.modulo1_catalogo_activo import catalog_manager
from modulos.modulo2_dlp_seguridad_pii import dlp_scanner, policy_tagger, sdp_manager
from modulos.modulo3_calidad_dataplex import quality_engine
from modulos.modulo4_linaje_trazabilidad import lineage_graph_builder
from modulos.modulo5_seguridad_cumplimiento import privacy_guard
from modulos.modulo6_data_stewards_ia import stewards_manager
from modulos.modulo7_policy_as_code_mcp import policy_engine
from modulos.modulo8_looker_semantic_governance import looker_governance_manager
from modulos.modulo3_calidad_dataplex.business_quality_rules import business_quality_engine
from modulos.conectores_multicloud import connector_factory, gcp_connector
from modulos.conectores_multicloud.external_db_connector import external_db_connector
from modulos.perfiles_gobierno import firestore_profile_service
from modulos.modulo9_billing_control_cuotas import billing_manager, bigquery_agent_service
from core_agent import agent_brain

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("governance_api")

app = FastAPI(
    title="Agentic Data Governance Hub API",
    description="Backend Modular para el Agente Inteligente de Gobierno de Datos Multi-Cloud con 5 Perfiles de Gobierno y Gestión FinOps",
    version="3.6.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_header(request, call_next):
    # Capturar identidad de Google IAP (Identity-Aware Proxy) si está presente
    iap_email = request.headers.get("X-Goog-Authenticated-User-Email", "")
    if iap_email:
        clean_email = iap_email.replace("accounts.google.com:", "").strip().lower()
        if clean_email:
            try:
                from modulos.autenticacion_firestore import firestore_auth_manager
                user_info = {
                    "email": clean_email,
                    "name": clean_email.split("@")[0].replace(".", " ").title(),
                    "domain": clean_email.split("@")[-1]
                }
                user_doc = firestore_auth_manager.register_or_update_user(user_info, "Lead Data Architect")
                request.state.user = user_doc
            except Exception as e:
                logger.warning(f"Error procesando usuario IAP '{clean_email}': {e}")

    response = await call_next(request)
    if request.url.path.endswith(".js") or request.url.path.endswith(".css") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# --- Modelos de Petición ---
class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None
    profile_id: Optional[str] = None


class BigQueryAgentChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None


class ProfileSwitchRequest(BaseModel):
    profile_id: str


class MaturityDiagnosisRequest(BaseModel):
    answers: Optional[Dict[str, int]] = None


class MetadataUpdateRequest(BaseModel):
    description: Optional[str] = None
    steward: Optional[str] = None
    golden_query: Optional[str] = None
    column_updates: Optional[List[Dict[str, Any]]] = None


class PolicyTagRequest(BaseModel):
    auto_mask: Optional[bool] = True


class GlossaryTermRequest(BaseModel):
    term: str
    definition: str
    domain: str
    approved_by: str


class TagUpdateRequest(BaseModel):
    template_id: str
    fields: Dict[str, Any]
    column_tags: Optional[List[Dict[str, Any]]] = None


class AICertificationRequest(BaseModel):
    certified: bool
    notes: Optional[str] = "Certificado por Data Steward"


class LoginRequest(BaseModel):
    email: str
    password: str


class PolicyGenerateRequest(BaseModel):
    prompt: str


class ExternalDBTestRequest(BaseModel):
    engine: str = "mysql"
    host: str
    port: int = 10283
    database: str
    schema: Optional[str] = "public, sistemas"
    user: str
    password: str
    ssl_enabled: bool = False


class ExternalDBDiscoverRequest(BaseModel):
    engine: str = "mysql"
    host: str
    port: int = 10283
    database: str
    schema: Optional[str] = "public, sistemas"
    user: str
    password: str
    selected_tables: Optional[List[str]] = None
    csv_content: Optional[str] = None


class ThresholdUpdateRequest(BaseModel):
    rule_id: str
    new_threshold: float


class ImpactAnalysisRequest(BaseModel):
    modified_columns: List[str]


class QualityDimensionAddRequest(BaseModel):
    nombre: str
    definicion: str
    ejemplo_regla_mdm: str
    added_by: Optional[str] = "Data Steward"


class SQLDryRunRequest(BaseModel):
    sql: str
    project_id: Optional[str] = None


class QuotaIncreaseRequest(BaseModel):
    quota_id: str
    requested_limit: float
    justification: str
    contact_email: Optional[str] = "billing@empresa.com"


class RecommendationApplyRequest(BaseModel):
    recommendation_id: str


class BudgetUpdateRequest(BaseModel):
    monthly_budget: float
    alert_thresholds: Optional[List[int]] = None


class BillingQueryRequest(BaseModel):
    sql: str
    dry_run: bool = False
    max_rows: Optional[int] = 200


# --- Modelos de Petición para Sensitive Data Protection (SDP) ---
class DiscoveryScanRequest(BaseModel):
    asset_id: Optional[str] = None
    source_type: Optional[str] = None
    cloud: Optional[str] = None


class CustomInfoTypeCreateRequest(BaseModel):
    name: str
    display_name: str
    type: str = "REGEX"
    regex_pattern: Optional[str] = None
    dictionary_words: Optional[List[str]] = None
    likelihood: str = "VERY_LIKELY"
    hotwords: Optional[List[str]] = None
    description: Optional[str] = ""
    created_by: Optional[str] = "Data Steward"


class CustomInfoTypeTestRequest(BaseModel):
    type: str = "REGEX"
    regex_pattern: Optional[str] = None
    dictionary_words: Optional[List[str]] = None
    sample_text: str
    hotwords: Optional[List[str]] = None


class InspectJobCreateRequest(BaseModel):
    name: str
    target_asset_id: str
    infotypes_selected: List[str]
    min_likelihood: str = "LIKELY"
    sampling_pct: int = 100
    auto_apply_tags: bool = True
    created_by: Optional[str] = "Data Steward"


class JobTriggerCreateRequest(BaseModel):
    name: str
    description: str
    schedule: str
    target_asset_id: str
    template_id: str = "tmpl_pii_latam_standard"
    created_by: Optional[str] = "Data Steward"


class RiskAnalysisRequest(BaseModel):
    quasi_identifiers: Optional[List[str]] = None
    sensitive_attributes: Optional[List[str]] = None


class InspectTemplateCreateRequest(BaseModel):
    name: str
    description: str
    infotypes: List[str]
    min_likelihood: str = "LIKELY"
    max_findings: int = 1000
    created_by: Optional[str] = "Data Steward"


class DeidentifyTemplateCreateRequest(BaseModel):
    name: str
    transformation_type: str
    description: str
    parameters: Dict[str, Any]
    sample_input: str
    sample_output: str
    created_by: Optional[str] = "Data Steward"


# --- Autenticación Google OAuth 2.0 & Login por Rol ---
from modulos.autenticacion_firestore import firestore_auth_manager

class GoogleOAuthRequest(BaseModel):
    credential: str
    selected_role: Optional[str] = "Lead Data Architect"


@app.post("/api/auth/google_login")
async def google_login(req: GoogleOAuthRequest):
    """Autentica a un usuario mediante Google OAuth 2.0 y registra el perfil en Firestore."""
    try:
        user_info = firestore_auth_manager.verify_google_oauth_token(req.credential)
        user_doc = firestore_auth_manager.register_or_update_user(user_info, req.selected_role)
        session_id = firestore_auth_manager.create_session(user_doc["email"], user_doc["role"])
        
        # FIX: Ensure OAuth users automatically become the Architect profile
        firestore_profile_service.set_active_profile("arquitecto_ingeniero")
        
        # Inyectar ID para que el frontend pueda cargar correctamente las pestañas y color pastel
        user_doc["id"] = "arquitecto_ingeniero"
        
        response = JSONResponse(content={
            "status": "success",
            "message": f"¡Bienvenido {user_doc['name']}! Autenticado mediante Google OAuth 2.0 en Firestore.",
            "data": {
                "user": user_doc,
                "session_id": session_id
            }
        })
        response.set_cookie(key="governance_session", value=session_id, httponly=True, samesite="lax", secure=True)
        return response
    except Exception as e:
        logger.error(f"Error en inicio de sesión Google OAuth: {e}")
        raise HTTPException(status_code=401, detail=str(e))


@app.get("/api/auth/firestore_status")
async def get_firestore_auth_status():
    """Retorna el estado de la base de datos Firestore y usuarios registrados."""
    status = firestore_auth_manager.get_firestore_status()
    return JSONResponse(content={"status": "success", "data": status})


@app.post("/api/auth/login")
async def login_user(req: LoginRequest):
    user_profile = firestore_profile_service.authenticate_user(req.email, req.password)
    if not user_profile:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas. Verifica tu correo y contraseña.")
    
    return JSONResponse(content={
        "status": "success",
        "message": f"Bienvenido, {user_profile.get('user_name')}",
        "user": user_profile,
        "token": f"token_{user_profile.get('id')}_auth"
    })


@app.get("/api/auth/current_user")
async def get_current_user():
    active = firestore_profile_service.get_active_profile()
    return JSONResponse(content={"status": "success", "user": active})


# --- Endpoints de Chat & Agente ---
@app.post("/api/chat")
async def chat_with_agent(req: ChatRequest):
    try:
        response = await agent_brain.chat(req.message, req.conversation_history, profile_id=req.profile_id)
        return JSONResponse(content={"status": "success", "data": response})
    except Exception as e:
        logger.error(f"Error en chat: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- MÓDULO PERFILES DE GOBIERNO & FIRESTORE ---
@app.get("/api/profiles")
async def list_profiles():
    """Retorna los 4 perfiles de gobierno persistidos en Firestore."""
    profiles = firestore_profile_service.get_all_profiles()
    active_profile = firestore_profile_service.get_active_profile()
    return JSONResponse(content={
        "status": "success",
        "active_profile_id": active_profile.get("id"),
        "total": len(profiles),
        "data": profiles
    })


@app.get("/api/profiles/active")
async def get_active_profile():
    active = firestore_profile_service.get_active_profile()
    return JSONResponse(content={"status": "success", "data": active})


@app.post("/api/profiles/switch")
async def switch_profile(req: ProfileSwitchRequest):
    """Cambia el perfil activo del agente y lo sincroniza con Firestore."""
    res = firestore_profile_service.set_active_profile(req.profile_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return JSONResponse(content={"status": "success", "data": res})


@app.post("/api/profiles/maturity_diagnosis")
async def calculate_maturity(req: MaturityDiagnosisRequest):
    """Calcula el diagnóstico de madurez de gobierno para el Perfil 2."""
    res = firestore_profile_service.calculate_maturity_diagnosis(req.answers or {})
    return JSONResponse(content={"status": "success", "data": res})


@app.post("/api/profiles/sync_firestore")
async def sync_profiles_to_firestore():
    """Sincroniza todos los perfiles de gobierno hacia Cloud Firestore (incluyendo Administrador del Billing)."""
    res = firestore_profile_service.sync_all_profiles_to_firestore()
    return JSONResponse(content={"status": "success", "data": res})


# --- MÓDULO 1: Knowledge Catalog & Metadatos ---
@app.get("/api/catalog/assets")
async def list_assets(cloud: Optional[str] = Query(None), domain: Optional[str] = Query(None)):
    assets = catalog_manager.list_assets(cloud=cloud, domain=domain)
    return JSONResponse(content={"status": "success", "total": len(assets), "data": assets})


@app.get("/api/catalog/assets/{asset_id}")
async def get_asset(asset_id: str):
    asset = catalog_manager.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return JSONResponse(content={"status": "success", "data": asset})


@app.get("/api/catalog/search")
async def search_catalog(q: str = Query(..., description="Query de búsqueda"), cloud: Optional[str] = Query(None)):
    results = catalog_manager.search_semantic(query=q, cloud=cloud)
    return JSONResponse(content={"status": "success", "query": q, "total": len(results), "data": results})


@app.post("/api/catalog/assets/{asset_id}/update")
async def update_asset_metadata(asset_id: str, req: MetadataUpdateRequest):
    updated = catalog_manager.update_metadata(
        asset_id=asset_id,
        description=req.description,
        steward=req.steward,
        golden_query=req.golden_query,
        column_updates=req.column_updates
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Error al actualizar metadatos")
    return JSONResponse(content={"status": "success", "message": "Metadatos actualizados", "data": updated})


@app.get("/api/catalog/glossary")
async def get_glossary():
    glossary = catalog_manager.get_glossary()
    return JSONResponse(content={"status": "success", "total": len(glossary), "data": glossary})


@app.post("/api/catalog/glossary")
async def add_glossary_term(req: GlossaryTermRequest):
    new_term = catalog_manager.add_glossary_term(
        term=req.term,
        definition=req.definition,
        domain=req.domain,
        approved_by=req.approved_by
    )
    return JSONResponse(content={"status": "success", "data": new_term})


# --- MÓDULO 1.1: Gobernanza y Gestión de Metadatos (Tagging & Tag Templates) ---
@app.get("/api/tags/templates")
async def get_tag_templates():
    templates = catalog_manager.get_tag_templates()
    return JSONResponse(content={"status": "success", "total": len(templates), "data": templates})


@app.get("/api/tags/asset/{asset_id}")
async def get_asset_tags(asset_id: str):
    tags_info = catalog_manager.get_asset_tags(asset_id)
    if not tags_info:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return JSONResponse(content={"status": "success", "data": tags_info})


@app.post("/api/tags/asset/{asset_id}")
async def update_asset_tags(asset_id: str, req: TagUpdateRequest):
    updated = catalog_manager.update_asset_tags(
        asset_id=asset_id,
        template_id=req.template_id,
        fields=req.fields,
        column_tags=req.column_tags
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Error al actualizar etiquetas")
    return JSONResponse(content={"status": "success", "message": "Etiquetas de gobierno actualizadas", "data": updated})


@app.post("/api/tags/auto_tag_sdp/{asset_id}")
async def auto_tag_with_sdp(asset_id: str):
    tagged = catalog_manager.auto_tag_with_sdp(asset_id)
    if not tagged:
        raise HTTPException(status_code=404, detail="Error al ejecutar Auto-Tagging con SDP")
    return JSONResponse(content={"status": "success", "message": "Auto-Tagging ejecutado con éxito", "data": tagged})


# --- MÓDULO 2: SENSITIVE DATA PROTECTION (CLOUD DLP / SDP INTEGRAL) ---

# 2.0 Dashboard Ejecutivo (Looker Studio SDP Template)
@app.get("/api/sdp/dashboard/overview")
async def get_sdp_dashboard_overview(
    project: Optional[str] = Query("-"),
    asset_type: Optional[str] = Query("-"),
    data_risk: Optional[str] = Query("-"),
    encryption: Optional[str] = Query("-"),
    data_asset: Optional[str] = Query("-"),
    infotype: Optional[str] = Query("-"),
    data_sensitivity: Optional[str] = Query("-"),
    is_public: Optional[str] = Query("-"),
    data_location: Optional[str] = Query("-"),
    date_range: Optional[str] = Query("-"),
    date_from: Optional[str] = Query(""),
    date_to: Optional[str] = Query("")
):
    filters = {
        "project": project,
        "asset_type": asset_type,
        "data_risk": data_risk,
        "encryption": encryption,
        "data_asset": data_asset,
        "infotype": infotype,
        "data_sensitivity": data_sensitivity,
        "is_public": is_public,
        "data_location": data_location,
        "date_range": date_range,
        "date_from": date_from,
        "date_to": date_to
    }
    data = sdp_manager.get_dashboard_overview(filters=filters)
    return JSONResponse(content=data)


@app.post("/api/sdp/dashboard/remediate/{issue_id}")
async def remediate_sdp_dashboard_issue(issue_id: str):
    res = sdp_manager.remediate_dashboard_issue(issue_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return JSONResponse(content=res)


# 2.1 Discovery (Descubrimiento Continuo & Data Profiles)
@app.get("/api/sdp/discovery/profiles")
async def get_sdp_discovery_profiles(cloud: Optional[str] = Query(None), risk_level: Optional[str] = Query(None)):
    profiles = sdp_manager.get_discovery_profiles(cloud=cloud, risk_level=risk_level)
    return JSONResponse(content={"status": "success", "total": len(profiles), "data": profiles})


@app.get("/api/sdp/discovery/summary")
async def get_sdp_discovery_summary():
    summary = sdp_manager.get_discovery_summary()
    return JSONResponse(content={"status": "success", "data": summary})


@app.post("/api/sdp/discovery/scan")
async def run_sdp_discovery_scan(req: Optional[DiscoveryScanRequest] = None):
    asset_id = req.asset_id if req else None
    source_type = req.source_type if req else None
    cloud = req.cloud if req else None
    result = sdp_manager.run_discovery_profile_scan(asset_id=asset_id, source_type=source_type, cloud=cloud)
    return JSONResponse(content=result)


# 2.2 Inspection & InfoTypes (Built-in & Custom InfoTypes)
@app.get("/api/sdp/infotypes/builtin")
async def get_builtin_infotypes(category: Optional[str] = Query(None), q: Optional[str] = Query(None)):
    items = sdp_manager.get_builtin_infotypes(category=category, query=q)
    return JSONResponse(content={"status": "success", "total": len(items), "data": items})


@app.get("/api/sdp/infotypes/custom")
async def get_custom_infotypes():
    custom_list = sdp_manager.get_custom_infotypes()
    return JSONResponse(content={"status": "success", "total": len(custom_list), "data": custom_list})


@app.post("/api/sdp/infotypes/custom/create")
async def create_custom_infotype(req: CustomInfoTypeCreateRequest):
    try:
        created = sdp_manager.create_custom_infotype(
            name=req.name,
            display_name=req.display_name,
            infotype_type=req.type,
            regex_pattern=req.regex_pattern,
            dictionary_words=req.dictionary_words,
            likelihood=req.likelihood,
            hotwords=req.hotwords,
            description=req.description or "",
            created_by=req.created_by or "Data Steward"
        )
        return JSONResponse(content={"status": "success", "message": f"InfoType '{created['name']}' creado exitosamente", "data": created})
    except Exception as e:
        logger.error(f"Error creando custom infotype: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sdp/infotypes/custom/test")
async def test_custom_infotype(req: CustomInfoTypeTestRequest):
    test_result = sdp_manager.test_custom_infotype(
        infotype_type=req.type,
        regex_pattern=req.regex_pattern,
        dictionary_words=req.dictionary_words,
        sample_text=req.sample_text,
        hotwords=req.hotwords
    )
    return JSONResponse(content=test_result)


class CustomInfoTypeUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    category: Optional[str] = None
    sensitivity_level: Optional[str] = None
    protection_action: Optional[str] = None
    regex_pattern: Optional[str] = None
    dictionary_words: Optional[List[str]] = None
    likelihood: Optional[str] = None
    hotwords: Optional[List[str]] = None
    description: Optional[str] = None


@app.put("/api/sdp/infotypes/custom/{infotype_id}")
async def update_custom_infotype(infotype_id: str, req: CustomInfoTypeUpdateRequest):
    try:
        updated = sdp_manager.update_custom_infotype(
            infotype_id=infotype_id,
            display_name=req.display_name,
            category=req.category,
            sensitivity_level=req.sensitivity_level,
            protection_action=req.protection_action,
            regex_pattern=req.regex_pattern,
            dictionary_words=req.dictionary_words,
            likelihood=req.likelihood,
            hotwords=req.hotwords,
            description=req.description
        )
        return JSONResponse(content={"status": "success", "message": f"InfoType '{updated['display_name']}' actualizado correctamente", "data": updated})
    except Exception as e:
        logger.error(f"Error actualizando custom infotype: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/sdp/infotypes/custom/{infotype_id}")
async def delete_custom_infotype(infotype_id: str):
    deleted = sdp_manager.delete_custom_infotype(infotype_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="InfoType no encontrado")
    return JSONResponse(content={"status": "success", "message": "InfoType personalizado eliminado correctamente"})


# 2.3 Inspect Jobs (Trabajos de Inspección On-Demand)
@app.get("/api/sdp/inspect/jobs")
async def list_inspect_jobs():
    jobs = sdp_manager.list_inspect_jobs()
    return JSONResponse(content={"status": "success", "total": len(jobs), "data": jobs})


@app.post("/api/sdp/inspect/jobs/create_and_run")
async def create_and_run_inspect_job(req: InspectJobCreateRequest):
    try:
        job = sdp_manager.create_and_run_inspect_job(
            name=req.name,
            target_asset_id=req.target_asset_id,
            infotypes_selected=req.infotypes_selected,
            min_likelihood=req.min_likelihood,
            sampling_pct=req.sampling_pct,
            auto_apply_tags=req.auto_apply_tags,
            created_by=req.created_by or "Data Steward"
        )
        return JSONResponse(content={"status": "success", "message": f"Trabajo de inspección '{job['name']}' completado", "data": job})
    except Exception as e:
        logger.error(f"Error en inspect job: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# 2.4 Job Triggers (Disparadores Programados)
@app.get("/api/sdp/inspect/triggers")
async def list_job_triggers():
    triggers = sdp_manager.list_job_triggers()
    return JSONResponse(content={"status": "success", "total": len(triggers), "data": triggers})


@app.post("/api/sdp/inspect/triggers/create")
async def create_job_trigger(req: JobTriggerCreateRequest):
    try:
        trigger = sdp_manager.create_job_trigger(
            name=req.name,
            description=req.description,
            schedule=req.schedule,
            target_asset_id=req.target_asset_id,
            template_id=req.template_id,
            created_by=req.created_by or "Data Steward"
        )
        return JSONResponse(content={"status": "success", "message": f"Disparador '{trigger['name']}' configurado exitosamente", "data": trigger})
    except Exception as e:
        logger.error(f"Error creando trigger: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/sdp/inspect/triggers/{trigger_id}/toggle")
async def toggle_job_trigger(trigger_id: str):
    try:
        res = sdp_manager.toggle_job_trigger(trigger_id)
        return JSONResponse(content=res)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/sdp/inspect/triggers/{trigger_id}/run_now")
async def run_job_trigger_now(trigger_id: str):
    try:
        res = sdp_manager.run_job_trigger_now(trigger_id)
        return JSONResponse(content=res)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/sdp/inspect/triggers/{trigger_id}")
async def delete_job_trigger(trigger_id: str):
    deleted = sdp_manager.delete_job_trigger(trigger_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Disparador no encontrado")
    return JSONResponse(content={"status": "success", "message": "Disparador de inspección eliminado"})


# 2.5 Risk Analysis (k-anonymity, l-diversity, delta-presence) - EXCLUSIVO PARA BIGQUERY
@app.post("/api/sdp/risk_analysis/evaluate/{asset_id}")
async def evaluate_risk_analysis(asset_id: str, req: Optional[RiskAnalysisRequest] = None):
    try:
        q_ids = req.quasi_identifiers if req else None
        s_attrs = req.sensitive_attributes if req else None
        report = sdp_manager.evaluate_bigquery_risk_analysis(
            asset_id=asset_id,
            quasi_identifiers=q_ids,
            sensitive_attributes=s_attrs
        )
        return JSONResponse(content={"status": "success", "data": report})
    except ValueError as ve:
        # Error específico si el asset no es BigQuery o no existe
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error en Risk Analysis: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sdp/risk_analysis/asset/{asset_id}")
async def get_risk_analysis_for_asset(asset_id: str):
    try:
        report = sdp_manager.evaluate_bigquery_risk_analysis(asset_id=asset_id)
        return JSONResponse(content={"status": "success", "data": report})
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# 2.6 Plantillas (Templates: Inspect & Deidentify)
@app.get("/api/sdp/templates/inspect")
async def list_inspect_templates():
    templates = sdp_manager.list_inspect_templates()
    return JSONResponse(content={"status": "success", "total": len(templates), "data": templates})


@app.post("/api/sdp/templates/inspect/create")
async def create_inspect_template(req: InspectTemplateCreateRequest):
    new_tmpl = sdp_manager.create_inspect_template(
        name=req.name,
        description=req.description,
        infotypes=req.infotypes,
        min_likelihood=req.min_likelihood,
        max_findings=req.max_findings,
        created_by=req.created_by or "Data Steward"
    )
    return JSONResponse(content={"status": "success", "message": "Plantilla de inspección creada", "data": new_tmpl})


@app.get("/api/sdp/templates/deidentify")
async def list_deidentify_templates():
    templates = sdp_manager.list_deidentify_templates()
    return JSONResponse(content={"status": "success", "total": len(templates), "data": templates})


@app.post("/api/sdp/templates/deidentify/create")
async def create_deidentify_template(req: DeidentifyTemplateCreateRequest):
    new_tmpl = sdp_manager.create_deidentify_template(
        name=req.name,
        transformation_type=req.transformation_type,
        description=req.description,
        parameters=req.parameters,
        sample_input=req.sample_input,
        sample_output=req.sample_output,
        created_by=req.created_by or "Data Steward"
    )
    return JSONResponse(content={"status": "success", "message": "Plantilla de desidentificación creada", "data": new_tmpl})


# 2.7 Content Policies de Gobernanza Continua
@app.get("/api/sdp/policies")
async def list_sdp_content_policies():
    policies = sdp_manager.list_content_policies()
    return JSONResponse(content={"status": "success", "total": len(policies), "data": policies})


@app.post("/api/sdp/policies/{policy_id}/toggle")
async def toggle_sdp_content_policy(policy_id: str):
    try:
        res = sdp_manager.toggle_content_policy(policy_id)
        return JSONResponse(content=res)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/sdp/policies/evaluate")
async def evaluate_sdp_content_policies():
    res = sdp_manager.evaluate_content_policies()
    return JSONResponse(content=res)


# 2.8 Resumen y Acciones por Perfil Responsable
@app.get("/api/sdp/overview/{profile_id}")
async def get_sdp_persona_overview(profile_id: str):
    overview = sdp_manager.get_persona_overview(profile_id)
    return JSONResponse(content={"status": "success", "data": overview})


# Endpoints heredados / retrocompatibles
@app.api_route("/api/dlp/scan/{asset_id}", methods=["GET", "POST"])
async def run_dlp_scan(asset_id: str):
    scan_result = dlp_scanner.inspect_asset(asset_id)
    if not scan_result:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return JSONResponse(content={"status": "success", "data": scan_result})


@app.post("/api/dlp/apply_policy_tags/{asset_id}")
async def apply_policy_tags(asset_id: str, req: PolicyTagRequest):
    res = policy_tagger.apply_tags_and_masking(asset_id, auto_mask=req.auto_mask)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return JSONResponse(content={"status": "success", "data": res})


# --- MÓDULO 3: Dataplex Data Quality ---
@app.api_route("/api/quality/scan/{asset_id}", methods=["GET", "POST"])
async def run_quality_scan(asset_id: str):
    quality_result = quality_engine.evaluate_asset(asset_id)
    if not quality_result:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return JSONResponse(content={"status": "success", "data": quality_result})


@app.get("/api/quality/health")
async def get_global_health():
    health = quality_engine.get_global_health()
    return JSONResponse(content={"status": "success", "data": health})


@app.get("/api/quality/dimensions")
async def get_quality_dimensions():
    dims = quality_engine.get_quality_dimensions_framework()
    return JSONResponse(content={"status": "success", "total": len(dims), "data": dims})


@app.post("/api/quality/dimensions/add")
async def add_quality_dimension(req: QualityDimensionAddRequest):
    res = quality_engine.add_quality_dimension(
        nombre=req.nombre,
        definicion=req.definicion,
        ejemplo_regla_mdm=req.ejemplo_regla_mdm,
        added_by=req.added_by or "Data Steward"
    )
    return JSONResponse(content=res)



@app.get("/api/quality/real_dataplex_scans")
async def get_real_dataplex_scans():
    scans = quality_engine.fetch_real_dataplex_scans()
    return JSONResponse(content={"status": "success", "total": len(scans), "data": scans})



# --- MÓDULO 4: Linaje de Datos & Impacto ---
@app.get("/api/lineage/{asset_id}")
async def get_lineage_graph(asset_id: str):
    graph = lineage_graph_builder.build_graph(asset_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    return JSONResponse(content={"status": "success", "data": graph})


@app.post("/api/lineage/impact_analysis/{asset_id}")
async def analyze_impact(asset_id: str, req: ImpactAnalysisRequest):
    impact = lineage_graph_builder.analyze_schema_impact(asset_id, req.modified_columns)
    return JSONResponse(content={"status": "success", "data": impact})


# --- MÓDULO 6: Data Stewards & Certificación IA ---
@app.get("/api/stewards/domains")
async def get_domains():
    domains = stewards_manager.get_domains_summary()
    return JSONResponse(content={"status": "success", "data": domains})


@app.get("/api/stewards/ai_readiness")
async def get_ai_readiness():
    readiness = stewards_manager.get_ai_readiness_list()
    return JSONResponse(content={"status": "success", "data": readiness})


@app.post("/api/stewards/certify_ai/{asset_id}")
async def certify_ai_dataset(asset_id: str, req: AICertificationRequest):
    res = stewards_manager.certify_dataset(asset_id, req.certified, req.notes or "")
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return JSONResponse(content={"status": "success", "data": res})


# --- MÓDULO 7: Policy as Code & Knowledge Catalog MCP Server ---
@app.get("/api/policies")
async def list_policies():
    policies = policy_engine.get_all_policies()
    return JSONResponse(content={"status": "success", "total": len(policies), "data": policies})


@app.post("/api/policies/generate")
async def generate_policy(req: PolicyGenerateRequest):
    new_policy = policy_engine.generate_policy_from_natural_language(req.prompt)
    return JSONResponse(content={"status": "success", "data": new_policy, "message": "Política generada como código exitosamente"})


@app.post("/api/policies/execute")
async def execute_policies():
    exec_result = policy_engine.execute_all_policies()
    return JSONResponse(content={"status": "success", "data": exec_result})


@app.get("/api/policies/violations")
async def get_policy_violations():
    policy_engine._load_policies()
    violations = policy_engine.data.get("violations", [])
    return JSONResponse(content={"status": "success", "total": len(violations), "data": violations})


@app.post("/api/policies/remediate/{violation_id}")
async def remediate_policy_violation(violation_id: str):
    res = policy_engine.remediate_violation(violation_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return JSONResponse(content={"status": "success", "data": res})


@app.get("/api/policies/scorecard")
async def get_compliance_scorecard():
    scorecard = policy_engine.get_compliance_scorecard()
    return JSONResponse(content={"status": "success", "data": scorecard})


@app.get("/api/policies/export_csv")
async def export_violations_csv():
    csv_content = policy_engine.export_violations_report_csv()
    return HTMLResponse(content=csv_content, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=compliance_violations_report.csv"})


# --- CONFIGURACIÓN DE DESPLIEGUE GCP (Project ID, Region, Templates) ---
class GCPConfigRequest(BaseModel):
    project_id: str
    location: Optional[str] = "us-central1"
    credentials_type: Optional[str] = "APPLICATION_DEFAULT_CREDENTIALS"
    dataplex_lake: Optional[str] = "enterprise-data-lake"
    dlp_inspection_template: Optional[str] = None


@app.get("/api/config/gcp")
async def get_gcp_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "connectors_config.yaml")
    cfg = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
        except Exception as e:
            logger.error(f"Error cargando connectors_config.yaml: {e}")
    
    dotenv.load_dotenv(override=True)
    gcp_cfg = cfg.get("gcp", {})
    active_proj = os.getenv("GCP_HOST_PROJECT_ID") or os.getenv("GCP_PROJECT_ID") or gcp_cfg.get("project_id") or "cmiagentes"
    active_loc = os.getenv("GCP_LOCATION") or gcp_cfg.get("location") or "us-central1"
    return JSONResponse(content={
        "status": "success",
        "data": {
            "project_id": active_proj,
            "location": active_loc,
            "credentials_type": gcp_cfg.get("credentials_type", "APPLICATION_DEFAULT_CREDENTIALS"),
            "dataplex_lake": gcp_cfg.get("dataplex_lake", "enterprise-data-lake"),
            "dlp_inspection_template": gcp_cfg.get("dlp_inspection_template", f"projects/{active_proj}/locations/global/inspectTemplates/default-pii-template"),
            "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "")
        }
    })


@app.post("/api/config/gcp")
async def save_gcp_config(req: GCPConfigRequest):
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "connectors_config.yaml")
    cfg = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
        except Exception:
            cfg = {}

    gcp_cfg = cfg.setdefault("gcp", {})
    gcp_cfg["project_id"] = req.project_id.strip()
    if req.location:
        gcp_cfg["location"] = req.location.strip()
    if req.credentials_type:
        gcp_cfg["credentials_type"] = req.credentials_type.strip()
    if req.dataplex_lake:
        gcp_cfg["dataplex_lake"] = req.dataplex_lake.strip()
    if req.dlp_inspection_template:
        gcp_cfg["dlp_inspection_template"] = req.dlp_inspection_template.strip()

    try:
        with open(config_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(cfg, f, default_flow_style=False)
        
        # Update in-memory connector project_id
        if hasattr(gcp_connector, "project_id"):
            gcp_connector.project_id = req.project_id.strip()

        return JSONResponse(content={
            "status": "success",
            "message": f"¡Proyecto GCP actualizado exitosamente a '{req.project_id.strip()}'!",
            "data": gcp_cfg
        })
    except Exception as e:
        logger.error(f"Error guardando configuración GCP: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class GCPDeployRequest(BaseModel):
    project_id: str
    region: Optional[str] = "us-central1"
    deploy_target: Optional[str] = "cloud_function"


@app.post("/api/deploy/gcp")
async def trigger_gcp_deployment(req: GCPDeployRequest):
    """
    Ejecuta automáticamente el script de despliegue en Google Cloud (Cloud Run Functions o Cloud Run)
    para el proyecto de GCP configurado dinámicamente por el usuario.
    """
    target_project = req.project_id.strip()
    region = req.region.strip() if req.region else "us-central1"
    deploy_type = req.deploy_target.strip() if req.deploy_target else "cloud_function"

    if not target_project:
        raise HTTPException(status_code=400, detail="ID de proyecto GCP objetivo es requerido.")

    # 1. Actualizar .env con el nuevo proyecto objetivo de despliegue
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        lines = []
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("GCP_HOST_PROJECT_ID="):
                    lines.append(f'GCP_HOST_PROJECT_ID="{target_project}"\n')
                elif line.startswith("GCP_LOCATION="):
                    lines.append(f'GCP_LOCATION="{region}"\n')
                else:
                    lines.append(line)
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        dotenv.load_dotenv(override=True)

    # 2. Seleccionar ejecutable de despliegue
    script = "deploy_cloud_function.sh" if deploy_type == "cloud_function" else "deploy_cloud_run.sh"
    script_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", script))
    
    if not os.path.exists(script_path):
        raise HTTPException(status_code=404, detail=f"Script de despliegue '{script}' no encontrado.")

    try:
        cmd = [script_path, "gobierno-datos-function" if deploy_type == "cloud_function" else "gobierno-datos-app", target_project, region]
        logger.info(f"🚀 Iniciando proceso de despliegue en GCP: {' '.join(cmd)}")
        
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=os.path.dirname(script_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode("utf-8", errors="ignore")
        err_str = stderr.decode("utf-8", errors="ignore")

        if proc.returncode == 0:
            url = f"https://us-central1-{target_project}.cloudfunctions.net/gobierno-datos-function" if deploy_type == "cloud_function" else f"https://gobierno-datos-app-623690130665.{region}.run.app"
            return JSONResponse(content={
                "status": "success",
                "message": f"¡Despliegue exitoso en Google Cloud ({deploy_type}) para el proyecto '{target_project}'!",
                "deployment_url": url,
                "logs": out_str[-1000:]
            })
        else:
            logger.error(f"Error en despliegue: {err_str}")
            return JSONResponse(status_code=500, content={
                "status": "error",
                "message": f"Fallo en despliegue de GCP: {err_str[-500:] or out_str[-500:]}",
                "logs": out_str[-1000:]
            })
    except Exception as e:
        logger.error(f"Excepción ejecutando despliegue GCP: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- CONECTORES MULTI-CLOUD ---
@app.get("/api/connectors/status")
async def get_connectors():
    status = connector_factory.get_all_connectors_status()
    return JSONResponse(content={"status": "success", "data": status})


@app.get("/api/connectors/gcp_real_projects")
async def get_real_gcp_projects():
    """Obtiene la lista real de proyectos GCP con permisos a nivel de la organización."""
    import subprocess
    import json
    
    dotenv.load_dotenv(override=True)
    host_p = os.getenv("GCP_HOST_PROJECT_ID") or gcp_connector.project_id or "gobiernodatos"
    governed_env_str = os.getenv("GCP_GOVERNED_PROJECTS", "")
    default_governed_set = {p.strip() for p in governed_env_str.split(",") if p.strip()} if governed_env_str else {host_p, "agente-newyork"}
    default_governed_set.add(host_p)

    try:
        out = subprocess.check_output(["gcloud", "projects", "list", "--format=json"], text=True)
        projects = json.loads(out)
        real_projects = []
        
        # Ensure host_p is included
        found_host = False
        for p in projects:
            if p.get("lifecycleState") == "ACTIVE":
                proj_id = p.get("projectId")
                proj_name = p.get("name") or proj_id
                parent_type = p.get("parent", {}).get("type", "organization") if isinstance(p.get("parent"), dict) else "organization"
                if proj_id == host_p:
                    found_host = True
                
                is_default_checked = proj_id in default_governed_set
                
                entry = {
                    "id": proj_id,
                    "name": proj_name,
                    "desc": f"Proyecto GCP ({parent_type.capitalize()})",
                    "checked": is_default_checked
                }
                if proj_id == host_p:
                    real_projects.insert(0, entry)
                else:
                    real_projects.append(entry)

        if not found_host:
            real_projects.insert(0, {
                "id": host_p,
                "name": host_p,
                "desc": "Proyecto GCP Host Principal (.env)",
                "checked": True
            })

        return JSONResponse(content={"status": "success", "total": len(real_projects), "data": real_projects})
    except Exception as e:
        logger.error(f"Error listando proyectos reales GCP: {e}")
        fallback = [
            {"id": host_p, "name": host_p, "desc": "Proyecto GCP Host Principal (.env)", "checked": True},
            {"id": "cmiagentes", "name": "cmiagentes", "desc": "Proyecto GCP Analytics", "checked": True},
            {"id": "agente-newyork", "name": "agente-newyork", "desc": "Proyecto GCP Analytics", "checked": True},
            {"id": "project-data-anita", "name": "project-data-anita", "desc": "Proyecto GCP Data Lake", "checked": True}
        ]
        return JSONResponse(content={"status": "success", "total": len(fallback), "data": fallback})



class GCPSyncRequest(BaseModel):
    project_id: Optional[str] = None
    project_ids: Optional[List[str]] = None


@app.post("/api/connectors/sync_real_gcp")
async def sync_real_gcp(req: Optional[GCPSyncRequest] = None, project_id: Optional[str] = Query(None)):
    import datetime
    
    # Determine target project IDs to scan
    target_projects = []
    if req and req.project_ids:
        target_projects = [p.strip() for p in req.project_ids if p.strip()]
    elif req and req.project_id:
        target_projects = [req.project_id.strip()]
    elif project_id:
        target_projects = [p.strip() for p in project_id.split(",") if p.strip()]
    
    if not target_projects:
        target_projects = [gcp_connector.project_id or "agente-newyork"]

    total_tables_synced = 0
    total_datasets_synced = 0
    synced_projects_summary = []
    now_iso = datetime.datetime.utcnow().isoformat() + "Z"

    existing_assets = catalog_manager.data.get("assets", [])
    # Remove mock/placeholder assets for all target projects to ensure NO INVENTED DATA
    cleaned_assets = [a for a in existing_assets if a.get("project_or_db") not in target_projects and a.get("project_id") not in target_projects]

    for proj in target_projects:
        try:
            gcp_connector.project_id = proj
            real_tables = gcp_connector.fetch_real_bigquery_tables()
            datasets_list = sorted(list({t["dataset"] for t in real_tables if "dataset" in t}))

            for rt in real_tables:
                rt["governed"] = True
                rt["governance_status"] = "GOBERNADO_ACTIVO"
                rt["governance_decided_by"] = "Javier Mendoza (Lead Data Architect)"
                rt["governance_timestamp"] = now_iso
                cleaned_assets.append(rt)

            total_tables_synced += len(real_tables)
            total_datasets_synced += len(datasets_list)
            
            catalog_manager.data.setdefault("scanned_projects", {})[proj] = {
                "last_scan": now_iso,
                "datasets_count": len(datasets_list),
                "tables_count": len(real_tables),
                "datasets_list": datasets_list
            }
            
            datasets_summary = ", ".join(datasets_list) if datasets_list else "Sin datasets"
            synced_projects_summary.append(f"'{proj}' ({len(datasets_list)} Datasets: {datasets_summary}, {len(real_tables)} Tablas)")
        except Exception as err:
            logger.error(f"Error escaneando proyecto {proj}: {err}")

    catalog_manager.data["assets"] = cleaned_assets
    catalog_manager._save_data()

    summary_str = " | ".join(synced_projects_summary)
    return JSONResponse(content={
        "status": "success",
        "synced_projects": target_projects,
        "synced_tables_count": total_tables_synced,
        "datasets_count": total_datasets_synced,
        "governed_by": "Javier Mendoza (Lead Data Architect)",
        "message": f"¡Gobierno GCP Multi-Proyecto Replicado Exitosamente! Se escanearon {len(target_projects)} Proyecto(s) [{summary_str}]. Los datos están sincronizados para todos los perfiles (CDO, Gestor, Steward y Arquitecto)."
    })


# --- CONECTORES EXTERNOS & DESCUBRIMIENTO AUTOMATIZADO (MySQL, Azure, Postgres) ---
@app.post("/api/connectors/external/test")
async def test_external_db_connection(req: ExternalDBTestRequest):
    engine = (req.engine or "mysql").lower()
    if "postgres" in engine:
        res = external_db_connector.test_postgres_connection(
            host=req.host,
            port=req.port or 5432,
            database=req.database,
            user=req.user,
            password=req.password,
            schema=req.schema or "public, sistemas"
        )
    else:
        res = external_db_connector.test_mysql_connection(
            host=req.host,
            port=req.port or 10283,
            database=req.database,
            user=req.user,
            password=req.password,
            ssl_enabled=req.ssl_enabled
        )
    return JSONResponse(content={"status": "success", "data": res})


@app.post("/api/connectors/external/discover")
async def discover_external_db(req: ExternalDBDiscoverRequest):
    try:
        res = external_db_connector.discover_and_catalog_database(
            engine_type=req.engine,
            host=req.host,
            port=req.port,
            database=req.database,
            user=req.user,
            password=req.password,
            schema_filter=req.schema or "public, sistemas",
            selected_tables=req.selected_tables,
            csv_tables_content=req.csv_content
        )
        return JSONResponse(content={"status": "success", "data": res})
    except Exception as e:
        logger.error(f"Error en descubrimiento de BD externa: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# --- REGLAS DE CALIDAD DE NEGOCIO AVANZADAS & DRILL-DOWN ---
@app.get("/api/quality/business_rules")
async def list_business_quality_rules():
    rules = business_quality_engine.get_all_rules()
    last_eval = business_quality_engine.data.get("last_evaluation")
    return JSONResponse(content={"status": "success", "total": len(rules), "data": rules, "last_evaluation": last_eval})


@app.post("/api/quality/business_rules/evaluate")
async def evaluate_business_quality_rules():
    evaluation = business_quality_engine.evaluate_business_quality_rules()
    return JSONResponse(content={"status": "success", "data": evaluation})


@app.post("/api/quality/business_rules/update_threshold")
async def update_business_rule_threshold(req: ThresholdUpdateRequest):
    res = business_quality_engine.update_rule_threshold(req.rule_id, req.new_threshold)
    return JSONResponse(content=res)


# --- GOBERNANZA SEMÁNTICA LOOKER & MÉTRICAS DE NEGOCIO ---
@app.get("/api/looker/semantic_metrics")
async def list_looker_semantic_metrics():
    metrics = looker_governance_manager.list_governed_metrics()
    return JSONResponse(content={"status": "success", "total": len(metrics), "data": metrics})


@app.get("/api/looker/generate_lookml/{asset_id}")
async def generate_lookml_for_asset(asset_id: str):
    asset = catalog_manager.get_asset_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset no encontrado")
    code = looker_governance_manager.generate_lookml_view(asset)
    return JSONResponse(content={
        "status": "success",
        "asset_id": asset_id,
        "table_name": asset.get("table_name"),
        "lookml_code": code
    })


# --- EJECUCIÓN & DRY RUN DE CONSULTAS SQL EN BIGQUERY GCP ---
@app.post("/api/sql/dry_run")
async def sql_dry_run(req: SQLDryRunRequest):
    try:
        from backend.gcp_utils import get_active_project_id, get_bigquery_client
        from google.cloud import bigquery
        proj = req.project_id or get_active_project_id()
        bq = get_bigquery_client(proj)
        
        job_cfg = bigquery.QueryJobConfig(dry_run=True, use_query_cache=True)
        dry_job = bq.query(req.sql, job_config=job_cfg)
        
        bytes_proc = dry_job.total_bytes_processed or 0
        mb_proc = round(bytes_proc / (1024 * 1024), 2)
        gb_proc = round(bytes_proc / (1024 * 1024 * 1024), 4)
        est_cost_usd = round((bytes_proc / (1024**4)) * 5.0, 6)
        
        schema_fields = [{"name": f.name, "type": f.field_type, "mode": f.mode} for f in dry_job.schema] if dry_job.schema else []
        
        return JSONResponse(content={
            "status": "success",
            "sql": req.sql,
            "project_id": proj,
            "bytes_processed": bytes_proc,
            "mb_processed": mb_proc,
            "gb_processed": gb_proc,
            "estimated_cost_usd": est_cost_usd,
            "schema_fields": schema_fields,
            "message": f"Dry Run Exitoso en BigQuery GCP: Escaneará {mb_proc} MB (${est_cost_usd} USD)."
        })
    except Exception as e:
        logger.error(f"Error en SQL Dry Run: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/config")
async def get_governance_config():
    cfg = stewards_manager.load_config()
    return JSONResponse(content={"status": "success", "data": cfg})


# --- MÓDULO 9: FACTURACIÓN, PRESUPUESTOS Y CONTROL DE CUOTAS GCP (FINOPS) ---
@app.get("/api/billing/overview")
async def get_billing_overview():
    """Retorna el resumen de facturación, presupuesto y proyección mensual."""
    overview = billing_manager.get_billing_overview()
    return JSONResponse(content={"status": "success", "data": overview})


@app.get("/api/billing/breakdown/services")
async def get_billing_services_breakdown():
    """Retorna el desglose de facturación por servicio de GCP."""
    services = billing_manager.get_services_breakdown()
    return JSONResponse(content={"status": "success", "total": len(services), "data": services})


@app.get("/api/billing/breakdown/projects")
async def get_billing_projects_breakdown():
    """Retorna el desglose de costos por proyecto gestionado."""
    projects = billing_manager.get_projects_breakdown()
    return JSONResponse(content={"status": "success", "total": len(projects), "data": projects})


@app.get("/api/billing/analytics")
async def get_billing_analytics(
    group_by: str = "project",
    project_id: Optional[str] = None,
    service: Optional[str] = None,
    month: Optional[str] = None,
    search: Optional[str] = None
):
    """Consulta analítica sobre la tabla real de BigQuery con filtros y agrupación."""
    res = billing_manager.query_billing_analytics(
        group_by=group_by,
        project_id=project_id,
        service=service,
        month=month,
        search=search
    )
    return JSONResponse(content=res)


@app.get("/api/billing/filter_options")
async def get_billing_filter_options():
    """Retorna las listas de proyectos, servicios y meses disponibles para filtrado."""
    options = billing_manager.get_filter_options()
    return JSONResponse(content=options)


@app.get("/api/billing/timeline")
async def get_billing_timeline(month: Optional[str] = "202608"):
    """Retorna la serie temporal diaria (1-31 agosto) de consumos por servicio para la gráfica."""
    timeline = billing_manager.get_timeline(month=month or "202608")
    return JSONResponse(content={"status": "success", "data": timeline})


@app.post("/api/billing/seed_real_data")
async def seed_real_billing_data():
    """Genera y sincroniza los datos reales de facturación de Agosto 2026 en BigQuery."""
    res = billing_manager.seed_real_data(force=True)
    return JSONResponse(content=res)


@app.post("/api/billing/sync_firestore")
async def sync_billing_to_firestore():
    """Sincroniza la facturación agrupada de BigQuery en la base de datos Firestore Native."""
    res = billing_manager.sync_real_billing_to_firestore()
    return JSONResponse(content=res)


@app.post("/api/billing/query")
async def run_billing_query(req: BillingQueryRequest):
    """Ejecuta una consulta SQL estándar sobre la tabla de facturación en BigQuery o realiza dry run."""
    res = billing_manager.execute_custom_billing_query(
        sql=req.sql,
        dry_run=req.dry_run,
        max_rows=req.max_rows or 200
    )
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return JSONResponse(content=res)


@app.get("/api/billing/templates")
async def get_billing_templates():
    """Retorna las plantillas oficiales de consultas de facturación Google Cloud."""
    templates = billing_manager.get_billing_query_templates()
    return JSONResponse(content={"status": "success", "total": len(templates), "data": templates})


@app.get("/api/billing/quotas")
async def get_billing_quotas(service: Optional[str] = None):
    """Retorna el estado de cuotas y límites de consumo en tiempo real."""
    quotas = billing_manager.get_quotas_status(service)
    return JSONResponse(content={"status": "success", "total": len(quotas), "data": quotas})


@app.post("/api/billing/quotas/request_increase")
async def request_quota_increase(req: QuotaIncreaseRequest):
    """Registra y aprueba una solicitud de incremento de cuota persistida en Firestore."""
    res = billing_manager.request_quota_increase(
        quota_id=req.quota_id,
        requested_limit=req.requested_limit,
        justification=req.justification,
        contact_email=req.contact_email
    )
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return JSONResponse(content=res)


@app.get("/api/billing/recommendations")
async def get_finops_recommendations():
    """Retorna recomendaciones de optimización FinOps para reducir costos."""
    recs = billing_manager.get_finops_recommendations()
    return JSONResponse(content={"status": "success", "total": len(recs), "data": recs})


@app.post("/api/billing/recommendations/apply")
async def apply_finops_recommendation(req: RecommendationApplyRequest):
    """Aplica una recomendación de ahorro FinOps y recalcula el forecast."""
    res = billing_manager.apply_recommendation(req.recommendation_id)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return JSONResponse(content=res)


@app.post("/api/billing/budget/update")
async def update_billing_budget(req: BudgetUpdateRequest):
    """Actualiza el presupuesto mensual objetivo y umbrales de alerta FinOps."""
    res = billing_manager.update_budget(req.monthly_budget, req.alert_thresholds)
    return JSONResponse(content=res)


# --- MÓDULO AGENTE NATIVO BIGQUERY STUDIO (FINOPS & BILLING) ---
@app.get("/api/billing/agent/info")
async def get_bigquery_agent_info():
    """Retorna información, estado y fuentes del agente de BigQuery (agente-facturacion)."""
    info = bigquery_agent_service.get_agent_info()
    return JSONResponse(content={"status": "success", "data": info})


@app.post("/api/billing/agent/chat")
async def chat_with_bigquery_agent(req: BigQueryAgentChatRequest):
    """Canal de chat en vivo con el Agente de BigQuery usando Conversational Analytics API."""
    try:
        response = await bigquery_agent_service.chat(
            user_query=req.message,
            client_history=req.conversation_history
        )
        return JSONResponse(content={"status": "success", "data": response})
    except Exception as e:
        logger.error(f"Error en chat con agente de BigQuery: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Servidor iniciado exitosamente.")


# --- Frontend Estático con Cache-Busting Forzado ---
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response


if FRONTEND_DIR.exists():
    app.mount("/css", NoCacheStaticFiles(directory=FRONTEND_DIR / "css"), name="css")
    app.mount("/js", NoCacheStaticFiles(directory=FRONTEND_DIR / "js"), name="js")

    @app.get("/")
    async def serve_index():
        index_file = FRONTEND_DIR / "index.html"
        if index_file.exists():
            return FileResponse(
                index_file,
                headers={
                    "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
                    "Pragma": "no-cache",
                    "Expires": "0"
                }
            )
        return HTMLResponse("<h1>Frontend cargando...</h1>")


def run():
    uvicorn.run("backend.app:app", host="0.0.0.0", port=8085, reload=True)


if __name__ == "__main__":
    run()
