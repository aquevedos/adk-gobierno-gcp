"""Knowledge Catalog and Context Graph Service for Multi-Cloud Metadata Management."""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("knowledge_catalog_service")
DB_PATH = Path(__file__).parent.parent.parent / "config" / "mock_catalog_db.json"


class KnowledgeCatalogService:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self._load_data()

    def _load_data(self) -> Dict[str, Any]:
        if self.db_path.exists():
            try:
                with open(self.db_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception as e:
                logger.error(f"Error loading catalog database: {e}")
                self.data = {"assets": [], "glossary": []}
        else:
            self.data = {"assets": [], "glossary": []}
        return self.data

    def _save_data(self) -> bool:
        try:
            with open(self.db_path, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving catalog database: {e}")
            return False

    def _load_connectors_config(self) -> Dict[str, Any]:
        import yaml
        config_path = Path(__file__).parent.parent.parent / "config" / "connectors_config.yaml"
        if config_path.exists():
            try:
                with open(config_path, "r", encoding="utf-8") as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                logger.error(f"Error cargando connectors_config.yaml: {e}")
        return {}

    def _is_asset_connector_active(self, asset: Dict[str, Any], cfg: Optional[Dict[str, Any]] = None) -> bool:
        if cfg is None:
            cfg = self._load_connectors_config()

        cloud = (asset.get("cloud") or "").upper()
        asset_id = (asset.get("id") or "").lower()

        if cloud == "GCP" or asset_id.startswith("gcp_"):
            gcp_cfg = cfg.get("gcp", {})
            if not gcp_cfg.get("enabled", True):
                return False
            allowed_datasets = gcp_cfg.get("bigquery_datasets", [])
            ds = asset.get("dataset_or_schema")
            if allowed_datasets and ds:
                return ds in allowed_datasets
            return True

        if "MYSQL" in cloud or asset_id.startswith("ext_mysql_"):
            mysql_cfg = cfg.get("onprem", {}).get("mysql", {})
            mysql_host = mysql_cfg.get("host", "").strip()
            mysql_db = mysql_cfg.get("database", "").strip()
            return bool(mysql_cfg.get("connected", False)) and bool(mysql_host) and bool(mysql_db)

        if "POSTGRES" in cloud or asset_id.startswith("ext_pg_") or asset_id.startswith("onprem_pg_"):
            pg_cfg = cfg.get("onprem", {}).get("postgresql", {})
            pg_host = pg_cfg.get("host", "").strip()
            pg_db = pg_cfg.get("database", "").strip()
            return bool(pg_cfg.get("connected", False)) and bool(pg_host) and bool(pg_db)

        if cloud == "AWS" or asset_id.startswith("aws_"):
            aws_cfg = cfg.get("aws", {})
            return bool(aws_cfg.get("enabled", False))

        if cloud == "AZURE" or asset_id.startswith("azure_"):
            azure_cfg = cfg.get("azure", {})
            return bool(azure_cfg.get("enabled", False))

        if "ON-PREMISES" in cloud or asset_id.startswith("onprem_"):
            onprem_cfg = cfg.get("onprem", {})
            return bool(onprem_cfg.get("enabled", False))

        return True

    def list_assets(self, cloud: Optional[str] = None, domain: Optional[str] = None) -> List[Dict[str, Any]]:
        self._load_data()
        cfg = self._load_connectors_config()
        all_assets = self.data.get("assets", [])
        
        assets = [a for a in all_assets if self._is_asset_connector_active(a, cfg)]

        if cloud and cloud.lower() != "all":
            assets = [a for a in assets if a.get("cloud", "").lower() == cloud.lower()]
        if domain and domain.lower() != "all":
            assets = [a for a in assets if a.get("domain", "").lower() == domain.lower()]
        return assets

    def get_asset(self, asset_id: str) -> Optional[Dict[str, Any]]:
        self._load_data()
        cfg = self._load_connectors_config()
        for asset in self.data.get("assets", []):
            if asset.get("id") == asset_id:
                if self._is_asset_connector_active(asset, cfg):
                    return asset
                return None
        return None

    def search_catalog(self, query: str, cloud: Optional[str] = None) -> List[Dict[str, Any]]:
        self._load_data()
        cfg = self._load_connectors_config()
        query_lower = query.lower().strip()
        results = []
        for asset in self.data.get("assets", []):
            if not self._is_asset_connector_active(asset, cfg):
                continue
            if cloud and cloud.lower() != "all" and asset.get("cloud", "").lower() != cloud.lower():
                continue
            
            # Match against table_name, name, description, columns, domain, tags
            match_score = 0
            if query_lower in asset.get("name", "").lower():
                match_score += 10
            if query_lower in asset.get("table_name", "").lower():
                match_score += 10
            if query_lower in asset.get("description", "").lower():
                match_score += 5
            if query_lower in asset.get("dataset", "").lower():
                match_score += 4
            if query_lower in asset.get("domain", "").lower():
                match_score += 3
            if query_lower in asset.get("service", "").lower() or query_lower in asset.get("cloud", "").lower():
                match_score += 2

            for col in asset.get("columns", []):
                if query_lower in col.get("name", "").lower() or query_lower in col.get("description", "").lower():
                    match_score += 3

            if match_score > 0 or not query_lower:
                asset_copy = dict(asset)
                asset_copy["relevance_score"] = match_score
                results.append(asset_copy)

        results.sort(key=lambda x: x.get("relevance_score", 0), reverse=True)
        return results

    def update_asset_metadata(
        self,
        asset_id: str,
        description: Optional[str] = None,
        steward: Optional[str] = None,
        column_updates: Optional[List[Dict[str, Any]]] = None,
        golden_query: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        self._load_data()
        for asset in self.data.get("assets", []):
            if asset.get("id") == asset_id:
                if description is not None:
                    asset["description"] = description
                if steward is not None:
                    asset["steward"] = steward
                if golden_query is not None:
                    asset["golden_query"] = golden_query
                if column_updates:
                    for col_update in column_updates:
                        c_name = col_update.get("name")
                        for col in asset.get("columns", []):
                            if col.get("name") == c_name:
                                if "description" in col_update:
                                    col["description"] = col_update["description"]
                                if "is_pii" in col_update:
                                    col["is_pii"] = col_update["is_pii"]
                                if "policy_tag" in col_update:
                                    col["policy_tag"] = col_update["policy_tag"]
                                if "masked" in col_update:
                                    col["masked"] = col_update["masked"]
                self._save_data()
                return asset
        return None

    def get_glossary(self) -> List[Dict[str, Any]]:
        self._load_data()
        return self.data.get("glossary", [])

    def add_glossary_term(self, term: str, definition: str, domain: str, approved_by: str) -> Dict[str, Any]:
        self._load_data()
        new_entry = {
            "term": term,
            "definition": definition,
            "domain": domain,
            "approved_by": approved_by
        }
        self.data.setdefault("glossary", []).append(new_entry)
        self._save_data()
        return new_entry


catalog_service = KnowledgeCatalogService()
