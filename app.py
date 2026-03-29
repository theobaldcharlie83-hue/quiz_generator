import os
import sys
import threading
import webbrowser
import time
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

from ai_engine import generate_quiz_from_image
import storage

load_dotenv()

last_heartbeat = time.time() + 10 # 10s de grâce au démarrage

def check_heartbeat():
    global last_heartbeat
    while True:
        time.sleep(3)
        if time.time() - last_heartbeat > 5:
            # Plus de signal du navigateur depuis 5s (onglet fermé ou refresh)
            print("Arret automatique du serveur (Timeout navigateur).")
            os._exit(0)

threading.Thread(target=check_heartbeat, daemon=True).start()

app = Flask(__name__)
# Configurations
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage_temp")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/heartbeat', methods=['POST'])
def heartbeat():
    global last_heartbeat
    last_heartbeat = time.time()
    return jsonify({"status": "ok"})

@app.route('/api/generate', methods=['POST'])
def generate():
    files = request.files.getlist('images')
    files = [f for f in files if f and f.filename != '']

    if not files:
        return jsonify({"error": "Aucune image sélectionnée."}), 400
        
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        return jsonify({"error": "La clé Google AI Studio (GEMINI_API_KEY) n'est pas configurée dans le fichier .env"}), 400

    try:
        num_qcm = int(request.form.get('qcm', '4'))
        num_boolean = int(request.form.get('boolean', '3'))
        num_direct = int(request.form.get('direct', '3'))
        total_questions = num_qcm + num_boolean + num_direct
    except ValueError:
        return jsonify({"error": "Paramètres de quantité incorrects."}), 400

    if total_questions == 0:
        return jsonify({"error": "Veuillez configurer au moins une question à générer."}), 400

    # Sauvegarde de tous les fichiers temporaires
    temp_paths = []
    for f in files:
        safe_name = f"{len(temp_paths)}_{f.filename}"
        temp_path = os.path.join(app.config['UPLOAD_FOLDER'], safe_name)
        f.save(temp_path)
        temp_paths.append(temp_path)

    try:
        quiz_data = generate_quiz_from_image(temp_paths, api_key, num_qcm, num_boolean, num_direct)
        mission_id = storage.save_mission(quiz_data)
        quiz_data['id'] = mission_id
        return jsonify(quiz_data)
    except Exception as e:
        return jsonify({"error": f"Erreur de génération : {str(e)}"}), 500
    finally:
        for tp in temp_paths:
            if os.path.exists(tp):
                os.remove(tp)


@app.route('/api/archives', methods=['GET'])
def get_archives():
    return jsonify(storage.list_missions())

@app.route('/api/archives/<mission_id>', methods=['GET'])
def get_mission(mission_id):
    mission = storage.get_mission(mission_id)
    if mission:
        return jsonify(mission)
    return jsonify({"error": "Mission non trouvée"}), 404

@app.route('/api/archives/<mission_id>', methods=['DELETE'])
def delete_mission(mission_id):
    success = storage.delete_mission(mission_id)
    if success:
        return jsonify({"status": "success"})
    return jsonify({"error": "Impossible de supprimer la mission"}), 500


def open_browser():
    """Ouvre le navigateur système par défaut vers l'application locale."""
    webbrowser.open_new("http://127.0.0.1:8989")


if __name__ == '__main__':
    # Mode dev ou production locale
    is_dev = '--dev' in sys.argv
    
    if not is_dev:
        # On demande à Python d'ouvrir le navigateur dans 1.5 secondes (le temps que Flask démarre)
        threading.Timer(1.5, open_browser).start()
    
    print("Démarrage de l'Aventure du Savoir sur http://127.0.0.1:8989")
    app.run(port=8989, debug=is_dev, use_reloader=is_dev)
