# ms-catalogo-py/app.py
import os
import sys 
import time
import uuid 
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
    # Columna clave que se usará para la API y la agregación de valoraciones
    receta_id = db.Column(db.String(50), unique=True, nullable=False) 
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text)
    ingredientes = db.Column(db.Text) # Almacenado como string
    instrucciones = db.Column(db.Text)
    tiempo_preparacion = db.Column(db.String(100))
    categoria = db.Column(db.String(100))
    
    def to_dict(self):
        """Convierte el objeto Receta a un diccionario para JSON."""
        return {
            'recetaId': self.receta_id, 
            'nombre': self.nombre,
            'descripcion': self.descripcion,
            'ingredientes': self.ingredientes,
            'instrucciones': self.instrucciones,
            'tiempo_preparacion': self.tiempo_preparacion,
            'categoria': self.categoria
        }

# ----------------------------------------------------
# 3. ENDPOINTS
# ----------------------------------------------------

# Endpoint de listado de recetas (NECESARIO para Healthcheck)
@app.route('/recetas', methods=['GET'])
def get_recetas():
    """Devuelve la lista completa de recetas."""
    with app.app_context():
        recetas = Receta.query.all()
        # Usa el método to_dict para serializar la lista
        recetas_schema = [r.to_dict() for r in recetas] 
        return jsonify(recetas_schema), 200


# Endpoint de detalle de receta por ID
@app.route('/recetas/<string:receta_id>', methods=['GET'])
def get_receta_by_id(receta_id):
    """Devuelve una receta específica por su receta_id."""
    with app.app_context():
        receta = Receta.query.filter_by(receta_id=receta_id).first()
        if not receta:
            return jsonify({"message": "Receta no encontrada"}), 404
        
        return jsonify(receta.to_dict()), 200


# Endpoint de administración para cargar datos (Ingesta ETL)
@app.route('/admin/cargar_datos', methods=['POST'])
def cargar_datos_externos():
    """Carga datos del archivo CSV en la base de datos."""
    print("Iniciando proceso de ingesta de datos...")
    try:
        # 1. Limpieza de datos existentes
        with app.app_context():
            db.session.query(Receta).delete()
            db.session.commit()

        # 2. Carga del archivo CSV (Usamos el separador ',' confirmado)
        df = pd.read_csv(DATA_EXTERNA_PATH)
        
        # 3. Transformación e Inserción
        nuevas_recetas = []
        for index, row in df.iterrows():
            # Mapeo y corrección de tipos: Usamos .fillna('') para evitar NaN/None,
            # y str() para asegurar que todo es una cadena de texto.
            
            # --- Correcciones de mapeo de CSV a Modelo ---
            nombre_val = str(row['titulo']).strip() if 'titulo' in row else ''
            ingredientes_val = str(row['ingredientes']).strip() if 'ingredientes' in row else ''
            instrucciones_val = str(row['pasos']).strip() if 'pasos' in row else ''
            
            # --- Asignación al Modelo ---
            receta = Receta(
                receta_id=str(uuid.uuid4()), # Generamos un ID único por si no existe
                nombre=nombre_val,
                descripcion="", # Valor por defecto
                ingredientes=ingredientes_val, 
                instrucciones=instrucciones_val, 
                tiempo_preparacion="", # Valor por defecto
                categoria="" # Valor por defecto
            )
            nuevas_recetas.append(receta)

        # 4. Confirmar la transacción
        with app.app_context():
            db.session.bulk_save_objects(nuevas_recetas)
            db.session.commit()
            
        return jsonify({
            "mensaje": f"Carga de datos externa completada. Total de recetas insertadas: {len(nuevas_recetas)}", 
            "total_recetas": len(nuevas_recetas)
        }), 201
        
    except FileNotFoundError:
        return jsonify({
            "message": f"ERROR: Archivo no encontrado en la ruta {DATA_EXTERNA_PATH}. ¿Está el volumen montado?"
        }), 500
    except Exception as e:
        app.logger.error(f"Error durante la ingesta de datos: {e}")
        # Retornamos un mensaje de error genérico para evitar exponer detalles internos
        return jsonify({"message": f"Fallo en la ingesta de datos: {str(e)}"}), 500


# ----------------------------------------------------
# 4. INICIO Y CREACIÓN DE TABLAS (Con Corrección de Conexión)
# ----------------------------------------------------

def ensure_db_ready(max_retries=10, delay=3):
    """Espera a que la conexión a la base de datos sea exitosa y crea las tablas."""
    for attempt in range(max_retries):
        with app.app_context():
            try:
                # CORRECCIÓN CLAVE: Usamos db.engine.begin() para una prueba de conexión robusta
                with db.engine.begin() as connection:
                     connection.execute(text('SELECT 1')) 
                
                # Si la conexión es exitosa, crea las tablas (solo si no existen)
                db.create_all()
                print("Tablas de PostgreSQL verificadas/creadas con éxito.")
                return True
            except Exception as e:
                # La BBDD no está lista, esperamos y reintentamos.
                print(f"ADVERTENCIA: Falló la conexión con PostgreSQL (Intento {attempt + 1}/{max_retries}). Reintentando en {delay}s...")
                time.sleep(delay)
    
    print("ERROR FATAL: No se pudo conectar a PostgreSQL después de varios reintentos. Saliendo.")
    return False

if __name__ == '__main__':
    # Intentamos asegurar que la BD esté lista y las tablas creadas antes de iniciar Flask.
    if ensure_db_ready():
        # Inicia la aplicación Flask solo si la BD está disponible
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False) 
    else:
        # Si la BD nunca estuvo lista, salimos con error
        sys.exit(1)