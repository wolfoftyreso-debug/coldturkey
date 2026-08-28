'use client';

import { useId, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { ENQUIRY_FORM_ENABLED } from '../lib/enquiries';
import styles from '../app/landing.module.css';

/**
 * The organisation enquiry form.
 *
 * What was here before: two `mailto:` links pointing at a domain nobody has
 * registered. Individuals never pay in this product, so an organisation
 * getting in touch is the only conversion event the business has, and it was
 * a hyperlink into a bounce with no record kept anywhere that somebody had
 * tried.
 *
 * Three required fields, and that number is the design. Every extra mandatory
 * box on a form like this is a clinic that starts filling it in on a Tuesday
 * afternoon and gives up. Seats and message are offered because people want
 * to say them, not because we need them to reply.
 *
 * Posts directly rather than through `lib/api`: that client attaches tokens
 * and refreshes sessions, and this is a form for somebody who has no account
 * and should not be issued anything resembling one by visiting a price page.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'failed'; message: string };

export function OrganisationEnquiry() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const id = useId();

  // No API behind this deployment, so there is nothing to submit to. Saying so
  // is the only honest option: a form that errors after somebody has typed
  // their unit's details into it is worse than no form, and much worse than a
  // sentence admitting where we are.
  if (!ENQUIRY_FORM_ENABLED) {
    return (
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Vi öppnar för förfrågningar inom kort</h3>
        <p className={styles.cardBody}>
          Vi har inte satt upp kanalen för verksamhetsförfrågningar än, och vi vill hellre
          säga det rakt ut än lägga upp ett formulär som inte går fram. Priserna ovan står
          fast; det som saknas är vår sida av kontakten.
        </p>
        <p className={styles.cardBody}>
          Under tiden är allt kliniskt i Cleat gratis för privatpersoner, utan tidsgräns och
          utan kort. Era klienter kan börja använda det i dag utan att ni gör någonting.
        </p>
      </div>
    );
  }

  if (state.kind === 'sent') {
    return (
      <div className={styles.card} role="status" aria-live="polite">
        <h3 className={styles.cardTitle}>Tack — det kom fram.</h3>
        <p className={styles.cardBody}>
          En människa läser er förfrågan och hör av sig inom ett par arbetsdagar. Vi har
          skickat en bekräftelse till adressen ni angav.
        </p>
        <p className={styles.cardBody} style={{ opacity: 0.7 }}>
          Under tiden kostar ingenting för era klienter. Allt kliniskt i Cleat är gratis för
          privatpersoner — det är verksamhetens egen miljö och platsadministrationen som är
          det ni betalar för.
        </p>
      </div>
    );
  }

  const sending = state.kind === 'sending';

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    /** FormData can hand back a File. These are text inputs; anything else is not a value. */
    const field = (name: string): string => {
      const value = form.get(name);
      return typeof value === 'string' ? value.trim() : '';
    };
    setState({ kind: 'sending' });

    try {
      const response = await fetch(`${API_BASE}/v1/contact/organisation`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          organisation: field('organisation'),
          contactName: field('contactName'),
          contactEmail: field('contactEmail'),
          contactPhone: field('contactPhone') || undefined,
          seatsEstimate: field('seatsEstimate') || undefined,
          message: field('message') || undefined,
          website: field('website'),
        }),
      });

      if (response.ok) {
        setState({ kind: 'sent' });
        return;
      }

      // Told apart on purpose. "Too many attempts" and "that address does not
      // look right" need different things from the person reading them, and a
      // single "something went wrong" makes both of them give up.
      if (response.status === 429) {
        setState({
          kind: 'failed',
          message:
            'Vi har tagit emot flera förfrågningar från er nyss. Vänta en stund, eller ring oss om det brådskar.',
        });
        return;
      }
      if (response.status === 400) {
        setState({
          kind: 'failed',
          message: 'Något i formuläret gick inte att läsa. Kontrollera e-postadressen och försök igen.',
        });
        return;
      }
      setState({
        kind: 'failed',
        message: 'Det gick inte att skicka just nu. Försök igen om en stund — inget är förlorat.',
      });
    } catch {
      // A dropped connection, an offline laptop, a captive portal on a
      // hospital network. Nothing was sent, and saying so plainly beats a
      // spinner that never resolves.
      setState({
        kind: 'failed',
        message:
          'Vi fick ingen kontakt med servern. Kontrollera nätverket och försök igen — ingenting skickades.',
      });
    }
  }

  return (
    <form
      className={styles.card}
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <h3 className={styles.cardTitle}>Hör av er</h3>
      <p className={styles.cardBody}>
        Tre fält räcker. Vi återkommer med vad det skulle kosta för er verksamhet.
      </p>

      <div style={{ display: 'grid', gap: 14, marginTop: 16 }}>
        <Field id={`${id}-org`} name="organisation" label="Verksamhet" required autoComplete="organization" />
        <Field id={`${id}-name`} name="contactName" label="Ditt namn" required autoComplete="name" />
        <Field
          id={`${id}-email`}
          name="contactEmail"
          label="E-post"
          required
          type="email"
          autoComplete="email"
        />
        <Field
          id={`${id}-phone`}
          name="contactPhone"
          label="Telefon (frivilligt)"
          type="tel"
          autoComplete="tel"
        />
        <Field
          id={`${id}-seats`}
          name="seatsEstimate"
          label="Ungefär hur många klienter? (frivilligt)"
          placeholder="t.ex. 40, eller “vet inte än”"
        />

        <label htmlFor={`${id}-message`} style={{ display: 'grid', gap: 6 }}>
          <span style={{ fontWeight: 600 }}>Något ni vill att vi vet (frivilligt)</span>
          <textarea
            id={`${id}-message`}
            name="message"
            rows={4}
            maxLength={4000}
            style={fieldStyle}
          />
        </label>

        {/* The honeypot. Hidden from people and from screen readers; bots fill
            it in because it looks like a field worth filling in. Cheaper and
            far more private than a captcha, which would put a third party
            between a clinic and us. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }}>
          <label htmlFor={`${id}-website`}>Webbplats</label>
          <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        {state.kind === 'failed' ? (
          <p role="alert" style={{ color: 'var(--danger, #ff8f8f)', margin: 0 }}>
            {state.message}
          </p>
        ) : null}

        <button type="submit" className={styles.submit} disabled={sending}>
          {sending ? 'Skickar…' : 'Skicka förfrågan'}
        </button>

        <p className={styles.cardBody} style={{ opacity: 0.7, margin: 0, fontSize: '0.9rem' }}>
          Vi sparar det ni skriver här för att kunna svara, och för ingenting annat. Inga
          klientuppgifter ska skickas i det här formuläret.
        </p>
      </div>
    </form>
  );
}

const fieldStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 10,
  color: 'inherit',
  font: 'inherit',
  padding: '10px 12px',
  width: '100%',
};

function Field(props: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label htmlFor={props.id} style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 600 }}>
        {props.label}
        {props.required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        id={props.id}
        name={props.name}
        type={props.type ?? 'text'}
        required={props.required}
        placeholder={props.placeholder}
        autoComplete={props.autoComplete}
        style={fieldStyle}
      />
    </label>
  );
}
