import app from "./app.js";
import { env } from "./config/env.js";
import prisma from "./lib/prisma.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`API ouvindo em 0.0.0.0:${env.PORT}`);
});

async function shutdown(signal) {
  console.log(`Recebido ${signal}. Encerrando o servidor...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
