export { NostrServer } from "./server.js";
export { NostrClient } from "./nostr-client.js";
export * from "./types.js";
export { VERSION } from "./version.js";

import { config } from "dotenv";
import { NostrServer } from "./server.js";
import logger from "./utils/logger.js";
import { ServerMode } from "./types.js";

// Load environment variables
config();

/**
 * Validates environment variables and starts the Nostr MCP server
 */
async function main() {
  // Get configuration from environment
  const relays = process.env.NOSTR_RELAYS?.split(",") || [];
  const nsecKey = process.env.NOSTR_NSEC_KEY;
  const mode =
    (process.env.MODE?.toLowerCase() as ServerMode) || ServerMode.STDIN;
  const port = parseInt(process.env.PORT || "3000", 10);

  // Validate required environment variables
  if (!nsecKey) {
    logger.error("NOSTR_NSEC_KEY environment variable is required");
    process.exit(1);
  }
  if (relays.length === 0) {
    logger.error("NOSTR_RELAYS environment variable is required");
    process.exit(1);
  }

  try {
    // Create and start the server
    const server = new NostrServer({ nsecKey, relays }, { mode, port });
    await server.start();
  } catch (error) {
    console.error(error);
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error({ error }, "Unhandled error");
  process.exit(1);
});
