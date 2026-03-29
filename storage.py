import os
import json
import uuid
from datetime import datetime

ARCHIVES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "archives")

def get_archives_dir():
    if not os.path.exists(ARCHIVES_DIR):
        os.makedirs(ARCHIVES_DIR)
    return ARCHIVES_DIR

def save_mission(mission_data):
    """
    Sauvegarde une nouvelle mission dans un fichier JSON.
    mission_data doit contenir au moins: 'topic', 'questions'
    """
    archives_dir = get_archives_dir()
    mission_id = str(uuid.uuid4())
    
    # Ajout des métadonnées
    mission_data["id"] = mission_id
    mission_data["created_at"] = datetime.now().isoformat()
    
    if "title" not in mission_data:
        mission_data["title"] = mission_data.get("topic", "Général")
    
    file_path = os.path.join(archives_dir, f"{mission_id}.json")
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(mission_data, f, ensure_ascii=False, indent=2)
        
    return mission_id

def list_missions():
    """
    Retourne la liste des missions archivées, triées de la plus récente à la plus ancienne.
    Ne renvoie que le résumé (pas toutes les questions) pour la barre latérale.
    """
    archives_dir = get_archives_dir()
    missions = []
    
    for filename in os.listdir(archives_dir):
        if filename.endswith(".json"):
            file_path = os.path.join(archives_dir, filename)
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    missions.append({
                        "id": data.get("id"),
                        "title": data.get("title", "Mission sans nom"),
                        "topic": data.get("topic", "Général"),
                        "created_at": data.get("created_at"),
                        "question_count": len(data.get("questions", []))
                    })
            except Exception as e:
                print(f"Erreur lors de la lecture de {filename}: {e}")
                
    # Tri par date décroissante
    missions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    return missions

def get_mission(mission_id):
    """
    Récupère le contenu complet d'une mission via son ID.
    """
    archives_dir = get_archives_dir()
    file_path = os.path.join(archives_dir, f"{mission_id}.json")
    if os.path.exists(file_path):
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return None

def delete_mission(mission_id):
    """
    Supprime une mission archivée.
    """
    archives_dir = get_archives_dir()
    file_path = os.path.join(archives_dir, f"{mission_id}.json")
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False
