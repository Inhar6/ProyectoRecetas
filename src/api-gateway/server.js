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
// --- ENDPOINTS ---
// ----------------------------------------------------------------------------------


// --- ENDPOINT PRINCIPAL: Agregación de Datos (GET /recetas) ---
app.get('/api/v1/recetas', async (req, res) => {
    try {
        // 1. Obtener Recetas (Catálogo)
        const recetasResponse = await axios.get(`${MS_CATALOGO_URL}/recetas`);
        const recetas = recetasResponse.data;
        
        let valoraciones = [];
        
        // 2. Obtener Valoraciones (MS Valoraciones) - Envuelto en try/catch (ROBUSTEZ)
        try {
            const valoracionesResponse = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/promedio`);
            valoraciones = valoracionesResponse.data;
        } catch (valoracionesError) {
            // ADVERTENCIA: Si Valoraciones falla, el sistema NO colapsa.
            console.error("ADVERTENCIA: Falló la conexión/obtención de valoraciones. Continuando sin valoraciones.", valoracionesError.message);
            // 'valoraciones' se queda como array vacío []
        }
        
        // 3. Agregación de Datos y Saneamiento (FIX para el error toLowerCase)
        const recetas_agregadas = recetas.map(receta => {
            const rating = valoraciones.find(v => v.recetaId === receta.receta_id);
            
            // SANEAMIENTO: Aseguramos que los campos clave sean siempre cadenas de texto
            // Esto evita el error 'Cannot read properties of undefined' en el Frontend.
            const safe_receta = {
                ...receta,
                nombre: receta.nombre || '', 
                ingredientes: receta.ingredientes || '', 
                instrucciones: receta.instrucciones || '', 
                categoria: receta.categoria || '', 
                
                promedio: rating ? rating.promedio : 0, 
                total_votos: rating ? rating.total_votos : 0
            };

            return safe_receta;
        });

        res.status(200).json(recetas_agregadas);
        
    } catch (error) {
        // Main catch solo se activa si falla el MS Catálogo
        console.error("ERROR CRÍTICO: Fallo al contactar al Microservicio de Catálogo.", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Fallo de conexión al Catálogo o error interno." };
        res.status(status).json(message);
    }
});


// --- ENDPOINT DETALLE: Obtener Receta por ID (GET /recetas/:id) ---
app.get('/api/v1/recetas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Obtener Receta (Catálogo)
        const recetaResponse = await axios.get(`${MS_CATALOGO_URL}/recetas/${id}`);
        let receta = recetaResponse.data;

        // 2. Obtener Valoraciones (Valoraciones) - Envuelto en try/catch
        try {
            const valoracionResponse = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/promedio/${id}`);
            const rating = valoracionResponse.data;
            receta = {
                ...receta,
                promedio: rating.promedio,
                total_votos: rating.total_votos
            };
        } catch (valoracionesError) {
            console.error(`ADVERTENCIA: No se pudo obtener la valoración para ${id}.`, valoracionesError.message);
            receta = { ...receta, promedio: 0, total_votos: 0 };
        }

        // 3. Saneamiento de Datos
        // Aseguramos que los campos clave sean siempre cadenas de texto
        receta.nombre = receta.nombre || '';
        receta.categoria = receta.categoria || '';
        receta.ingredientes = receta.ingredientes || ''; // Esto ya es un array en la BD de Catálogo, pero lo mantenemos por seguridad.


        res.status(200).json(receta);

    } catch (error) {
        console.error("Error al redireccionar detalle de receta:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Catálogo." };
        res.status(status).json(message);
    }
});

// --- ENDPOINT INGESTA: Cargar datos iniciales (POST /api/v1/admin/cargar_datos) ---
app.post('/api/v1/admin/cargar_datos', async (req, res) => {
    try {
        // Redirecciona la petición POST al Microservicio de Catálogo para iniciar la ingesta
        const response = await axios.post(`${MS_CATALOGO_URL}/admin/cargar_datos`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar ingesta de datos:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Catálogo para la ingesta." };
        res.status(status).json(message);
    }
});


// --- ENDPOINT: Obtener lista de Valoraciones (GET /api/v1/valoraciones/:recetaId) ---
app.get('/api/v1/valoraciones/:recetaId', async (req, res) => {
    try {
        const recetaId = req.params.recetaId;
        // Redirige al MS-Valoraciones para obtener la lista de comentarios
        const response = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/${recetaId}`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar obtención de valoraciones:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Valoraciones para obtener comentarios." };
        res.status(status).json(message);
    }
});

// --- ENDPOINT: Obtener Media de Puntuación (GET /api/v1/valoraciones/:recetaId/media) ---
app.get('/api/v1/valoraciones/:recetaId/media', async (req, res) => {
    try {
        const recetaId = req.params.recetaId;
        // Redirige al MS-Valoraciones, que usa la URL /valoraciones/:recetaId/media
        const response = await axios.get(`${MS_VALORACIONES_URL}/valoraciones/${recetaId}/media`);
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar obtención de media de valoración:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Valoraciones para obtener la media." };
        res.status(status).json(message);
    }
});


// 🌟 CRÍTICO: ENDPOINT AÑADIDO PARA LA CREACIÓN DE VALORACIONES (FIX) 🌟
// --- ENDPOINT: CREAR VALORACIÓN (POST /api/v1/valoraciones) ---
app.post('/api/v1/valoraciones', async (req, res) => {
    try {
        // Redirecciona la petición POST (con el cuerpo JSON en req.body) al Microservicio de Valoraciones
        // URL: http://ms-valoraciones-nodejs:3000/valoraciones
        const response = await axios.post(
            `${MS_VALORACIONES_URL}/valoraciones`, 
            req.body // CRÍTICO: Se pasa el cuerpo (body) de la petición
        );
        // Devuelve la respuesta del microservicio al cliente
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar creación de valoración:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Valoraciones para la creación." };
        res.status(status).json(message);
    }
});
// 🌟 FIN DEL FIX 🌟


// --- ENDPOINT: CREAR RECETA (POST /api/v1/recetas) ---
app.post('/api/v1/recetas', async (req, res) => {
    try {
        // Redirecciona la petición POST (con el cuerpo JSON en req.body) al Microservicio de Catálogo
        // URL: http://ms-catalogo-py:5000/recetas
        const response = await axios.post(
            `${MS_CATALOGO_URL}/recetas`, 
            req.body // Es CRÍTICO pasar req.body para enviar los datos de la receta
        );
        // Devuelve la respuesta del microservicio al cliente
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error("Error al redireccionar creación de receta:", error.message);
        const status = error.response ? error.response.status : 500;
        const message = error.response && error.response.data ? error.response.data : { message: "Error al intentar contactar al Microservicio de Catálogo para la creación." };
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
    console.log(`API Gateway escuchando en puerto ${GATEWAY_PORT}`);
});