# Usar una imagen base de Node.js
FROM node:18-alpine

# Establecer la carpeta de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias (solo producción)
RUN npm install --production

# Copiar el código de la aplicación (server.js)
COPY . .

# Exponer el puerto (3000)
EXPOSE 3000 

# Comando para iniciar el servidor
CMD ["node", "server.js"]