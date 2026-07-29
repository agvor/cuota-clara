import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../docs/traceability.json', import.meta.url);
const outputPath = new URL('../docs/status.md', import.meta.url);
const mode = process.argv.at(2);
const allowedStatuses = new Set(['planned', 'in_progress', 'completed']);

function title(status) {
  return { planned: 'Planeado', in_progress: 'En curso', completed: 'Completado' }[status];
}

function buildDocument(data) {
  const milestones = [...new Set(data.requirements.map(({ milestone }) => milestone))].sort();
  const count = (items, status) => items.filter((item) => item.status === status).length;
  const rows = milestones.map((milestone) => {
    const items = data.requirements.filter((item) => item.milestone === milestone);
    return `| ${milestone} | ${count(items, 'planned')} | ${count(items, 'in_progress')} | ${count(items, 'completed')} |`;
  });
  const details = [...data.requirements]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((item) => `| ${item.id} | ${item.milestone} | ${title(item.status)} |`);

  return `# Estado de requisitos\n\n> Generado desde \`docs/traceability.json\` el ${data.updatedAt}. No editar manualmente.\n\n| Hito | Planeado | En curso | Completado |\n| --- | ---: | ---: | ---: |\n${rows.join('\n')}\n\n| Estado | Cantidad |\n| --- | ---: |\n| Planeado | ${count(data.requirements, 'planned')} |\n| En curso | ${count(data.requirements, 'in_progress')} |\n| Completado | ${count(data.requirements, 'completed')} |\n\n## Detalle\n\n| ID | Hito | Estado |\n| --- | --- | --- |\n${details.join('\n')}\n`;
}

const data = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!Array.isArray(data.requirements) || !data.updatedAt) throw new Error('Trazabilidad inválida.');
for (const item of data.requirements) {
  if (!item.id || !item.milestone || !allowedStatuses.has(item.status)) {
    throw new Error(`Requisito de trazabilidad inválido: ${JSON.stringify(item)}`);
  }
}
const generated = buildDocument(data);

if (mode === '--write') {
  await writeFile(outputPath, generated);
  process.stdout.write('docs/status.md actualizado.\n');
} else if (mode === '--check') {
  const current = await readFile(outputPath, 'utf8');
  if (current !== generated)
    throw new Error('docs/status.md está desactualizado. Ejecuta npm run docs:sync.');
  process.stdout.write('Documentación generada consistente.\n');
} else {
  throw new Error('Uso: node tooling/docs-status.mjs --write|--check');
}
