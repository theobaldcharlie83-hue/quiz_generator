import os
import json
import base64
import requests
from typing_extensions import TypedDict
import logging

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Définition du schéma JSON attendu (Structured Output)
class Question(TypedDict):
    question: str
    options: list[str]
    correct_answer: int
    explanation: str

class QuizReport(TypedDict):
    title: str
    topic: str
    questions: list[Question]

def generate_quiz_from_image(image_paths: list, api_key: str, num_qcm: int = 4, num_boolean: int = 3, num_direct: int = 3) -> dict:
    """
    Exécute l'OCR sur une ou plusieurs images via OpenRouter et génère un quiz JSON structuré.
    """
    logger.info(f"Configuration de l'API OpenRouter avec la clé fournie.")

    messages = [
        {
            "role": "user",
            "content": []
        }
    ]

    for path in image_paths:
        logger.info(f"Encodage du fichier {path} en base64...")
        with open(path, "rb") as image_file:
            base64_image = base64.b64encode(image_file.read()).decode('utf-8')
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}"
                }
            })

    total_questions = num_qcm + num_boolean + num_direct
    nb_images = len(image_paths)
    multi_note = f"IMPORTANT : Tu analyses {nb_images} image(s) de cours simultanément. Tu DOIS couvrir l'ensemble des contenus présents dans TOUTES les images.\n" if nb_images > 1 else ""

    try:
        prompt = f"""
Tu es un concepteur pédagogique expert.
Ta mission est de LIRE, COMPRENDRE et ANALYSER le contenu du cours présent sur {'les images' if nb_images > 1 else "l'image"}, puis de créer un quiz interactif original.
{multi_note}
RÈGLES ABSOLUES À RESPECTER :
1. NOMBRES ET TYPES DE QUESTIONS : Tu dois générer EXACTEMENT {total_questions} questions au total. Si le cours est court, invente tes propres problèmes d'approfondissement. Tu DOIS IMPERATIVEMENT respecter les quantités et formats suivants :
    - {num_qcm} questions de type "qcm". 4 propositions distinctes dans `options` (index correct: 0-3 dans `correct_answer`).
    - {num_boolean} questions de type "boolean". Une affirmation testée en Vrai/Faux. `options` DOIT être exactement `["Vrai", "Faux"]`. `correct_answer` sera 0 (Vrai) ou 1 (Faux).
    - {num_direct} questions de type "direct". L'enfant devra écrire sa réponse. `options` doit être `null`, `correct_answer` = `null`. La réponse brute attendue sera dans `direct_answer` (écrite en minuscules, maximum 1 ou 2 mots, ex: "mathématiques", "12").
2. FOND, PAS LA FORME : Il est STRICTEMENT INTERDIT de poser des questions descriptives sur l'image elle-même.
3. GÉNÉRALISATION OBLIGATOIRE (CRITIQUE) : NE RÉUTILISE PAS les exemples précis montrés dans le cours (l'enfant n'aura pas le cours sous les yeux !). Tes questions DOIVENT être de nouveaux exercices abstraits parfaits créés par toi-même sur le même concept.
4. EXPLICATION : Fournis toujours une `explanation` douce et encourageante.

FORMAT DE SORTIE OBLIGATOIRE (JSON STRICT) :
Renvoie EXCLUSIVEMENT un JSON valide respectant ce format précis :
{{
  "title": "Titre captivant",
  "topic": "Sujet exact (1/2 mots)",
  "summary": ["Point clé 1 du cours (phrase courte)", "Point clé 2 du cours", "Point clé 3 du cours"],
  "questions": [
    {{
      "type": "qcm", 
      "question": "Texte de la question 1",
      "options": ["Choix A", "Choix B", "Choix C", "Choix D"], 
      "correct_answer": 0, 
      "direct_answer": null, 
      "explanation": "L'explication..."
    }},
    ... (Répéter EXACTEMENT {total_questions} fois au total, en insérant bien les {num_qcm} qcm, {num_boolean} boolean et {num_direct} direct, dans un ordre aléatoire idéalement)
  ]
}}
        """

        messages[0]["content"].append({
            "type": "text",
            "text": prompt
        })

        import time
        max_retries = 4
        for attempt in range(max_retries):
            logger.info(f"Envoi de la demande de génération via OpenRouter (Tentative {attempt + 1}/{max_retries})...")
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                data=json.dumps({
                    "model": "google/gemma-4-26b-a4b-it:free",
                    "messages": messages,
                    "temperature": 0.4
                })
            )
            
            if response.status_code == 429:
                if attempt < max_retries - 1:
                    sleep_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s...
                    logger.warning(f"Erreur 429 (Trop de requêtes). Nouvelle tentative dans {sleep_time} secondes...")
                    time.sleep(sleep_time)
                    continue
            
            # Pour toute autre erreur ou succès, on sort la boucle et on raise si besoin
            response.raise_for_status()
            break
            
        response_json = response.json()

        logger.info("Réponse reçue. Nettoyage et Parsing du JSON.")
        if "choices" not in response_json or not response_json["choices"]:
            raise ValueError(f"Réponse inattendue de l'API OpenRouter : {response_json}")

        raw_text = response_json["choices"][0]["message"]["content"].strip()
        
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        elif raw_text.startswith("```"):
            raw_text = raw_text[3:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        raw_text = raw_text.strip()
        
        try:
            return json.loads(raw_text)
        except json.JSONDecodeError as e:
            logger.error(f"Echec JSON. Début du texte généré : {raw_text[:200]}")
            raise ValueError(f"Le texte reçu d'OpenRouter est corrompu ou incomplet. {str(e)}")

        
    except Exception as e:
        logger.error(f"Erreur durant la génération OpenRouter : {e}")
        raise e
