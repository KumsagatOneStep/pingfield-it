// Wipes the database in DATABASE_URL and loads the demo data: npm run db:demo-reset
import { neon, neonConfig } from "@neondatabase/serverless";
import { resetDemo } from "../src/lib/demo/seed.ts";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан. Заполните .env.local (см. .env.example).");
  process.exit(1);
}
if (process.env.NEON_LOCAL_PROXY) neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
console.log("Демо-данные загружены:", await resetDemo(neon(url)));
