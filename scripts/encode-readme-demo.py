"""Encode the browser capture as a GitHub-compatible GIF. Requires Pillow."""

import json
import sys
from pathlib import Path

from PIL import Image, ImageOps


def load_frames(manifest):
    frames = []
    for item in manifest["frames"]:
        with Image.open(item["file"]) as source:
            frames.append(source.convert("RGB").resize((1120, 747), Image.Resampling.LANCZOS))
    return frames


def shared_palette(frames, kind):
    # A shared palette keeps colours stable as the pointer moves over the page.
    sample = Image.new("RGB", (280 * 6, 187 * 6), "white")
    count = min(36, len(frames))
    for index in range(count):
        position = index % 18 if kind == "ai" else index
        steps = 17 if kind == "ai" else max(1, count - 1)
        selected = frames[round(position * (len(frames) - 1) / steps)]
        # Give the small animated orbs enough palette space for their gradients.
        if kind == "ai" and index >= 18:
            selected = selected.crop((265, 20, 335, 90))
        sample.paste(ImageOps.fit(selected, (280, 187)), ((index % 6) * 280, (index // 6) * 187))
    return sample.quantize(colors=256)


def verify_sources(manifest, kind):
    files = {item["file"] for item in manifest["frames"]}
    assert len(files) == len(manifest["frames"]), "Duplicate source frame names"
    other = "demo" if kind == "ai" else "ai"
    path = Path(f"output/playwright/readme-{other}-frames.json")
    if path.exists():
        other_manifest = json.loads(path.read_text(encoding="utf-8"))
        other_files = {item["file"] for item in other_manifest["frames"]}
        assert not files.intersection(other_files), "AI and product captures must use separate frame files"


def start_with_assistants(manifest):
    # Rotate the loop to make the five guides visible before a viewer presses anything.
    frames = manifest["frames"]
    for index in range(1, len(frames)):
        current = frames[index]
        if (current["stage"] == "Choose from five animated assistants"
                and not current["pointer"]["pressed"] and frames[index - 1]["pointer"]["pressed"]):
            return {**manifest, "frames": frames[index:] + frames[:index]}
    raise ValueError("The AI capture is missing the assistant picker")


def encode():
    kind = sys.argv[1] if len(sys.argv) > 1 else "ai"
    if kind not in {"ai", "demo"}:
        raise ValueError("Choose 'ai' or 'demo'")
    manifest = json.loads(Path(f"output/playwright/readme-{kind}-frames.json").read_text(encoding="utf-8"))
    verify_sources(manifest, kind)
    if kind == "ai":
        manifest = start_with_assistants(manifest)
    frames = load_frames(manifest)
    palette = shared_palette(frames, kind)
    indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
    destination = Path("docs/readme/ai-bot.gif" if kind == "ai" else "docs/readme/demo.gif")
    indexed[0].save(
        destination, save_all=True, append_images=indexed[1:],
        duration=[item["duration"] for item in manifest["frames"]],
        loop=0, optimize=True, disposal=1,
    )
    Path(f"output/playwright/readme-{kind}-encoded-frames.json").write_text(json.dumps(manifest), encoding="utf-8")
    with Image.open(destination) as result:
        assert result.n_frames > 1, "Expected an animated GIF"
        assert result.info.get("loop") == 0, "Expected an infinite loop"
        duration = sum(result.seek(index) or result.info["duration"] for index in range(result.n_frames))
        print(f"{destination}: {result.size}, {result.n_frames} frames, {duration / 1000:.2f}s, {destination.stat().st_size / 1024 / 1024:.2f} MiB")


if __name__ == "__main__":
    encode()
