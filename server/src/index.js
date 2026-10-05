import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openDb } from './db.js';
import { createApp } from './app.js';
import { secret } from './auth.js';

secret(); // fail fast in production if JWT_SECRET is missing
const app = createApp(openDb());
const dist = join(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
}
const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Folio listening on http://localhost:${port}${existsSync(dist) ? '' : ' (API only: run the client with npm run dev)'}`));
