import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { withoutTenant } from '../db/pool.js';
import { mailer } from '../mail/smtp.js';
import { metrics } from '../observability/metrics.js';
import { createOrgEnquiry, markOrgEnquiryNotified } from '../contact/repository.js';

/**
 * The commercial contact surface.
 *
 * Before this existed, the organisation page offered two `mailto:` links
 * pointing at a domain nobody has registered. Every clinic that tried to get
 * in touch wrote into a bounce, and nothing anywhere recorded that they had
 * tried. Individuals never pay in this product, so an organisation enquiry is
 * the only conversion event the business has — it cannot be a hyperlink and a
 * hope.
 *
 * Unauthenticated by necessity: the whole point is that somebody who has never
 * heard of us can reach us. That makes it an abuse surface, so:
 *
 *   * it is rate limited far below the global ceiling;
 *   * the confirmation mail contains no text the caller supplied, so this
 *     cannot be used to relay a message to a third party;
 *   * a filled-in honeypot is stored as spam and answered normally, because
 *     telling a bot it was detected only teaches it;
 *   * the enquiry is written to the database *before* any mail is attempted.
 *
 * That last one is the important one. Mail is the part most likely to fail,
 * and an enquiry that only ever existed as an email is a customer who wrote to
 * us and got silence.
 */

const body = z.object({
  organisation: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(200),
  contactEmail: z.string().trim().email().max(320),
  contactPhone: z.string().trim().max(40).optional(),
  seatsEstimate: z.string().trim().max(100).optional(),
  message: z.string().trim().max(4000).optional(),
  /**
   * The honeypot. Hidden from people, irresistible to form-filling bots. Named
   * for something a bot expects to see rather than `honeypot`.
   */
  website: z.string().max(200).optional(),
});

/**
 * Two octets, never the address. Enough to notice fifty enquiries from one
 * network in an hour; not enough to be a record of where somebody was.
 */
function sourcePrefix(request: FastifyRequest): string | null {
  const ip = request.ip;
  if (!ip) return null;
  if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':');
  return ip.split('.').slice(0, 2).join('.');
}

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  const config = loadConfig();

  app.post(
    '/v1/contact/organisation',
    {
      config: {
        rateLimit: { max: config.CONTACT_LIMIT_MAX, timeWindow: config.CONTACT_LIMIT_WINDOW },
      },
    },
    async (request, reply) => {
      const input = body.parse(request.body);
      const spam = Boolean(input.website && input.website.trim().length > 0);

      const enquiry = await withoutTenant((client) =>
        createOrgEnquiry(client, {
          organisation: input.organisation,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone ?? null,
          seatsEstimate: input.seatsEstimate ?? null,
          message: input.message ?? null,
          sourcePrefix: sourcePrefix(request),
          spam,
        }),
      );

      metrics.orgEnquiries += 1;

      // Answered identically either way. A bot that learns it was caught is a
      // bot that comes back without the tell.
      if (spam) {
        metrics.orgEnquiriesSpam += 1;
        return reply.code(202).send({ received: true });
      }

      const notifyTo = config.CONTACT_NOTIFY_EMAIL ?? config.MAIL_FROM;
      try {
        await mailer().send({
          to: notifyTo,
          subject: `Förfrågan från ${enquiry.organisation}`,
          text: [
            `Verksamhet: ${enquiry.organisation}`,
            `Kontakt: ${enquiry.contactName} <${enquiry.contactEmail}>`,
            enquiry.contactPhone ? `Telefon: ${enquiry.contactPhone}` : null,
            enquiry.seatsEstimate ? `Uppskattat antal platser: ${enquiry.seatsEstimate}` : null,
            '',
            enquiry.message ?? '(inget meddelande)',
            '',
            `Ärende-id: ${enquiry.id}`,
          ]
            .filter((line) => line !== null)
            .join('\n'),
        });

        // Deliberately carries nothing the caller typed. This endpoint will
        // send mail to any address given to it, so anything it echoed back
        // would make it a relay for attacker-controlled content.
        await mailer().send({
          to: enquiry.contactEmail,
          subject: 'Vi har fått er förfrågan',
          text: [
            'Tack — er förfrågan har kommit fram och en människa läser den.',
            'Vi hör av oss inom ett par arbetsdagar.',
            '',
            'Under tiden: allt kliniskt i Cleat är gratis för privatpersoner, utan',
            'tidsgräns och utan kort. Det är bara verksamhetens egen miljö,',
            'platsadministrationen och stödet som kostar.',
            '',
            '— Cleat',
          ].join('\n'),
        });

        metrics.mailSent += 2;
        await withoutTenant((client) => markOrgEnquiryNotified(client, enquiry.id));
      } catch (error) {
        // The enquiry is already saved, so this is recoverable by a human
        // reading the table — which is precisely why it is saved first. Loud,
        // because the alternative is a clinic waiting for a reply that nobody
        // knows they are owed.
        metrics.mailFailed += 1;
        metrics.orgEnquiriesUnnotified += 1;
        request.log.error(
          { err: error, enquiry: enquiry.id },
          'organisation enquiry stored but the notification could not be sent',
        );
      }

      // 202 either way. The person filling in the form did nothing wrong, and
      // whether our mail provider is having a bad morning is not their problem
      // — their enquiry is safe.
      return reply.code(202).send({ received: true });
    },
  );
}
