# 🥘 RecetasProyecto: Microservicios Demo

[![Estado de CI](https://github.com/Inhar6/ProyectoRecetas/actions/workflows/main.yml/badge.svg)](https://github.com/Inhar6/ProyectoRecetas/actions/workflows/main.yml)

Este proyecto implementa una arquitectura de microservicios utilizando Docker Compose, con un Microservicio de Catálogo (Python + PostgreSQL) y un Microservicio de Valoraciones (Node.js + MongoDB), orquestados por un API Gateway.

---

## 0️⃣ Requisitos Previos (Software Necesario)

Para arrancar el proyecto, solo necesitas instalar y configurar el siguiente software en tu sistema operativo:

* ** Docker:** Motor de contenedores necesario para construir y ejecutar todos los microservicios y bases de datos.
    * *Instalación:* Se recomienda instalar **Docker Desktop**.
* ** Docker Compose:** Herramienta para definir y ejecutar aplicaciones multi-contenedor.
    * *Nota:* Suele venir integrado con Docker Desktop.
* **Git (Opcional):** Necesario si clonas el repositorio desde un servicio como GitHub/GitLab.

---

## 1️⃣ Arquitectura y Servicios

El proyecto se compone de los siguientes contenedores interconectados, definidos en `docker-compose.yml`:

| Servicio | Tipo | Puerto Externo | Descripción |
| :--- | :--- | :--- | :--- |
| `api-gateway` | Node.js (Express) | `8080` | Punto de entrada único. Sirve el Frontend y redirige las peticiones a los MS. |
| `ms-catalogo-py` | Python (Flask) | `5000` | Microservicio de recetas. Maneja la lógica de negocio y la ingesta de datos. |
| `ms-valoraciones-nodejs` | Node.js | `3000` | Microservicio de valoraciones. |
| `ms-recetas-db` | PostgreSQL | `5432` | Base de datos relacional para el Catálogo de Recetas. |
| `ms-valoraciones-db` | MongoDB | `27017` | Base de datos NoSQL para las Valoraciones. |

---

## 2️⃣ Dependencias Locales (¡No Requerido!)

**¡Buena noticia!** Gracias al uso de **Docker**, no necesitas instalar manualmente ninguna dependencia de Node.js (`npm install`) o Python (`pip install`) en tu máquina local.

* El **`Dockerfile`** de cada microservicio se encarga de instalar las dependencias necesarias (ej: `axios` para Node.js, `pandas` y `psycopg2` para Python) *dentro* de su respectivo contenedor durante la fase de construcción.

---

## 3️⃣ Proceso de Arranque Servidor

Para construir, orquestar y arrancar todos los servicios en segundo plano, utiliza el siguiente comando en el directorio raíz del proyecto (donde se encuentra `docker-compose.yml`):

docker compose up --build -d

## 4️⃣ Acceso a la Parte Cliente

Una vez que todos los contenedores estén activos y estables:

### 4.1. Acceso a la Interfaz Web (Cliente)

Abre tu navegador web y accede al puerto del **API Gateway** para ver la aplicación:

| Componente | Acceso | URL/Acción |
| :--- | :--- | :--- |
| **Frontend** | Interfaz web | `http://localhost:8080` |
| **Ingesta de datos** | Botón de la interfaz | Clic en **"Cargar Datos"** |

### 4.2. Pasos para Cargar Datos

La base de datos de recetas (`ms-recetas-db`) comienza vacía. Debes realizar la ingesta de los datos de prueba mediante la interfaz:

1.  Asegúrate de que `ms-catalogo-py` está **`healthy`**.
2.  Haz clic en el botón **"Cargar Datos"** en la interfaz web.
3.  Si la ingesta es exitosa, las recetas aparecerán en la lista principal.

---

## 🗑️ Comandos Útiles

| Comando | Función | Notas |
| :--- | :--- | :--- |
| `docker compose stop` | Detiene los contenedores (no los elimina). | Los datos de PostgreSQL y MongoDB **persisten**. |
| `docker compose restart [servicio]` | Reinicia un servicio específico (ej: `ms-catalogo-py`). | Rápido para aplicar cambios de código. |
| `docker compose down` | Detiene y elimina los contenedores y redes. | Los datos **persisten** (volúmenes quedan en Docker). |
| `docker compose down -v` | **¡Limpieza Total!** Detiene y elimina contenedores, redes **y volúmenes de datos**. | **CRÍTICO** para reiniciar las bases de datos desde cero (esquema limpio). |
