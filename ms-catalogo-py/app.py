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
    id = db.Column(db.Integer, primary_key=True)
    titulo = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, nullable=False)
    tiempo_preparacion = db.Column(db.Integer, nullable=False)
    dificultad = db.Column(db.String(50), nullable=False)
    ingredientes = db.Column(db.Text, nullable=False) 
    imagen_url = db.Column(db.String(500), nullable=True) # <--- NUEVA COLUMNA
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
    if not os.path.exists(DATA_EXTERNA_PATH):
        print(f"ADVERTENCIA: Archivo CSV no encontrado.")
        return 0

    try:
        df = pd.read_csv(DATA_EXTERNA_PATH)
        
        # 1. Normalización de columnas
        def normalize_column_name(s):
            normalized = unicodedata.normalize('NFD', str(s))
            return normalized.encode('ascii', 'ignore').decode('utf-8').lower().strip()
        df.columns = [normalize_column_name(col) for col in df.columns]
        
        # --- SOLUCIÓN PARA EL ERROR DE TABLA NO ENCONTRADA ---
        # Obtenemos el nombre exacto de la tabla desde el modelo Receta
        nombre_tabla = Receta.__table__.name 
        
        # Ejecutamos el TRUNCATE usando el nombre real (entre comillas dobles por seguridad)
        db.session.execute(text(f'TRUNCATE TABLE "{nombre_tabla}" RESTART IDENTITY CASCADE;'))
        db.session.commit()
        # ---------------------------------------------------

        count = 0
        for index, row in df.iterrows():
            # Procesar ingredientes como lista (sin json.dumps)
            raw_ing = str(row.get('ingredientes', ''))
            lista_ingredientes = [i.strip() for i in raw_ing.split(';') if i]

            nueva_receta = Receta(
                titulo=row.get('titulo', 'Sin título'),
                descripcion=row.get('descripcion', 'Sin descripción'),
                tiempo_preparacion=int(row.get('tiempo_preparacion', 0)),
                dificultad=row.get('dificultad', 'Media'),
                ingredientes=lista_ingredientes, 
                imagen_url=row.get('imagen_url')
            )
            
            db.session.add(nueva_receta)
            count += 1
            
        db.session.commit()
        return count
    
    except Exception as e:
        db.session.rollback()
        print(f"ERROR CSV: {e}")
        raise e
    
# ----------------------------------------------------
# 4. ENDPOINTS DE LA API (CRUD)
# ----------------------------------------------------

# --- ENDPOINT: CREAR RECETA (POST /recetas) ---
@app.route('/recetas', methods=['POST'])
def create_receta():
    data = request.json
    # Añadimos 'imagen_url' como opcional en la validación si quieres
    required_fields = ['titulo', 'descripcion', 'tiempo_preparacion', 'dificultad', 'ingredientes']
    
    if not data or not all(field in data for field in required_fields):
        return jsonify({"message": "Faltan campos requeridos."}), 400

    try:
        nueva_receta = Receta(
            titulo=data['titulo'],
            descripcion=data['descripcion'],
            tiempo_preparacion=int(data['tiempo_preparacion']),
            dificultad=data['dificultad'],
            ingredientes=json.dumps(data['ingredientes']),
            imagen_url=data.get('imagen_url') # Captura la URL si existe
        )
        db.session.add(nueva_receta)
        db.session.commit()
        return jsonify(serialize_receta(nueva_receta)), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error interno."}), 500

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