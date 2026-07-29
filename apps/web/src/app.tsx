import { useEffect, useState } from 'react';

import type { Loan, LoanRepository } from '@cuotaclara/domain';

import './styles.css';

export type AppProps = Readonly<{
  repository: LoanRepository;
}>;

type LoadState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; loans: readonly Loan[] }>
  | Readonly<{ status: 'error' }>;

function formatMoney(loan: Loan, amount: Loan['initialBalance']): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: amount.currency,
    minimumFractionDigits: loan.roundingPolicy.scale,
    maximumFractionDigits: loan.roundingPolicy.scale,
  }).format(Number(amount.toFixed(loan.roundingPolicy)));
}

export function App({ repository }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedLoanId, setSelectedLoanId] = useState<string>();

  useEffect(() => {
    let active = true;
    void repository
      .listLoans()
      .then((loans) => {
        if (active) setState({ status: 'ready', loans });
      })
      .catch(() => {
        if (active) setState({ status: 'error' });
      });
    return () => {
      active = false;
    };
  }, [repository]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#loans">
        Ir a préstamos
      </a>
      <header className="site-header">
        <a className="brand" href="#loans" aria-label="CuotaClara, inicio">
          CuotaClara
        </a>
        <nav aria-label="Principal">
          <a href="#loans">Préstamos</a>
          <a href="#about">Acerca de</a>
        </nav>
      </header>
      <main>
        <section id="loans" aria-labelledby="loans-title">
          <p className="eyebrow">Local-first · sin cuenta</p>
          <h1 id="loans-title">Tus préstamos</h1>
          <p className="section-introduction">
            Consulta cada préstamo por separado y conserva los datos en este dispositivo.
          </p>
          {state.status === 'loading' ? <p aria-live="polite">Cargando préstamos…</p> : null}
          {state.status === 'error' ? (
            <p role="alert">
              No fue posible leer los préstamos locales. Intenta recargar la página.
            </p>
          ) : null}
          {state.status === 'ready' && state.loans.length === 0 ? <EmptyLoans /> : null}
          {state.status === 'ready' && state.loans.length > 0 ? (
            <>
              <ul className="loan-list" aria-label="Préstamos guardados">
                {state.loans.map((loan) => (
                  <li key={loan.id}>
                    <article className="loan-card">
                      <h2>{loan.name}</h2>
                      <dl>
                        <div>
                          <dt>Saldo inicial</dt>
                          <dd>{formatMoney(loan, loan.initialBalance)}</dd>
                        </div>
                        <div>
                          <dt>Cuota ordinaria</dt>
                          <dd>{formatMoney(loan, loan.ordinaryPayment)}</dd>
                        </div>
                        <div>
                          <dt>Tasa nominal anual</dt>
                          <dd>{Number(loan.annualNominalRate) * 100}%</dd>
                        </div>
                      </dl>
                      <button type="button" onClick={() => setSelectedLoanId(loan.id)}>
                        Ver préstamo
                      </button>
                    </article>
                  </li>
                ))}
              </ul>
              {selectedLoanId ? (
                <LoanDetail loan={state.loans.find((loan) => loan.id === selectedLoanId)} />
              ) : null}
            </>
          ) : null}
        </section>
        <section id="about" className="about" aria-labelledby="about-title">
          <h2 id="about-title">Datos bajo tu control</h2>
          <p>CuotaClara guarda los préstamos localmente y no requiere una cuenta para el MVP.</p>
        </section>
      </main>
    </div>
  );
}

function EmptyLoans() {
  return (
    <div className="empty-state">
      <h2>Aún no hay préstamos</h2>
      <p>La creación de préstamos estará disponible en el siguiente paso de la implementación.</p>
    </div>
  );
}

function LoanDetail({ loan }: Readonly<{ loan: Loan | undefined }>) {
  if (!loan) return null;
  return (
    <section className="loan-detail" aria-labelledby="loan-detail-title" aria-live="polite">
      <h2 id="loan-detail-title">Resumen de {loan.name}</h2>
      <p>
        Inicio: <time dateTime={loan.startDate}>{loan.startDate}</time>
      </p>
      <p>Periodicidad: {loan.periodsPerYear} pagos por año.</p>
    </section>
  );
}
