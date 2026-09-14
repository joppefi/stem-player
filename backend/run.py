"""Entry point for the PyInstaller-bundled binary (see stem-player.spec).

Runs the FastAPI app in a background thread and opens it in a native
pywebview window, so the standalone binary feels like a desktop app rather
than "go start a server and find a tab for it." Only used for the frozen
build -- normal dev (`npm run dev`, plain `uvicorn app.main:app`) is
untouched.
"""

import os
import threading

import uvicorn
import webview

from app.main import app


def main() -> None:
    host = os.environ.get("STEM_PLAYER_HOST", "127.0.0.1")
    port = int(os.environ.get("STEM_PLAYER_PORT", "8000"))

    config = uvicorn.Config(app, host=host, port=port, log_level="info")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    while not server.started:
        threading.Event().wait(0.05)

    webview.create_window("Stem Player", f"http://{host}:{port}")
    webview.start()

    # The window closed. Force-exit rather than trying to join the server
    # thread/torch's own background threads -- there's nothing to persist,
    # and no other window is waiting on a clean shutdown.
    os._exit(0)


if __name__ == "__main__":
    main()
