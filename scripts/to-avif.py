"""Writes an AVIF (quality 60) next to each mask PNG the masker loads: the classic overlay masks
and their thumbnails, the flag motifs and full flags, and the PictureGame server emojis.

The app loads the .avif files; the PNGs stay for old/v2 and for sessions saved before the switch.
At quality 60 the masks look the same at 100% and are 20-35% of the PNG's size
(comparisons in comparisons/avif-q60 when that folder is around).

    python scripts/to-avif.py           converts PNGs that are new or changed since their AVIF
    python scripts/to-avif.py --force   converts all of them again

Needs Pillow 11.3 or newer (AVIF support).
"""
import glob
import os
import sys

from PIL import Image, features

QUALITY = 60
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PATTERNS = [
    'images/[0-9]*.png',
    'images/flag-masks/motifs/*.png',
    'images/flag-masks/full/*.png',
    'images/discord-emojis/*.png',
]


def main():
    if not features.check('avif'):
        sys.exit('This Pillow has no AVIF support: pip install -U pillow')

    force = '--force' in sys.argv
    converted = skipped = 0
    before = after = 0

    for pattern in PATTERNS:
        for source in sorted(glob.glob(os.path.join(ROOT, pattern))):
            target = source[:-4] + '.avif'

            if not force and os.path.exists(target) and os.path.getmtime(target) >= os.path.getmtime(source):
                skipped += 1
                continue

            with Image.open(source) as image:
                image = image.convert('RGBA')
                image.save(target, 'AVIF', quality=QUALITY, speed=4)

            converted += 1
            before += os.path.getsize(source)
            after += os.path.getsize(target)

    if converted:
        print(f'{converted} converted: {before / 1048576:.1f} MB of PNG -> {after / 1048576:.1f} MB of AVIF ({skipped} already up to date)')
    else:
        print(f'all {skipped} up to date')


if __name__ == '__main__':
    main()
