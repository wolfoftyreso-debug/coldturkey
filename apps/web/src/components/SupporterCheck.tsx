'use client';

import { useState } from 'react';
import {
  reflectOnSupport,
  SUPPORTER_SCALE,
  SUPPORTER_STATEMENTS,
  type SupporterAnswer,
} from '@cleat/core';
import { translate } from '@cleat/i18n';
import styles from '../app/landing.module.css';

/**
 * The self-check, computed in the browser and posted nowhere.
 *
 * "I search their phone." "I have said this is the last time more than once."
 * "I am only calm once I know where they are." That is the most sensitive
 * thing anybody could type into this product — more sensitive, in a household
 * where it might be read, than the recovery data the rest of the app encrypts —
 * and there is no feature that needs a copy of it. So there is no request, no
 * storage, and nothing left behind when the page closes.
 *
 * It also refuses to say anything from a handful of taps. Recognising yourself
 * in a pattern an app assembled out of three answers is worse than being told
 * nothing at all.
 */
const LOCALE = 'sv';
const t = (key: string) => translate(LOCALE, key);

export function SupporterCheck() {
  const [answers, setAnswers] = useState<Record<string, SupporterAnswer>>({});
  const reflection = reflectOnSupport(answers);
  const answered = Object.keys(answers).length;

  return (
    <div>
      {SUPPORTER_STATEMENTS.map((statement) => (
        <div className={styles.card} key={statement.id} style={{ marginBottom: 12 }}>
          <p className={styles.cardBody} style={{ marginBottom: 12 }}>
            {t(`near.statement.${statement.id}`)}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUPPORTER_SCALE.map((value) => {
              const selected = answers[statement.id] === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAnswers((current) => ({ ...current, [statement.id]: value }))}
                  aria-pressed={selected}
                  style={{
                    flex: '1 1 auto',
                    minWidth: 92,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius)',
                    border: `1px solid ${selected ? 'var(--accent-strong)' : 'var(--border)'}`,
                    background: selected ? 'var(--accent-soft, transparent)' : 'transparent',
                    color: selected ? 'var(--text)' : 'var(--text-dim)',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                  }}
                >
                  {t(`near.scale.${value}`)}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <h3 className={styles.cardTitle} style={{ marginTop: 32 }}>
        {t('near.checkResult')}
      </h3>

      {reflection.tooLittle ? (
        <p className={styles.cardBody}>{t('near.checkTooLittle')}</p>
      ) : reflection.loudest.length === 0 ? (
        <p className={styles.cardBody}>{t('near.checkNothingLoud')}</p>
      ) : (
        reflection.loudest.map((pattern) => (
          <article className={styles.card} key={pattern} style={{ marginBottom: 12 }}>
            <h4 className={styles.cardTitle}>{t(`near.pattern.${pattern}`)}</h4>
            <p className={styles.cardBody}>{t(`near.pattern.${pattern}.body`)}</p>
            <p className={styles.cardBody} style={{ color: 'var(--accent-strong)' }}>
              {t(`near.pattern.${pattern}.step`)}
            </p>
          </article>
        ))
      )}

      {answered > 0 ? (
        <button
          type="button"
          className={styles.crisisLink}
          onClick={() => setAnswers({})}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {t('near.checkReset')}
        </button>
      ) : null}
    </div>
  );
}
