
import os
import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
import google.auth
import google.auth.transport.requests
import requests

logger = logging.getLogger("firestore_service")
DB_FILE = Path(__file__).parent.parent.parent / "config" / "firestore_profiles_db.json"

class FirestoreProfileService:
    def __init__(self, project_id: Optional[str] = None, collection_name: str = "governance_profiles"):
        self.project_id = project_id or os.getenv("GCP_HOST_PROJECT_ID") or os.getenv("GCP_PROJECT_ID") or "gobiernodatos"
        self.collection_name = collection_name
        self.db_file = DB_FILE
        self._load_local_data()

    def _load_local_data(self) -> Dict[str, Any]:
        if self.db_file.exists():
            try:
                with open(self.db_file, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
            except Exception as e:
                logger.error(f"Error loading local profiles db: {e}")
                self.data = {"profiles": [], "active_profile_id": "guardian_dato"}
        else:
            self.data = {"profiles": [], "active_profile_id": "guardian_dato"}
        return self.data

    def _save_local_data(self) -> bool:
        try:
            with open(self.db_file, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            logger.error(f"Error saving local profiles db: {e}")
            return False

    def get_all_profiles(self) -> List[Dict[str, Any]]:
        self._load_local_data()
        return self.data.get("profiles", [])

    def authenticate_user(self, email: str, password: str) -> Optional[Dict[str, Any]]:
        self._load_local_data()
        email_clean = email.strip().lower()
        pass_clean = password.strip()

        # 1. Check predefined profiles
        for p in self.data.get("profiles", []):
            if p.get("email", "").lower() == email_clean and p.get("password") == pass_clean:
                self.set_active_profile(p.get("id"))
                return p
        
        # 2. Allow any custom user to login and default them to the Architect profile
        architect = self.get_profile("arquitecto_ingeniero")
        if architect:
            self.set_active_profile("arquitecto_ingeniero")
            # Personalize it for the current user
            architect["email"] = email_clean
            architect["user_name"] = email_clean.split("@")[0].title()
            return architect
            
        return None

    def get_profile(self, profile_id: str) -> Optional[Dict[str, Any]]:
        self._load_local_data()
        for p in self.data.get("profiles", []):
            if p.get("id") == profile_id:
                return p
        return None

    def get_active_profile(self) -> Dict[str, Any]:
        self._load_local_data()
        active_id = self.data.get("active_profile_id", "guardian_dato")
        p = self.get_profile(active_id)
        if p:
            return p
        profiles = self.get_all_profiles()
        return profiles[0] if profiles else {}

    def set_active_profile(self, profile_id: str) -> Dict[str, Any]:
        self._load_local_data()
        p = self.get_profile(profile_id)
        if not p:
            return {"status": "error", "message": f"Perfil '{profile_id}' no encontrado"}

        self.data["active_profile_id"] = profile_id
        self._save_local_data()
        
        # Also attempt async sync to Firestore in GCP
        self._sync_to_gcp_firestore(profile_id, p)

        return {
            "status": "success",
            "active_profile": p,
            "message": f"Perfil activo cambiado a: {p.get('name')} ({p.get('role')})"
        }

    def sync_all_profiles_to_firestore(self) -> Dict[str, Any]:
        """Sincroniza todos los perfiles gobernados (incluyendo Administrador del Billing) hacia Cloud Firestore."""
        self._load_local_data()
        profiles = self.get_all_profiles()
        synced_count = 0
        errors = []

        # 1. Intento nativo con SDK google.cloud.firestore
        try:
            from google.cloud import firestore
            db = firestore.Client(project=self.project_id)
            for p in profiles:
                doc_id = p.get("id")
                if doc_id:
                    db.collection(self.collection_name).document(doc_id).set(p, merge=True)
                    synced_count += 1
            logger.info(f"🔥 Sincronizados exitosamente {synced_count} perfiles en Firestore '{self.project_id}' via SDK.")
            return {"status": "success", "mode": "FIRESTORE_SDK", "synced_count": synced_count}
        except Exception as e:
            logger.warning(f"Sincronización nativa SDK Firestore falló ({e}), intentando vía REST API...")
            errors.append(str(e))

        # 2. Fallback vía REST API
        for p in profiles:
            doc_id = p.get("id")
            if doc_id:
                ok = self._sync_to_gcp_firestore(doc_id, p)
                if ok:
                    synced_count += 1

        return {
            "status": "partial" if synced_count > 0 else "fallback_local",
            "synced_count": synced_count,
            "total_profiles": len(profiles),
            "errors": errors
        }

    def _sync_to_gcp_firestore(self, doc_id: str, payload: Dict[str, Any]) -> bool:
        try:
            import subprocess
            token = None
            try:
                token = subprocess.check_output(
                    ["gcloud", "auth", "print-access-token"],
                    text=True, timeout=4
                ).strip()
            except Exception:
                pass

            if not token:
                creds, _ = google.auth.default()
                auth_req = google.auth.transport.requests.Request()
                creds.refresh(auth_req)
                token = creds.token

            url = f"https://firestore.googleapis.com/v1/projects/{self.project_id}/databases/(default)/documents/{self.collection_name}/{doc_id}"
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            
            fields = {
                "id": {"stringValue": str(payload.get("id", ""))},
                "name": {"stringValue": str(payload.get("name", ""))},
                "user_name": {"stringValue": str(payload.get("user_name", ""))},
                "email": {"stringValue": str(payload.get("email", ""))},
                "role": {"stringValue": str(payload.get("role", ""))},
                "mission": {"stringValue": str(payload.get("mission", ""))},
                "avatar": {"stringValue": str(payload.get("avatar", "💳"))}
            }
            res = requests.patch(url, headers=headers, json={"fields": fields}, timeout=4)
            return res.status_code in [200, 201]
        except Exception as e:
            logger.debug(f"Sync a Firestore omitido (se usará local fallback). Detalle: {e}")
            return False

firestore_profile_service = FirestoreProfileService()
