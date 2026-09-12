import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = join(root, 'public', 'maps-config.json');
const apiKey = process.env['GOOGLE_MAPS_API_KEY']?.trim();

if (!apiKey) {
  console.warn(
    '[maps-config] GOOGLE_MAPS_API_KEY no está definida. ' +
      'Copia public/maps-config.example.json a public/maps-config.json o exporta la variable.',
  );
  process.exit(0);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ googleMapsApiKey: apiKey }, null, 2)}\n`, 'utf8');
console.log('[maps-config] public/maps-config.json generado desde GOOGLE_MAPS_API_KEY');
