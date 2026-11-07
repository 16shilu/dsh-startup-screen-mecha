"""Build the install-only TGZ and three-file share ZIP (Python standard library).

Runtime code, media and committed watermarked installation guides are copied
without conversion. No game installation or local machine paths are required.
"""
from pathlib import Path
from io import BytesIO
import hashlib
import json
import os
import tarfile
import time
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / '.test-output' / 'releases'
OUTPUT.mkdir(parents=True, exist_ok=True)
package = json.loads((ROOT / 'package.json').read_text('utf-8'))
version = package['version']
plugin_name = f'dsh-startup-screen-{version}.tgz'
share_name = f'dsh-startup-screen-mecha-{version}.zip'
share_folder = f'解限机风格DSH启动动画_分享包_{version}'
timestamp = int(os.environ.get('SOURCE_DATE_EPOCH', time.time()))
files = {'package.json': (ROOT / 'package.json').read_bytes()}
for item in package['files']:
    source = ROOT / item
    if not source.exists():
        raise FileNotFoundError(source)
    candidates = sorted(source.rglob('*')) if source.is_dir() else [source]
    for file in candidates:
        if file.is_file():
            files[file.relative_to(ROOT).as_posix()] = file.read_bytes()
for name in files:
    if name.startswith(('preview/', 'test/')) or name in ['打开预览.cmd', 'open-preview.sh', '先读我.txt']:
        raise ValueError('Development/user-preview file in install package: ' + name)
with tarfile.open(OUTPUT / plugin_name, 'w:gz', format=tarfile.PAX_FORMAT) as archive:
    for name, data in sorted(files.items()):
        entry = tarfile.TarInfo('package/' + name)
        entry.size = len(data)
        entry.mode = 0o644
        entry.mtime = timestamp
        archive.addfile(entry, BytesIO(data))

guide_names = {}
for extension in ['pdf', 'docx']:
    data = (ROOT / f'docs/install-guide.zh-CN.{extension}').read_bytes()
    (OUTPUT / f'install-guide.zh-CN.{extension}').write_bytes(data)
    guide_names[f'解限机风格DSH启动动画_安装说明.{extension}'] = data
with zipfile.ZipFile(OUTPUT / share_name, 'w', zipfile.ZIP_DEFLATED) as archive:
    archive.writestr(share_folder + '/' + plugin_name, (OUTPUT / plugin_name).read_bytes())
    for name, data in guide_names.items():
        archive.writestr(share_folder + '/' + name, data)
with zipfile.ZipFile(OUTPUT / share_name) as archive:
    if archive.testzip() is not None or len(archive.namelist()) != 3:
        raise ValueError('Share ZIP integrity check failed')
manifest = json.loads(files['docs/MECHA-ASSET-SOURCES.json'])
for row in manifest['audio']:
    if hashlib.sha256(files['lib/assets/' + row['file']]).hexdigest() != row['sha256']:
        raise ValueError('Audio checksum mismatch: ' + row['file'])
for field, filename_key, hash_key in [('icon', 'png', 'pngSha256'), ('wordmark', 'png', 'pngSha256'), ('animation', 'file', 'sha256')]:
    row = manifest[field]
    if hashlib.sha256(files['lib/assets/' + row[filename_key]]).hexdigest() != row[hash_key]:
        raise ValueError('Visual checksum mismatch: ' + field)
assets = [plugin_name, share_name, 'install-guide.zh-CN.pdf', 'install-guide.zh-CN.docx']
checksums = '\n'.join(hashlib.sha256((OUTPUT / name).read_bytes()).hexdigest() + '  ' + name for name in assets)
(OUTPUT / 'SHA256SUMS.txt').write_text(checksums + '\n', 'utf-8')
print(json.dumps({'version': version, 'directory': str(OUTPUT), 'runtimeFiles': len(files),
    'assets': [{'name': name, 'bytes': (OUTPUT / name).stat().st_size} for name in assets + ['SHA256SUMS.txt']]}, ensure_ascii=False, indent=2))
