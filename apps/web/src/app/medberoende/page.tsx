import Link from 'next/link';
import { jsonLd, publicPage } from '../../lib/seo';
import styles from '../landing.module.css';

/**
 * "Medberoende" — the word 1,900 people a month type into a search box.
 *
 * Cleat Nära deliberately refuses to use it as a label on anybody: it is used
 * in twenty different ways, several of them harmful, and telling an exhausted
 * partner they have a condition is not a service. That looks like a conflict
 * with the search data, and it is not. The honest way to rank for a word is to
 * answer the question behind it better than the pages that pathologise the
 * person asking — which is what this page does, and it is the only page on the
 * subject that says plainly which parts of the term are contested.
 *
 * Everything here is public, holds no personal data, and needs no account.
 */
export const metadata = publicPage({
  title: 'Medberoende — vad ordet betyder, och vad som faktiskt hjälper',
  description:
    'Vad medberoende betyder, varför ordet är omtvistat, och vad som faktiskt hjälper dig som lever nära någon med ett beroende. Utan diagnos och utan pekpekare.',
  path: '/medberoende',
});

const QUESTIONS = [
  {
    q: 'Vad betyder medberoende?',
    a: 'Ordet används oftast om mönster som växer fram hos någon som lever nära en person med ett beroende: att hålla koll, att fånga upp konsekvenser, att flytta sina egna gränser, att läsa av humöret innan man säger något. Beskrivningen känns ofta igen. Det är däremot ingen diagnos i den svenska sjukvården — du får ingen sådan av en läkare — och forskningen är oenig om det är ett eget tillstånd eller en rimlig reaktion på en orimlig situation.',
  },
  {
    q: 'Är medberoende en diagnos?',
    a: 'Nej. Det finns ingen diagnoskod för medberoende, varken i ICD eller DSM. Det är ett populärpsykologiskt begrepp som blivit vanligt i självhjälpslitteratur. Det betyder inte att det du känner är påhittat — bara att ingen kan ställa diagnosen på dig, och att du inte behöver acceptera etiketten för att få hjälp.',
  },
  {
    q: 'Är det mitt fel att hen dricker?',
    a: 'Nej. Du kan inte ha orsakat ett beroende genom att vara fel sorts partner, förälder eller barn. Du kan inte kontrollera det, och du kan inte bota det. Det är inte en tröstformulering — det ligger helt enkelt utanför det du har åtkomst till.',
  },
  {
    q: 'Hur stöttar jag någon utan att förlora mig själv?',
    a: 'Genom att vara förutsägbar och genom att säga vad du själv gör, i stället för vad den andra måste göra. "Jag ger dig inte pengar. Jag kör dig till akuten." går att hålla. "Du måste sluta" gör det inte, eftersom du inte styr över någon annans beteende. Din sömn, dina vänner och det du tycker om är inte belöningar du får när hen blir frisk — de är det som gör att du orkar vara kvar.',
  },
  {
    q: 'Hur slutar jag vara medberoende?',
    a: 'Frågan är oftast bättre ställd som: vilket enda mönster kostar mig mest just nu? Att sluta räkna flaskor, att sluta täcka upp inför andra, att berätta för en person till hur det faktiskt är hemma. Ett mönster i taget, och med stöd för din egen skull — inte som en metod för att få någon annan att sluta.',
  },
  {
    q: 'När är det inte längre ett samtal?',
    a: 'Om personen inte går att väcka, kramper, andas långsamt eller rosslande, är blå om läpparna, är kraftigt förvirrad eller pratar om att inte vilja finnas kvar — ring 112. Att abrupt sluta med alkohol eller lugnande läkemedel kan i sig ge livsfarlig abstinens; ring 1177 och fråga innan någon gör det ensam.',
  },
];

export default function CodependencyPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        // A real list of questions and answers, so the markup is true.
        dangerouslySetInnerHTML={jsonLd({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
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
        <Link href="/nara" className={styles.signIn}>
          För dig som står bredvid
        </Link>
      </header>

      <h1 className={styles.title}>Medberoende</h1>
      <p className={styles.lede}>
        Du sökte antagligen på ordet för att något hemma inte stämmer. Här är vad det
        betyder, varför vi inte sätter det som etikett på dig — och vad som faktiskt
        hjälper.
      </p>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Först, om det är akut</h2>
        <p className={styles.crisisBody}>
          Går personen inte att väcka, har kramper, andas konstigt eller pratar om att inte
          vilja finnas kvar — ring 112. Att sluta tvärt med alkohol eller lugnande läkemedel
          kan ge livsfarlig abstinens; ring 1177 och fråga först.
        </p>
        <Link href="/kris" className={styles.crisisLink}>
          Alla nummer och vad du kan säga →
        </Link>
      </section>

      <section className={styles.grid}>
        {QUESTIONS.map((item) => (
          <article className={styles.card} key={item.q}>
            <h2 className={styles.cardTitle}>{item.q}</h2>
            <p className={styles.cardBody}>{item.a}</p>
          </article>
        ))}
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Varför vi inte kallar dig medberoende</h2>
        <p className={styles.crisisBody}>
          För att en etikett sällan hjälper någon som redan bär för mycket. Cleat Nära
          beskriver mönster i stället — sju av dem — och speglar tillbaka vad dina egna svar
          sa, utan diagnos och utan att någonsin säga åt dig att stanna eller gå. Det räknas
          ut i din webbläsare och skickas ingenstans.
        </p>
        <Link href="/nara" className={styles.crisisLink}>
          Gå till Cleat Nära →
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>
          Cleat är ett coachverktyg, inte vård. Det ersätter inte läkare, psykiatri eller
          beroendebehandling.
        </p>
      </footer>
    </main>
  );
}
