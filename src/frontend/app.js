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
const modalImagen = document.getElementById('modal-imagen'); 

// Elementos del DOM para el Formulario de Creación
const creationFormContainer = document.getElementById('creation-form-container'); // Referencia corregida
const toggleIcon = document.getElementById('toggle-icon');

// -----------------------------------------------------------------------
// INICIALIZACIÓN
// -----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar recetas
    loadRecetas();
    
    // 2. Eventos con comprobación de existencia (Seguridad total)
    const ratingForm = document.getElementById('rating-form');
    if (ratingForm) ratingForm.addEventListener('submit', handleRatingSubmit);
    
    if (searchInput) searchInput.addEventListener('input', filterRecetas);

    if (loadDataButton) loadDataButton.addEventListener('click', handleDataIngestion);

    // 5. PANEL DE CREACIÓN (Lo que no te abría)
    const btnToggle = document.getElementById('toggle-form-btn');
    if (btnToggle) {
        btnToggle.addEventListener('click', toggleCreationForm);
    }

    const recipeForm = document.getElementById('recipe-form');
    if (recipeForm) {
        recipeForm.addEventListener('submit', handleRecipeCreation);
    }


    // 6. CERRAR MODAL (Lo que no te cerraba)
    // Buscamos por ID que es más seguro que por clase
    modalCloseBtn.onclick = function() {
        modal.style.display = 'none';
    };

    // Cerrar modal al hacer clic fuera (esto ahora sí funcionará al quitar el error de arriba)
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
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
    const listContainer = document.getElementById('recetas-list');
    if (!listContainer) return;

    listContainer.innerHTML = ''; // Limpia la lista anterior

    if (recetas.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No se encontraron recetas.</p>';
        return;
    }

    // Definimos la imagen por defecto una sola vez fuera del bucle
    const imagenDefault = 'https://images.unsplash.com/photo-1495195129352-aec325a55b65?q=80&w=400&auto=format&fit=crop';

    recetas.forEach(receta => {
        // Manejo seguro de ingredientes
        const ingredientesTexto = Array.isArray(receta.ingredientes) 
            ? receta.ingredientes.slice(0, 3).join(', ') + (receta.ingredientes.length > 3 ? '...' : '')
            : 'N/A';

        // URL inicial: si no hay en la BD, usamos la de defecto
        const srcInicial = receta.imagen_url ? receta.imagen_url : imagenDefault;

        const card = document.createElement('div');
        card.className = 'bg-white border border-gray-200 rounded-xl shadow-lg hover:shadow-xl transition duration-300 overflow-hidden flex flex-col';
        
        card.innerHTML = `
            <div class="relative">
                <img src="${srcInicial}" 
                     alt="${receta.titulo}" 
                     class="w-full h-48 object-cover border-b border-gray-100"
                     onerror="this.onerror=null; this.src='${imagenDefault}';">
                <div class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">
                    ${receta.tiempo_preparacion} min
                </div>
            </div>
            
            <div class="p-6 flex-grow flex flex-col">
                <h2 class="text-2xl font-bold text-indigo-600 mb-2">${receta.titulo}</h2>
                <p class="text-gray-700 mb-3 line-clamp-2 text-sm">${receta.descripcion}</p>
                
                <div class="mt-auto">
                    <p class="text-xs text-gray-500 mb-4">
                        <span class="font-semibold text-gray-700">Ingredientes:</span> ${ingredientesTexto}
                    </p>
                    <button class="view-details-btn bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition duration-200 w-full" 
                            data-id="${receta.id}">
                        Ver Detalle y Valorar
                    </button>
                </div>
            </div>
        `;

        // Asignar evento al botón
        const btn = card.querySelector('.view-details-btn');
        btn.addEventListener('click', () => openModal(receta.id));

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
            if (modalImagen) {
                modalImagen.src = data.imagen_url ? data.imagen_url : 'https://images.unsplash.com/photo-1495195129352-aec325a55b65?q=80&w=400';
            }
            
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
            form.querySelector('button[type="submit"]').disabled = false;
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
    // Buscamos los elementos en el momento del clic para evitar errores de carga
    const container = document.getElementById('creation-form-container');
    const icon = document.getElementById('toggle-icon');

    if (container) {
        container.classList.toggle('hidden');
        if (icon) {
            // Si está oculto (tiene la clase hidden), ponemos +
            icon.textContent = container.classList.contains('hidden') ? '+' : '-';
        }
    } else {
        console.error("No se encontró el contenedor del formulario");
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
        ingredientes: ingredientesArray, // Lista de strings
        imagen_url: form.elements['imagen_url'] ? form.elements['imagen_url'].value : ''
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
            // Recargar la lista de recetas para incluir la nueva
            // Usamos setTimeout para dar tiempo a que el servicio de catálogo termine de guardar.
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