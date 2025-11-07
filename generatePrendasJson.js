const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, 'src/assets/prendas');
const OUTPUT_FILE = path.join(__dirname, 'src/assets/data/prendas.json');

const VISTAS_MAP = {
  'delantera':         { key: 'frontal', nombre: 'Frontal' },
  'lateral_delantera': { key: 'frontal', nombre: 'Frontal' },
  'trasera':           { key: 'trasera', nombre: 'Trasera' },
  'lateral_a':         { key: 'perfilIzq', nombre: 'Perfil Izquierdo' },
  'lateral_b':         { key: 'perfilDer', nombre: 'Perfil Derecho' },
  'frontal':           { key: 'frontal', nombre: 'Frontal' },
  'perfilIzq':         { key: 'perfilIzq', nombre: 'Perfil Izquierdo' },
  'perfilDer':         { key: 'perfilDer', nombre: 'Perfil Derecho' },
};

function toTitleCase(str) {
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function scanDirectory(dirPath) {
  const result = {};

  function walk(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    entries.forEach(entry => {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
        const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
        const parts = relativePath.split('/');

        if (parts.length < 2) return;

        const folder = parts[0];
        const item = parts[1];
        const key = `${folder}_${item}`;
        const nombre = toTitleCase(item);

        const baseFilename = path.basename(entry.name).replace(/\.[^.]+$/, '');

        // Intenta encontrar una vista válida desde el nombre
        const vistaKeyEncontrada = Object.keys(VISTAS_MAP).find(vk => baseFilename.endsWith(vk));
        if (!vistaKeyEncontrada) return;

        const vista = VISTAS_MAP[vistaKeyEncontrada];

        if (!result[key]) {
          result[key] = {
            nombre: nombre,
            valor: 'corto',
            vistas: {},
          };
        }

        result[key].vistas[vista.key] = {
          nombre: vista.nombre,
          ruta: `prendas/${relativePath}`,
        };
      }
    });
  }

  walk(dirPath);
  return result;
}

function main() {
  const prendasData = scanDirectory(ROOT_DIR);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(prendasData, null, 2));
  console.log(`✅ Archivo generado: ${OUTPUT_FILE}`);
}

main();
