"""Genera ejecutables Windows descargables con PyInstaller."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.resolve()
DIST = ROOT.parent / "dist"
SEP = os.pathsep
ASSETS = str(ROOT / "assets")
WEB = str(ROOT / "web")


def run(cmd: list[str]) -> bool:
    print(">", " ".join(cmd))
    try:
        subprocess.check_call(cmd, cwd=ROOT)
        return True
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Compilacion fallo (codigo {e.returncode})")
        return False


def main():
    try:
        import PyInstaller  # noqa: F401
    except ImportError:
        print("Instalando PyInstaller...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyinstaller"])

    if DIST.exists():
        shutil.rmtree(DIST, ignore_errors=True)
    DIST.mkdir(parents=True, exist_ok=True)
    (ROOT / "build").mkdir(parents=True, exist_ok=True)

    common = [
        sys.executable, "-m", "PyInstaller",
        "--noconfirm", "--clean", "--onefile",
        "--distpath", str(DIST),
        "--workpath", str(ROOT / "build"),
        "--specpath", str(ROOT / "build"),
    ]

    ok_desktop = False
    ok_web = False

    print("\n=== 1/2 Academic OS Escritorio (puede tardar 10 min) ===")
    ok_desktop = run(common + [
        "--name", "AcademicOS-Escritorio",
        "--windowed",
        "--collect-all", "customtkinter",
        f"--add-data={ASSETS}{SEP}assets",
        f"--add-data={WEB}{SEP}web",
        "--hidden-import", "PIL._tkinter_finder",
        "--hidden-import", "plyer",
        str(ROOT / "main.py"),
    ])

    print("\n=== 2/2 Academic OS Web ===")
    ok_web = run(common + [
        "--name", "AcademicOS-Web",
        "--console",
        "--collect-all", "uvicorn",
        f"--add-data={WEB}{SEP}web",
        f"--add-data={ASSETS}{SEP}assets",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan.on",
        str(ROOT / "run_web.py"),
    ])

    readme = DIST / "LEEME.txt"
    readme.write_text(
        "Academic OS - Ejecutables\n"
        "========================\n\n"
        "AcademicOS-Escritorio.exe  -> App completa Windows\n"
        "AcademicOS-Web.exe         -> Servidor para Android (misma WiFi)\n\n"
        "Nube (Android desde cualquier lugar): lee CLOUD.md en la carpeta del proyecto\n",
        encoding="utf-8",
    )

    print()
    for name in ("AcademicOS-Web.exe", "AcademicOS-Escritorio.exe"):
        p = DIST / name
        if p.exists():
            print(f"[OK] {p} ({p.stat().st_size // 1024 // 1024} MB)")
    if not ok_web and not ok_desktop:
        print("[ERROR] No se genero ningun .exe.")
        sys.exit(1)
    if not ok_desktop:
        print("[AVISO] Escritorio fallo; Web puede estar listo.")
    print(f"\nAbre la carpeta: {DIST.resolve()}")


if __name__ == "__main__":
    main()
