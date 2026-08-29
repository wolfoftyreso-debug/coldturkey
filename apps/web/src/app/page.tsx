import Link from 'next/link';
import { translate } from '@cleat/i18n';
import { LandingRedirect } from '../components/LandingRedirect';
import styles from './landing.module.css';
import { publicPage } from '../lib/seo';

/**
 * The landing page.
 *
 * Server-rendered, no client JavaScript required to read it, and — the part
 * that matters — the crisis numbers are on it. They used to sit behind a
 * login, which meant somebody who arrived here at 2am had to create an
 * account before the product would tell them what to ring. That is a funnel
 * placed ahead of the thing the product claims to exist for.
 *
 * It is also deliberately not a wellness page. No stock photography of people
 * on clifftops, no "start your journey", no numbers claiming how many days
 * anyone has been anything. The visual brief this brand is held to is: never
 * look like a hospital, an AA meeting, or a meditation app.
 */
export const metadata = publicPage({
  title: 'Cleat — lämna beroendet, bygg tillbaka livet',
  description:
    'Ett sekulärt verktyg vid alkohol- och drogberoende. Sugmotor, återfallsanalys och krisstöd — utan skam, utan religion och utan tolvstegskrav. Gratis för privatpersoner.',
  path: '/',
});

const sv = (key: string) => translate('sv', key);

export default function LandingPage() {
  return (
    <main className={styles.page}>
      {/* Signed-in visitors are sent to the app; everyone else reads this. */}
      <LandingRedirect />

      <header className={styles.header}>
        <span className={styles.wordmark}>CLEAT</span>
        <Link href="/login" className={styles.signIn}>
          {sv('auth.signIn')}
        </Link>
      </header>

      <section className={styles.hero}>
        <h1 className={styles.title}>
          Det avgörs på tio minuter.
          <br />
          <span className={styles.titleDim}>Resten är förberedelse.</span>
        </h1>
        <p className={styles.lede}>
          Cleat är en sekulär återhämtningscoach för beroenden och vanor. Ingen högre makt,
          inga tolv steg, ingen skam. Ett sug varar sällan längre än en kvart — den
          här appen är byggd runt just den kvarten.
        </p>
        <div className={styles.actions}>
          <Link href="/login" className={styles.primary}>
            Kom igång
          </Link>
          <Link href="/kris" className={styles.secondary}>
            Jag behöver hjälp nu
          </Link>
          {/* The relative is not a secondary audience reached through a footer.
              Most people who carry this never look for anything for themselves,
              because the problem is framed as somebody else's. */}
          <Link href="/nara" className={styles.secondary}>
            Jag är anhörig
          </Link>
        </div>
      </section>

      {/* Placed above the feature list on purpose. Somebody who needs this
          should not have to scroll past marketing copy to find it. */}
      <section className={styles.crisis} aria-labelledby="crisis-heading">
        <h2 id="crisis-heading" className={styles.crisisTitle}>
          Är det akut just nu?
        </h2>
        <p className={styles.crisisBody}>
          Ring 112. Vid självmordstankar: Mind Självmordslinjen 90101, dygnet runt.
          Sjukvårdsrådgivning: 1177. Du behöver inget konto för de numren, och du
          behöver inte den här appen för att ringa dem.
        </p>
        <Link href="/kris" className={styles.crisisLink}>
          Fler nummer och vad du kan säga →
        </Link>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Fungerar utan uppkoppling</h3>
          <p className={styles.cardBody}>
            Tiominutersprotokollet, verktygen och ditt eget varför ligger på enheten.
            Någon i en källare klockan två med en stapel täckning ska inte mötas av
            &quot;kontrollera din anslutning&quot;.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Ingen totalpoäng</h3>
          <p className={styles.cardBody}>
            Sju indikatorer visas var för sig — sömn, humör, sug, kontakt, rutin,
            ärlighet, framtidstro. Aldrig sammanvägda till ett tal. Ett enda betyg
            inbjuder till att jaga siffran i stället för att beskriva verkligheten.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Återfall nollställer inte allt</h3>
          <p className={styles.cardBody}>
            Den pågående serien börjar om. Din längsta serie och dina totala dagar i
            återhämtning rörs inte. Det du har gjort försvann inte för att en dag
            gick sönder.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Nödlägen coachas inte bort</h3>
          <p className={styles.cardBody}>
            En deterministisk säkerhetskontroll läser varje meddelande innan någon
            språkmodell gör det. Vid ett nödläge stängs coachen av och du får numret
            att ringa. Ingen modell får försöka prata någon ur en överdos.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Din data är din</h3>
          <p className={styles.cardBody}>
            Export och radering i appen. Ingen försäljning av återhämtningsdata, inga
            annonser byggda på ditt missbruk, ingen profilering till försäkringsbolag
            eller arbetsgivare. Inga tredjepartsskript på den här sidan heller.
          </p>
        </article>
        <article className={styles.card}>
          <h3 className={styles.cardTitle}>Öppen källkod, egen drift</h3>
          <p className={styles.cardBody}>
            Hela plattformen går att köra själv — databas, autentisering, coach och
            allt däremellan. Du behöver inte lita på oss för att kunna använda den.
          </p>
        </article>
      </section>

      {/* Internal linking: every indexable page is reachable from the entry
          point in one hop, which is what a crawler needs and what a person
          arriving from a search result needs just as much. */}
      <nav className={styles.footer} aria-label="Mer från Cleat">
        <p>
          <Link href="/kris" style={{ color: 'var(--accent-strong)' }}>Akuta nummer</Link>{' · '}
          <Link href="/nara" style={{ color: 'var(--accent-strong)' }}>För anhöriga</Link>{' · '}
          <Link href="/medberoende" style={{ color: 'var(--accent-strong)' }}>Medberoende</Link>{' · '}
          <Link href="/abstinens" style={{ color: 'var(--accent-strong)' }}>Abstinens</Link>{' · '}
          <Link href="/sluta-roka" style={{ color: 'var(--accent-strong)' }}>Sluta röka</Link>{' · '}
          <Link href="/sluta-snusa" style={{ color: 'var(--accent-strong)' }}>Sluta snusa</Link>{' · '}
          <Link href="/organisation" style={{ color: 'var(--accent-strong)' }}>För verksamheter</Link>
        </p>
      </nav>

      <footer className={styles.footer}>
        <p>
          Cleat ersätter inte vård. Det är inte en terapeut, inte en läkare och inte en
          garanti. Vid livsfara: 112.
        </p>
        <p className={styles.footerDim}>
          Att sluta tvärt med alkohol, bensodiazepiner eller andra lugnande kan vara
          livsfarligt. Prata med vården innan du gör det.
        </p>
      </footer>
    </main>
  );
}
