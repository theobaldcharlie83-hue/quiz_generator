import sys
import os

# Ajout de la racine du projet au path pour permettre l'importation de app.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from serverless_wsgi import handle_request
from app import app

def handler(event, context):
    return handle_request(app, event, context)
