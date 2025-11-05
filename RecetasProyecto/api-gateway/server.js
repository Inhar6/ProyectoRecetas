// api-gateway/server.js

const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') }); 

const app = express();
const GATEWAY_PORT = process.env.PORT || 8080;
const MS_CATALOGO_URL = process.env.MS_CATALOGO_URL;
const MS_VALORACIONES_URL = process.env.MS_VALORACIONES_URL;

// --- CONFIGURACIÓN CRÍTICA ---
app.use(express.json());

const FRONTEND_PATH = path.resolve(__dirname, '../frontend');
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
        const recetasResponse = await axios.get(`${MS_CATALOGO_URL}/recetas`);
        const recetas = recetasResponse.data;
        
        const valoracionesResponse = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/medias`);
        const mediasValoraciones = valoracionesResponse.data; 
        
        const recetasConRating = recetas.map(receta => {
            const ratingData = mediasValoraciones.find(m => m.receta_id === receta.receta_id);
            receta.average_rating = ratingData ? parseFloat(ratingData.average_rating.toFixed(1)) : null;
            return receta;
        });

        res.status(200).json(recetasConRating);

    } catch (error) {
        console.error("Error en la agregación de /api/v1/recetas:", error.message);
        res.status(500).json({ message: "Error al orquestar la agregación de datos de recetas." });
    }
});


// --- NUEVA RUTA: Crear Receta (POST /recetas) ---
app.post('/api/v1/recetas', async (req, res) => {
    try {
        // Redirecciona la petición POST al MS de Catálogo
        const response = await axios.post(`${MS_CATALOGO_URL}/recetas`, req.body);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar creación de receta:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Catálogo." };
        res.status(status).json(message);
    }
});

// --- RUTA PROXY: Enviar Valoración (POST /valoraciones/:recetaId) ---
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

// --- RUTA PROXY: Obtener TODAS las Valoraciones de una Receta (GET /valoraciones/:recetaId) ---
app.get('/api/v1/valoraciones/:recetaId', async (req, res) => {
    try {
        const recetaId = req.params.recetaId;
        const response = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/${recetaId}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error(`Error al obtener valoraciones para ${req.params.recetaId}:`, error.message);
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
    console.log(`API Gateway escuchando en el puerto ${GATEWAY_PORT}`);
});