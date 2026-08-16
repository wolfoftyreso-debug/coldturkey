// A throwaway SMTP sink for the end-to-end suite.
//
// Account recovery is the one flow whose critical value — the reset token —
// exists nowhere the tests can reach. It is hashed in the database by design,
// and the development mailer logs a digest of the message rather than the
// message, also by design: a working reset link in a log file is a key to
// somebody's account. Both of those are correct and both make the flow
// untestable without a mailbox.
//
// So the suite gets a mailbox. This speaks just enough SMTP for the client in
// `apps/api/src/mail/smtp.ts` — no STARTTLS and no AUTH advertised, so it never
// tries either — and appends every accepted message to a JSONL file the tests
// read. It listens on the loopback interface only and is started and killed by
// scripts/e2e.sh.
import { appendFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';

const PORT = Number(process.env.E2E_SMTP_PORT ?? 2525);
const FILE = process.env.E2E_MAIL_FILE ?? '/tmp/cleat-e2e-mail.jsonl';

// Fresh on every run, so a test never reads a link from a previous one.
writeFileSync(FILE, '');

const server = createServer((socket) => {
  let buffer = '';
  let inData = false;
  let data = '';
  let to = '';

  socket.write('220 cleat-e2e ESMTP\r\n');

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    for (;;) {
      const index = buffer.indexOf('\r\n');
      if (index === -1) break;
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      if (inData) {
        if (line === '.') {
          inData = false;
          appendFileSync(FILE, `${JSON.stringify({ to, body: data })}\n`);
          data = '';
          socket.write('250 2.0.0 Ok\r\n');
        } else {
          // Undo the dot-stuffing the client applies.
          data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
        }
        continue;
      }

      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) {
        // No STARTTLS and no AUTH in the capability list: this sink is
        // loopback-only and the client skips both when they are not offered.
        socket.write('250-cleat-e2e\r\n250 8BITMIME\r\n');
      } else if (command.startsWith('MAIL FROM')) {
        socket.write('250 2.1.0 Ok\r\n');
      } else if (command.startsWith('RCPT TO')) {
        to = (/<([^>]*)>/.exec(line)?.[1] ?? '').toLowerCase();
        socket.write('250 2.1.5 Ok\r\n');
      } else if (command === 'DATA') {
        inData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (command === 'QUIT') {
        socket.write('221 2.0.0 Bye\r\n');
        socket.end();
      } else if (command === 'RSET' || command === 'NOOP') {
        socket.write('250 2.0.0 Ok\r\n');
      } else {
        socket.write('502 5.5.2 Command not implemented\r\n');
      }
    }
  });

  socket.on('error', () => undefined);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`e2e-smtp: listening on 127.0.0.1:${PORT}, writing to ${FILE}`);
});
