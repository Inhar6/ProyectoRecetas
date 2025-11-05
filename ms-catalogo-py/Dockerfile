# Usar una imagen base ligera de Python
FROM python:3.11-slim

# Establecer la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiar el archivo de dependencias y la carpeta data-externa
COPY requirements.txt .
# Necesario para la ingesta de datos y el .env
# Hemos quitado la linea 'COPY ../data-externa ./data-externa' que fallaba.
# La carpeta 'data-externa' será montada mediante volumenes en docker-compose.yml

# Instalar las dependencias
# El flag --no-cache-dir reduce el tamaño final de la imagen
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el código del microservicio
COPY app.py .

# Exponer el puerto de Flask (5000)
EXPOSE 5000

# Comando para iniciar el servidor de Flask (usando python)
CMD ["python", "app.py"]