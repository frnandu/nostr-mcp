import { config } from "dotenv";
import { NostrServer } from "./server.js";
import logger from "./utils/logger.js";

// Load environment variables
config();

/**
 * Validates environment variables and starts the Nostr MCP server
 */
async function main() {
  // Get configuration from environment
  const relays = process.env.NOSTR_RELAYS?.split(",") || [];
  const nsecKey = process.env.NOSTR_NSEC_KEY;

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
    const server = new NostrServer({ nsecKey, relays });
    await server.start();
  } catch (error) {
    logger.error({ error }, "Failed to start server");
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  logger.error({ error }, "Unhandled error");
  process.exit(1);
});
