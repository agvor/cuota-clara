import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { DexieLoanRepository } from '@cuotaclara/local-storage';

import { App } from './app.js';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró el elemento raíz de CuotaClara.');

createRoot(root).render(
  <StrictMode>
    <App repository={new DexieLoanRepository()} />
  </StrictMode>,
);
