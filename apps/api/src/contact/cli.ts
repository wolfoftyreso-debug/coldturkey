import { pathToFileURL } from 'node:url';
import { closePool, withoutTenant } from '../db/pool.js';
import { decryptField } from '../crypto/field.js';

/**
 * The operator's view of organisation enquiries.
 *
 * This exists because the message is encrypted at rest, which means `psql`
 * alone cannot read it. Without a tool, an operator recovering from a mail
 * outage can see that four clinics wrote in and not a word of what any of
 * them said — the feature would be half-delivered.
 *
 *   pnpm --filter @cleat/api enquiries            # everything unanswered
 *   pnpm --filter @cleat/api enquiries -- --all   # including handled and spam
 *   pnpm --filter @cleat/api enquiries -- --contacted <id>
 *
 * Deliberately a command and not an admin web page. An admin UI over this
 * table is a second authentication surface, a second authorisation model and a
 * second thing to get wrong, for a volume of enquiries that one person reads
 * over coffee. If that volume ever justifies a screen, the screen can be built
 * then.
 */

interface Row {
  id: string;
  created_at: Date;
  organisation: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  seats_estimate: string | null;
  message: string | null;
  status: string;
  notified_at: Date | null;
}

function messageRef(id: string) {
  return { tenantId: 'no-tenant', table: 'org_enquiries', column: 'message', ownerId: id };
}

export async function listEnquiries(all: boolean): Promise<Row[]> {
  return withoutTenant(async (client) => {
    const { rows } = await client.query<Row>(
      all
        ? `SELECT * FROM org_enquiries ORDER BY created_at DESC`
        : `SELECT * FROM org_enquiries WHERE status = 'new' ORDER BY created_at DESC`,
    );
    return rows;
  });
}

export async function markContacted(id: string): Promise<boolean> {
  return withoutTenant(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE org_enquiries SET status = 'contacted' WHERE id = $1 AND status <> 'spam'`,
      [id],
    );
    return (rowCount ?? 0) > 0;
  });
}

function render(row: Row): string {
  // Decryption is allowed to fail loudly. A message that will not decrypt
  // means the wrong key ring is loaded, and printing an empty line instead
  // would make that look like an enquiry with nothing in it.
  let message: string;
  try {
    message = decryptField(row.message, messageRef(row.id)) ?? '(inget meddelande)';
  } catch (error) {
    message = `!! could not decrypt: ${error instanceof Error ? error.message : String(error)}`;
  }

  return [
    // Spam is never announced, by design, so marking it unannounced would be
    // noise on exactly the rows an operator is scrolling past.
    `${row.created_at.toISOString()}  ${row.status}` +
      (row.notified_at === null && row.status !== 'spam' ? '  [NOT ANNOUNCED]' : ''),
    `  ${row.organisation}`,
    `  ${row.contact_name} <${row.contact_email}>${row.contact_phone ? ` · ${row.contact_phone}` : ''}`,
    row.seats_estimate ? `  platser: ${row.seats_estimate}` : null,
    `  ${message.split('\n').join('\n  ')}`,
    `  id: ${row.id}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function main(argv: string[]): Promise<void> {
  const contactedAt = argv.indexOf('--contacted');
  if (contactedAt !== -1) {
    const id = argv[contactedAt + 1];
    if (!id) throw new Error('--contacted needs an enquiry id');
    console.log(
      (await markContacted(id)) ? `marked ${id} contacted` : `no unhandled enquiry with id ${id}`,
    );
    return;
  }

  const rows = await listEnquiries(argv.includes('--all'));
  if (rows.length === 0) {
    console.log('nothing waiting');
    return;
  }
  console.log(rows.map(render).join('\n\n'));

  // The number that matters most is not how many came in but how many nobody
  // was told about, because those are the ones waiting on a reply that no
  // human knows is owed.
  const silent = rows.filter((row) => row.notified_at === null && row.status === 'new').length;
  if (silent > 0) {
    console.log(
      `\n${silent} enquir${silent === 1 ? 'y' : 'ies'} were stored but never announced — ` +
        'mail was failing when they arrived.',
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2))
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('[enquiries]', error);
      process.exit(1);
    });
}
