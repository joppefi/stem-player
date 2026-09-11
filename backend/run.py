"""Entry point for the PyInstaller-bundled binary (see stem-player.spec).

Imports the app object directly rather than passing an import string to
uvicorn -- import strings are resolved by uvicorn at runtime via the normal
module machinery, which is more fragile inside a frozen bundle than a plain
`from ... import ...` at the top of this file.
"""

import os

import uvicorn

from app.main import app


def main() -> None:
    host = os.environ.get("STEM_PLAYER_HOST", "127.0.0.1")
    port = int(os.environ.get("STEM_PLAYER_PORT", "8000"))
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
