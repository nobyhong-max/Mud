#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

mkdir -p src/assets

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not installed."
  exit 1
fi

if ! python3 -c "import PIL" >/dev/null 2>&1; then
  echo "Pillow not found. Installing with pip3..."
  pip3 install Pillow
fi

python3 - <<'PY'
from pathlib import Path
from PIL import Image, ImageDraw

assets_dir = Path("src/assets")
assets_dir.mkdir(parents=True, exist_ok=True)

# tile.png - 32x32 green ground tile
tile = Image.new("RGB", (32, 32), (46, 78, 48))
tile_path = assets_dir / "tile.png"
tile.save(tile_path)

# player_football.png - 48x48 football player
player = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
draw = ImageDraw.Draw(player)

# head
draw.ellipse([14, 2, 34, 22], fill=(255, 210, 170, 255))

# jersey
draw.rectangle([8, 22, 40, 38], fill=(210, 40, 40, 255))

# legs
draw.rectangle([12, 38, 22, 48], fill=(255, 210, 170, 255))
draw.rectangle([26, 38, 36, 48], fill=(255, 210, 170, 255))

player_path = assets_dir / "player_football.png"
player.save(player_path)

print("Assets generated!")
print(f"tile.png: {tile.size} -> {tile_path}")
print(f"player_football.png: {player.size} -> {player_path}")
PY
