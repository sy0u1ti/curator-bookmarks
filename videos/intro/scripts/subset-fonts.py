"""Regenerate the bundled webfonts after changing the film's text."""

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--font-dir",
    type=Path,
    required=True,
    help="Directory containing NotoSansSC-VF.ttf, NotoSerifSC-VF.ttf and SourceSans3-Regular.ttf",
)
args = parser.parse_args()
project = Path(__file__).resolve().parents[1]
text = "".join(
    source.read_text(encoding="utf-8")
    for source in (project / "src").glob("*")
    if source.is_file()
)
text += "".join(chr(code) for code in range(32, 127)) + "·✓“”‘’。，；！？：／（）"
output = project / "public/fonts"
output.mkdir(parents=True, exist_ok=True)
faces = [
    ("NotoSansSC-VF.ttf", "sans-regular.woff2", 400),
    ("NotoSansSC-VF.ttf", "sans-bold.woff2", 750),
    ("NotoSerifSC-VF.ttf", "serif.woff2", 650),
    ("SourceSans3-Regular.ttf", "mono.woff2", None),
]
for source, filename, weight in faces:
    font = TTFont(args.font_dir / source)
    if weight and "fvar" in font:
        font = instantiateVariableFont(font, {"wght": weight}, inplace=True)
    options = subset.Options()
    options.flavor = "woff2"
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(output / filename)
    print(filename, (output / filename).stat().st_size)
