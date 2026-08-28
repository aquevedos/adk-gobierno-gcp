# ==============================================================================
# 🛡️ DOCKERFILE PARA DESPLIEGUE SERVERLESS EN GOOGLE CLOUD RUN
# ==============================================================================

FROM python:3.11-slim

# Evitar escritura de bytecode y forzar stdout sin buffer
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Instalar utilidades del sistema necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código fuente completo de la plataforma
COPY . .

# Puerto expuesto por Cloud Run por defecto
ENV PORT=8080
EXPOSE 8080

# Ejecutar el servidor uvicorn sirviendo la aplicación FastAPI
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8080"]
