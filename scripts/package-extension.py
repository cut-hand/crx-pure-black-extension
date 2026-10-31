"""Build a runtime-only ZIP with manifest.json at its root."""
import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'manifest.json').read_text())
version = manifest['version']
for file in ['package.json']:
    assert json.loads((root / file).read_text())['version'] == version
for file in ['content.js', 'popup.js']:
    assert f"'{version}'" in (root / file).read_text(), f'{file}: preview version differs'
files = {'manifest.json', 'background.js', 'content.js', 'content.css',
         'theme.js', 'lamp.js', 'popup.html', 'popup.js', 'popup.css'}
files.update(p.relative_to(root).as_posix() for p in (root / 'icons').iterdir()
             if p.suffix in {'.png', '.svg'})
for name in [*manifest['icons'].values(), *manifest['action']['default_icon'].values()]:
    assert name in files and (root / name).is_file(), name
output = root / 'downloads' / f'Pure-Black-{version}.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for name in sorted(files):
        entry = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        entry.compress_type = ZIP_DEFLATED
        entry.external_attr = 0o100644 << 16
        archive.writestr(entry, (root / name).read_bytes())
with ZipFile(output) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == files
    assert json.loads(archive.read('manifest.json'))['version'] == version
    for name in files:
        assert archive.read(name) == (root / name).read_bytes()
print(f'{output}\n{len(files)} files, {output.stat().st_size} bytes\nSHA256 {hashlib.sha256(output.read_bytes()).hexdigest()}')
