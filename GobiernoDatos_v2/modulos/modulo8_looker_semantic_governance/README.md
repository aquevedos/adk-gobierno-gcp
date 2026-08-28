# 📊 Módulo 8: Gobernanza Semántica de Looker & Generación de Modelos LookML

Este módulo proporciona el marco de **Gobernanza Semántica** para Looker y Looker Studio conectado con **BigQuery GCP**.

---

## 🎯 Capacidades Principales

1. **Catálogo de Métricas Oficiales de Negocio:**
   - Registro de métricas certificadas por comités de gobierno (KPIs financieros, volumen de operaciones, comisiones).
   - Mapeo directo entre la definición conceptual, la expresión matemática y la columna física en BigQuery.

2. **Generación Automatizada de LookML (.lkml):**
   - Transforma esquemas y metadatos de tablas BigQuery en archivos de definición LookML (`view`, `dimensions`, `measures`, `dimension_group`).
   - Evita inconsistencias entre la base de datos y la capa de visualización analítica.

3. **Trazabilidad de Consumidores:**
   - Vinculación de dashboards de Looker y Looker Studio con los Data Stewards responsables de cada métrica.
   - Auditoría de impacto ante cambios de esquema en BigQuery.
