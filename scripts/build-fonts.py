"""Subset the OFL UI fonts in assets-src/fonts to small static WOFF2 files (run once, output is committed).

    pip install fonttools brotli && python3 scripts/build-fonts.py

Fredoka 600 (display: numbers, titles, buttons) and Nunito 800 (body). Fredoka has no Cyrillic,
so Russian falls back to Nunito via the CSS font stack.
"""
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

RANGES = 'U+0020-007E,U+00A0-00FF,U+0100-017F,U+0400-045F,U+2013-2014,U+2018-201E,U+2022,U+2026,U+20AC,U+20BD,U+2190-2193,U+2605,U+00D7'
JOBS = [
    ('Fredoka-Variable.ttf', {'wght': 600, 'wdth': 100}, 'fredoka-600.woff2'),
    ('Nunito-Variable.ttf', {'wght': 800}, 'nunito-800.woff2'),
]
for src, axes, out in JOBS:
    f = TTFont(f'assets-src/fonts/{src}')
    axes = {k: v for k, v in axes.items() if k in [a.axisTag for a in f['fvar'].axes]}
    f = instancer.instantiateVariableFont(f, axes)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'tnum']
    opts.name_IDs = [0, 1, 2, 3, 4, 6]
    s = subset.Subsetter(opts)
    s.populate(unicodes=subset.parse_unicodes(RANGES))
    s.subset(f)
    f.flavor = 'woff2'
    f.save(f'assets-src/fonts/{out}')
    print(out)
