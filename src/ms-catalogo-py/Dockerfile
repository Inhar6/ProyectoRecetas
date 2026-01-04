# Usar una imagen base ligera de Python
FROM python:3.11-slim

# Establecer la carpeta de trabajo dentro del contenedor
WORKDIR /app

# === CORRECCIÓN CRÍTICA: Instalar CURL para el Healthcheck ===
# Esto asegura que el healthcheck definido en docker-compose.yml pueda ejecutarse.
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
# ============================================================

# 1. Copiar solo el archivo de dependencias (para aprovechar el cache de Docker)
COPY requirements.txt .

# 2. Instalar las dependencias
# El flag --no-cache-dir reduce el tamaño final de la imagen
RUN pip install --no-cache-dir -r requirements.txt

# 3. Copiar el código de la aplicación y el archivo de entorno
COPY app.py .
COPY .env .

# Exponer el puerto de Flask (5000)
EXPOSE 5000

# Comando para iniciar el servidor de Flask (usando python)
CMD ["python", "app.py"]