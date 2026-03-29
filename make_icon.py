"""
Convertit icon.png en icon.ico pour le raccourci Bureau.
"""
import sys
import os
import subprocess

# Installer Pillow si absent
try:
    from PIL import Image
except ImportError:
    print("  Installation de Pillow...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow", "-q"])
    from PIL import Image

script_dir = os.path.dirname(os.path.abspath(__file__))
icon_png = os.path.join(script_dir, "icon.png")
icon_ico = os.path.join(script_dir, "icon.ico")

if not os.path.exists(icon_png):
    print(f"ERREUR : icon.png introuvable dans {script_dir}")
    sys.exit(1)

img = Image.open(icon_png).convert("RGBA")
img.save(icon_ico, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
print(f"  Icone creee : {icon_ico}")
