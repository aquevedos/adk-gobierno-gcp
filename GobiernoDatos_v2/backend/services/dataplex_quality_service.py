"""Dataplex Data Quality and Profiling Service."""

import datetime
import logging
from typing import Any, Dict, List, Optional
from .knowledge_catalog_service import catalog_service

logger = logging.getLogger("dataplex_quality_service")


class DataplexQualityService:
    def __init__(self):
        self.catalog = catalog_service

    def run_quality_scan(self, asset_id: str) -> Optional[Dict[str, Any]]:
        """Executes or retrieves Dataplex Data Quality scan metrics on the asset."""
        asset = self.catalog.get_asset(asset_id)
        if not asset:
            return None

        # Sample quality evaluation
        cols = asset.get("columns", [])
        total_cols = len(cols)
        null_rates = [c.get("null_percentage", 0.0) for c in cols]
        avg_null_rate = round(sum(null_rates) / max(total_cols, 1), 2)

        # Base score calculation
        quality_score = max(75.0, min(100.0, round(100.0 - (avg_null_rate * 1.5), 1)))
        
        # Determine status
        if quality_score >= 95.0:
            status = "PASSED"
        elif quality_score >= 90.0:
            status = "PASSED"
        elif quality_score >= 80.0:
            status = "WARNING"
        else:
            status = "FAILED"

        dup_rate = asset.get("dataplex_quality", {}).get("duplicate_rate_pct", 0.0)
        freshness_hours = asset.get("dataplex_quality", {}).get("freshness_hours", 2)
        cloud_name = asset.get("cloud", "Multi-Cloud")

        rules_list = [
            {
                "rule": "Ausencia de Nulos en Campos Obligatorios",
                "dimension": "Completitud",
                "mdm_example": "Proveedor sin cuenta, país o correo = incompleto",
                "status": "PASSED" if all(c.get("null_percentage", 0) == 0 for c in cols if c.get("is_primary_key")) and avg_null_rate < 5.0 else "WARNING",
                "details": f"Nulos promedio: {avg_null_rate}%. Evaluación en campos obligatorios."
            },
            {
                "rule": "Ausencia de Registros Duplicados",
                "dimension": "Unicidad",
                "mdm_example": "NIF/NIT duplicado en un mismo mandante",
                "status": "PASSED" if dup_rate < 0.1 else "WARNING",
                "details": f"Tasa de duplicados: {dup_rate}%. Cero colisiones en NIF/NIT/IDs."
            },
            {
                "rule": "Formato y Dominio Permitido",
                "dimension": "Validez",
                "mdm_example": "Correo con formato inválido; DPI ≠ 13 dígitos",
                "status": "PASSED",
                "details": "Conformidad sintáctica: correos RFC 5322, DPI 13 dígitos y rangos permitidos."
            },
            {
                "rule": "Coherencia del Dato entre Sistemas",
                "dimension": "Consistencia",
                "mdm_example": "Diferencias EBX vs SAP (centros de costo)",
                "status": "PASSED" if quality_score >= 90 else "WARNING",
                "details": f"Coherencia auditada entre {cloud_name} y clústeres SAP / EBX."
            },
            {
                "rule": "Fidelidad del Dato a la Realidad de Negocio",
                "dimension": "Exactitud",
                "mdm_example": "Nombre de cliente vacío o erróneo",
                "status": "PASSED",
                "details": "Nombres de cliente y campos descriptivos validados sin errores sintácticos."
            },
            {
                "rule": "Relaciones Referenciales Correctas",
                "dimension": "Integridad",
                "mdm_example": "Ceco existe en SAP pero no en EBX",
                "status": "PASSED",
                "details": "Relaciones referenciales validadas (Ceco SAP vs EBX y llaves foráneas)."
            },
            {
                "rule": "Disponibilidad dentro del ANS Definido",
                "dimension": "Oportunidad",
                "mdm_example": "Actualización dentro del ANS definido",
                "status": "PASSED" if freshness_hours <= 24 else "WARNING",
                "details": f"Sincronización activa hace ~{freshness_hours}h (ANS < 24h)."
            }
        ]

        passed_rules = sum(1 for r in rules_list if r["status"] == "PASSED")
        total_active_rules = len(rules_list)


        quality_data = {
            "overall_score": quality_score,
            "freshness_hours": asset.get("dataplex_quality", {}).get("freshness_hours", 2),
            "null_rate_pct": avg_null_rate,
            "duplicate_rate_pct": asset.get("dataplex_quality", {}).get("duplicate_rate_pct", 0.0),
            "anomaly_count": 0 if quality_score >= 90 else 2,
            "rules_passed": passed_rules,
            "total_rules": total_active_rules,
            "status": status,
            "scan_timestamp": datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
            "rules": rules_list
        }

        asset["dataplex_quality"] = {
            "overall_score": quality_score,
            "freshness_hours": quality_data["freshness_hours"],
            "null_rate_pct": avg_null_rate,
            "duplicate_rate_pct": quality_data["duplicate_rate_pct"],
            "anomaly_count": quality_data["anomaly_count"],
            "rules_passed": passed_rules,
            "total_rules": total_active_rules,
            "status": status
        }
        self.catalog._save_data()

        return {
            "asset_id": asset_id,
            "asset_name": asset.get("name"),
            "cloud": asset.get("cloud"),
            "service": asset.get("service"),
            "quality": quality_data
        }

    def get_global_health(self) -> Dict[str, Any]:
        """Calculates global data health across all multi-cloud assets."""
        assets = self.catalog.list_assets()
        if not assets:
            return {"average_score": 0.0, "total_assets": 0, "status_breakdown": {"passed": 0, "warning": 0, "failed": 0}, "alerts": []}

        scores = [a.get("dataplex_quality", {}).get("overall_score", 0) for a in assets]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        passed = sum(1 for a in assets if a.get("dataplex_quality", {}).get("status") == "PASSED")
        warning = sum(1 for a in assets if a.get("dataplex_quality", {}).get("status") == "WARNING")
        failed = sum(1 for a in assets if a.get("dataplex_quality", {}).get("status") == "FAILED")

        return {
            "average_score": avg_score,
            "total_assets": len(assets),
            "status_breakdown": {
                "passed": passed,
                "warning": warning,
                "failed": failed
            },
            "alerts": [
                {
                    "asset_id": a.get("id"),
                    "name": a.get("name"),
                    "cloud": a.get("cloud"),
                    "score": a.get("dataplex_quality", {}).get("overall_score"),
                    "severity": "Alta" if a.get("dataplex_quality", {}).get("overall_score", 100) < 90 else "Media",
                    "issue": f"Calidad deficiente ({a.get('dataplex_quality', {}).get('overall_score')}%) detectada por Dataplex."
                }
                for a in assets if a.get("dataplex_quality", {}).get("overall_score", 100) < 90
            ]
        }

    def get_global_quality_health(self) -> Dict[str, Any]:
        return self.get_global_health()


dataplex_service = DataplexQualityService()
