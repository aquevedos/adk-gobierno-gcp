"""Servicio de Integración con el Agente de BigQuery (agente-facturacion).
Conexión directa con Google Cloud Conversational Analytics API (Gemini Data Analytics)
utilizando el SDK oficial de Google Cloud y la arquitectura del summitagentic2026.
"""

import os
import logging
from typing import Any, Dict, List, Optional
from google.cloud import geminidataanalytics_v1alpha as geminidataanalytics
from google.protobuf.json_format import MessageToDict
from backend.gcp_utils import get_gcp_credentials

import dotenv

logger = logging.getLogger("bigquery_agent_service")

# --- CONFIGURACIÓN DINÁMICA DEL AGENTE BIGQUERY STUDIO (LEÍDA DE .ENV) ---
def get_bq_agent_project_id() -> str:
    """Obtiene el ID del proyecto para el Agente BQ desde las variables de entorno (.env)."""
    dotenv.load_dotenv(override=True)
    return (
        os.getenv("BQ_DATA_AGENT_PROJECT_ID")
        or os.getenv("GCP_PROJECT")
        or os.getenv("GCP_HOST_PROJECT_ID")
        or os.getenv("GCP_PROJECT_ID")
        or "gobiernodatos"
    )

def get_bq_agent_location() -> str:
    """Obtiene la región/ubicación del Agente BQ desde las variables de entorno (.env)."""
    dotenv.load_dotenv(override=True)
    return (
        os.getenv("BQ_DATA_AGENT_LOCATION")
        or os.getenv("GCP_BQ_LOCATION")
        or "us"
    )

def get_bq_agent_id() -> str:
    """Obtiene el ID único del Agente de BigQuery desde las variables de entorno (.env)."""
    dotenv.load_dotenv(override=True)
    return (
        os.getenv("BQ_DATA_AGENT_ID")
        or os.getenv("DATA_AGENT_ID")
        or os.getenv("BIGQUERY_AGENT_ID")
        or "agent_d74dd4e9-e294-4834-9b6d-a00fff8f0950"
    )

def get_bq_agent_path() -> str:
    return f"projects/{get_bq_agent_project_id()}/locations/{get_bq_agent_location()}/dataAgents/{get_bq_agent_id()}"

def get_bq_agent_parent() -> str:
    return f"projects/{get_bq_agent_project_id()}/locations/{get_bq_agent_location()}"


def extract_followup_questions(text: str) -> List[str]:
    """Extrae preguntas de seguimiento limpias de un texto como '¿Cuál...?¿Qué...?'"""
    questions = []
    if "¿" in text:
        parts = text.split("¿")
        for p in parts:
            p = p.strip()
            if p:
                q = "¿" + p
                if not q.endswith("?"):
                    q += "?"
                questions.append(q)
    elif "?" in text:
        for line in text.split("\n"):
            line = line.strip()
            if line.endswith("?") and len(line) > 10:
                questions.append(line.lstrip("-*•0123456789. "))
    return questions


def detect_chart_metadata(fields: List[str], rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Detecta automáticamente si los datos deben renderizarse como gráfico (Line para series temporales, Bar para categorías)."""
    if not rows or not fields:
        return None

    numeric_candidates = [
        "cost", "daily_cost", "total_cost", "totalbilledcost", 
        "billedcost", "effectivecost", "amount", "total", 
        "spend", "consumedquantity"
    ]
    y_col = None
    for col in fields:
        col_lower = col.lower()
        if any(cand in col_lower for cand in numeric_candidates):
            y_col = col
            break
    if not y_col:
        for col in fields:
            val = rows[0].get(col)
            if isinstance(val, (int, float)):
                y_col = col
                break

    if not y_col:
        return None

    date_candidates = [
        "date", "usage_date", "time", "day", "month", 
        "billingperiodstart", "start_time", "partitiondate"
    ]
    x_col = None
    chart_type = "bar"

    for col in fields:
        if col == y_col:
            continue
        col_lower = col.lower()
        if any(cand in col_lower for cand in date_candidates):
            x_col = col
            chart_type = "line"
            break

    if not x_col:
        for col in fields:
            if col != y_col:
                x_col = col
                chart_type = "bar"
                break

    if not x_col:
        return None

    title = "Tendencia Diaria de Costos" if chart_type == "line" else f"Distribución de Costos por {x_col}"

    return {
        "chart_type": chart_type,
        "x_field": x_col,
        "y_field": y_col,
        "title": title
    }


def parse_responses(stream) -> List[Dict[str, Any]]:
    """Parsea el flujo de respuestas de Gemini Data Analytics extrayendo texto, SQL, datos, gráficos y follow-up questions."""
    results = []

    for resp in stream:
        m = resp.system_message
        item = {"type": "unknown", "content": None}

        # 1. PROCESAR TEXTO (Limpieza de razonamiento y filtros de errores transitorios)
        if 'text' in m:
            text_content = "".join(m.text.parts).strip()
            lower_text = text_content.lower()

            # Omitir pensamientos internos y errores transitorios de sintaxis durante reintentos
            if any(skip in lower_text for skip in [
                "analyzing context", 
                "retrieved context",
                "running a query", 
                "query execution completed",
                "query execution failed",
                "query parsing error",
                "syntax error:",
                "expected end of input",
                "[invalid_argument]"
            ]):
                continue

            # Detectar si el texto contiene preguntas de seguimiento
            if "follow-up questions" in lower_text or (text_content.startswith("¿") and text_content.count("?") >= 1):
                qs = extract_followup_questions(text_content)
                if qs:
                    results.append({"type": "followup_questions", "content": qs})
                continue

            # Limpiar 'follow-up questions' del final del texto si estuviera incrustado
            target_phrase = "follow-up questions"
            if target_phrase in lower_text:
                cut_idx = lower_text.find(target_phrase)
                text_content = text_content[:cut_idx].strip()

            if len(text_content) < 5:
                continue

            item["type"] = "text"
            item["content"] = text_content

        # 2. PROCESAR SQL GENERADO
        elif 'data' in m and hasattr(m.data, 'generated_sql') and m.data.generated_sql:
            item["type"] = "sql"
            item["content"] = m.data.generated_sql

        # 3. PROCESAR DATOS Y RESULTADOS DE TABLA (CON CHART METADATA)
        elif 'data' in m and 'result' in m.data:
            fields = [f.name for f in m.data.result.schema.fields]
            rows = [{f: row[f] for f in fields} for row in m.data.result.data]
            chart_meta = detect_chart_metadata(fields, rows)
            item["type"] = "data"
            item["content"] = {
                "fields": fields, 
                "rows": rows,
                "chart_meta": chart_meta
            }

        # 4. PROCESAR GRÁFICOS VEGA-LITE NATIVOS
        elif 'chart' in m and 'result' in m.chart:
            item["type"] = "chart"
            item["content"] = MessageToDict(m.chart.result._pb).get('vegaConfig', {})

        if item["type"] != "unknown":
            results.append(item)

    return results


class BigQueryAgentService:
    def __init__(self):
        self._client = None
        self._cached_endpoint = None

    @property
    def project_id(self) -> str:
        return get_bq_agent_project_id()

    @property
    def location(self) -> str:
        return get_bq_agent_location()

    @property
    def agent_id(self) -> str:
        return get_bq_agent_id()

    @property
    def agent_path(self) -> str:
        return get_bq_agent_path()

    @property
    def parent(self) -> str:
        return get_bq_agent_parent()

    def get_client(self) -> geminidataanalytics.DataChatServiceClient:
        """Inicializa el cliente oficial con el endpoint regional de Google Cloud y credenciales válidas."""
        endpoint = f"geminidataanalytics.{self.location}.rep.googleapis.com"
        if self._client is None or self._cached_endpoint != endpoint:
            try:
                creds = get_gcp_credentials()
            except Exception:
                creds = None

            if creds:
                self._client = geminidataanalytics.DataChatServiceClient(
                    client_options={"api_endpoint": endpoint},
                    credentials=creds
                )
            else:
                self._client = geminidataanalytics.DataChatServiceClient(
                    client_options={"api_endpoint": endpoint}
                )
            self._cached_endpoint = endpoint
            logger.info(f"🤖 DataChatServiceClient conectado a '{endpoint}' para '{self.agent_path}'.")
        return self._client

    def get_agent_info(self) -> Dict[str, Any]:
        """Retorna los metadatos y estado del agente de BigQuery."""
        proj = self.project_id
        loc = self.location
        return {
            "status": "online",
            "id": self.agent_id,
            "name": "agente-facturacion",
            "full_resource_name": self.agent_path,
            "project_id": proj,
            "location": loc,
            "tables": [
                {
                    "project_id": proj,
                    "dataset_id": "facturacion",
                    "table_id": "gcp_billing_export_resource_v1_01D79A_F04D6B_3B368E",
                    "full_path": f"`{proj}.facturacion.gcp_billing_export_resource_v1_01D79A_F04D6B_3B368E`"
                },
                {
                    "project_id": proj,
                    "dataset_id": f"gcp_billing_immutable_01D79A_F04D6B_3B368E_{loc}",
                    "table_id": "gcp_billing_export_focus_01D79A_F04D6B_3B368E",
                    "full_path": f"`{proj}.gcp_billing_immutable_01D79A_F04D6B_3B368E_{loc}.gcp_billing_export_focus_01D79A_F04D6B_3B368E`"
                }
            ]
        }

    async def chat(self, user_query: str, client_history: Optional[List[Dict[str, str]]] = None) -> List[Dict[str, Any]]:
        """Envía una consulta analítica al agente y retorna los bloques procesados (texto, SQL, datos, gráficos)."""
        logger.info(f"Enviando consulta a DataAgent '{self.agent_id}': '{user_query}'")
        client = self.get_client()

        # Reconstrucción de historial de mensajes
        messages = []
        for h in (client_history or []):
            msg = geminidataanalytics.Message()
            if h.get('role') == 'user':
                msg.user_message.text = h.get('content', '')
            else:
                msg.system_message.text.parts.append(h.get('content', ''))
            messages.append(msg)

        new_msg = geminidataanalytics.Message()
        new_msg.user_message.text = user_query
        messages.append(new_msg)

        context = geminidataanalytics.DataAgentContext(data_agent=self.agent_path)
        req = geminidataanalytics.ChatRequest(
            parent=self.parent,
            messages=messages,
            data_agent_context=context,
        )

        # Timeout de 360s recomendado para consultas pesadas a BigQuery
        stream = client.chat(request=req, timeout=360)
        responses = parse_responses(stream)

        if not responses:
            return [{"type": "text", "content": "### Resultado\nLa consulta se ejecutó, pero no se generó una explicación compatible."}]

        return responses


bigquery_agent_service = BigQueryAgentService()
