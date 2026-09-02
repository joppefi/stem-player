import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import librosa
import librosa.display
import matplotlib.pyplot as plt

WAVEFORM_COLOR = "#3b82f6"


def generate_waveform_png(path: Path, width: int = 600, height: int = 80) -> bytes:
    y, sr = librosa.load(str(path), sr=None, mono=True)

    dpi = 100
    fig, ax = plt.subplots(figsize=(width / dpi, height / dpi), dpi=dpi)
    fig.patch.set_alpha(0.0)
    ax.set_facecolor("none")
    ax.axis("off")
    fig.subplots_adjust(left=0, right=1, top=1, bottom=0)

    librosa.display.waveshow(y, sr=sr, ax=ax, color=WAVEFORM_COLOR)
    ax.set_xmargin(0)

    buf = io.BytesIO()
    fig.savefig(buf, format="png", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()
