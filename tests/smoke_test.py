from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

for path in [
    "index.html", "app.js", "styles.css", "README.md", "BASELINE.md",
    "src/app-core.js", "src/app-combat.js", "src/app-render.js", "src/app-ui.js",
]:
    assert (ROOT / path).is_file(), path

for path in [
    "assets/enemies/boss.webp", "assets/enemies/brute.webp", "assets/enemies/drone.webp",
    "assets/enemies/runner.webp", "assets/enemies/shield.webp",
    "assets/towers/arcane.webp", "assets/towers/cryo.webp", "assets/towers/plasma.webp", "assets/towers/rail.webp",
    "assets/world/background.webp", "assets/world/core.webp", "assets/ui/logo.webp",
]:
    assert (ROOT / path).stat().st_size > 100, path

for path in ["src/app-core.js", "src/app-combat.js", "src/app-render.js", "src/app-ui.js"]:
    subprocess.run(["node", "--check", str(ROOT / path)], check=True)

print("PASS: complete source tree and static asset layout")
