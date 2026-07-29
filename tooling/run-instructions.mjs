import { readFile, writeFile } from 'node:fs/promises';

const rootPackagePath = new URL('../package.json', import.meta.url);
const webPackagePath = new URL('../apps/web/package.json', import.meta.url);
const outputPath = new URL('../docs/run.md', import.meta.url);
const mode = process.argv.at(2);

function buildDocument(rootPackage, webPackage) {
  const nodeVersion = rootPackage.engines?.node;
  const packageManager = rootPackage.packageManager;
  const devScript = webPackage.scripts?.dev;
  if (!nodeVersion || !packageManager || !devScript) {
    throw new Error('Faltan engines.node, packageManager o apps/web.scripts.dev.');
  }

  return `# Ejecutar CuotaClara\n\n> Generado desde \`package.json\` y \`apps/web/package.json\`. No editar manualmente.\n\n## Requisitos\n\n- Node.js ${nodeVersion}.\n- Gestor fijado por el repositorio: \`${packageManager}\`.\n\n## Preparar el entorno\n\nEn una instalación nueva, habilita el shim de Corepack una sola vez y abre una terminal nueva:\n\n\`\`\`bash\ncorepack enable\n\`\`\`\n\nSi Node está instalado en una ubicación protegida y el comando no tiene permisos, usa \`sudo corepack enable\`. Después instala exactamente el lockfile:\n\n\`\`\`bash\ncd /ruta/a/cuota-clara\npnpm install --frozen-lockfile\n\`\`\`\n\n## Iniciar la interfaz\n\nCon el shim de pnpm disponible, el comando normal es:\n\n\`\`\`bash\ncd /ruta/a/cuota-clara\npnpm --filter ${webPackage.name} run dev\n\`\`\`\n\nVite mostrará una URL local, normalmente \`http://localhost:5173\`.\n\n### Alternativa sin un comando global \`pnpm\`\n\nSi las dependencias ya están instaladas pero Corepack no puede relanzar \`pnpm\`, inicia el binario local de Vite:\n\n\`\`\`bash\ncd /ruta/a/cuota-clara/apps/web\n../../node_modules/.bin/vite\n\`\`\`\n\nNo uses \`--root\` con la versión de Vite fijada por el repositorio. Para detener el servidor, presiona \`Ctrl+C\`.\n\n## Comprobar una compilación de producción\n\n\`\`\`bash\ncd /ruta/a/cuota-clara/apps/web\n../../node_modules/.bin/vite build\n\`\`\`\n`;
}

const rootPackage = JSON.parse(await readFile(rootPackagePath, 'utf8'));
const webPackage = JSON.parse(await readFile(webPackagePath, 'utf8'));
const generated = buildDocument(rootPackage, webPackage);

if (mode === '--write') {
  await writeFile(outputPath, generated);
  process.stdout.write('docs/run.md actualizado.\n');
} else if (mode === '--check') {
  const current = await readFile(outputPath, 'utf8');
  if (current !== generated) {
    throw new Error('docs/run.md está desactualizado. Ejecuta pnpm docs:sync.');
  }
  process.stdout.write('Instrucciones de ejecución consistentes.\n');
} else {
  throw new Error('Uso: node tooling/run-instructions.mjs --write|--check');
}
