"""MÓDULO 8: Gobernanza Semántica de Looker & Generación de Modelos LookML desde BigQuery GCP.

Permite gobernar las métricas y modelos semánticos oficiales utilizados en Looker:
- Métricas aprobadas por comités (Trips, Fares, Messages, Comisiones).
- Mapeo hacia vistas LookML y tablas físicas en BigQuery / MySQL.
- Generación dinámica de código LookML (.lkml) directamente desde esquemas de BigQuery.
"""

import json
import logging
from typing import Any, Dict, List, Optional
from backend.gcp_utils import get_active_project_id

logger = logging.getLogger("looker_governance")


class LookerGovernanceManager:
    def __init__(self):
        proj = get_active_project_id()
        self.metrics = [
            {
                "id": f"metric-bq-{proj}-taxi-trips-total",
                "name": "Total Viajes de Taxi Registrados (BigQuery GCP)",
                "domain": "transporte_y_movilidad",
                "definition": "Conteo total de viajes de taxi procesados en el dataset chicago_taxi_trips (>213M registros en BigQuery).",
                "lookml_model": "chicago_taxi_analytics",
                "lookml_view": "taxi_trips",
                "lookml_sql": "COUNT(${TABLE}.unique_key)",
                "source_table": f"{proj}.chicago_taxi_trips.taxi_trips",
                "owner_steward": "Javier Mendoza (Lead Data Architect)",
                "governance_status": "CERTIFICADA_OFICIAL",
                "last_updated": "2026-08-14 UTC",
                "pii_classification": "No PII (Métrica Agregada / Ubicaciones Geo)",
                "dashboard_consumers": ["Dashboard de Transporte Urbano (Looker Studio)", "Vertex AI Agent"]
            },
            {
                "id": f"metric-bq-{proj}-taxi-fares-sum",
                "name": "Monto Total de Tarifas Recaudadas (BigQuery GCP)",
                "domain": "finanzas_y_costos",
                "definition": "Suma total acumulada del valor de tarifas y propinas pagadas en viajes de taxi.",
                "lookml_model": "chicago_taxi_analytics",
                "lookml_view": "taxi_trips",
                "lookml_sql": "SUM(${TABLE}.trip_total)",
                "source_table": f"{proj}.chicago_taxi_trips.taxi_trips",
                "owner_steward": "Javier Mendoza (Lead Data Architect)",
                "governance_status": "CERTIFICADA_OFICIAL",
                "last_updated": "2026-08-14 UTC",
                "pii_classification": "Métrica Financiera Agregada",
                "dashboard_consumers": ["Control de Ingresos de Transporte", "Auditoría Financiera"]
            },
            {
                "id": f"metric-bq-{proj}-costos-messages-total",
                "name": "Total Transacciones & Mensajes Blockchain (BigQuery GCP)",
                "domain": "finanzas_y_costos",
                "definition": "Conteo masivo de mensajes y transacciones indexadas en el dataset de costos (>241M registros).",
                "lookml_model": "blockchain_costos_model",
                "lookml_view": "messages",
                "lookml_sql": "COUNT(${TABLE}.txhash)",
                "source_table": f"{proj}.costos.messages",
                "owner_steward": "Javier Mendoza (Lead Data Architect)",
                "governance_status": "CERTIFICADA_OFICIAL",
                "last_updated": "2026-08-14 UTC",
                "pii_classification": "Hashes Encriptados / No PII Directa",
                "dashboard_consumers": ["Dashboard de Costos de Red", "Agente de Monitoreo RAG"]
            },
            {
                "id": "metric-mysql-total-ventas",
                "name": "Ventas Totales Consolidadas (MySQL External)",
                "domain": "ventas",
                "definition": "Monto total acumulado de ventas comerciales registradas en la base de datos externa MySQL.",
                "lookml_model": "comercial_mysql_model",
                "lookml_view": "resumen_comercial_consolidado",
                "lookml_sql": "SUM(${TABLE}.total_venta)",
                "source_table": "mysql-1c645071-google-beed.j.aivencloud.com:10283.bdcomercial.resumen_comercial_consolidado",
                "owner_steward": "Javier Mendoza (Lead Data Architect)",
                "governance_status": "CERTIFICADA_OFICIAL",
                "last_updated": "2026-08-14 UTC",
                "pii_classification": "Enmascarado con Dynamic Data Masking",
                "dashboard_consumers": ["Tablero de Ventas Ejecutivas (Looker Studio)", "Agente RAG Comercial"]
            }
        ]

    def list_governed_metrics(self) -> List[Dict[str, Any]]:
        return self.metrics

    def get_metric_by_id(self, metric_id: str) -> Optional[Dict[str, Any]]:
        return next((m for m in self.metrics if m.get("id") == metric_id), None)

    def generate_lookml_view(self, asset: Dict[str, Any]) -> str:
        """Genera el código LookML (.lkml) oficial para una tabla de BigQuery o MySQL."""
        proj = asset.get("project_or_db", get_active_project_id())
        ds = asset.get("dataset", "dataset")
        tbl = asset.get("table_name", "table")
        view_name = tbl.lower()

        dimensions_code = []
        measures_code = [
            f"  measure: count {{\n    type: count\n    drill_fields: [detail*]\n  }}"
        ]

        cols = asset.get("columns", [])
        for col in cols:
            c_name = col.get("name")
            c_type = (col.get("type") or "STRING").upper()
            is_pii = col.get("is_pii", False)

            # Map BigQuery types to LookML types
            if "INT" in c_type or "FLOAT" in c_type or "NUMERIC" in c_type or "DOUBLE" in c_type:
                lookml_type = "number"
            elif "TIME" in c_type or "DATE" in c_type:
                lookml_type = "time"
            elif "BOOL" in c_type:
                lookml_type = "yesno"
            else:
                lookml_type = "string"

            # Sensitive column LookML tag
            tags_str = " tags: [\"pii\", \"confidential\"]" if is_pii else ""

            if lookml_type == "time":
                dimensions_code.append(
                    f"  dimension_group: {c_name} {{\n"
                    f"    type: time\n"
                    f"    timeframes: [raw, time, date, week, month, quarter, year]\n"
                    f"    sql: ${{TABLE}}.{c_name} ;;\n"
                    f"  }}"
                )
            else:
                dimensions_code.append(
                    f"  dimension: {c_name} {{\n"
                    f"    type: {lookml_type}\n"
                    f"    sql: ${{TABLE}}.{c_name} ;;{tags_str}\n"
                    f"  }}"
                )

            # Add numerical measures
            if lookml_type == "number" and not col.get("is_primary_key"):
                measures_code.append(
                    f"  measure: total_{c_name} {{\n"
                    f"    type: sum\n"
                    f"    sql: ${{TABLE}}.{c_name} ;;\n"
                    f"    value_format_name: decimal_2\n"
                    f"  }}"
                )

        dims_joined = "\n\n".join(dimensions_code)
        meas_joined = "\n\n".join(measures_code)

        lookml_content = f"""# LookML View Autogenerada por Agente de Gobierno de Datos
view: {view_name} {{
  sql_table_name: `{proj}.{ds}.{tbl}` ;;

  # --- DIMENSIONES GOBERNADAS ---
{dims_joined}

  # --- MÉTRICAS DE NEGOCIO ---
{meas_joined}

  set: detail {{
    fields: [{', '.join([c['name'] for c in cols[:5]])}]
  }}
}}
"""
        return lookml_content


looker_governance_manager = LookerGovernanceManager()
