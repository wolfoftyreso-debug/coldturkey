import Link from 'next/link';
import { jsonLd, publicPage } from '../../lib/seo';
import styles from '../landing.module.css';

/**
 * Nicotine, and the question people actually type.
 *
 * Semrush, Swedish database: "sluta röka" is 5 400 a month at difficulty 29,
 * and the question cluster behind it is dominated by one thing — "vad händer i
 * kroppen när man slutar röka" and about a dozen near-identical phrasings,
 * together roughly 900 a month at difficulty 14–23. Somebody asking that has
 * not decided yet. They are trying to work out whether it is worth it.
 *
 * So the page answers exactly that, with a timeline, and it does not sell
 * anything above the fold. The product is mentioned once, at the end, as the
 * free thing it is.
 *
 * Every physiological claim below comes from NHS Better Health or the CDC and
 * is attributed on the page. That attribution is not decoration: this product
 * must never pretend to be a doctor, and the honest way to answer a question
 * about a body is to say who established the answer and let somebody check it.
 *
 * What this page deliberately does not contain: a method, a taper, a product
 * recommendation, nicotine replacement dosing, or a promise about anybody's
 * chances. Those are for a clinician who has met the person.
 */
export const metadata = publicPage({
  title: 'Vad händer i kroppen när du slutar röka — timme för timme, år för år',
  ogTitle: 'Vad händer i kroppen när du slutar röka',
  description:
    'Pulsen efter 20 minuter, kolmonoxiden efter två dygn, lungfunktionen efter tolv veckor, hjärtinfarktrisken efter ett år. Vad NHS och CDC faktiskt säger — och vad abstinensen gör under tiden.',
  path: '/sluta-roka',
});

/**
 * The timeline, with its source next to each row rather than in a footnote.
 * A reader who wants to check one line should not have to work out which of
 * two organisations said it.
 */
const TIMELINE: Array<{ when: string; what: string; source: 'NHS' | 'CDC' }> = [
  {
    when: '20 minuter',
    what: 'Pulsen börjar gå ner mot det normala. Kolmonoxiden i blodet har halverats och syresättningen är på väg tillbaka.',
    source: 'NHS',
  },
  {
    when: '24 timmar',
    what: 'Nikotinhalten i blodet är nere på en försumbar nivå. Det är också ungefär här abstinensen är som mest påtaglig.',
    source: 'CDC',
  },
  {
    when: '48 timmar',
    what: 'Kolmonoxiden är nere på samma nivå som hos någon som aldrig rökt. Lungorna börjar rensa slem, och lukt och smak börjar komma tillbaka.',
    source: 'NHS',
  },
  {
    when: '2 veckor till 3 månader',
    what: 'Risken för hjärtinfarkt börjar sjunka. Lungfunktionen förbättras, och hosta och andfåddhet minskar.',
    source: 'CDC',
  },
  {
    when: '2 till 12 veckor',
    what: 'Blodcirkulationen har blivit bättre. Lungfunktionen ökar med upp till tio procent.',
    source: 'NHS',
  },
  {
    when: '1 år',
    what: 'Risken för hjärtinfarkt är halverad jämfört med någon som fortsätter röka. Risken att dö i lungcancer är också halverad.',
    source: 'NHS',
  },
  {
    when: '5 till 15 år',
    what: 'Risken för stroke är nere på samma nivå som hos någon som aldrig rökt.',
    source: 'CDC',
  },
];

/**
 * The half nobody puts on the timeline.
 *
 * The physiological benefits are real and they are also not what the first
 * week feels like. A page that lists only the benefits reads as encouraging
 * and lands as a lie, and somebody on day three who feels worse than they did
 * on day one concludes that it is not working. It is working. This is what it
 * is.
 */
const WITHDRAWAL = [
  ['Irritation och kort stubin', 'Vanligast de första dagarna. Det är abstinens, inte ett karaktärsdrag.'],
  ['Sömnen blir sämre', 'Ofta ett par veckor. Den brukar bli bättre igen utan att man gör något särskilt.'],
  ['Suget kommer i vågor', 'En våg varar oftast några minuter, inte några timmar. Det är därför tio minuter räcker förvånansvärt ofta.'],
  ['Ökad aptit', 'Nikotin dämpar aptit. När det försvinner kommer den tillbaka, och det är inte samma sak som att tappa kontrollen.'],
  ['Hosta som blir värre innan den blir bättre', 'Lungorna rensar slem som legat kvar. Ihållande eller blodig hosta hör hemma hos vården, inte på en hemsida.'],
  ['Koncentrationen svajar', 'Brukar ge med sig inom några veckor.'],
];

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: 'Vad händer i kroppen när man slutar röka?',
    a: 'Inom tjugo minuter börjar pulsen gå ner och kolmonoxiden i blodet halveras. Efter två dygn är kolmonoxiden nere på samma nivå som hos någon som aldrig rökt, och lukt och smak börjar komma tillbaka. Mellan två och tolv veckor förbättras cirkulationen och lungfunktionen ökar med upp till tio procent. Efter ett år är risken för hjärtinfarkt halverad jämfört med någon som fortsätter. Uppgifterna kommer från NHS och CDC.',
  },
  {
    q: 'Vad händer när man slutar röka dag för dag?',
    a: 'Dag ett är nikotinet i praktiken ur blodet och abstinensen är som tydligast. Dag två till tre är kolmonoxiden borta och lukt och smak börjar återvända, samtidigt som irritation och sömnsvårigheter ofta är som värst. Från ungefär vecka två blir andningen och orken märkbart bättre. Att det känns sämre dag tre än dag ett betyder inte att något gått fel.',
  },
  {
    q: 'Hur länge har man abstinens när man slutar röka?',
    a: 'De kroppsliga symtomen är oftast tydligast de första tre till fem dygnen och avtar väsentligt inom två till fyra veckor. Suget kan komma tillbaka långt senare, utlöst av en plats, en person eller en känsla snarare än av nikotinbrist — och en sugvåg varar oftast bara några minuter.',
  },
  {
    q: 'Varför går man upp i vikt när man slutar röka?',
    a: 'Nikotin dämpar aptiten och höjer ämnesomsättningen något. När det försvinner kommer aptiten tillbaka. Det är en förutsägbar effekt av att kroppen fungerar utan nikotin, inte ett tecken på att man tappat kontrollen — och den är på alla sätt lättare att hantera än att fortsätta röka.',
  },
  {
    q: 'Är det farligt att sluta röka tvärt?',
    a: 'Nej. Till skillnad från alkohol och bensodiazepiner, där abrupt utsättning kan vara livsfarlig, är nikotinabstinens obehaglig men inte medicinskt farlig. Det är därför den här sidan ser annorlunda ut än vår sida om abstinens.',
  },
];

export default function QuitSmokingPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          inLanguage: 'sv-SE',
          mainEntity: QUESTIONS.map((item) => ({
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
        <Link href="/kris" className={styles.signIn}>
          Akuta nummer
        </Link>
      </header>

      <h1 className={styles.title}>Vad händer i kroppen när du slutar röka</h1>
      <p className={styles.lede}>
        Timme för timme, vecka för vecka, år för år — och vad abstinensen gör under tiden.
        Ingen metod, inga produkter, inga löften om dina odds.
      </p>

      <section aria-labelledby="tidslinje">
        <h2 id="tidslinje" className={styles.crisisTitle} style={{ marginTop: 40 }}>
          Tidslinjen
        </h2>
        <div className={styles.grid}>
          {TIMELINE.map((row) => (
            <article className={styles.card} key={row.when}>
              <h3 className={styles.cardTitle}>{row.when}</h3>
              <p className={styles.cardBody}>{row.what}</p>
              <p className={styles.cardBody} style={{ opacity: 0.55, fontSize: '0.85rem' }}>
                Källa: {row.source}
              </p>
            </article>
          ))}
        </div>
        <p className={styles.cardBody} style={{ opacity: 0.7 }}>
          Uppgifterna kommer från NHS Better Health och amerikanska CDC. Vi har inte räknat fram
          dem själva och vi är inte läkare — vi skriver ut var de kommer ifrån så att du kan
          kontrollera dem.
        </p>
      </section>

      <section aria-labelledby="abstinens">
        <h2 id="abstinens" className={styles.crisisTitle} style={{ marginTop: 48 }}>
          Det som inte står på tidslinjen
        </h2>
        <p className={styles.cardBody}>
          Allt ovanför är sant och är inte vad den första veckan känns som. Om du mår sämre dag
          tre än dag ett har ingenting gått fel — det är ungefär då det brukar vara som tyngst.
        </p>
        <div className={styles.grid}>
          {WITHDRAWAL.map(([title, body]) => (
            <article className={styles.card} key={title}>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.crisis} aria-labelledby="vard">
        <h2 id="vard" className={styles.crisisTitle}>
          När du ska prata med vården i stället för att läsa vidare
        </h2>
        <p className={styles.crisisBody}>
          Bröstsmärta, andnöd, hosta med blod, eller om tankarna handlar om att inte finnas kvar.
          Då är det inte den här sidan du behöver. Ring 112 vid akut fara, 1177 för
          sjukvårdsrådgivning.
        </p>
        <Link href="/kris" className={styles.crisisLink}>
          Alla akuta nummer →
        </Link>
      </section>

      <section aria-labelledby="fragor">
        <h2 id="fragor" className={styles.crisisTitle} style={{ marginTop: 48 }}>
          Vanliga frågor
        </h2>
        {QUESTIONS.map((item) => (
          <div key={item.q} style={{ marginBottom: 24 }}>
            <h3 className={styles.cardTitle}>{item.q}</h3>
            <p className={styles.cardBody}>{item.a}</p>
          </div>
        ))}
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Om du vill ha något som håller i tio minuter åt gången</h2>
        <p className={styles.crisisBody}>
          Cleat är gratis för privatpersoner, utan tidsgräns och utan kort. Den räknar inte dagar åt
          dig för att imponera — den finns där när suget kommer och frågar vad som hände precis
          innan. Och om du börjar röka igen behandlar den inte det som ett moraliskt misslyckande,
          för det är det inte.
        </p>
        <Link href="/" className={styles.crisisLink}>
          Vad Cleat är →
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>
          <Link href="/abstinens" style={{ color: 'var(--accent-strong)' }}>
            Abstinens vid andra substanser
          </Link>{' '}
          ·{' '}
          <Link href="/nara" style={{ color: 'var(--accent-strong)' }}>
            För anhöriga
          </Link>{' '}
          ·{' '}
          <Link href="/kris" style={{ color: 'var(--accent-strong)' }}>
            Akuta nummer
          </Link>
        </p>
      </footer>
    </main>
  );
}
