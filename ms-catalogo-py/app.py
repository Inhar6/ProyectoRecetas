# ms-catalogo-py/app.py
import os
import sys 
import time
import uuid 
import json 
import unicodedata # <--- ¡AÑADIR ESTA LÍNEA!
from flask import Flask, jsonify, request 
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text 
import pandas as pd
from dotenv import load_dotenv

# ----------------------------------------------------
# 1. CONFIGURACIÓN INICIAL Y VERIFICACIÓN
# ----------------------------------------------------

# **Aseguramos la carga de variables de entorno**
load_dotenv() 

DATABASE_URL = os.getenv('DATABASE_URL')
# Ruta al archivo CSV. Es accesible porque el volumen está mapeado en docker-compose.yml.
DATA_EXTERNA_PATH = './data-externa/recetas_externas.csv'

# **Verificación de la URL**
if not DATABASE_URL:
    print("FATAL ERROR: DATABASE_URL no se ha cargado. Revisa el archivo .env.")
    sys.exit(1) # Salir si no hay URL de BBDD

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# ----------------------------------------------------
# 2. MODELO DE DATOS
# ----------------------------------------------------

class Receta(db.Model):
    """Define la tabla de Recetas."""
    __tablename__ = 'recetas' 
    id = db.Column(db.Integer, primary_key=True) # Clave primaria
    titulo = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    tiempo_preparacion = db.Column(db.Integer, nullable=False)
    dificultad = db.Column(db.String(50), nullable=False)
    # Almacenamos la lista de ingredientes como una cadena JSON en la BBDD
    ingredientes = db.Column(db.Text, nullable=False) 
    fecha_creacion = db.Column(db.DateTime, server_default=db.func.now())

# ----------------------------------------------------
# 3. FUNCIONES DE UTILIDAD
# ----------------------------------------------------

# Función de ayuda para serializar una receta a JSON (incluyendo deserializar ingredientes)
def serialize_receta(receta):
    """Convierte un objeto Receta de SQLAlchemy a un diccionario serializable."""
    try:
        # Deserializa el string JSON de ingredientes a una lista de Python
        ingredientes_list = json.loads(receta.ingredientes) if receta.ingredientes else []
    except json.JSONDecodeError:
        # En caso de que el JSON esté mal, devuelve la cadena original como fallback
        ingredientes_list = [receta.ingredientes]

    return {
        'id': str(receta.id), # Aseguramos que el ID sea string
        'titulo': receta.titulo,
        'descripcion': receta.descripcion,
        'tiempo_preparacion': receta.tiempo_preparacion,
        'dificultad': receta.dificultad,
        'ingredientes': ingredientes_list,
        'fecha_creacion': receta.fecha_creacion.isoformat()
    }


def cargar_datos_csv():
    """Carga los datos del CSV a la base de datos, mapeando las columnas faltantes."""
    if not os.path.exists(DATA_EXTERNA_PATH):
        print(f"ADVERTENCIA: Archivo CSV no encontrado en {DATA_EXTERNA_PATH}. Omitiendo carga.")
        return 0

    try:
        df = pd.read_csv(DATA_EXTERNA_PATH)
        
        # --- Normalización de columnas: Simplificamos para adaptarnos a tu CSV ---
        # Aseguramos que 'titulo' e 'ingredientes' funcionen
        def normalize_column_name(s):
            import unicodedata # Importamos aquí por si acaso
            normalized = unicodedata.normalize('NFD', str(s))
            ascii_only = normalized.encode('ascii', 'ignore').decode('utf-8')
            return ascii_only.lower().replace(' ', '_').replace('-', '_').strip()

        df.columns = [normalize_column_name(col) for col in df.columns]
        # ------------------------------------------------------------------
        
        count = 0
        db.session.query(Receta).delete()
        
        for index, row in df.iterrows():
            # Serializamos la lista de ingredientes
            try:
                ingredientes_data = json.loads(row.get('ingredientes', '[]').replace("'", "\""))
            except Exception:
                ingredientes_data = [row.get('ingredientes', '')]
                
            ingredientes_json = json.dumps(ingredientes_data)

            # *** CORRECCIÓN CLAVE: Mapear y usar valores por defecto ***
            nueva_receta = Receta(
                titulo=row['titulo'],
                # Usamos la columna 'pasos' del CSV como la 'descripcion'
                descripcion=row.get('pasos', 'Descripción no disponible en el CSV.'),
                # Valores por defecto para las columnas que faltan
                tiempo_preparacion=15, 
                dificultad='Fácil', 
                ingredientes=ingredientes_json
            )
            
            db.session.add(nueva_receta)
            count += 1
            
        db.session.commit()
        return count
    except Exception as e:
        db.session.rollback()
        # Mostramos la excepción para el diagnóstico
        print(f"ERROR: Falló la carga de datos CSV: {e}", file=sys.stderr)
        raise e
    
# ----------------------------------------------------
# 4. ENDPOINTS DE LA API (CRUD)
# ----------------------------------------------------

# --- ENDPOINT: CREAR RECETA (POST /recetas) ---
@app.route('/recetas', methods=['POST'])
def create_receta():
    data = request.json
    
    # 1. Validación de Datos Mínima
    required_fields = ['titulo', 'descripcion', 'tiempo_preparacion', 'dificultad', 'ingredientes']
    if not data or not all(field in data for field in required_fields):
        return jsonify({
            "message": "Faltan campos requeridos: titulo, descripcion, tiempo_preparacion, dificultad, ingredientes."
        }), 400

    # Validación específica de tipos
    if not isinstance(data.get('ingredientes'), list):
        return jsonify({"message": "El campo 'ingredientes' debe ser una lista de strings."}), 400
    try:
        tiempo = int(data['tiempo_preparacion'])
        if tiempo <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return jsonify({"message": "El campo 'tiempo_preparacion' debe ser un número entero positivo."}), 400

    try:
        # 2. Serializar Ingredientes a string JSON para la base de datos
        ingredientes_json = json.dumps(data['ingredientes'])
        
        # 3. Creación del nuevo objeto Receta
        nueva_receta = Receta(
            titulo=data['titulo'],
            descripcion=data['descripcion'],
            tiempo_preparacion=tiempo,
            dificultad=data['dificultad'],
            ingredientes=ingredientes_json
        )

        # 4. Guardar en la Base de Datos
        db.session.add(nueva_receta)
        db.session.commit()
        
        # 5. Respuesta de Éxito
        return jsonify(serialize_receta(nueva_receta)), 201 # 201 Created

    except Exception as e:
        db.session.rollback()
        # 6. Manejo de Errores de BD
        print(f"Error al crear receta: {e}", file=sys.stderr)
        return jsonify({
            "message": "Error interno del servidor al procesar la receta."
        }), 500


# --- ENDPOINT: OBTENER TODAS LAS RECETAS (GET /recetas) ---
@app.route('/recetas', methods=['GET'])
def get_recetas():
    try:
        recetas = Receta.query.order_by(Receta.fecha_creacion.desc()).all()
        # Usamos la función de serialización para devolver el formato correcto
        return jsonify([serialize_receta(r) for r in recetas]), 200
    except Exception as e:
        print(f"Error al obtener recetas: {e}", file=sys.stderr)
        return jsonify({"message": "Error interno al recuperar recetas."}), 500


# --- ENDPOINT: OBTENER UNA RECETA POR ID (GET /recetas/<id>) ---
@app.route('/recetas/<int:receta_id>', methods=['GET'])
def get_receta(receta_id):
    receta = Receta.query.get(receta_id)
    if receta is None:
        return jsonify({"message": f"Receta con ID {receta_id} no encontrada."}), 404
    
    return jsonify(serialize_receta(receta)), 200

# ----------------------------------------------------
# 5. ENDPOINTS DE ADMINISTRACIÓN Y SALUD
# ----------------------------------------------------

@app.route('/admin/cargar_datos', methods=['POST'])
def cargar_datos():
    try:
        count = cargar_datos_csv()
        return jsonify({
            "message": f"Datos cargados exitosamente. {count} recetas insertadas/actualizadas.",
            "recetas_cargadas": count
        }), 200
    except Exception as e:
        return jsonify({
            "message": f"Fallo al cargar datos: {str(e)}",
            "error": "Error interno al procesar el CSV."
        }), 500


@app.route('/health', methods=['GET'])
def health_check():
    """Endpoint de salud para Docker, verifica la conexión a la base de datos."""
    try:
        # Ejecuta una consulta simple para verificar la conexión a la DB
        with db.engine.begin() as connection:
            connection.execute(text('SELECT 1')) 
        return jsonify({"status": "healthy", "service": "ms-catalogo-py", "database": "connected"}), 200
    except Exception:
        # Devuelve un 500 si la conexión a la DB falla
        return jsonify({"status": "unhealthy", "service": "ms-catalogo-py", "database": "disconnected"}), 500


# ----------------------------------------------------
# 6. INICIO DE LA APLICACIÓN
# ----------------------------------------------------

def ensure_db_ready(max_retries=10, delay=3):
    """Espera a que la conexión a la base de datos sea exitosa y crea las tablas."""
    for attempt in range(max_retries):
        with app.app_context():
            try:
                # CORRECCIÓN CLAVE: Usamos db.engine.begin() para una prueba de conexión robusta
                with db.engine.begin() as connection:
                     connection.execute(text('SELECT 1')) 
                
                # *** CORRECCIÓN CRÍTICA AÑADIDA: Eliminación de tablas para evitar conflictos de esquema ***
                db.drop_all() 
                
                # Si la conexión es exitosa, crea las tablas (solo si no existen)
                db.create_all()
                print("Tablas de PostgreSQL verificadas/creadas con éxito.")
                return True
            except Exception as e:
                # La BBDD no está lista, esperamos y reintentamos.
                print(f"ADVERTENCIA: Falló la conexión con PostgreSQL (Intento {attempt + 1}/{max_retries}). Reintentando en {delay}s...", file=sys.stderr)
                time.sleep(delay)
    
    print("ERROR FATAL: No se pudo conectar a PostgreSQL después de varios reintentos. Saliendo.", file=sys.stderr)
    return False

if __name__ == '__main__':
    # Intentamos asegurar que la BD esté lista y las tablas creadas antes de iniciar Flask.
    if ensure_db_ready():
        # Inicia la aplicación Flask solo si la BD está disponible
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)