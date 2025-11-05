# Usar una imagen base de Node.js
FROM node:18-alpine

# Establecer la carpeta de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install --production

# Copiar el código de la aplicación (server.js, .env, etc.)
COPY . .

# Exponer el puerto (8080)
EXPOSE 8080 

# Comando para iniciar el servidor
CMD ["node", "server.js"]