"""Academic OS — Servidor web (PC, Android WiFi o nube)."""

import os
import socket
import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import uvicorn
from api.server import app

PORT = int(os.environ.get("PORT", "8765"))
IS_CLOUD = bool(
    os.environ.get("RENDER")
    or os.environ.get("RAILWAY_ENVIRONMENT")
    or os.environ.get("FLY_APP_NAME")
    or os.environ.get("ACADEMIC_OS_CLOUD")
)


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def main():
    if IS_CLOUD:
        print(f"Academic OS en la nube — puerto {PORT}")
    else:
        ip = local_ip()
        print()
        print("  ╔══════════════════════════════════════╗")
        print("  ║       Academic OS — Modo Web/Móvil   ║")
        print("  ╠══════════════════════════════════════╣")
        print(f"  ║  PC:      http://localhost:{PORT:<17} ║")
        print(f"  ║  Android: http://{ip}:{PORT:<17} ║")
        print("  ╠══════════════════════════════════════╣")
        print("  ║  Chrome → URL → Añadir a inicio     ║")
        print("  ╚══════════════════════════════════════╝")
        print()
        try:
            webbrowser.open(f"http://localhost:{PORT}")
        except Exception:
            pass

    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")


if __name__ == "__main__":
    main()
