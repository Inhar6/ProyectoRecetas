# ms-catalogo-py/app.py
import os
import sys 
import time
import json # Necesario para manejar la columna de ingredientes
import uuid # Necesario para generar IDs únicos
from flask import Flask, jsonify, request # Importamos request para manejar POST
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text 
import pandas as pd
from dotenv import load_dotenv

# ----------------------------------------------------
# 1. CONFIGURACIÓN INICIAL Y VERIFICACIÓN
# ----------------------------------------------------

load_dotenv() 

DATABASE_URL = os.getenv('DATABASE_URL')
DATA_EXTERNA_PATH = './data-externa/recetas_externas.csv'

if not DATABASE_URL:
    print("FATAL ERROR: DATABASE_URL no se ha cargado. Revisa el archivo .env.")
    sys.exit(1)

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
    receta_id = db.Column(db.String(50), unique=True, nullable=False) 
    titulo = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text)
    tiempo_preparacion = db.Column(db.Integer)
    dificultad = db.Column(db.String(50))
    ingredientes = db.Column(db.Text) 

    def to_dict(self):
        """Convierte el objeto Receta a un diccionario, parseando el JSON de ingredientes."""
        return {
            'receta_id': self.receta_id,
            'titulo': self.titulo,
            'descripcion': self.descripcion,
            'tiempo_preparacion': self.tiempo_preparacion,
            'dificultad': self.dificultad,
            'ingredientes': json.loads(self.ingredientes) if self.ingredientes else []
        }

# ----------------------------------------------------
# 3. FUNCIONES UTILITARIAS DE CONEXIÓN
# ----------------------------------------------------

from contextlib import contextmanager
from sqlalchemy import create_engine

engine = create_engine(DATABASE_URL)

@contextmanager
def get_db_connection():
    """Proporciona una conexión raw a la base de datos."""
    conn = None
    try:
        conn = engine.connect()
        yield conn
    finally:
        if conn:
            conn.close()

# ----------------------------------------------------
# 4. ENDPOINTS DE LA API (MS-CATÁLOGO)
# ----------------------------------------------------

@app.route('/recetas', methods=['GET'])
def listar_recetas():
    """Devuelve el listado completo de recetas."""
    try:
        recetas = Receta.query.all()
        return jsonify([r.to_dict() for r in recetas]), 200
    except Exception as e:
        app.logger.error(f"Error al listar recetas: {e}")
        return jsonify({"message": "Error interno al obtener recetas."}), 500


@app.route('/recetas/<receta_id>', methods=['GET'])
def obtener_detalle_receta(receta_id):
    """Devuelve el detalle de una receta específica."""
    try:
        receta = Receta.query.filter_by(receta_id=receta_id).first()
        if receta:
            return jsonify(receta.to_dict()), 200
        else:
            return jsonify({"message": f"Receta con ID {receta_id} no encontrada."}), 404
    except Exception as e:
        app.logger.error(f"Error al obtener detalle de receta {receta_id}: {e}")
        return jsonify({"message": "Error interno al obtener el detalle de la receta."}), 500


@app.route('/recetas', methods=['POST'])
def crear_receta():
    """Crea una nueva receta en la base de datos PostgreSQL."""
    try:
        if not request.is_json:
            return jsonify({"message": "Content-Type debe ser application/json"}), 415

        data = request.json
        required_fields = ['titulo', 'descripcion', 'tiempo_preparacion', 'dificultad', 'ingredientes']
        if not all(key in data for key in required_fields):
            return jsonify({"message": "Faltan campos obligatorios para crear la receta."}), 400
        
        if not isinstance(data.get('tiempo_preparacion'), int) or data.get('tiempo_preparacion') <= 0:
            return jsonify({"message": "El campo 'tiempo_preparacion' debe ser un número entero positivo."}), 400
        if not isinstance(data.get('ingredientes'), list):
            return jsonify({"message": "El campo 'ingredientes' debe ser una lista."}), 400


        # Generar un ID único
        receta_id = f"REC-{uuid.uuid4().hex[:8].upper()}"

        query = """
            INSERT INTO recetas (receta_id, titulo, descripcion, tiempo_preparacion, dificultad, ingredientes)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING receta_id, titulo;
        """
        # Convertir lista Python a string JSON para PostgreSQL
        ingredientes_json = json.dumps(data['ingredientes']) 
        
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(query, (
                    receta_id, 
                    data['titulo'], 
                    data['descripcion'], 
                    data['tiempo_preparacion'], 
                    data['dificultad'], 
                    ingredientes_json 
                ))
                new_recipe = cur.fetchone()
                conn.commit()
                
        return jsonify({
            "receta_id": new_recipe[0],
            "titulo": new_recipe[1],
            "message": "Receta creada con éxito."
        }), 201

    except Exception as e:
        app.logger.error(f"Error al crear receta: {e}")
        return jsonify({"message": "Error interno del servidor al crear la receta."}), 500


@app.route('/admin/cargar_datos', methods=['POST'])
def cargar_datos():
    """Carga datos iniciales desde el CSV, borrando los existentes."""
    try:
        df = pd.read_csv(DATA_EXTERNA_PATH)
        print(f"INFO: Se cargaron {len(df)} registros del archivo CSV.")

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute('DELETE FROM recetas;') 
                
                for index, row in df.iterrows():
                    ingredientes_list = [ing.strip() for ing in row['ingredientes'].split(';')]
                    ingredientes_json = json.dumps(ingredientes_list)
                    
                    query = """
                        INSERT INTO recetas (receta_id, titulo, descripcion, tiempo_preparacion, dificultad, ingredientes)
                        VALUES (%s, %s, %s, %s, %s, %s);
                    """
                    cur.execute(query, (
                        row['receta_id'],
                        row['titulo'],
                        row.get('descripcion', 'Sin descripción.'), 
                        int(row['tiempo_preparacion']),
                        row['dificultad'],
                        ingredientes_json
                    ))

                conn.commit()
        
        db.session.remove()

        return jsonify({"mensaje": f"Se eliminaron y cargaron {len(df)} recetas en PostgreSQL."}), 200

    except FileNotFoundError:
        return jsonify({"message": f"Error: Archivo de datos no encontrado en {DATA_EXTERNA_PATH}"}), 500
    except Exception as e:
        app.logger.error(f"Error durante la ingesta de datos: {e}")
        return jsonify({"message": "Error interno del servidor durante la ingesta de datos."}), 500

# ----------------------------------------------------
# 5. INICIO Y CREACIÓN DE TABLAS
# ----------------------------------------------------

def ensure_db_ready(max_retries=10, delay=3):
    """Espera a que la conexión a la base de datos sea exitosa y crea las tablas."""
    for attempt in range(max_retries):
        with app.app_context():
            try:
                with db.engine.begin() as connection:
                     connection.execute(text('SELECT 1')) 
                
                db.create_all()
                print("Tablas de PostgreSQL verificadas/creadas con éxito.")
                return True
            except Exception as e:
                print(f"ADVERTENCIA: Falló la conexión con PostgreSQL (Intento {attempt + 1}/{max_retries}). Reintentando en {delay}s...")
                time.sleep(delay)
    
    print("ERROR FATAL: No se pudo conectar a PostgreSQL después de varios reintentos. Saliendo.")
    return False

if __name__ == '__main__':
    if ensure_db_ready():
        app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
    else:
        sys.exit(1)