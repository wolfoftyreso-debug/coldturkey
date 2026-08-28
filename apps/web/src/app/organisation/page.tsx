import Link from 'next/link';
import { CLINIC_BASE_SEATS } from '@cleat/core';
import { jsonLd, publicPage } from '../../lib/seo';
import styles from '../landing.module.css';

/**
 * What Cleat sells, and to whom.
 *
 * The model is deliberately lopsided and the page says so first: a person in
 * recovery never pays, and the free column is a real column rather than a
 * footnote. Money comes from organisations that need their own isolated tenant
 * and a seat count.
 *
 * There are no customer logos and no testimonials on this page, because there
 * are no customers yet. Manufacturing social proof would be the first dishonest
 * thing in a product whose entire claim is that it does not lie to people.
 */
export const metadata = publicPage({
  title: 'Cleat för kliniker och verksamheter',
  description:
    'Cleat är gratis för privatpersoner, alltid. Kliniker, behandlingshem och företagshälsa får en egen isolerad miljö med platser per klient.',
  path: '/organisation',
});

const FAQ = [
  {
    q: 'Varför är det gratis för privatpersoner?',
    a: 'För att en betalvägg i ett beroendeverktyg träffar någon i deras sämsta stund. Krisnumren, sugmotorn, coachen, återfallsanalysen och anhörigytan är gratis och kommer att förbli det. Ingen enskild människa ska behöva ett kort för att få hjälp klockan två på natten.',
  },
  {
    q: 'Vad ingår i en organisationslicens?',
    a: `En egen isolerad miljö — egna data, egen inloggning, ingen delning med andra verksamheter — och ${CLINIC_BASE_SEATS} platser i grunden. Ni lägger till fler platser när ni behöver. Isoleringen upprätthålls i databasen, inte i applikationskoden.`,
  },
  {
    q: 'Vad händer om vi slutar betala?',
    a: 'Ni kan inte lägga till nya personer, och administrationen stängs. Men varje person som redan finns hos er behåller hela det kliniska verktyget — coach, mönster, kris. Patienten var inte den som lät fakturan förfalla och ska inte vara den som straffas för det.',
  },
  {
    q: 'Ser vi som klinik våra klienters anteckningar?',
    a: 'Nej. En organisationslicens ger er en isolerad miljö och platsadministration — inte insyn i vad någon skriver till coachen. Skulle en verksamhet behöva något sådant måste det byggas som ett uttryckligt, återkalleligt samtycke från personen själv, och det finns inte idag.',
  },
  {
    q: 'Var lagras uppgifterna?',
    a: 'I EU. Fritext som människor skriver — varför-formuleringar, sugloggar, coachsamtal — krypteras dessutom per fält innan den skrivs till disk, så en läckt säkerhetskopia inte är läsbar.',
  },
  {
    q: 'Kan vi testa först?',
    a: 'Ja. Hör av er, så sätter vi upp en utvärderingsmiljö med ett fåtal platser innan något abonnemang startas.',
  },
];

export default function OrganisationPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQ.map((item) => ({
            '@type': 'Question',
            name: item.q,
            acceptedAnswer: { '@type': 'Answer', text: item.a },
          })),
        })}
      />

      <header className={styles.header}>
        <Link href="/" className={styles.wordmark}>
          CLEAT
        </Link>
        <Link href="/login" className={styles.signIn}>
          Logga in
        </Link>
      </header>

      <h1 className={styles.title}>Cleat för verksamheter</h1>
      <p className={styles.lede}>
        Privatpersoner betalar aldrig. Kliniker, behandlingshem och företagshälsa betalar
        per plats — och får en egen miljö där ingen annan verksamhets uppgifter finns.
      </p>

      <section className={styles.grid} aria-label="Priser">
        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Privatperson</h2>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0 12px' }}>0 kr</p>
          <p className={styles.cardBody}>
            Allt kliniskt: kris, sugmotorn, coachen, återfallsanalysen, mönstren, Cleat Nära,
            export och radering. Utan tidsgräns och utan kort.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link href="/login" className={styles.crisisLink}>
              Skapa konto →
            </Link>
          </p>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Klinik</h2>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0 4px' }}>
            per plats
          </p>
          <p className={styles.cardBody} style={{ opacity: 0.75, marginTop: 0 }}>
            Faktureras årsvis · {CLINIC_BASE_SEATS} platser ingår
          </p>
          <p className={styles.cardBody}>
            Egen isolerad miljö, egen inloggning, platsadministration och stöd. Priset sätts
            per verksamhet — hör av er, så räknar vi på antalet klienter ni faktiskt har.
          </p>
          <p style={{ marginTop: 14 }}>
            <a href="mailto:verksamhet@cleat.app" className={styles.crisisLink}>
              Kontakta oss →
            </a>
          </p>
        </article>

        <article className={styles.card}>
          <h2 className={styles.cardTitle}>Region eller större</h2>
          <p style={{ fontSize: '2rem', fontWeight: 800, margin: '4px 0 12px' }}>Vi pratar</p>
          <p className={styles.cardBody}>
            Fler verksamheter under samma avtal, upphandling, personuppgiftsbiträdesavtal och
            säkerhetsgranskning. Vi går igenom kraven tillsammans innan något skrivs på.
          </p>
          <p style={{ marginTop: 14 }}>
            <a href="mailto:verksamhet@cleat.app" className={styles.crisisLink}>
              Boka ett samtal →
            </a>
          </p>
        </article>
      </section>

      <section aria-labelledby="faq">
        <h2 id="faq" className={styles.crisisTitle} style={{ marginTop: 48 }}>
          Vanliga frågor
        </h2>
        <div className={styles.grid}>
          {FAQ.map((item) => (
            <article className={styles.card} key={item.q}>
              <h3 className={styles.cardTitle}>{item.q}</h3>
              <p className={styles.cardBody}>{item.a}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Innan ni bestämmer er</h2>
        <p className={styles.crisisBody}>
          Cleat är ett coachverktyg, inte vård, och ersätter varken läkare, psykiatri eller
          beroendebehandling. Säkerhetstriagen har ännu inte granskats kliniskt av
          utomstående och produkten har inte penetrationstestats av tredje part. Vi säger det
          här innan ni frågar, för att ni ska kunna ta ett informerat beslut.
        </p>
      </section>

      <footer className={styles.footer}>
        <p>
          <Link href="/kris" style={{ color: 'var(--accent-strong)' }}>
            Akuta nummer
          </Link>{' '}
          ·{' '}
          <Link href="/nara" style={{ color: 'var(--accent-strong)' }}>
            För anhöriga
          </Link>
        </p>
      </footer>
    </main>
  );
}
