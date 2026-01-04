// ms-valoraciones-nodejs/server.js

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
// Carga las variables de entorno desde el .env.
require('dotenv').config({ path: path.resolve(__dirname, './.env') }); 

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;

// Middleware para parsear JSON
app.use(express.json());

// ----------------------------------------------------
// 1. CONEXIÓN A MONGODB
// ----------------------------------------------------

if (!DATABASE_URL) {
    console.error("FATAL ERROR: DATABASE_URL no está definida.");
    process.exit(1);
}

// Intentamos la conexión
mongoose.connect(DATABASE_URL)
  .then(() => console.log('Conexión exitosa a MongoDB.'))
  .catch(err => {
    // Si la conexión falla, imprimimos el error completo.
    console.error('ERROR DE CONEXIÓN A MONGODB:', err);
    process.exit(1);
  });


// ----------------------------------------------------
// 2. MODELO DE DATOS (Mongoose Schema)
// ----------------------------------------------------

const valoracionSchema = new mongoose.Schema({
    receta_id: { type: String, required: true, index: true }, 
    puntuacion: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, required: false },
    fecha: { type: Date, default: Date.now },
});

// Especificamos explícitamente el nombre de la colección: 'valoraciones'
const Valoracion = mongoose.model('Valoracion', valoracionSchema, 'valoraciones');

// ----------------------------------------------------
// 3. ENDPOINTS
// ----------------------------------------------------

// Endpoint de Creación de Valoración (POST /valoraciones)
app.post('/valoraciones', async (req, res) => {
    try {
        const { receta_id, puntuacion, comentario } = req.body;
        
        // Validación básica de campos requeridos
        if (!receta_id || puntuacion === undefined || puntuacion === null) {
            return res.status(400).json({ message: 'receta_id y puntuacion son campos requeridos.' });
        }
        
        // Creamos la instancia del modelo. Mongoose valida el tipo de dato.
        const nuevaValoracion = new Valoracion({
            receta_id: receta_id.toString(),
            puntuacion: parseInt(puntuacion),
            comentario: comentario || '',
        });
        
        // Intentamos guardar en la base de datos
        await nuevaValoracion.save();
        
        // Respuesta exitosa
        res.status(201).json(nuevaValoracion);

    } catch (error) {
        // Logueamos el error EXACTO para el diagnóstico
        console.error("ERROR CRÍTICO AL GUARDAR EN MONGODB:", error);
        
        // Si es un error de Mongoose por validación (ej. puntuacion > 5 o tipo incorrecto)
        if (error.name === 'ValidationError') {
            // Devolvemos 400 Bad Request
            return res.status(400).json({ message: `Error de Validación: ${error.message}` });
        }
        
        // Para cualquier otro error (ej. permisos de escritura fallidos, error de disco, etc.)
        res.status(500).json({ message: "Error interno al intentar guardar. Verifique el log 'ERROR CRÍTICO AL GUARDAR EN MONGODB' en el contenedor." });
    }
});


// Endpoint para obtener todas las valoraciones de una receta (GET /valoraciones/:recetaId)
app.get('/valoraciones/:recetaId', async (req, res) => {
    try {
        const receta_id = req.params.recetaId;
        const valoraciones = await Valoracion.find({ receta_id }).sort({ fecha: -1 });
        res.json(valoraciones);
    } catch (error) {
        console.error("Error al obtener valoraciones:", error);
        res.status(500).json({ message: "Error interno al recuperar las valoraciones." });
    }
});

// Endpoint de Agregación: Obtener Media de Puntuación (GET /valoraciones/:recetaId/media)
app.get('/valoraciones/:recetaId/media', async (req, res) => {
    try {
        const receta_id = req.params.recetaId;

        const resultado = await Valoracion.aggregate([
            { $match: { receta_id: receta_id } },
            { $group: {
                _id: null,
                average_rating: { $avg: '$puntuacion' }
            }}
        ]);

        if (resultado.length > 0) {
            const average_rating = parseFloat(resultado[0].average_rating.toFixed(2));
            res.json({ receta_id, average_rating });
        } else {
            res.json({ receta_id, average_rating: 0 });
        }

    } catch (error) {
        console.error("Error en la agregación de media:", error);
        res.status(500).json({ message: "Error interno al calcular la media de valoración." });
    }
});


// ----------------------------------------------------
// 4. INICIO DEL SERVIDOR
// ----------------------------------------------------
app.listen(PORT, () => {
    console.log(`Microservicio de Valoraciones escuchando en puerto ${PORT}`);
});