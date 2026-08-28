import Link from 'next/link';
import { SUBSTANCE_PROFILES, substanceProfile, type SubstanceKind } from '@cleat/core';
import { translate } from '@cleat/i18n';
import { jsonLd, publicPage } from '../../lib/seo';
import styles from '../landing.module.css';

/**
 * Withdrawal, per substance, built from the same table the product uses.
 *
 * This is the page where being wrong could kill somebody, so none of it is
 * written by hand for the search engine: the risk classification and the
 * warning text come from `@cleat/core` and the shared catalogue, exactly as the
 * coach and the craving flow read them. If the clinical review changes a
 * substance's risk, this page changes with it.
 *
 * It leads with "do not do this alone" rather than with a method, and it names
 * no doses, no tapering schedules and no self-detox protocol. The search
 * intent is real — 880 people a month — and the responsible answer to it is
 * the one thing most pages on the subject will not say plainly: for alcohol and
 * benzodiazepines, stopping abruptly is the dangerous part.
 */
export const metadata = publicPage({
  title: 'Abstinens — vad som händer i kroppen och när det är farligt',
  description:
    'Vad abstinens är, hur den skiljer sig mellan alkohol, bensodiazepiner och opioider, och vilka symtom som betyder att du ska ringa vård direkt. Inga doser, inga scheman.',
  path: '/abstinens',
});

const DANGER_SIGNS = [
  'Kramper eller anfall.',
  'Kraftig förvirring, eller att se och höra saker som inte finns.',
  'Feber, hjärtklappning och kraftiga skakningar samtidigt.',
  'Ihållande kräkningar, eller att inte kunna få i sig vätska.',
  'Tankar på att inte finnas kvar.',
];

export default function WithdrawalPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd({
          '@context': 'https://schema.org',
          '@type': 'MedicalWebPage',
          name: 'Abstinens — vad som händer i kroppen och när det är farligt',
          inLanguage: 'sv-SE',
          about: { '@type': 'MedicalCondition', name: 'Abstinens' },
          // Stated explicitly, because the page is health information written
          // by a product team rather than by clinicians.
          reviewedBy: undefined,
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

      <h1 className={styles.title}>Abstinens</h1>
      <p className={styles.lede}>
        Abstinens är kroppens svar när något den vant sig vid försvinner. För en del
        substanser är det obehagligt. För andra kan det vara livsfarligt — och då är det
        att sluta tvärt, ensam, som är det farliga.
      </p>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Ring 112 vid något av det här</h2>
        <ul className={styles.crisisBody}>
          {DANGER_SIGNS.map((sign) => (
            <li key={sign}>{sign}</li>
          ))}
        </ul>
        <p className={styles.crisisBody}>
          Är du osäker: ring 1177. Att fråga kostar ingenting, och du är aldrig till besvär.
        </p>
      </section>

      <section aria-labelledby="per-substance">
        <h2 id="per-substance" className={styles.crisisTitle} style={{ marginTop: 40 }}>
          Det skiljer sig kraftigt mellan substanser
        </h2>
        <div className={styles.grid}>
          {(Object.keys(SUBSTANCE_PROFILES) as SubstanceKind[]).map((substance) => {
            const profile = substanceProfile(substance);
            return (
              <article className={styles.card} key={substance}>
                <h3 className={styles.cardTitle}>{translate('sv', `substance.${substance}`)}</h3>
                <p className={styles.cardBody}>
                  {profile.medicalDetoxAdvised
                    ? translate('sv', `safety.detox.${substance}`)
                    : 'Abstinensen här är sällan livshotande i sig, men den kan vara tung — sömn, ångest och humör påverkas ofta i veckor. Det är ett skäl att ha stöd, inte ett skäl att göra det ensam.'}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Varför du inte hittar något schema här</h2>
        <p className={styles.crisisBody}>
          Nedtrappning är en medicinsk bedömning som beror på hur mycket, hur länge, vilken
          kropp och vilka andra läkemedel som är inblandade. En generell tabell på en
          hemsida kan vara direkt farlig för just dig. Det vi kan göra är att säga vad som
          är riskabelt, och hjälpa dig formulera vad du ska säga när du ringer vården.
        </p>
        <Link href="/kris" className={styles.crisisLink}>
          Nummer att ringa →
        </Link>
      </section>

      <section className={styles.crisis}>
        <h2 className={styles.crisisTitle}>Är du orolig för någon annan?</h2>
        <p className={styles.crisisBody}>
          Då finns en egen yta för dig, utan konto och utan att den visar något om personen
          du oroar dig för.
        </p>
        <Link href="/nara" className={styles.crisisLink}>
          För dig som står bredvid →
        </Link>
      </section>

      <footer className={styles.footer}>
        <p>
          Cleat är ett coachverktyg, inte vård. Innehållet här är allmän information och
          ersätter inte en medicinsk bedömning.
        </p>
      </footer>
    </main>
  );
}
