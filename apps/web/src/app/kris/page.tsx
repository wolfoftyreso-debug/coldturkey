import Link from 'next/link';
import type { Metadata } from 'next';
import styles from '../landing.module.css';

/**
 * Crisis numbers, reachable with no account and no JavaScript.
 *
 * Everything on this page is static and server-rendered. It does not call the
 * API, so it works when the API is down; it does not need the client bundle,
 * so it works on a connection that will not finish loading one; and it stores
 * nothing, so visiting it leaves no trace in anybody's record.
 *
 * The numbers are Swedish because this deployment is Swedish-first. A
 * deployment for another country must change them — a crisis line that does
 * not answer where the person is standing is worse than none, because it
 * costs the call.
 */
export const metadata: Metadata = {
  title: 'Akut hjälp — Cleat',
  description: 'Nummer att ringa nu. Inget konto krävs.',
};

interface Line {
  name: string;
  number: string;
  when: string;
  hours: string;
}

const LINES: Line[] = [
  {
    name: 'SOS Alarm',
    number: '112',
    when: 'Livsfara, överdos, någon som inte går att väcka, krampanfall.',
    hours: 'Dygnet runt',
  },
  {
    name: 'Mind Självmordslinjen',
    number: '90101',
    when: 'Tankar på att inte finnas kvar, med eller utan plan.',
    hours: 'Dygnet runt',
  },
  {
    name: '1177 Vårdguiden',
    number: '1177',
    when: 'Abstinens, kroppsliga symtom, råd om vart du ska vända dig.',
    hours: 'Dygnet runt',
  },
  {
    name: 'Alkohollinjen',
    number: '020-84 44 48',
    when: 'Din egen eller någon annans alkoholkonsumtion. Anonymt.',
    hours: 'Vardagar',
  },
  {
    name: 'Stödlinjen för spelare',
    number: '020-81 91 00',
    when: 'Spel om pengar, för dig som spelar eller står nära någon som gör det.',
    hours: 'Vardagar',
  },
];

export default function CrisisPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          CLEAT
        </Link>
      </header>

      <h1 className={styles.title}>Nummer att ringa nu</h1>
      <p className={styles.lede}>
        Du behöver inget konto och du behöver inte den här appen. Är det akut — ring 112.
      </p>

      <section className={styles.grid}>
        {LINES.map((line) => (
          <article className={styles.card} key={line.number}>
            <h2 className={styles.cardTitle}>{line.name}</h2>
            {/* A real tel: link. On the device most people will read this on,
                the number should be one tap, not something to memorise and
                retype while shaking. */}
            <p style={{ margin: '0 0 10px' }}>
              <a
                href={`tel:${line.number.replace(/\s/g, '')}`}
                style={{ color: 'var(--accent-strong)', fontSize: '1.35rem', fontWeight: 700 }}
              >
                {line.number}
              </a>
            </p>
            <p className={styles.cardBody}>{line.when}</p>
            <p className={styles.cardBody} style={{ opacity: 0.7, marginTop: 8 }}>
              {line.hours}
            </p>
          </article>
        ))}
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Om du inte vet vad du ska säga</h2>
        <p className={styles.crisisBody}>
          Du behöver inte formulera det bra. &quot;Jag mår inte bra och jag vet inte vem
          jag ska ringa&quot; räcker för att komma vidare. Du behöver inte ha bestämt dig
          för någonting, och du behöver inte vara säker på att det är tillräckligt
          allvarligt.
        </p>
        <p className={styles.crisisBody}>
          Är du orolig för någon annan just nu: lämna dem inte ensamma, lägg dem i stabilt
          sidoläge om de är medvetslösa men andas, och ring 112.
        </p>
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Sluta inte tvärt med allt</h2>
        <p className={styles.crisisBody}>
          Att abrupt sluta med alkohol, bensodiazepiner eller andra lugnande läkemedel kan
          ge krampanfall och delirium, och kan vara livsfarligt. Det är den ena situationen
          där det du tänkte göra är farligare än att fortsätta ett dygn till medan du får
          tag på vård. Ring 1177 och fråga.
        </p>
      </section>

      <footer className={styles.footer}>
        <p>
          Den här sidan laddar ingenting utifrån, sparar ingenting om ditt besök och
          fungerar utan konto.
        </p>
      </footer>
    </main>
  );
}
