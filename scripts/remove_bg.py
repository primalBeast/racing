"""Process car sprites with rembg, keep only the car, front at top."""
from __future__ import annotations

import io
from collections import deque
from pathlib import Path

from PIL import Image
from rembg import remove

ASSETS = Path(__file__).resolve().parent.parent / "assets" / "cars"
CAR_FILES = [
    "neon-pulse.jpg",
    "midnight-gt.jpg",
    "drift-phantom.jpg",
    "thunder-rex.jpg",
    "velocity-rx.jpg",
    "steel-hauler.jpg",
    "crimson-blade.jpg",
    "ghost-walker.jpg",
    "golden-emperor.jpg",
    "viper-strike.jpg",
]


def rembg_image(path: Path) -> Image.Image:
    with path.open("rb") as handle:
        result = remove(handle.read())
    return Image.open(io.BytesIO(result)).convert("RGBA")


def opaque_bbox(img: Image.Image):
    alpha = img.split()[3]
    return alpha.getbbox()


def keep_largest_component(img: Image.Image) -> Image.Image:
    w, h = img.size
    alpha = img.load()
    visited = [[False] * w for _ in range(h)]
    best_pixels: list[tuple[int, int]] = []

    for y in range(h):
        for x in range(w):
            if visited[y][x] or alpha[x, y][3] < 20:
                continue
            queue = deque([(x, y)])
            group = []
            visited[y][x] = True
            while queue:
                cx, cy = queue.popleft()
                group.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and alpha[nx, ny][3] >= 20:
                        visited[ny][nx] = True
                        queue.append((nx, ny))
            if len(group) > len(best_pixels):
                best_pixels = group

    cleaned = Image.new("RGBA", img.size, (0, 0, 0, 0))
    src = img.load()
    dst = cleaned.load()
    keep = set(best_pixels)
    for y in range(h):
        for x in range(w):
            if (x, y) in keep:
                dst[x, y] = src[x, y]
    return cleaned


def region_light_score(img: Image.Image, y0: int, y1: int) -> int:
    rgb = img.convert("RGB")
    alpha = img.split()[3]
    w = img.width
    score = 0
    for y in range(max(0, y0), min(img.height, y1)):
        for x in range(w):
            if alpha.getpixel((x, y)) < 128:
                continue
            r, g, b = rgb.getpixel((x, y))
            brightness = r + g + b
            if brightness > 520 or (r > 190 and g > 170):
                score += 4
            if r > 150 and g < 95 and b < 95:
                score -= 3
    return score


def front_is_at_bottom(img: Image.Image) -> bool:
    bbox = opaque_bbox(img)
    if not bbox:
        return False
    _, top, _, bottom = bbox
    span = max(1, bottom - top)
    top_score = region_light_score(img, top, top + int(span * 0.22))
    bottom_score = region_light_score(img, bottom - int(span * 0.22), bottom + 1)
    return bottom_score > top_score + 4


def normalize_orientation(img: Image.Image) -> tuple[Image.Image, bool]:
    if front_is_at_bottom(img):
        return img.transpose(Image.FLIP_TOP_BOTTOM), True
    return img, False


def trim_and_pad(img: Image.Image, pad: int = 8) -> Image.Image:
    bbox = opaque_bbox(img)
    if not bbox:
        return img
    cropped = img.crop(bbox)
    out = Image.new("RGBA", (cropped.width + pad * 2, cropped.height + pad * 2), (0, 0, 0, 0))
    out.paste(cropped, (pad, pad), cropped)
    return out


def transparent_ratio(img: Image.Image) -> float:
    pixels = list(img.getdata())
    if not pixels:
        return 0.0
    return sum(1 for _, _, _, a in pixels if a == 0) / len(pixels)


def process_image(src_path: Path, dst_path: Path) -> None:
    img = rembg_image(src_path)
    img = keep_largest_component(img)
    img, flipped = normalize_orientation(img)
    img = trim_and_pad(img)
    img.save(dst_path, "PNG")
    print(
        f"Saved {dst_path.name} ({img.size[0]}x{img.size[1]}) "
        f"trans={transparent_ratio(img) * 100:.1f}% flipped={flipped}"
    )


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    for src_name in CAR_FILES:
        src = ASSETS / src_name
        dst = ASSETS / src_name.replace(".jpg", ".png")
        if not src.exists():
            raise FileNotFoundError(src)
        process_image(src, dst)


if __name__ == "__main__":
    main()