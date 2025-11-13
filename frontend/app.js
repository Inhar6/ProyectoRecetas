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

// REFERENCIAS CRÍTICAS CORREGIDAS
const creationFormContainer = document.getElementById('create-recipe-form-container');
const toggleIcon = document.getElementById('toggle-icon'); 
const modal = document.getElementById('recipe-modal');
const modalCloseBtn = document.querySelector('.close');


document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar todas las recetas al inicio
    loadRecetas();
    
    // 2. Asigna evento de submit al formulario de valoración
    document.getElementById('rating-form').addEventListener('submit', handleRatingSubmit);
    
    // 3. Asigna evento al input de búsqueda (filtrado en tiempo real)
    searchInput.addEventListener('input', filterRecetas); // Llama a la función de filtro corregida

    // 4. Asigna evento al botón de carga de datos
    loadDataButton.addEventListener('click', handleDataIngestion);

    // 5. Asigna eventos para el formulario de creación (AÑADIDO)
    document.getElementById('toggle-creation-form').addEventListener('click', toggleCreationForm);
    document.getElementById('create-recipe-form').addEventListener('submit', handleRecipeCreation);

    // 6. Asigna eventos para el modal
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

async function loadRecetas() {
    statusMessage.textContent = 'Cargando recetas...';
    try {
        // Llama al Gateway API
        const response = await fetch('/api/v1/recetas');
        const data = await response.json();
        
        if (response.ok) {
            allRecetas = data;
            renderRecetas(allRecetas);
            statusMessage.textContent = `Se cargaron ${allRecetas.length} recetas.`;
        } else {
            // Manejo de errores de la API
            statusMessage.textContent = `Error al cargar recetas: ${data.message || 'Fallo de conexión.'}`;
            listContainer.innerHTML = `<p class="text-center text-red-500 col-span-full">${data.message || 'Fallo al contactar al servicio de catálogo.'}</p>`;
        }
    } catch (error) {
        console.error('Error de red o CORS:', error);
        statusMessage.textContent = 'Error de red. Asegúrate de que el API Gateway está corriendo.';
        listContainer.innerHTML = `<p class="text-center text-red-500 col-span-full">Error: ${error.message}. ¿Está el servidor activo?</p>`;
    }
}

function renderRecetas(recetas) {
    listContainer.innerHTML = ''; // Limpiar lista
    if (recetas.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No se encontraron recetas.</p>';
        return;
    }

    recetas.forEach(receta => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-lg hover:shadow-xl transition duration-300 transform hover:scale-[1.01] overflow-hidden border border-gray-100';
        card.innerHTML = `
            <div class="p-6">
                <h3 class="text-xl font-bold text-gray-800 mb-2">${receta.titulo}</h3>
                <p class="text-sm text-gray-600 mb-4 line-clamp-2">${receta.descripcion}</p>
                <div class="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span class="flex items-center">
                        <svg class="w-4 h-4 mr-1 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        ${receta.tiempo_preparacion} min
                    </span>
                    <span class="font-medium text-indigo-600">${receta.dificultad}</span>
                </div>
                <button onclick="openModal('${receta.id}')" 
                        class="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition duration-200">
                    Ver Detalles
                </button>
            </div>
        `;
        listContainer.appendChild(card);
    });
}

function filterRecetas() {
    const searchTerm = searchInput.value.toLowerCase();
    
    // Si no hay recetas cargadas, no hacer nada (o forzar carga si es necesario)
    if (allRecetas.length === 0) return;

    const filtered = allRecetas.filter(receta => 
        receta.titulo.toLowerCase().includes(searchTerm)
    );

    renderRecetas(filtered);
}

// -----------------------------------------------------------------------
// FUNCIONES ADMIN (Carga de datos)
// -----------------------------------------------------------------------

async function handleDataIngestion() {
    ingestaStatusElement.textContent = 'Iniciando carga de datos...';
    loadDataButton.disabled = true;

    try {
        const response = await fetch('/api/v1/admin/cargar_datos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const result = await response.json();

        if (response.ok) {
            ingestaStatusElement.textContent = `✅ Datos cargados: ${result.message}`;
            // Esperar un momento para que la BD se actualice y luego recargar la lista
            setTimeout(() => {
                loadRecetas();
                loadDataButton.disabled = false;
            }, 3000); 

        } else {
            ingestaStatusElement.textContent = `❌ Error en ingesta: ${result.message || 'Fallo en la API.'}`;
            loadDataButton.disabled = false;
        }
    } catch (error) {
        ingestaStatusElement.textContent = `❌ Error de red: ${error.message}`;
        loadDataButton.disabled = false;
    }
}

// -----------------------------------------------------------------------
// FUNCIONES DE MODAL Y DETALLE (Manejando el modal)
// -----------------------------------------------------------------------

async function openModal(recetaId) {
    currentRecipeId = recetaId;
    
    // Mostrar el modal y el loader
    modal.style.display = 'block';
    document.getElementById('modal-title').textContent = 'Cargando...';
    document.getElementById('modal-content-details').style.display = 'block';
    document.getElementById('modal-content-loaded').style.display = 'none';
    
    try {
        // Llamada para obtener la receta
        const recetaResponse = await fetch(`/api/v1/recetas/${recetaId}`);
        const recetaData = await recetaResponse.json();

        // Llamada para obtener las valoraciones
        const ratingResponse = await fetch(`/api/v1/valoraciones/${recetaId}`);
        const ratingData = await ratingResponse.json();
        
        if (recetaResponse.ok) {
            // Actualizar detalles de la receta
            document.getElementById('modal-title').textContent = recetaData.titulo;
            document.getElementById('modal-id').textContent = recetaData.id;
            document.getElementById('modal-tiempo').textContent = `${recetaData.tiempo_preparacion} min`;
            document.getElementById('modal-dificultad').textContent = recetaData.dificultad;
            document.getElementById('modal-description').textContent = recetaData.descripcion;
            
            // Renderizar ingredientes
            const ingredientesList = document.getElementById('modal-ingredientes');
            ingredientesList.innerHTML = '';
            recetaData.ingredientes.forEach(ing => {
                const li = document.createElement('li');
                li.textContent = ing.trim();
                ingredientesList.appendChild(li);
            });
            
            // Renderizar valoraciones
            renderRatings(ratingResponse.ok ? ratingData : { valoraciones: [] });

            // Mostrar el contenido cargado y ocultar el loader
            document.getElementById('modal-content-details').style.display = 'none';
            document.getElementById('modal-content-loaded').style.display = 'block';

        } else {
            document.getElementById('modal-title').textContent = 'Error';
            document.getElementById('modal-content-details').innerHTML = `<p class="text-center text-red-500 py-10">❌ Error al cargar receta: ${recetaData.message || 'Desconocido'}</p>`;
            document.getElementById('modal-content-loaded').style.display = 'none';
        }

    } catch (error) {
        document.getElementById('modal-title').textContent = 'Error de Red';
        document.getElementById('modal-content-details').innerHTML = `<p class="text-center text-red-500 py-10">❌ Error de conexión: ${error.message}.</p>`;
        document.getElementById('modal-content-loaded').style.display = 'none';
    }
}

function renderRatings(ratingsResult) {
    const ratingsList = document.getElementById('modal-ratings-list');
    const noCommentsMessage = document.getElementById('no-comments-message');
    ratingsList.innerHTML = '';
    
    if (ratingsResult.valoraciones && ratingsResult.valoraciones.length > 0) {
        ratingsResult.valoraciones.forEach(rating => {
            const ratingDiv = document.createElement('div');
            ratingDiv.className = 'p-3 border-b border-gray-200';
            ratingDiv.innerHTML = `
                <div class="flex items-center mb-1">
                    <span class="font-bold text-indigo-700 mr-2">${rating.puntuacion}/5</span>
                    <span class="text-sm text-gray-500">${rating.fecha_creacion}</span>
                </div>
                <p class="text-gray-800">${rating.comentario || 'Sin comentario.'}</p>
            `;
            ratingsList.appendChild(ratingDiv);
        });
        noCommentsMessage.style.display = 'none';
    } else if (ratingsResult.message) {
         // Si la respuesta del microservicio no fue un error grave, pero no hay valoraciones.
        noCommentsMessage.textContent = 'No hay valoraciones para esta receta aún.';
        noCommentsMessage.style.display = 'block';
    } else {
        noCommentsMessage.textContent = 'Error al cargar valoraciones.';
        noCommentsMessage.style.display = 'block';
    }
}


function closeModal() {
    modal.style.display = 'none';
}


// -----------------------------------------------------------------------
// FUNCIONES DE FORMULARIO DE CREACIÓN
// -----------------------------------------------------------------------

function toggleCreationForm() {
    if (creationFormContainer && toggleIcon) {
        // 1. Alterna la clase 'hidden' (Muestra/oculta el formulario)
        creationFormContainer.classList.toggle('hidden');
        
        // 2. Alterna el icono y la rotación
        if (creationFormContainer.classList.contains('hidden')) {
            toggleIcon.textContent = '+';
            toggleIcon.classList.remove('rotate-180');
        } else {
            toggleIcon.textContent = '−'; // Guión largo para mejor efecto visual de cierre
            toggleIcon.classList.add('rotate-180');
        }
    } else {
        console.error("Error: Elementos de creación de receta no encontrados en el DOM.");
    }
}


async function handleRecipeCreation(e) {
    e.preventDefault();
    const form = e.target;
    const statusElement = document.getElementById('create-status');

    // 1. Prepara los datos (los ingredientes vienen como un string separado por comas)
    const ingredientesInput = form.elements['new-ingredientes'].value;
    const ingredientesArray = ingredientesInput.split(',').map(item => item.trim()).filter(item => item !== '');

    const recipeData = {
        titulo: form.elements['new-titulo'].value,
        descripcion: form.elements['new-descripcion'].value,
        tiempo_preparacion: parseInt(form.elements['new-tiempo'].value),
        dificultad: form.elements['new-dificultad'].value,
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
                toggleCreationForm(); // Ocultar el formulario después de la creación
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


// -----------------------------------------------------------------------
// FUNCIONES DE VALORACIÓN
// -----------------------------------------------------------------------

async function handleRatingSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const statusElement = document.getElementById('rating-status');

    if (!currentRecipeId) {
        statusElement.textContent = '❌ Error: ID de receta no definido.';
        return;
    }

    const ratingData = {
        receta_id: currentRecipeId,
        puntuacion: parseInt(form.elements['rating-score'].value),
        comentario: form.elements['rating-comment'].value
    };
    
    statusElement.textContent = 'Enviando valoración...';
    form.querySelector('button[type="submit"]').disabled = true;

    try {
        const response = await fetch('/api/v1/valoraciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData)
        });

        const result = await response.json();

        if (response.ok) {
            statusElement.textContent = `✅ Valoración de ${ratingData.puntuacion}/5 enviada.`;
            form.reset();
            form.querySelector('button[type="submit"]').disabled = false;
            
            // Recargar el modal para ver la nueva valoración
            setTimeout(() => {
                openModal(currentRecipeId); 
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