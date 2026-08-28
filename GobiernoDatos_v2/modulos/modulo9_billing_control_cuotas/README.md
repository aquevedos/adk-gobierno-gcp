# 💳 Módulo 9: Facturación, Presupuestos y Control de Cuotas GCP (FinOps)

Este módulo implementa el perfil y tablero del **Administrador del Billing y Cuotas GCP** en el Agente de Gobierno de Datos Inteligente.

---

## 🎯 Capacidades Principales
1. **Auditoría de Facturación Multi-Servicio:**
   - Desglose detallado por servicios centrales de GCP: BigQuery, Cloud Storage, Compute Engine, Vertex AI (Gemini), Cloud DLP / Dataplex DQ y Cloud Run.
   - Comparación de gasto acumulado frente al presupuesto mensual ($USD).
   - Pronósticos de cierre de mes (Forecast) y tasa de consumo (Burn Rate).

2. **Control y Monitor de Cuotas en Tiempo Real:**
   - Supervisión continua de cuotas críticas: BigQuery TB/día, Consultas concurrentes, vCPUs en us-central1, Discos SSD y throughput de Vertex AI / Cloud DLP.
   - Categorización visual según el sistema de diseño Google Cloud y colores pasteles (Verde <70%, Amarillo 70-85%, Rojo >85%).
   - Solicitud interactiva de aumento de cuota con auto-aprobación y persistencia.

3. **Consola SQL de Facturación y Consultas Oficiales de Google Cloud:**
   - Conexión nativa a la tabla de exportación: `gobiernodatos.facturacion.gcp_billing_export_v1_01D79A_F04D6B_3B368E`.
   - Implementación de los ejemplos oficiales de Google Cloud ([bq-examples](https://docs.cloud.google.com/billing/docs/how-to/bq-examples#sum-costs-per-invoice)):
     - **Ejemplo 1:** Suma de todos los costos por factura deduciendo créditos (`UNNEST(credits)` y `CAST(cost AS NUMERIC)`).
     - **Ejemplo 2:** Detalle por tipo de costo (`cost_type`: regular, tax, adjustment, rounding_error).
     - **Ejemplo 3:** Costos brutos vs netos por proyecto con créditos desglosados.
     - **Ejemplo 4:** Top servicios con mayor facturación neta.
     - **Ejemplo 5:** Agrupación y clasificación por etiquetas de recursos (`UNNEST(labels)`).
     - **Ejemplo 6:** Tendencia diaria de consumo cronológico por servicio.
   - Editor interactivo SQL con validación previa (*Dry Run*), cálculo de bytes procesados y exportación a CSV.

4. **Recomendaciones FinOps de Ahorro:**
   - Detección de tablas BigQuery sin particionamiento.
   - Transición de políticas de ciclo de vida (Lifecycle Rules) en Cloud Storage a Nearline.
   - Detección y depuración de discos persistentes huérfanos.
   - Ajuste de auto-scaling a 0 en endpoints de Vertex AI.
   - Posibilidad de aplicar recomendaciones interactivamente con recálculo de forecast.

5. **Persistencia en Google Cloud Firestore:**
   - Colección `governance_profiles`: Documento `administrador_billing`.
   - Colección `governance_users`: Usuario `billing@empresa.com`.
   - Colección `governance_billing_real`: Resumen y desglose de proyectos y servicios en BigQuery.
   - Colección `governance_quotas`: Registro de cuotas rastreadas y límites.
   - Colección `governance_quotas_requests`: Bitácora de solicitudes de incremento de cuota.

