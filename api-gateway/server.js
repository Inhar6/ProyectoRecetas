// api-gateway/server.js

const express = require('express');
const axios = require('axios');
const path = require('path');
// Se asegura de cargar el .env correctamente, sin importar dónde se ejecute
require('dotenv').config({ path: path.resolve(__dirname, './.env') }); 

const app = express();
const GATEWAY_PORT = process.env.PORT || 8080;
const MS_CATALOGO_URL = process.env.MS_CATALOGO_URL;
const MS_VALORACIONES_URL = process.env.MS_VALORACIONES_URL;

// --- CONFIGURACIÓN CRÍTICA ---
// Middleware para parsear el cuerpo de las peticiones JSON (necesario para POST)
app.use(express.json());

// 1. CORRECCIÓN DE RUTA ESTÁTICA: 
// '__dirname' es '/app'. Buscamos en './frontend' -> '/app/frontend'.
// CORRECCIÓN CRÍTICA: Apuntamos a la carpeta 'frontend' dentro de '/app'.
const FRONTEND_PATH = path.resolve(__dirname, 'frontend'); 
// ANTES ERA: const FRONTEND_PATH = path.resolve(__dirname, '../frontend'); // <--- ¡Asegúrate de que esta línea NO esté activa!
console.log(`Sirviendo archivos estáticos desde: ${FRONTEND_PATH}`);
app.use(express.static(FRONTEND_PATH)); 
// ----------------------------------------------------------------------------------

console.log(`URL Catálogo: ${MS_CATALOGO_URL}`);
console.log(`URL Valoraciones: ${MS_VALORACIONES_URL}`);

// ----------------------------------------------------------------------------------
// --- ENDPOINTS DE AGREGACIÓN Y PROXY ---
// ----------------------------------------------------------------------------------

// --- ENDPOINT PRINCIPAL: Agregación de Datos (GET /recetas) ---
app.get('/api/v1/recetas', async (req, res) => {
    try {
        // 1. LLamada a Python (Catálogo): Obtener recetas base
        const recetasResponse = await axios.get(`${MS_CATALOGO_URL}/recetas`);
        const recetas = recetasResponse.data;

        // Si no hay recetas, devolver una lista vacía para no fallar
        if (recetas.length === 0) {
            return res.status(200).json([]);
        }

        // 2. LLamada a Node.js (Valoraciones): Obtener medias
        // Creamos un array de IDs para la petición
        const recetaIds = recetas.map(r => r.receta_id);
        const valoracionesResponse = await axios.post(`${MS_VALORACIONES_URL}/valoraciones/medias`, {
            receta_ids: recetaIds
        });
        const valoracionesMap = valoracionesResponse.data; // { 'REC001': 4.5, ... }

        // 3. Agregación: Combinar los datos
        const recetasAgregadas = recetas.map(receta => {
            const media = valoracionesMap[receta.receta_id] || null;
            return {
                ...receta,
                average_rating: media,
            };
        });

        res.status(200).json(recetasAgregadas);

    } catch (error) {
        console.error("Error al orquestar /recetas:", error.message);
        // Si el Catálogo o Valoraciones no responden, el Gateway devuelve 500
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error de orquestación en el Gateway." };
        res.status(status).json(message);
    }
});

// --- ENRUTAMIENTO PROXY: Enviar Valoración (POST /valoraciones/:recetaId) ---
app.post('/api/v1/valoraciones/:recetaId', async (req, res) => {
    try {
        const recetaId = req.params.recetaId;
        const response = await axios.post(`${MS_VALORACIONES_URL}/valoraciones/${recetaId}`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar valoración:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Valoraciones." };
        res.status(status).json(message);
    }
});

// --- ENRUTAMIENTO DIRECTO: Detalle de Receta (GET /recetas/:recetaId) ---
app.get('/api/v1/recetas/:recetaId', async (req, res) => {
    try {
        const recetaId = req.params.recetaId;
        const response = await axios.get(`${MS_CATALOGO_URL}/recetas/${recetaId}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Error al redireccionar detalle para ${req.params.recetaId}:`, error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "No se pudo contactar al Microservicio de Catálogo o la receta no existe." };
        res.status(status).json(message);
    }
});


// --- ENDPOINT ADMIN: Cargar Datos (POST /admin/cargar_datos) ---
app.post('/api/v1/admin/cargar_datos', async (req, res) => {
    try {
        const response = await axios.post(`${MS_CATALOGO_URL}/admin/cargar_datos`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar carga de datos:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Catálogo para la ingesta." };
        res.status(status).json(message);
    }
});


// Ruta Catch-all para el Frontend (SPA)
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, 'index.html'));
});


// ----------------------------------------------------------------------------------
// --- INICIO DEL SERVIDOR ---
// ----------------------------------------------------------------------------------

app.listen(GATEWAY_PORT, () => {
    console.log(`🚀 API Gateway corriendo en el puerto ${GATEWAY_PORT}`);
    console.log('----------------------------------------------------------------');
});