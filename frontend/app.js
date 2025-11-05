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

document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar todas las recetas al inicio
    loadRecetas();
    
    // 2. Asigna evento de submit al formulario de valoración
    document.getElementById('rating-form').addEventListener('submit', handleRatingSubmit);
    
    // 3. Asigna evento al input de búsqueda (filtrado en tiempo real)
    searchInput.addEventListener('input', filterRecetas);

    // 4. Asigna evento al botón de carga de datos
    loadDataButton.addEventListener('click', handleDataIngestion);

    // 5. Asigna eventos para el formulario de creación (AÑADIDO)
    document.getElementById('toggle-creation-form').addEventListener('click', toggleCreationForm);
    document.getElementById('create-recipe-form').addEventListener('submit', handleRecipeCreation);
});

// -----------------------------------------------------------------------
// FUNCIONES DE CARGA Y RENDERIZADO
// -----------------------------------------------------------------------

async function loadRecetas() {
    statusMessage.textContent = 'Cargando recetas...';
    listContainer.innerHTML = '';
    
    try {
        const response = await fetch('/api/v1/recetas');
        if (!response.ok) {
             throw new Error('El Gateway no pudo obtener la lista de recetas.');
        }
        const recetas = await response.json();
        allRecetas = recetas; // Guarda la lista completa

        if (recetas.length === 0) {
            statusMessage.textContent = 'No se encontraron recetas. Intenta cargar datos con el botón de administración.';
            return;
        }

        filterRecetas(); // Llama al filtro para renderizar la lista completa

    } catch (error) {
        statusMessage.textContent = `❌ Error al cargar recetas: ${error.message}. Asegúrate de que todos los microservicios están activos.`;
    }
}

function filterRecetas() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredRecetas = allRecetas.filter(receta => 
        receta.titulo.toLowerCase().includes(searchTerm)
    );

    listContainer.innerHTML = ''; // Limpiar lista
    statusMessage.textContent = `Mostrando ${filteredRecetas.length} recetas.`;

    filteredRecetas.forEach(receta => {
        const card = document.createElement('div');
        
        card.className = 'bg-white rounded-xl shadow-lg hover:shadow-xl transition duration-300 overflow-hidden border border-gray-100 cursor-pointer';
        card.onclick = () => openModal(receta.receta_id); // Asigna el evento al hacer click
        
        const ratingDisplay = receta.average_rating !== null ? 
            `<span class="text-yellow-500 font-bold">${receta.average_rating} ⭐</span>` : 
            '<span class="text-gray-400">Sin valorar</span>';
        
        card.innerHTML = `
            <div class="p-5">
                <h3 class="text-xl font-bold text-gray-800 mb-2">${receta.titulo}</h3>
                <p class="text-sm text-gray-600 truncate mb-3">${receta.descripcion}</p>
                <div class="flex justify-between items-center text-sm font-medium border-t pt-3">
                    <span class="text-indigo-600">${receta.dificultad}</span>
                    ${ratingDisplay}
                </div>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

// -----------------------------------------------------------------------
// MANEJO DEL MODAL (DETALLE Y VALORACIÓN)
// -----------------------------------------------------------------------

async function openModal(recetaId) {
    currentRecipeId = recetaId;
    const modal = document.getElementById('recipe-modal');
    const modalDetails = document.getElementById('modal-content-details');
    
    modalDetails.innerHTML = '<p class="text-center text-lg py-10">Cargando detalles de la receta...</p>';
    document.getElementById('modal-content-loaded').style.display = 'none';
    modal.style.display = 'block';

    try {
        // --- 1. CARGAR DETALLES Y VALORACIONES EN PARALELO ---
        const [detalleResponse, ratingsResponse] = await Promise.all([
            fetch(`/api/v1/recetas/${recetaId}`),
            fetch(`/api/v1/valoraciones/${recetaId}`) // Obtener lista de valoraciones individuales (AÑADIDO)
        ]);

        if (!detalleResponse.ok) {
            throw new Error('No se pudo obtener el detalle de la receta.');
        }
        
        const detalle = await detalleResponse.json();
        const ratings = await ratingsResponse.json();

        // Rellenar detalles
        document.getElementById('modal-title').textContent = detalle.titulo;
        document.getElementById('modal-description').textContent = detalle.descripcion;
        document.getElementById('modal-id').textContent = detalle.receta_id;
        document.getElementById('modal-tiempo').textContent = detalle.tiempo_preparacion + ' minutos';
        document.getElementById('modal-dificultad').textContent = detalle.dificultad;
        
        // Renderizar ingredientes
        const ingredientesList = document.getElementById('modal-ingredientes');
        ingredientesList.innerHTML = '';
        if (detalle.ingredientes && detalle.ingredientes.length > 0) {
            detalle.ingredientes.forEach(ing => {
                const li = document.createElement('li');
                li.textContent = ing;
                ingredientesList.appendChild(li);
            });
        } else {
             ingredientesList.innerHTML = '<li>No hay ingredientes listados.</li>';
        }

        // --- 2. MOSTRAR COMENTARIOS (AÑADIDO) ---
        const ratingsListContainer = document.getElementById('modal-ratings-list');
        ratingsListContainer.innerHTML = ''; 

        if (ratings.valoraciones && ratings.valoraciones.length > 0) {
            ratings.valoraciones.forEach(rating => {
                const ratingElement = document.createElement('div');
                ratingElement.className = 'border-b pb-3 mb-3 last:border-b-0 last:pb-0';
                ratingElement.innerHTML = `
                    <p class="font-bold text-lg text-indigo-600">${rating.puntuacion} ⭐</p>
                    <p class="text-gray-700 italic">${rating.comentario ? `"${rating.comentario}"` : '(Sin comentario)'}</p>
                    <p class="text-xs text-gray-400 mt-1">Valoración ID: ${rating.valoracion_id.substring(0, 8)}...</p>
                `;
                ratingsListContainer.appendChild(ratingElement);
            });
        } else {
            ratingsListContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Aún no hay valoraciones. ¡Sé el primero!</p>';
        }

        // Mostrar el contenido cargado y ocultar el loader
        modalDetails.innerHTML = '';
        document.getElementById('modal-content-loaded').style.display = 'block';

        // Restablecer el formulario de valoración
        document.getElementById('rating-form').reset();
        document.getElementById('rating-status').textContent = '';

    } catch (error) {
        modalDetails.innerHTML = `<p class="text-center text-red-500 py-10">❌ Error al cargar los detalles o valoraciones: ${error.message}</p>`;
        document.getElementById('modal-content-loaded').style.display = 'none';
    }
}

function closeModal() {
    document.getElementById('recipe-modal').style.display = 'none';
}

// -----------------------------------------------------------------------
// MANEJO DEL ENVÍO DE VALORACIÓN
// -----------------------------------------------------------------------

async function handleRatingSubmit(event) {
    event.preventDefault(); 
    
    if (!currentRecipeId) {
        document.getElementById('rating-status').textContent = '❌ Error: ID de receta no encontrado.';
        return;
    }

    const form = event.target;
    const puntuacion = form.elements['puntuacion'].value;
    const comentario = form.elements['comentario'].value;
    const statusElement = document.getElementById('rating-status');

    statusElement.textContent = 'Enviando...';

    try {
        const response = await fetch(`/api/v1/valoraciones/${currentRecipeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ puntuacion: parseInt(puntuacion), comentario })
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `✅ Valoración enviada. Recargando datos...`;
            form.reset();
            
            // Recarga las recetas y vuelve a abrir el modal
            setTimeout(() => {
                loadRecetas(); 
                openModal(currentRecipeId);
            }, 1000); 

        } else {
            statusElement.textContent = `❌ Error: ${result.message || 'Fallo en la API.'}`;
        }

    } catch (error) {
        statusElement.textContent = `❌ Error de red al enviar la valoración: ${error.message}`;
    }
}


// -----------------------------------------------------------------------
// MANEJO DE INGESTA DE DATOS (ADMIN)
// -----------------------------------------------------------------------

async function handleDataIngestion() {
    ingestaStatusElement.textContent = 'Iniciando carga de datos... Esto puede tardar unos segundos.';
    loadDataButton.disabled = true; 

    try {
        const response = await fetch('/api/v1/admin/cargar_datos', {
            method: 'POST'
        });

        const result = await response.json();

        if (response.ok) {
            ingestaStatusElement.textContent = `✅ Datos cargados correctamente: ${result.mensaje || 'Ingesta completada.'}`;
            setTimeout(() => {
                loadRecetas();
                loadDataButton.disabled = false;
            }, 2000); 
        } else {
            ingestaStatusElement.textContent = `❌ Error al cargar datos: ${result.message || 'Fallo en el servicio de ingesta.'}`;
            loadDataButton.disabled = false;
        }

    } catch (error) {
        ingestaStatusElement.textContent = `❌ Error de red: No se pudo contactar al Gateway.`;
        loadDataButton.disabled = false;
    }
}

// -----------------------------------------------------------------------
// MANEJO DEL FORMULARIO DE CREACIÓN DE RECETAS (AÑADIDO)
// -----------------------------------------------------------------------

function toggleCreationForm() {
    const container = document.getElementById('creation-form-container');
    const icon = document.getElementById('toggle-icon');
    
    const isVisible = container.classList.toggle('hidden');
    
    if (isVisible) {
        icon.classList.remove('rotate-180');
        icon.textContent = '+';
    } else {
        icon.classList.add('rotate-180');
        icon.textContent = '−'; 
    }
}


async function handleRecipeCreation(event) {
    event.preventDefault(); 
    
    const form = event.target;
    const statusElement = document.getElementById('create-status');

    // 1. Recoger datos y preparar la lista de ingredientes
    const rawIngredientes = form.elements['ingredientes'].value.trim();
    const ingredientesArray = rawIngredientes.split(',').map(item => item.trim()).filter(item => item.length > 0);

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
        // 2. Llamada al endpoint de creación a través del Gateway
        const response = await fetch('/api/v1/recetas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(recipeData)
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `✅ Receta "${result.titulo}" creada con éxito.`;
            form.reset();
            form.querySelector('button[type="submit"]').disabled = false;
            
            // Recargar la lista de recetas para mostrar la nueva
            setTimeout(() => {
                loadRecetas(); 
            }, 1000); 

        } else {
            statusElement.textContent = `❌ Error: ${result.message || 'Fallo en la API.'}`;
            form.querySelector('button[type="submit"]').disabled = false;
        }

    } catch (error) {
        statusElement.textContent = `❌ Error de red: ${error.message}`;
        form.querySelector('button[type="submit"]').disabled = false;
    }
}