import os
import time
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv

from ai_engine import generate_quiz_from_image
import storage

load_dotenv()

# Pas de Heartbeat en production Cloud

app = Flask(__name__)
# Configurations
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024 # 16 MB max
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "storage_temp")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/')
def index():
    return render_template('index.html')

# Route heartbeat supprimée

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
        
        # Génération des métadonnées côté serveur (auparavant dans storage.py)
        mission_id = str(uuid.uuid4())
        quiz_data['id'] = mission_id
        quiz_data['created_at'] = datetime.now().isoformat()
        
        return jsonify(quiz_data)
    except Exception as e:
        return jsonify({"error": f"Erreur de génération : {str(e)}"}), 500
    finally:
        for tp in temp_paths:
            if os.path.exists(tp):
                os.remove(tp)


# Routes d'archives supprimées (gérées par le LocalStorage du navigateur)


if __name__ == '__main__':
    # Mode dev local
    port = int(os.environ.get("PORT", 8989))
    print(f"Démarrage sur le port {port}")
    app.run(host='0.0.0.0', port=port)
