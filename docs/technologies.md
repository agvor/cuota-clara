# Tecnologías seleccionadas

## Base del MVP

| Área                  | Elección                                | Motivo                                                                                |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------------------------- |
| Lenguaje              | TypeScript estricto                     | Tipos compartibles entre dominio, aplicación y PWA.                                   |
| Interfaz              | React                                   | Ecosistema maduro para interfaces ricas y responsive.                                 |
| Construcción          | Vite                                    | Entorno rápido, extensible y adecuado para una PWA estática.                          |
| PWA                   | `vite-plugin-pwa` / Workbox             | Instalación y funcionamiento sin conexión con configuración explícita.                |
| Datos locales         | IndexedDB mediante Dexie                | Base transaccional del navegador, abstraída tras repositorios.                        |
| Validación de límites | Zod                                     | Validación de formularios, CSV, respaldo y datos persistidos.                         |
| Dinero decimal        | `decimal.js` encapsulado por `Money`    | Evita errores de punto flotante binario y hace explícito el redondeo.                 |
| Estado de interfaz    | Zustand                                 | Estado de UI simple; los cálculos siguen fuera del store.                             |
| Tablas y gráficos     | TanStack Table/Virtual y Apache ECharts | Tablas extensas y comparaciones sin implementar virtualización o gráficos desde cero. |
| CSV                   | Papa Parse                              | Parseo robusto; la normalización regional queda en adaptador propio.                  |
| Pruebas               | Vitest, Testing Library y Playwright    | Unidades de dominio, componentes y recorridos críticos.                               |
| Calidad               | ESLint, Prettier y TypeScript           | Reglas uniformes y verificables en CI.                                                |

Las versiones concretas se fijan al instalar dependencias y se registran en el lockfile. La persistencia local usa Dexie 4.4.4 y sus pruebas usan `fake-indexeddb` 6.2.5. La PWA usa React 19.2.8, Vite 8.1.5 y `vite-plugin-pwa` 1.3.0; las demás dependencias se incorporarán cuando se implemente el módulo que las necesita.

Las herramientas base de desarrollo ya están fijadas en `package.json` y `pnpm-lock.yaml`: Vitest para pruebas, ESLint y TypeScript para análisis estático, Prettier para formato y Commitlint para la convención de commits.

## Criterios de selección

- Debe funcionar como aplicación estática sin servidor para el MVP.
- Debe permitir separar dominio, adaptadores y UI.
- Debe soportar almacenamiento local, exportación y futura sincronización sin acoplarlas.
- Debe tener licencia compatible con distribución comercial futura y mantenimiento activo comprobado al incorporarse.
- Se prefiere la menor complejidad que cumpla los requisitos.

## Alternativas descartadas por ahora

- **Backend, autenticación y base de datos remota:** añaden costos, privacidad y operación sin aportar valor básico al MVP.
- **Microservicios:** no se justifican en un producto local-first de un solo equipo.
- **Rust/WASM para el motor:** puede revisarse ante necesidades probadas de rendimiento o reutilización móvil; TypeScript aislado ofrece menor fricción inicial.
- **React Native o aplicaciones nativas:** la PWA cubre primero escritorio, móvil y tableta desde una única base.

React 19 es la línea estable documentada por el proyecto de React; Vite ofrece una configuración orientada a aplicaciones web modernas y Dexie encapsula IndexedDB, por lo que son compatibles con este enfoque local-first. [React](https://react.dev/versions), [Vite](https://vite.dev/guide/), [Dexie](https://dexie.org/docs)
