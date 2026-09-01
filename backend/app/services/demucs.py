import threading
from pathlib import Path
from typing import Callable

from demucs.apply import apply_model
from demucs.audio import AudioFile, save_audio
from demucs.pretrained import get_model

_model_lock = threading.Lock()
_models: dict[str, object] = {}


def _load_model(model_name: str):
    with _model_lock:
        model = _models.get(model_name)
        if model is None:
            model = get_model(model_name)
            model.eval()
            _models[model_name] = model
        return model


def separate(
    input_path: Path,
    output_dir: Path,
    model_name: str,
    progress_cb: Callable[[float], None],
) -> dict[str, Path]:
    model = _load_model(model_name)

    wav = AudioFile(input_path).read(
        streams=0, samplerate=model.samplerate, channels=model.audio_channels
    )

    total_length = wav.shape[-1]

    def _callback(d: dict) -> None:
        if d.get("state") != "end":
            return
        offset = d.get("segment_offset", 0)
        progress_cb(min(1.0, offset / total_length))

    ref = wav.mean(0)
    mix = (wav - ref.mean()) / ref.std()
    sources = apply_model(
        model,
        mix[None],
        device="cpu",
        progress=False,
        callback=_callback,
    )[0]
    sources = sources * ref.std() + ref.mean()

    output_dir.mkdir(parents=True, exist_ok=True)
    stem_paths: dict[str, Path] = {}
    for source_name, source_audio in zip(model.sources, sources):
        out_path = output_dir / f"{source_name}.wav"
        save_audio(source_audio, str(out_path), model.samplerate)
        stem_paths[source_name] = out_path

    progress_cb(1.0)
    return stem_paths
