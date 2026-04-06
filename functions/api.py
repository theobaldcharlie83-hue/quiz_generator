import sys
import os
import uuid
import json
import base64
import tempfile
from datetime import datetime

# Ajout de la racine du projet dans le path pour trouver ai_engine.py
# functions/ est un dossier enfant de la racine, donc on remonte d'un niveau
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT_DIR)

def handler(event, context):
    """Handler autonome pour Netlify. Gère POST /api/generate."""
    
    method = event.get("httpMethod", "")
    path = event.get("path", "")
    
    # Support CORS
    headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
    }
    
    if method == "OPTIONS":
        return {"statusCode": 200, "headers": headers, "body": ""}

    # Route : POST /api/heartbeat (ne rien faire en cloud)
    if "/api/heartbeat" in path:
        return {"statusCode": 200, "headers": headers, "body": json.dumps({"status": "ok"})}

    # Route : POST /api/generate
    if "/api/generate" in path and method == "POST":
        return handle_generate(event, headers)

    return {
        "statusCode": 404,
        "headers": headers,
        "body": json.dumps({"error": "Route non trouvée"})
    }


def handle_generate(event, headers):
    """Traite la génération de quiz à partir de fichiers uploadés."""
    try:
        # Récupérer la clé API
        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "La clé GEMINI_API_KEY n'est pas configurée sur le serveur."})
            }

        # Décoder le corps multipart
        import email
        import cgi

        content_type = ""
        for key, val in (event.get("headers") or {}).items():
            if key.lower() == "content-type":
                content_type = val
                break

        body = event.get("body", "")
        is_base64 = event.get("isBase64Encoded", False)
        if is_base64:
            body_bytes = base64.b64decode(body)
        else:
            body_bytes = body.encode("utf-8") if isinstance(body, str) else body

        # Parser le multipart
        environ = {
            "REQUEST_METHOD": "POST",
            "CONTENT_TYPE": content_type,
            "CONTENT_LENGTH": str(len(body_bytes)),
        }

        import io
        fp = io.BytesIO(body_bytes)
        
        # FieldStorage parse
        form = cgi.FieldStorage(fp=fp, environ=environ, keep_blank_values=True)

        # Extraire les paramètres
        try:
            num_qcm = int(form.getvalue("qcm", "4"))
            num_boolean = int(form.getvalue("boolean", "3"))
            num_direct = int(form.getvalue("direct", "3"))
        except (ValueError, TypeError):
            num_qcm, num_boolean, num_direct = 4, 3, 3

        total_questions = num_qcm + num_boolean + num_direct
        if total_questions == 0:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Veuillez configurer au moins une question."})
            }

        # Extraire les fichiers images
        temp_paths = []
        tmp_dir = tempfile.gettempdir()  # /tmp sur Netlify (accessible en écriture)

        images_field = form["images"] if "images" in form else None
        if images_field is None:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Aucun fichier image reçu."})
            }

        # images peut être une liste ou un seul item
        if not isinstance(images_field, list):
            images_field = [images_field]

        images_field = [f for f in images_field if f.filename]
        if not images_field:
            return {
                "statusCode": 400,
                "headers": headers,
                "body": json.dumps({"error": "Aucune image sélectionnée."})
            }

        for img_field in images_field:
            safe_name = f"{uuid.uuid4().hex}_{img_field.filename}"
            temp_path = os.path.join(tmp_dir, safe_name)
            with open(temp_path, "wb") as tf:
                tf.write(img_field.file.read())
            temp_paths.append(temp_path)

        # Générer le quiz via ai_engine
        try:
            from ai_engine import generate_quiz_from_image
            quiz_data = generate_quiz_from_image(temp_paths, api_key, num_qcm, num_boolean, num_direct)
            quiz_data["id"] = str(uuid.uuid4())
            quiz_data["created_at"] = datetime.now().isoformat()
            return {
                "statusCode": 200,
                "headers": headers,
                "body": json.dumps(quiz_data)
            }
        except Exception as e:
            return {
                "statusCode": 500,
                "headers": headers,
                "body": json.dumps({"error": f"Erreur de génération : {str(e)}"})
            }
        finally:
            for tp in temp_paths:
                try:
                    if os.path.exists(tp):
                        os.remove(tp)
                except Exception:
                    pass

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": headers,
            "body": json.dumps({"error": f"Erreur interne : {str(e)}"})
        }
