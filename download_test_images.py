import requests
from pathlib import Path

# Structure de dossiers à créer avec le nombre d'images voulues
FOLDERS = {
    "landscape": 5,
    "nature": 5,
    "abstract": 3,
}

BASE_DIR = Path("./images")

def download_image(url, dest_path):
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    dest_path.write_bytes(response.content)
    print(f"✓ {dest_path}")

def main():
    for folder, count in FOLDERS.items():
        folder_path = BASE_DIR / folder
        folder_path.mkdir(parents=True, exist_ok=True)

        for i in range(1, count + 1):
            # Picsum génère une image aléatoire différente à chaque appel
            url = f"https://picsum.photos/1920/1080?random={folder}{i}"
            dest = folder_path / f"{folder}_{i}.jpg"
            try:
                download_image(url, dest)
            except Exception as e:
                print(f"✗ Erreur pour {dest}: {e}")

if __name__ == "__main__":
    main()
