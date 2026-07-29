import { readFile, writeFile } from 'node:fs/promises';

const sourcePath = new URL('../docs/backlog.json', import.meta.url);
const outputPath = new URL('../docs/implementation-status.md', import.meta.url);
const mode = process.argv.at(2);
const statuses = ['planned', 'ready', 'in_progress', 'blocked', 'completed'];
const labels = {
  planned: 'Planeado',
  ready: 'Listo',
  in_progress: 'En curso',
  blocked: 'Bloqueado',
  completed: 'Completado',
};

function count(items, status) {
  return items.filter((item) => item.status === status).length;
}

function buildDocument(data) {
  const epics = [...new Set(data.items.map((item) => item.epic))];
  const epicRows = epics.map((epic) => {
    const items = data.items.filter((item) => item.epic === epic);
    return `| ${epic} | ${count(items, 'planned')} | ${count(items, 'ready')} | ${count(items, 'in_progress')} | ${count(items, 'blocked')} | ${count(items, 'completed')} |`;
  });
  const byId = new Map(data.items.map((item) => [item.id, item]));
  const next = data.items.find(
    (item) =>
      item.status === 'ready' && item.dependsOn.every((id) => byId.get(id)?.status === 'completed'),
  );
  const rows = data.items.map(
    (item) =>
      `| ${item.id} | ${item.epic} | ${item.title} | ${labels[item.status]} | ${item.dependsOn.join(', ') || '—'} |`,
  );

  return `# Estado de implementación\n\n> Generado desde \`docs/backlog.json\` el ${data.updatedAt}. No editar manualmente.\n\n${next ? `**Siguiente ítem habilitado:** ${next.id} — ${next.title}\n` : '**Siguiente ítem habilitado:** ninguno; revisar dependencias o bloqueos.\n'}\n| Épica | Planeado | Listo | En curso | Bloqueado | Completado |\n| --- | ---: | ---: | ---: | ---: | ---: |\n${epicRows.join('\n')}\n\n## Historias\n\n| ID | Épica | Historia | Estado | Depende de |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n`;
}

const data = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!data.updatedAt || !Array.isArray(data.items)) throw new Error('Backlog inválido.');
const ids = new Set();
let inProgress = 0;
for (const item of data.items) {
  if (
    !item.id ||
    !item.epic ||
    !item.title ||
    !Array.isArray(item.requirements) ||
    !Array.isArray(item.dependsOn) ||
    !Array.isArray(item.acceptanceCriteria) ||
    !statuses.includes(item.status)
  ) {
    throw new Error(`Historia inválida: ${JSON.stringify(item)}`);
  }
  if (ids.has(item.id)) throw new Error(`Historia duplicada: ${item.id}`);
  ids.add(item.id);
  if (item.status === 'in_progress') inProgress += 1;
}
if (inProgress > 1) throw new Error('Solo puede haber una historia en curso.');
for (const item of data.items) {
  for (const dependency of item.dependsOn) {
    if (!ids.has(dependency))
      throw new Error(`${item.id} depende de una historia inexistente: ${dependency}`);
  }
}
const generated = buildDocument(data);

if (mode === '--write') {
  await writeFile(outputPath, generated);
  process.stdout.write('docs/implementation-status.md actualizado.\n');
} else if (mode === '--check') {
  const current = await readFile(outputPath, 'utf8');
  if (current !== generated) {
    throw new Error('docs/implementation-status.md está desactualizado. Ejecuta pnpm docs:sync.');
  }
  process.stdout.write('Backlog generado consistente.\n');
} else {
  throw new Error('Uso: node tooling/backlog-status.mjs --write|--check');
}
