import json
import logging
from pathlib import Path

import librosa
import numpy as np

logger = logging.getLogger(__name__)

_KEY_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Schmuckler key profiles (relative pitch-class weights for major/minor).
_MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _detect_key(chroma_mean: np.ndarray) -> str:
    best_score = -np.inf
    best_key = _KEY_NAMES[0]
    best_mode = "major"
    for shift in range(12):
        major_corr = np.corrcoef(np.roll(_MAJOR_PROFILE, shift), chroma_mean)[0, 1]
        minor_corr = np.corrcoef(np.roll(_MINOR_PROFILE, shift), chroma_mean)[0, 1]
        if major_corr > best_score:
            best_score = major_corr
            best_key = _KEY_NAMES[shift]
            best_mode = "major"
        if minor_corr > best_score:
            best_score = minor_corr
            best_key = _KEY_NAMES[shift]
            best_mode = "minor"
    return f"{best_key} {best_mode}"


def analyze_audio(path: Path) -> dict:
    y, sr = librosa.load(str(path), sr=None, mono=True)

    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    bpm = round(float(np.asarray(tempo).item()), 1)

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key = _detect_key(chroma.mean(axis=1))

    return {"key": key, "bpm": bpm}


def save_analysis(path: Path, output_path: Path) -> dict:
    result = analyze_audio(path)
    output_path.write_text(json.dumps(result))
    logger.info("Analysis for %s: %s -> %s", path, result, output_path)
    return result
