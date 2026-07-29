# Ejecutar CuotaClara

> Generado desde `package.json` y `apps/web/package.json`. No editar manualmente.

## Requisitos

- Node.js >=22.
- Gestor fijado por el repositorio: `pnpm@11.17.0+sha512.cca3cea332ad254bb84145f966d19f4879615210346fc92c79a047f23a0d7b3cca3c3792f0076ba1f1831d277efbcf0a9119b31a9a60eca7fb3d6231f331ef72`.

## Preparar el entorno

En una instalación nueva, habilita el shim de Corepack una sola vez y abre una terminal nueva:

```bash
corepack enable
```

Si Node está instalado en una ubicación protegida y el comando no tiene permisos, usa `sudo corepack enable`. Después instala exactamente el lockfile:

```bash
cd /ruta/a/cuota-clara
pnpm install --frozen-lockfile
```

## Iniciar la interfaz

Con el shim de pnpm disponible, el comando normal es:

```bash
cd /ruta/a/cuota-clara
pnpm --filter @cuotaclara/web run dev
```

Vite mostrará una URL local, normalmente `http://localhost:5173`.

### Alternativa sin un comando global `pnpm`

Si las dependencias ya están instaladas pero Corepack no puede relanzar `pnpm`, inicia el binario local de Vite:

```bash
cd /ruta/a/cuota-clara/apps/web
../../node_modules/.bin/vite
```

No uses `--root` con la versión de Vite fijada por el repositorio. Para detener el servidor, presiona `Ctrl+C`.

## Comprobar una compilación de producción

```bash
cd /ruta/a/cuota-clara/apps/web
../../node_modules/.bin/vite build
```
