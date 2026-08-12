import { createHash, randomBytes } from 'node:crypto';
import { connect, type Socket } from 'node:net';
import { connect as tlsConnect, type TLSSocket } from 'node:tls';
import { loadConfig } from '../config.js';

/**
 * A small SMTP client.
 *
 * Written rather than pulled in because the dependency is not worth its
 * surface here: this sends two kinds of short plain-text message to one
 * server, and a mail library brings templating, attachments, OAuth flows and
 * a transitive tree that all has to be trusted with a process that also holds
 * recovery data. The protocol below is the 1982 subset plus STARTTLS and
 * AUTH — enough for Postfix, Maddy, or any self-hosted relay.
 *
 * What this deliberately does NOT do: retries with backoff, queuing, DKIM
 * signing, bounce handling. Those belong in the relay, which is a solved
 * piece of software that should be run rather than reimplemented. This client
 * hands a message to it and reports whether that worked.
 */

export interface Mail {
  to: string;
  subject: string;
  /** Plain text only. HTML mail in this product would be a tracking surface. */
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
  /** What the caller should tell the user about delivery, for the dev case. */
  readonly kind: 'smtp' | 'log';
}

const CRLF = '\r\n';

class SmtpError extends Error {
  constructor(message: string, readonly reply?: string) {
    super(reply ? `${message}: ${reply.trim()}` : message);
    this.name = 'SmtpError';
  }
}

/**
 * Reads SMTP replies off a socket.
 *
 * A reply can span several lines — "250-STARTTLS" then "250 AUTH ..." — and
 * only the line with a space in the fourth column ends it. Reading one line
 * and moving on is the classic way an SMTP client desynchronises and then
 * misinterprets every later reply.
 */
class ReplyReader {
  private buffer = '';
  private waiting: ((reply: string) => void) | null = null;
  private failed: ((error: Error) => void) | null = null;

  constructor(private socket: Socket | TLSSocket) {
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.push(chunk));
    socket.on('error', (error) => this.failed?.(error));
  }

  attach(socket: Socket | TLSSocket): void {
    this.socket = socket;
    this.buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.push(chunk));
    socket.on('error', (error) => this.failed?.(error));
  }

  private push(chunk: string): void {
    this.buffer += chunk;
    if (!this.waiting) return;
    const complete = /^\d{3} [^\r\n]*\r\n/m.test(this.buffer)
      ? this.buffer.split(/\r\n/).some((line) => /^\d{3} /.test(line))
      : false;
    if (!complete) return;
    const reply = this.buffer;
    this.buffer = '';
    const resolve = this.waiting;
    this.waiting = null;
    resolve(reply);
  }

  read(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.waiting = resolve;
      this.failed = reject;
      this.push('');
    });
  }
}

async function expect(reader: ReplyReader, codes: number[], step: string): Promise<string> {
  const reply = await reader.read();
  const code = Number(reply.slice(0, 3));
  if (!codes.includes(code)) throw new SmtpError(`SMTP ${step} refused`, reply);
  return reply;
}

function write(socket: Socket | TLSSocket, line: string): void {
  socket.write(line + CRLF);
}

/**
 * Dot-stuffing. A line consisting of a single "." ends the message body, so a
 * message containing one would be truncated there — and the rest interpreted
 * as SMTP commands. Rare in ordinary prose and trivially reachable by someone
 * writing their why statement as a list.
 */
function encodeBody(text: string): string {
  return text
    .replace(/\r?\n/g, CRLF)
    .split(CRLF)
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join(CRLF);
}

function messageId(from: string): string {
  const domain = from.split('@')[1] ?? 'cleat.local';
  return `<${randomBytes(16).toString('hex')}@${domain}>`;
}

class SmtpMailer implements Mailer {
  readonly kind = 'smtp';

  constructor(
    private readonly options: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      from: string;
      rejectUnauthorized: boolean;
    },
  ) {}

  async send(mail: Mail): Promise<void> {
    const { host, port, user, pass, from } = this.options;

    let socket: Socket | TLSSocket = await new Promise((resolve, reject) => {
      const s = connect({ host, port }, () => resolve(s));
      s.setTimeout(15_000, () => s.destroy(new Error('SMTP timeout')));
      s.once('error', reject);
    });

    const reader = new ReplyReader(socket);
    try {
      await expect(reader, [220], 'greeting');
      write(socket, `EHLO ${hostnameFor(from)}`);
      let capabilities = await expect(reader, [250], 'EHLO');

      // Upgrade before authenticating. Credentials and a password reset link
      // both cross this connection, and on a self-hosted setup "it is all
      // inside the cluster" is the assumption that stops being true the first
      // time the relay moves to another host.
      if (/\bSTARTTLS\b/i.test(capabilities)) {
        write(socket, 'STARTTLS');
        await expect(reader, [220], 'STARTTLS');
        socket = await new Promise<TLSSocket>((resolve, reject) => {
          const upgraded = tlsConnect(
            {
              socket,
              servername: host,
              rejectUnauthorized: this.options.rejectUnauthorized,
            },
            () => resolve(upgraded),
          );
          upgraded.once('error', reject);
        });
        reader.attach(socket);
        write(socket, `EHLO ${hostnameFor(from)}`);
        capabilities = await expect(reader, [250], 'EHLO after STARTTLS');
      }

      if (user && pass) {
        if (!/\bAUTH\b/i.test(capabilities)) {
          throw new SmtpError('SMTP credentials configured but the server offers no AUTH');
        }
        // PLAIN over an upgraded connection. LOGIN adds a round trip and no
        // security; CRAM-MD5 adds an obsolete hash.
        const payload = Buffer.from(`\0${user}\0${pass}`).toString('base64');
        write(socket, `AUTH PLAIN ${payload}`);
        await expect(reader, [235], 'AUTH');
      }

      write(socket, `MAIL FROM:<${from}>`);
      await expect(reader, [250], 'MAIL FROM');
      write(socket, `RCPT TO:<${mail.to}>`);
      await expect(reader, [250, 251], 'RCPT TO');
      write(socket, 'DATA');
      await expect(reader, [354], 'DATA');

      const headers = [
        `From: Cleat <${from}>`,
        `To: <${mail.to}>`,
        `Subject: ${encodeHeader(mail.subject)}`,
        `Message-ID: ${messageId(from)}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: 8bit',
        // These are transactional and must never be treated as a mailing list
        // or bounced into a bulk folder.
        'Auto-Submitted: auto-generated',
      ].join(CRLF);

      write(socket, `${headers}${CRLF}${CRLF}${encodeBody(mail.text)}${CRLF}.`);
      await expect(reader, [250], 'message');

      write(socket, 'QUIT');
    } finally {
      socket.destroy();
    }
  }
}

/**
 * Non-ASCII subjects need encoding or they arrive as mojibake — and every
 * subject this product sends is Swedish by default.
 */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function hostnameFor(from: string): string {
  return from.split('@')[1] ?? 'cleat.local';
}

/**
 * The development mailer.
 *
 * Prints a one-line digest instead of sending. It logs a hash of the link
 * rather than the link itself: a reset link in a log file is a working key to
 * somebody's account, and development logs get pasted into issues.
 */
class LogMailer implements Mailer {
  readonly kind = 'log';

  async send(mail: Mail): Promise<void> {
    const digest = createHash('sha256').update(mail.text).digest('hex').slice(0, 12);
    console.log(`[mail] to=${mail.to} subject=${JSON.stringify(mail.subject)} body=sha256:${digest}`);
  }
}

let cached: Mailer | null = null;

export function mailer(): Mailer {
  if (cached) return cached;
  const config = loadConfig();
  cached = config.SMTP_HOST
    ? new SmtpMailer({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
        from: config.MAIL_FROM,
        rejectUnauthorized: config.SMTP_REJECT_UNAUTHORIZED,
      })
    : new LogMailer();
  return cached;
}

/** Test seam. */
export function setMailer(next: Mailer | null): void {
  cached = next;
}
