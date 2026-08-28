import { randomUUID } from 'node:crypto';
import type { Client } from '../db/pool.js';
import { decryptField, encryptField } from '../crypto/field.js';

/**
 * Storage for organisation enquiries.
 *
 * The enquiry is written before anything is emailed, and that order is the
 * whole design. Mail is the part most likely to fail — a revoked API key, an
 * unverified sender domain, a provider outage — and a sales enquiry that only
 * ever existed as an email is a customer who wrote to us and got silence.
 */

export interface OrgEnquiryInput {
  organisation: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  seatsEstimate?: string | null;
  message?: string | null;
  /** First two octets of the caller's address, for flood spotting. Nothing more. */
  sourcePrefix?: string | null;
  /** Set when the honeypot was filled in. Stored, never emailed. */
  spam?: boolean;
}

export interface OrgEnquiry {
  id: string;
  createdAt: Date;
  organisation: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  seatsEstimate: string | null;
  message: string | null;
  status: string;
  notifiedAt: Date | null;
}

/**
 * The free text is encrypted with the same key ring as the clinical free text,
 * so it needs an AAD. There is no tenant and no owner — a sales enquiry comes
 * from a stranger by definition — so the row's own id stands in as the owner.
 * That still binds the ciphertext to its row, which is what the AAD is for:
 * the message from one enquiry cannot be moved into another.
 */
function messageRef(id: string) {
  return { tenantId: 'no-tenant', table: 'org_enquiries', column: 'message', ownerId: id };
}

export async function createOrgEnquiry(
  client: Client,
  input: OrgEnquiryInput,
): Promise<OrgEnquiry> {
  // Generated here rather than by the column default, because the id is part
  // of the AAD and has to exist before the message can be encrypted.
  const id = randomUUID();
  const { rows } = await client.query<{
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
  }>(
    `INSERT INTO org_enquiries
       (id, organisation, contact_name, contact_email, contact_phone,
        seats_estimate, message, status, source_prefix)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, created_at, organisation, contact_name, contact_email,
               contact_phone, seats_estimate, message, status, notified_at`,
    [
      id,
      input.organisation,
      input.contactName,
      input.contactEmail.toLowerCase(),
      input.contactPhone ?? null,
      input.seatsEstimate ?? null,
      encryptField(input.message ?? null, messageRef(id)),
      input.spam ? 'spam' : 'new',
      input.sourcePrefix ?? null,
    ],
  );

  const row = rows[0];
  if (!row) throw new Error('org enquiry insert returned no row');
  return {
    id: row.id,
    createdAt: row.created_at,
    organisation: row.organisation,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    seatsEstimate: row.seats_estimate,
    message: decryptField(row.message, messageRef(row.id)),
    status: row.status,
    notifiedAt: row.notified_at,
  };
}

/**
 * Recorded only once the notification has actually left. An enquiry with a
 * null `notified_at` and a `new` status is one nobody has been told about,
 * which is exactly the query an operator needs after a mail outage.
 */
export async function markOrgEnquiryNotified(client: Client, id: string): Promise<void> {
  await client.query(`UPDATE org_enquiries SET notified_at = now() WHERE id = $1`, [id]);
}
