// ms-valoraciones-nodejs/server.js

const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
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
    console.error("FATAL ERROR: DATABASE_URL no está definida en el .env.");
    process.exit(1);
}

mongoose.connect(DATABASE_URL)
  .then(() => console.log('Conexión exitosa a MongoDB.'))
  .catch(err => console.error('ERROR DE CONEXIÓN A MONGODB:', err));


// ----------------------------------------------------
// 2. MODELO DE DATOS (Mongoose Schema)
// ----------------------------------------------------

const valoracionSchema = new mongoose.Schema({
    receta_id: { type: String, required: true, index: true }, // Indexado para búsquedas rápidas
    puntuacion: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, required: false },
    fecha: { type: Date, default: Date.now }
});

const Valoracion = mongoose.model('Valoracion', valoracionSchema);


// ----------------------------------------------------
// 3. ENDPOINTS
// ----------------------------------------------------

// Endpoint de Persistencia: Creación de Valoración (POST)
app.post('/valoraciones/:recetaId', async (req, res) => {
    try {
        const { puntuacion, comentario } = req.body;
        const receta_id = req.params.recetaId;

        if (!puntuacion || puntuacion < 1 || puntuacion > 5) {
            return res.status(400).json({ message: "La puntuación debe ser un número entre 1 y 5." });
        }

        const nuevaValoracion = new Valoracion({
            receta_id,
            puntuacion,
            comentario: comentario || ""
        });

        await nuevaValoracion.save();
        res.status(201).json({ message: "Valoración creada con éxito.", data: nuevaValoracion });

    } catch (error) {
        console.error("Error al crear valoración:", error);
        res.status(500).json({ message: "Error interno al guardar la valoración en MongoDB." });
    }
});

// --- Endpoint: Obtener todas las valoraciones para una receta (GET) ---
app.get('/valoraciones/:recetaId', async (req, res) => {
    try {
        const receta_id = req.params.recetaId;
        
        // Busca todas las valoraciones para el ID de receta dado, ordenadas por fecha descendente
        const valoraciones = await Valoracion.find({ receta_id: receta_id })
                                             .sort({ fecha: -1 });

        // Devuelve el array de valoraciones
        res.json(valoraciones);

    } catch (error) {
        console.error("Error al obtener valoraciones:", error);
        res.status(500).json({ message: "Error interno al recuperar las valoraciones." });
    }
});

// Endpoint de Agregación: Obtener Media de Puntuación (GET)
app.get('/valoraciones/:recetaId/media', async (req, res) => {
    try {
        const receta_id = req.params.recetaId;

        // Lógica de Agregación de MongoDB: Calcula la media ($avg)
        const resultado = await Valoracion.aggregate([
            // 1. Filtrar solo las valoraciones para esta receta
            { $match: { receta_id: receta_id } },
            // 2. Agrupar todas las valoraciones restantes y calcular la media
            { $group: {
                _id: null,
                average_rating: { $avg: '$puntuacion' }
            }}
        ]);

        if (resultado.length > 0) {
            // Si hay resultados, devuelve la media
            const average_rating = parseFloat(resultado[0].average_rating.toFixed(2));
            res.json({ receta_id, average_rating });
        } else {
            // Si no hay valoraciones para esta receta, devuelve 0
            res.json({ receta_id, average_rating: 0 });
        }

    } catch (error) {
        console.error("Error en la agregación de media:", error);
        res.status(500).json({ message: "Error en el cálculo de la media de valoración." });
    }
});


app.listen(PORT, () => {
    console.log(`MS Valoraciones corriendo en el puerto ${PORT}`);
});