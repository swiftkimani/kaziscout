// tsc only emits .js, so the SQL migrations have to be copied next to the compiled code.
import { cpSync } from 'node:fs';

cpSync('src/db/migrations', 'dist/db/migrations', { recursive: true });
