import Link from 'next/link';
import { substanceProfile } from '@cleat/core';
import { translate } from '@cleat/i18n';
import { jsonLd, publicPage } from '../../lib/seo';
import styles from '../landing.module.css';

/**
 * Snus, and the reason this page is shorter than the one about smoking.
 *
 * There is a great deal published in Swedish about quitting snus. Almost all
 * of it is published by companies that sell snus, or by companies that sell
 * the nicotine replacement — and it is written to read like health
 * information. So this page does the one thing those cannot: it says what a
 * public health service says, stops there, and names the gap out loud.
 *
 * That means no timeline of organs recovering. The milestones here are the
 * ones from `@cleat/core` that carry no `intake` marker — the claims that hold
 * for nicotine whichever way it arrived — and there are three of them. The
 * temptation to pad that out with the smoking timeline is exactly the mistake
 * this page exists to correct: those claims are about carbon monoxide and
 * lungs, and a person who has never lit anything did not do that to
 * themselves.
 */
export const metadata = publicPage({
  title: 'Sluta snusa — vad som faktiskt händer, och vad ingen kan lova dig',
  ogTitle: 'Sluta snusa',
  description:
    'Nikotinet är ur blodet efter ett dygn, abstinensen toppar runt dag tre och släpper oftast inom tre veckor. Vad 1177 säger — och varför vi inte påstår mer än så.',
  path: '/sluta-snusa',
});

const LOCALE = 'sv';

/**
 * Only the milestones that hold regardless of how the nicotine arrived. The
 * app applies exactly the same filter for somebody who answered "snusar".
 */
const TIMELINE = substanceProfile('nicotine').milestones.filter((m) => !m.intake);

const WITHDRAWAL = [
  ['Suget kommer i vågor', 'En våg varar oftast under en minut. Det är kortare än de flesta tror, och det är därför det går att vänta ut.'],
  ['Irritation och rastlöshet', 'Vanligast första veckan. Det är abstinens, inte hur du är.'],
  ['Sämre sömn', 'Brukar ge med sig utan att man gör något särskilt.'],
  ['Svårare att koncentrera sig', 'Ofta det som märks mest på jobbet. Också det som går över.'],
  ['Ökad aptit', 'Nikotin dämpar aptit. När det försvinner kommer den tillbaka.'],
  ['Nedstämdhet', 'Om den inte släpper när resten gör det, eller om den blir tung, hör den hemma hos vården.'],
];

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: 'Vad händer i kroppen när man slutar snusa?',
    a: 'Nikotinhalten i blodet sjunker snabbt och är i praktiken borta inom ett dygn. Abstinensbesvären — sug, irritation, sömnsvårigheter, koncentrationssvårigheter, ökad aptit — brukar toppa runt dag tre och ha släppt inom en till tre veckor. Det är vad 1177 beskriver. Vi påstår inte mer än så, för mer än så finns inte publicerat av någon som inte också säljer något.',
  },
  {
    q: 'Hur länge håller abstinensen?',
    a: 'Oftast en till tre veckor för de kroppsliga besvären. Ett enskilt sug varar däremot bara omkring en halv till en minut — det är utlöst av en situation snarare än av nikotinbrist, och det är därför det går att vänta ut även långt senare.',
  },
  {
    q: 'Gäller det som sägs om att sluta röka även för snus?',
    a: 'Nej, och det är viktigare än det låter. Tidslinjen om kolmonoxid, lungfunktion och lungcancerrisk handlar om rökning. Har du aldrig rökt har du inte utsatt kroppen för det, så det finns ingenting där att återhämta. Vår app frågar därför om du röker eller snusar, och visar bara det som gäller dig.',
  },
  {
    q: 'Är det farligt att sluta snusa tvärt?',
    a: 'Nej. Till skillnad från alkohol och bensodiazepiner, där abrupt utsättning kan vara livsfarlig, är nikotinabstinens obehaglig men inte medicinskt farlig.',
  },
  {
    q: 'Varför säger den här sidan så lite?',
    a: 'För att det mesta som skrivs på svenska om att sluta snusa är publicerat av bolag som säljer snus eller som säljer nikotinläkemedel. Vi hade kunnat fylla sidan med samma påståenden. Vi vill hellre att du ska kunna lita på det lilla som står här.',
  },
];

export default function QuitSnusPage() {
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

      <h1 className={styles.title}>Sluta snusa</h1>
      <p className={styles.lede}>
        Vad som faktiskt händer, hur länge det håller på, och vad ingen ärligt kan lova dig.
      </p>

      <section aria-labelledby="tidslinje">
        <h2 id="tidslinje" className={styles.crisisTitle} style={{ marginTop: 40 }}>
          Tidslinjen — hela den
        </h2>
        <div className={styles.grid}>
          {TIMELINE.map((row) => (
            <article className={styles.card} key={row.key}>
              <p className={styles.cardBody}>{translate(LOCALE, row.key)}</p>
              {row.source ? (
                <p className={styles.cardBody} style={{ opacity: 0.55, fontSize: '0.85rem' }}>
                  Källa: {row.source}
                </p>
              ) : null}
            </article>
          ))}
        </div>
        <p className={styles.cardBody}>
          Tre punkter. Det är inte för att vi inte orkat skriva mer — det är för att det inte
          finns mer som en offentlig vårdgivare gått i god för. Sidor som listar hur tandköttet,
          blodtrycket och hjärtat återhämtar sig vecka för vecka finns det gott om, och de är
          nästan alltid publicerade av någon som säljer snus eller säljer nikotinläkemedel.
        </p>
      </section>

      <section aria-labelledby="abstinens">
        <h2 id="abstinens" className={styles.crisisTitle} style={{ marginTop: 48 }}>
          Vad du kan vänta dig
        </h2>
        <div className={styles.grid}>
          {WITHDRAWAL.map(([title, body]) => (
            <article className={styles.card} key={title}>
              <h3 className={styles.cardTitle}>{title}</h3>
              <p className={styles.cardBody}>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.crisis} aria-labelledby="rokning">
        <h2 id="rokning" className={styles.crisisTitle}>
          Har du rökt också?
        </h2>
        <p className={styles.crisisBody}>
          Då gäller en helt annan tidslinje utöver den här — kolmonoxid, lungfunktion,
          hjärtinfarktrisk. Den handlar om rökning och bara om rökning, vilket är precis
          därför den inte står på den här sidan.
        </p>
        <Link href="/sluta-roka" className={styles.crisisLink}>
          Vad som händer när du slutar röka →
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
        <h2 className={styles.crisisTitle}>Om ett sug varar en minut behöver du något som räcker en minut</h2>
        <p className={styles.crisisBody}>
          Cleat är gratis för privatpersoner, utan tidsgräns och utan kort. Den frågar vad som
          hände precis innan suget kom, och den frågar om du röker eller snusar — så att den
          bara visar dig det som faktiskt gäller din kropp.
        </p>
        <Link href="/" className={styles.crisisLink}>
          Vad Cleat är →
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>
          Innehållet här bygger på 1177 och är allmän information. Cleat är ett coachverktyg,
          inte vård.{' '}
          <Link href="/kris" style={{ color: 'var(--accent-strong)' }}>
            Akuta nummer
          </Link>
        </p>
      </footer>
    </main>
  );
}
