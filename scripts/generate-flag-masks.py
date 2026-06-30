#!/usr/bin/env python3
"""Generate local flag mask motifs and JSON config from the current Imgur list."""

from __future__ import annotations

import concurrent.futures
import json
import math
import re
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


ROOT = Path(__file__).resolve().parents[1]
MASK_DATA = ROOT / "src" / "masks" / "maskData.js"
MOTIF_DIR = ROOT / "images" / "flag-masks" / "motifs"
FULL_DIR = ROOT / "images" / "flag-masks" / "full"
CONFIG_PATH = ROOT / "src" / "masks" / "flagMaskConfig.json"
CACHE_DIR = Path(tempfile.gettempdir()) / "imagemasker-flag-mask-source-cache"
USER_AGENT = "ImageMasker flag mask generator"


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "flag-mask"


def read_entries() -> list[dict]:
    source = MASK_DATA.read_text(encoding="utf-8")
    matches = re.findall(
        r'\{\s*name:\s*"([^"]+)",\s*url:\s*"([^"]+)"\s*\}',
        source,
    )

    if not matches:
        raise RuntimeError(f"No flag mask entries found in {MASK_DATA}")

    used_ids: dict[str, int] = {}
    entries = []

    for name, url in matches:
        base_id = slugify(name)
        index = used_ids.get(base_id, 0)
        used_ids[base_id] = index + 1
        flag_id = base_id if index == 0 else f"{base_id}-{index + 1}"
        entries.append(
            {
                "id": flag_id,
                "name": name,
                "legacyUrl": url,
                "sourceFile": url.rsplit("/", 1)[-1],
            }
        )

    return entries


def download_source(entry: dict) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / entry["sourceFile"]

    if not path.exists() or path.stat().st_size == 0:
        request = urllib.request.Request(
            entry["legacyUrl"],
            headers={"User-Agent": USER_AGENT},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            path.write_bytes(response.read())

    return path


def median(values: list[float]) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    return ordered[len(ordered) // 2]


def rounded(value: float) -> float:
    return round(float(value), 3)


def analyze_components(image: Image.Image) -> dict:
    rgba = image.convert("RGBA")
    alpha = np.array(rgba)[:, :, 3]
    labels, _ = ndimage.label(alpha > 0)
    objects = ndimage.find_objects(labels)
    boxes = []

    for index, slices in enumerate(objects, start=1):
        if slices is None:
            continue

        y_slice, x_slice = slices
        area = int((labels[slices] == index).sum())

        if area <= 20:
            continue

        boxes.append(
            {
                "x": x_slice.start,
                "y": y_slice.start,
                "width": x_slice.stop - x_slice.start,
                "height": y_slice.stop - y_slice.start,
                "area": area,
                "cx": (x_slice.start + x_slice.stop) / 2,
                "cy": (y_slice.start + y_slice.stop) / 2,
            }
        )

    if not boxes:
        raise RuntimeError("No visible motif components found.")

    largest_area = max(box["area"] for box in boxes)
    largest_width = max(box["width"] for box in boxes)
    largest_height = max(box["height"] for box in boxes)
    full_boxes = [
        box
        for box in boxes
        if box["area"] >= largest_area * 0.72
        and box["width"] >= largest_width * 0.72
        and box["height"] >= largest_height * 0.72
    ]

    return {
        "boxes": boxes,
        "fullBoxes": full_boxes or boxes,
        "largestArea": largest_area,
        "largestWidth": largest_width,
        "largestHeight": largest_height,
    }


def choose_motif_box(analysis: dict, width: int, height: int) -> dict:
    full_boxes = analysis["fullBoxes"]
    largest_area = max(box["area"] for box in full_boxes)
    candidates = [
        box
        for box in full_boxes
        if box["area"] >= largest_area * 0.9
        and box["x"] > 2
        and box["y"] > 2
        and box["x"] + box["width"] < width - 2
        and box["y"] + box["height"] < height - 2
    ]

    if not candidates:
        candidates = full_boxes

    center_x = width / 2
    center_y = height / 2
    return min(
        candidates,
        key=lambda box: (box["cx"] - center_x) ** 2 + (box["cy"] - center_y) ** 2,
    )


def cluster_rows(boxes: list[dict], motif_height: int) -> list[list[dict]]:
    rows: list[list[dict]] = []
    threshold = max(24, motif_height * 0.45)

    for box in sorted(boxes, key=lambda item: item["cy"]):
        for row in rows:
            row_y = sum(item["cy"] for item in row) / len(row)
            if abs(row_y - box["cy"]) <= threshold:
                row.append(box)
                break
        else:
            rows.append([box])

    return rows


def infer_spacing(full_boxes: list[dict], rows: list[list[dict]]) -> tuple[float, float]:
    full_ids = {id(box) for box in full_boxes}
    x_diffs: list[float] = []
    row_centers: list[float] = []

    for row in rows:
        full_row = sorted([box for box in row if id(box) in full_ids], key=lambda item: item["cx"])

        if full_row:
            row_centers.append(median([box["cy"] for box in full_row]) or full_row[0]["cy"])

        for left, right in zip(full_row, full_row[1:]):
            diff = right["cx"] - left["cx"]
            if diff > 4:
                x_diffs.append(diff)

    y_diffs = [
        right - left
        for left, right in zip(row_centers, row_centers[1:])
        if right - left > 4
    ]

    spacing_x = median(x_diffs) or max(box["width"] for box in full_boxes)
    spacing_y = median(y_diffs) or max(box["height"] for box in full_boxes)

    return spacing_x, spacing_y


def infer_pattern_rows(
    analysis: dict,
    motif_box: dict,
    source_width: int,
    source_height: int,
) -> list[dict]:
    boxes = analysis["boxes"]
    full_boxes = analysis["fullBoxes"]
    rows = cluster_rows(boxes, analysis["largestHeight"])
    full_ids = {id(box) for box in full_boxes}
    spacing_x, spacing_y = infer_spacing(full_boxes, rows)
    motif_alpha_half_width = motif_box["width"] / 2
    motif_alpha_half_height = motif_box["height"] / 2
    pattern_rows: list[dict] = []

    for row_index, row in enumerate(rows):
        row_all = sorted(row, key=lambda item: item["cx"])
        row_full = sorted([box for box in row_all if id(box) in full_ids], key=lambda item: item["cx"])

        if row_full:
            center_y = median([box["cy"] for box in row_full]) or row_full[0]["cy"]
            min_center = row_full[0]["cx"]
            max_center = row_full[-1]["cx"]
            centers = [box["cx"] for box in row_full]

            if row_all[0]["cx"] < min_center - spacing_x * 0.28:
                centers.insert(0, min_center - spacing_x)

            if row_all[-1]["cx"] > max_center + spacing_x * 0.28:
                centers.append(max_center + spacing_x)
        else:
            previous = pattern_rows[-1] if pattern_rows else None
            two_back = pattern_rows[-2] if len(pattern_rows) >= 2 else None
            center_y = (
                previous["y"] + spacing_y
                if previous
                else (median([box["cy"] for box in row_all]) or 0)
            )
            centers = list(two_back["centers"] if two_back else previous["centers"] if previous else [])

        if row_index == 0 and row_full and center_y - spacing_y + motif_alpha_half_height > 0:
            # Some masks begin with a clipped row above the first full row.
            visible_above = any(box["cy"] < center_y - spacing_y * 0.35 for box in boxes)
            if visible_above:
                pattern_rows.append(
                    {
                        "y": rounded(center_y - spacing_y),
                        "centers": [rounded(value) for value in centers],
                    }
                )

        # If the original detection saw clipped edge pieces, extend from the full row.
        while centers and centers[0] - spacing_x + motif_alpha_half_width > 0:
            visible_left = any(box["cx"] < centers[0] - spacing_x * 0.28 for box in row_all)
            if not visible_left:
                break
            centers.insert(0, centers[0] - spacing_x)

        while centers and centers[-1] + spacing_x - motif_alpha_half_width < source_width:
            visible_right = any(box["cx"] > centers[-1] + spacing_x * 0.28 for box in row_all)
            if not visible_right:
                break
            centers.append(centers[-1] + spacing_x)

        pattern_rows.append(
            {
                "y": rounded(center_y),
                "centers": [rounded(value) for value in centers],
            }
        )

    # Tiny bottom slivers are below the last full row in a few masks. If component
    # detection saw them as their own row, infer the off-canvas center from cadence.
    last_row = pattern_rows[-1]
    if last_row["y"] + spacing_y - motif_alpha_half_height < source_height:
        bottom_candidates = [
            box for box in boxes if box["cy"] > last_row["y"] + spacing_y * 0.35
        ]
        if bottom_candidates:
            template = pattern_rows[-2] if len(pattern_rows) >= 2 else last_row
            pattern_rows.append(
                {
                    "y": rounded(last_row["y"] + spacing_y),
                    "centers": [rounded(value) for value in template["centers"]],
                }
            )

    return pattern_rows


def make_motif(image: Image.Image, motif_box: dict, output_path: Path) -> dict:
    pad = 4
    left = max(0, motif_box["x"] - pad)
    top = max(0, motif_box["y"] - pad)
    right = min(image.width, motif_box["x"] + motif_box["width"] + pad)
    bottom = min(image.height, motif_box["y"] + motif_box["height"] + pad)
    crop = image.crop((left, top, right, bottom))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(output_path, optimize=True)

    return {
        "src": f"images/flag-masks/motifs/{output_path.name}",
        "width": crop.width,
        "height": crop.height,
        "anchorX": rounded(motif_box["cx"] - left),
        "anchorY": rounded(motif_box["cy"] - top),
    }


def render_rows_for_verification(flag_config: dict) -> Image.Image:
    output = Image.new(
        "RGBA",
        (flag_config["source"]["width"], flag_config["source"]["height"]),
        (0, 0, 0, 0),
    )
    motif = Image.open(ROOT / flag_config["motif"]["src"]).convert("RGBA")

    for row in flag_config["pattern"]["rows"]:
        y = round(row["y"] - flag_config["motif"]["anchorY"])

        for center_x in row["centers"]:
            x = round(center_x - flag_config["motif"]["anchorX"])
            output.alpha_composite(motif, (x, y))

    return output


def compare_visible_pixels(source: Image.Image, candidate: Image.Image) -> dict:
    source_array = np.asarray(source.convert("RGBA"), dtype=np.int16)
    candidate_array = np.asarray(candidate.convert("RGBA"), dtype=np.int16)
    source_alpha = source_array[:, :, 3:4] / 255
    candidate_alpha = candidate_array[:, :, 3:4] / 255
    source_premultiplied = (source_array[:, :, :3] * source_alpha).astype(np.int16)
    candidate_premultiplied = (candidate_array[:, :, :3] * candidate_alpha).astype(np.int16)
    rgb_diff = np.abs(source_premultiplied - candidate_premultiplied)
    alpha_diff = np.abs(source_array[:, :, 3] - candidate_array[:, :, 3])
    changed = ((rgb_diff.max(axis=2) > 8) | (alpha_diff > 8)).mean() * 100
    mae = (rgb_diff.sum() + alpha_diff.sum()) / (
        source_array.shape[0] * source_array.shape[1] * 4
    )

    return {
        "changed": float(changed),
        "mae": float(mae),
        "alphaMean": float(alpha_diff.mean()),
    }


def make_full_image(image: Image.Image, output_path: Path) -> dict:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)

    return {
        "src": f"images/flag-masks/full/{output_path.name}",
        "width": image.width,
        "height": image.height,
    }


def process_unique_source(source_file: str, source_path: Path, output_name: str) -> dict:
    image = Image.open(source_path).convert("RGBA")
    analysis = analyze_components(image)
    motif_box = choose_motif_box(analysis, image.width, image.height)
    motif_path = MOTIF_DIR / output_name
    motif = make_motif(image, motif_box, motif_path)
    rows = infer_pattern_rows(analysis, motif_box, image.width, image.height)
    config = {
        "renderMode": "rows",
        "source": {
            "width": image.width,
            "height": image.height,
        },
        "motif": motif,
        "pattern": {
            "rows": rows,
        },
    }
    verification = compare_visible_pixels(image, render_rows_for_verification(config))

    if verification["changed"] > 2.0 or verification["mae"] > 1.5:
        motif_path.unlink(missing_ok=True)
        full = make_full_image(image, FULL_DIR / output_name)
        return {
            "renderMode": "full",
            "source": {
                "width": image.width,
                "height": image.height,
            },
            "full": full,
            "verification": {
                "rowsChanged": round(verification["changed"], 3),
                "rowsMae": round(verification["mae"], 3),
            },
        }

    config["verification"] = {
        "rowsChanged": round(verification["changed"], 3),
        "rowsMae": round(verification["mae"], 3),
    }
    return config


def main() -> None:
    entries = read_entries()
    MOTIF_DIR.mkdir(parents=True, exist_ok=True)
    FULL_DIR.mkdir(parents=True, exist_ok=True)

    for path in MOTIF_DIR.glob("*.png"):
        path.unlink()

    for path in FULL_DIR.glob("*.png"):
        path.unlink()

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
        downloads = list(executor.map(download_source, entries))

    source_paths = {
        entry["sourceFile"]: path
        for entry, path in zip(entries, downloads, strict=True)
    }
    by_source: defaultdict[str, list[dict]] = defaultdict(list)

    for entry in entries:
        by_source[entry["sourceFile"]].append(entry)

    used_motif_names: dict[str, int] = {}
    source_configs: dict[str, dict] = {}

    for source_file, source_entries in sorted(by_source.items()):
        base_name = slugify(source_entries[0]["name"])
        count = used_motif_names.get(base_name, 0)
        used_motif_names[base_name] = count + 1
        motif_name = f"{base_name}.png" if count == 0 else f"{base_name}-{count + 1}.png"
        source_configs[source_file] = process_unique_source(
            source_file,
            source_paths[source_file],
            motif_name,
        )

    masks = []

    for entry in entries:
        config = source_configs[entry["sourceFile"]]
        masks.append(
            {
                "id": entry["id"],
                "name": entry["name"],
                "legacyUrl": entry["legacyUrl"],
                "renderMode": config["renderMode"],
                "source": config["source"],
                **(
                    {
                        "motif": config["motif"],
                        "pattern": config["pattern"],
                    }
                    if config["renderMode"] == "rows"
                    else {
                        "full": config["full"],
                    }
                ),
            }
        )

    CONFIG_PATH.write_text(
        json.dumps(
            {
                "version": 1,
                "description": "Generated local flag masks. Run scripts/generate-flag-masks.py to refresh.",
                "masks": masks,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    full_size = sum(path.stat().st_size for path in source_paths.values())
    motif_size = sum(path.stat().st_size for path in MOTIF_DIR.glob("*.png"))
    fallback_size = sum(path.stat().st_size for path in FULL_DIR.glob("*.png"))
    fallback_count = sum(1 for config in source_configs.values() if config["renderMode"] == "full")
    print(f"Generated {len(masks)} flag configs from {len(source_configs)} unique images.")
    print(f"Full-image fallbacks: {fallback_count}")
    print(f"Source cache size: {full_size / 1024 / 1024:.2f} MiB")
    print(f"Motif asset size: {motif_size / 1024 / 1024:.2f} MiB")
    print(f"Full fallback asset size: {fallback_size / 1024 / 1024:.2f} MiB")
    print(f"Wrote {CONFIG_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
