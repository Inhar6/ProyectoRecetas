// Almacena todas las recetas cargadas para permitir el filtrado en el cliente
let allRecetas = [];
// Almacena el ID de la receta actualmente abierta para el formulario
let currentRecipeId = null;

// Elementos del DOM para la gestión de estados
const listContainer = document.getElementById('recetas-list');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const ingestaStatusElement = document.getElementById('ingesta-status');
const loadDataButton = document.getElementById('load-data-btn');

// Elementos del DOM para el Modal
const modal = document.getElementById('recipe-modal');
const modalCloseBtn = document.querySelector('.close');
const modalTitle = document.getElementById('modal-title');
const modalId = document.getElementById('modal-id');
const modalTiempo = document.getElementById('modal-tiempo');
const modalDificultad = document.getElementById('modal-dificultad');
const modalDescription = document.getElementById('modal-description');
const modalIngredientes = document.getElementById('modal-ingredientes');
const modalAvgRating = document.getElementById('modal-avg-rating'); // Nuevo elemento

// Elementos del DOM para el Formulario de Creación
const creationFormContainer = document.getElementById('creation-form-container'); // Referencia corregida
const toggleIcon = document.getElementById('toggle-icon');

// -----------------------------------------------------------------------
// INICIALIZACIÓN
// -----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar todas las recetas al inicio
    loadRecetas();
    
    // 2. Asigna evento de submit al formulario de valoración
    document.getElementById('rating-form').addEventListener('submit', handleRatingSubmit);
    
    // 3. Asigna evento al input de búsqueda (filtrado en tiempo real)
    searchInput.addEventListener('input', filterRecetas);

    // 4. Asigna evento al botón de carga de datos
    loadDataButton.addEventListener('click', handleDataIngestion);

    // 5. Asigna eventos para el formulario de creación
    document.getElementById('toggle-creation-form').addEventListener('click', toggleCreationForm);
    document.getElementById('create-recipe-form').addEventListener('submit', handleRecipeCreation);

    // 6. Asigna eventos para cerrar el modal
    modalCloseBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
});

// -----------------------------------------------------------------------
// FUNCIONES DE CARGA Y RENDERIZADO DE RECETAS
// -----------------------------------------------------------------------

/**
 * Carga todas las recetas desde el Microservicio de Catálogo a través del Gateway.
 */
async function loadRecetas() {
    statusMessage.textContent = 'Cargando recetas...';
    try {
        const response = await fetch('/api/v1/recetas');
        const data = await response.json();
        
        if (response.ok) {
            allRecetas = data; // Almacena la lista completa
            renderRecetas(allRecetas);
            statusMessage.textContent = `Se han cargado ${allRecetas.length} recetas.`;
        } else {
            statusMessage.textContent = `❌ Error al cargar recetas: ${data.message || 'Fallo desconocido.'}`;
        }
    } catch (error) {
        console.error('Error de red al cargar recetas:', error);
        statusMessage.textContent = '❌ Error de red: No se pudo conectar al Microservicio de Catálogo.';
    }
}

/**
 * Renderiza la lista de recetas en el contenedor principal.
 * @param {Array} recetas - Array de objetos receta a renderizar.
 */
function renderRecetas(recetas) {
    listContainer.innerHTML = ''; // Limpia la lista anterior
    if (recetas.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500">No se encontraron recetas.</p>';
        return;
    }

    recetas.forEach(receta => {
        // Formatea los ingredientes para mostrar solo los 3 primeros si hay muchos
        const ingredientesTexto = Array.isArray(receta.ingredientes) 
            ? receta.ingredientes.slice(0, 3).join(', ') + (receta.ingredientes.length > 3 ? '...' : '')
            : 'N/A';
            
        const card = document.createElement('div');
        card.className = 'bg-white p-6 border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition duration-300 cursor-pointer';
        card.innerHTML = `
            <h2 class="text-2xl font-bold text-indigo-600 mb-2">${receta.titulo}</h2>
            <p class="text-gray-700 mb-3 line-clamp-2">${receta.descripcion}</p>
            <p class="text-sm text-gray-500 mb-2"><span class="font-semibold">Tiempo:</span> ${receta.tiempo_preparacion} min</p>
            <p class="text-sm text-gray-500 mb-4"><span class="font-semibold">Ingredientes clave:</span> ${ingredientesTexto}</p>
            <button class="view-details-btn bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-1 px-3 rounded-lg transition duration-200" 
                    data-id="${receta.id}">Ver Detalle y Valorar</button>
        `;
        // Asigna el evento click al botón de ver detalle
        card.querySelector('.view-details-btn').addEventListener('click', () => {
            openModal(receta.id);
        });
        listContainer.appendChild(card);
    });
}

/**
 * Filtra las recetas en base al texto introducido en el campo de búsqueda.
 */
function filterRecetas() {
    const searchTerm = searchInput.value.toLowerCase();
    
    const filteredRecetas = allRecetas.filter(receta => {
        // Busca en el título y en los ingredientes
        const titleMatch = receta.titulo.toLowerCase().includes(searchTerm);
        
        const ingredientsMatch = Array.isArray(receta.ingredientes) && 
                                 receta.ingredientes.some(ing => ing.toLowerCase().includes(searchTerm));
        
        return titleMatch || ingredientsMatch;
    });

    renderRecetas(filteredRecetas);
}


// -----------------------------------------------------------------------
// FUNCIONES DE MODAL Y VALORACIÓN
// -----------------------------------------------------------------------

/**
 * Convierte un score numérico a una cadena de estrellas HTML.
 * @param {number} score - Puntuación (1 a 5).
 * @returns {string} HTML con estrellas.
 */
function renderStars(score) {
    const fullStar = '★';
    const emptyStar = '☆';
    const roundedScore = Math.round(score); // Redondea para mostrar estrellas completas
    let stars = '';

    for (let i = 1; i <= 5; i++) {
        stars += (i <= roundedScore) 
            ? `<span class="text-yellow-500">${fullStar}</span>` 
            : `<span class="text-gray-300">${emptyStar}</span>`;
    }
    return stars;
}

/**
 * Renderiza la lista de valoraciones y la puntuación media en el modal.
 * @param {Array} ratings - Lista de objetos valoración.
 * @param {number} avgRating - Puntuación media.
 */
function renderRatings(ratings, avgRating) {
    const ratingsList = document.getElementById('modal-ratings-list');
    const noCommentsMessage = document.getElementById('no-comments-message');
    
    // 1. RENDERIZAR PUNTUACIÓN MEDIA
    if (avgRating !== null) {
        const starHtml = renderStars(avgRating);
        modalAvgRating.innerHTML = `Puntuación Media: ${starHtml} (${avgRating.toFixed(2)} / 5)`;
    } else {
        modalAvgRating.textContent = `Puntuación Media: Sin valoraciones.`;
    }

    // 2. RENDERIZAR COMENTARIOS
    ratingsList.innerHTML = '';
    
    if (ratings.length === 0) {
        ratingsList.innerHTML = '<p class="text-gray-500 text-center">No hay comentarios para esta receta. ¡Sé el primero!</p>';
        return;
    }
    
    ratings.forEach(rating => {
        const item = document.createElement('div');
        item.className = 'border-b last:border-b-0 pb-3 mb-3';
        const stars = renderStars(rating.puntuacion);
        
        item.innerHTML = `
            <div class="flex justify-between items-center text-sm mb-1">
                <span class="font-bold">${stars}</span>
                <span class="text-gray-500">${new Date(rating.fecha).toLocaleDateString()}</span>
            </div>
            <p class="text-gray-700">${rating.comentario || 'Sin comentario.'}</p>
        `;
        ratingsList.appendChild(item);
    });

    // Asegurar que el mensaje de "no hay comentarios" no esté visible si hay ratings
    if (noCommentsMessage) noCommentsMessage.style.display = 'none';
}


/**
 * Carga las valoraciones y la media de puntuación para una receta.
 * @param {number} recetaId - ID de la receta.
 */
async function loadRatingsAndAverage(recetaId) {
    const ratingsList = document.getElementById('modal-ratings-list');
    ratingsList.innerHTML = '<p class="text-gray-500 text-center" id="no-comments-message">Cargando comentarios...</p>';
    modalAvgRating.textContent = 'Calculando media...';

    try {
        // Carga valoraciones y media en paralelo
        const [ratingsResponse, averageResponse] = await Promise.all([
            fetch(`/api/v1/valoraciones/${recetaId}`),
            fetch(`/api/v1/valoraciones/${recetaId}/media`)
        ]);

        // Manejo de las valoraciones (comentarios individuales)
        let ratings = [];
        if (ratingsResponse.ok) {
            ratings = await ratingsResponse.json();
        } else {
            console.error('Error al cargar comentarios:', await ratingsResponse.json());
        }

        // Manejo de la media de puntuación
        let avgRating = null;
        if (averageResponse.ok) {
            const avgData = await averageResponse.json();
            avgRating = avgData.average_rating;
        } else {
            console.error('Error al cargar la media de puntuación:', await averageResponse.json());
        }
        
        // Renderiza ambos resultados
        renderRatings(ratings, avgRating);

    } catch (error) {
        console.error('Error de red al cargar valoraciones/media:', error);
        ratingsList.innerHTML = '<p class="text-red-500 text-center">Error de red al cargar valoraciones.</p>';
        modalAvgRating.textContent = 'Puntuación Media: Error de carga.';
    }
}


/**
 * Muestra el modal con los detalles de la receta y sus valoraciones.
 * @param {number} recetaId - ID de la receta a mostrar.
 */
async function openModal(recetaId) {
    currentRecipeId = recetaId;
    modalTitle.textContent = 'Cargando...';
    // Ocultar contenido mientras carga
    document.getElementById('modal-content-loaded').style.display = 'none'; 
    modal.style.display = 'block';

    try {
        // 1. Cargar el detalle de la receta
        const response = await fetch(`/api/v1/recetas/${recetaId}`);
        const data = await response.json();

        if (response.ok) {
            // Rellenar detalles de la receta
            modalTitle.textContent = data.titulo;
            modalId.textContent = data.id;
            modalTiempo.textContent = `${data.tiempo_preparacion} min`;
            modalDificultad.textContent = data.dificultad;
            modalDescription.textContent = data.descripcion;
            
            // Rellenar lista de ingredientes
            modalIngredientes.innerHTML = '';
            if (Array.isArray(data.ingredientes)) {
                data.ingredientes.forEach(ing => {
                    const li = document.createElement('li');
                    li.textContent = ing;
                    modalIngredientes.appendChild(li);
                });
            } else {
                modalIngredientes.innerHTML = '<li>Información de ingredientes no disponible.</li>';
            }

            document.getElementById('modal-content-loaded').style.display = 'block';

            // 2. Cargar valoraciones y media
            await loadRatingsAndAverage(recetaId);

        } else {
            modalTitle.textContent = 'Receta No Encontrada';
            modalDescription.textContent = data.message || 'Error al obtener los detalles de la receta.';
        }
    } catch (error) {
        console.error('Error de red al cargar detalles de receta:', error);
        modalTitle.textContent = 'Error de Red';
        modalDescription.textContent = 'No se pudo conectar al Microservicio de Catálogo.';
    }
}

/**
 * Oculta el modal.
 */
function closeModal() {
    modal.style.display = 'none';
    currentRecipeId = null;
    document.getElementById('rating-form').reset(); // Limpiar formulario de valoración
    document.getElementById('rating-status').textContent = ''; // Limpiar estado
}


// -----------------------------------------------------------------------
// FUNCIONES DE FORMULARIO DE VALORACIÓN (CRÍTICO)
// -----------------------------------------------------------------------

/**
 * Maneja el envío del formulario de valoración.
 */
async function handleRatingSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const statusElement = document.getElementById('rating-status');

    if (!currentRecipeId) {
        statusElement.textContent = '❌ Error: ID de receta no definido.';
        return;
    }
    
    // **CORRECCIÓN CRÍTICA: Obtener el valor del radio button seleccionado**
    const scoreElement = form.elements['puntuacion'];
    if (!scoreElement.value) {
        statusElement.textContent = '❌ Por favor, selecciona una puntuación (1-5 estrellas).';
        return;
    }

    const ratingData = {
        receta_id: String(currentRecipeId), // Asegura que sea string para MongoDB
        puntuacion: parseInt(scoreElement.value),
        comentario: form.elements['comentario'].value // name="comentario" en el textarea
    };
    
    statusElement.textContent = 'Enviando valoración...';
    form.querySelector('button[type="submit"]').disabled = true;

    try {
        // 1. Llamada al endpoint de valoración a través del Gateway
        const response = await fetch('/api/v1/valoraciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData)
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `✅ Valoración de ${ratingData.puntuacion}/5 enviada con éxito.`;
            form.reset();
            
            // 2. Recargar el modal para mostrar la nueva valoración y media actualizada
            // Usamos setTimeout para dar tiempo a que el servicio de valoraciones termine de guardar.
            
            // ---------------------------------------------------------------
            // 🌟 ÚNICA MODIFICACIÓN APLICADA PARA RECARGAR EL MODAL 🌟
            // ---------------------------------------------------------------
            setTimeout(() => {
                // Reabrir el modal con el mismo ID para recargar los datos
                openModal(currentRecipeId); 
            }, 1000); 
            // ---------------------------------------------------------------

        } else {
            statusElement.textContent = `❌ Error: ${result.message || 'Fallo en la API.'}`;
        }
    } catch (error) {
        statusElement.textContent = `❌ Error de red: No se pudo contactar al Microservicio de Valoraciones.`;
        console.error('Error de red al enviar valoración:', error);
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
}


// -----------------------------------------------------------------------
// FUNCIONES DE INGESTA DE DATOS Y CREACIÓN
// -----------------------------------------------------------------------

/**
 * Maneja la carga inicial de datos de ingesta.
 */
async function handleDataIngestion() {
    ingestaStatusElement.textContent = 'Iniciando ingesta de datos...';
    loadDataButton.disabled = true;

    try {
        const response = await fetch('/api/v1/admin/cargar_datos', { method: 'POST' });
        const data = await response.json();

        if (response.ok) {
            ingestaStatusElement.textContent = `✅ ${data.message}`;
            // Recargar las recetas para ver los nuevos datos
            setTimeout(loadRecetas, 1500); 
        } else {
            ingestaStatusElement.textContent = `❌ Error en ingesta: ${data.message || 'Fallo desconocido.'}`;
        }
    } catch (error) {
        console.error('Error de red durante la ingesta:', error);
        ingestaStatusElement.textContent = '❌ Error de red: No se pudo contactar al Gateway para la ingesta.';
    } finally {
        loadDataButton.disabled = false;
    }
}


/**
 * Alterna la visibilidad del formulario de creación de recetas.
 */
function toggleCreationForm() {
    if (!creationFormContainer) {
        console.error("Error: El contenedor 'creation-form-container' no fue encontrado en el DOM.");
        return;
    }

    const isHidden = creationFormContainer.classList.contains('hidden');
    
    if (isHidden) {
        creationFormContainer.classList.remove('hidden');
        toggleIcon.classList.add('rotate-180');
    } else {
        creationFormContainer.classList.add('hidden');
        toggleIcon.classList.remove('rotate-180');
    }
}


/**
 * Maneja el envío del formulario de creación de nuevas recetas.
 */
async function handleRecipeCreation(e) {
    e.preventDefault();
    const form = e.target;
    const statusElement = document.getElementById('creation-status');
    
    // Obtener los ingredientes y convertirlos a un array (limpiando espacios)
    const ingredientesString = form.elements['ingredientes'].value;
    const ingredientesArray = ingredientesString.split(',').map(item => item.trim()).filter(item => item !== '');

    const recipeData = {
        titulo: form.elements['titulo'].value,
        descripcion: form.elements['descripcion'].value,
        tiempo_preparacion: parseInt(form.elements['tiempo_preparacion'].value),
        dificultad: form.elements['dificultad'].value,
        ingredientes: ingredientesArray // Lista de strings
    };
    
    statusElement.textContent = 'Creando receta...';
    form.querySelector('button[type="submit"]').disabled = true;

    try {
        // 1. Llamada al endpoint de creación a través del Gateway
        const response = await fetch('/api/v1/recetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `✅ Receta "${result.titulo}" creada con éxito.`;
            form.reset();
            
            // Recargar la lista de recetas para mostrar la nueva
            setTimeout(() => {
                loadRecetas(); 
            }, 1000); 

        } else {
            statusElement.textContent = `❌ Error: ${result.message || 'Fallo en la API.'}`;
        }

    } catch (error) {
        statusElement.textContent = `❌ Error de red: No se pudo contactar al Microservicio de Catálogo.`;
        console.error('Error de red al crear receta:', error);
    } finally {
        form.querySelector('button[type="submit"]').disabled = false;
    }
}