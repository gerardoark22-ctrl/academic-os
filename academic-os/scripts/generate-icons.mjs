import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
const avatar = join(iconsDir, 'gerardex-avatar.png');

if (!existsSync(avatar)) {
  console.warn('⚠️  Coloca gerardex-avatar.png en public/icons/');
  process.exit(0);
}

const py = `
from PIL import Image
from pathlib import Path
src = Path(${JSON.stringify(avatar)})
out = Path(${JSON.stringify(iconsDir)})
img = Image.open(src).convert('RGBA')
for size in (192, 512):
    r = img.copy()
    r.thumbnail((size, size), Image.Resampling.LANCZOS)
    bg = Image.new('RGBA', (size, size), (44, 36, 22, 255))
    bg.paste(r, ((size - r.width) // 2, (size - r.height) // 2), r)
    bg.save(out / f'gerardex-{size}.png')
print('ok')
`;

execSync(`python -c ${JSON.stringify(py)}`, { stdio: 'inherit' });
console.log('✅ Iconos PWA generados desde gerardex-avatar.png');
