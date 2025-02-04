export { NostrClient } from "./nostr-client.js";
export * from "./types.js";

import { config } from "dotenv";
import { NostrSseServer } from "./sse_server.js";
import { NostrStdioServer } from "./stdio_server.js";
import { Config, ServerConfig, ServerMode } from "./types.js";
import logger from "./utils/logger.js";

// Load environment variables
config();

/**
 * Validates environment variables and starts the Nostr MCP server
 */
async function main() {
  // Get configuration from environment
  const relays = process.env.NOSTR_RELAYS?.split(",") || [];
  const nsecKey = process.env.NOSTR_NSEC_KEY || "";
  const config: Config = {
    nsecKey,
    relays,
  };
  const mode =
    (process.env.SERVER_MODE?.toLowerCase() as ServerMode) || ServerMode.STDIO;

  const serverConfig: ServerConfig = {
    port: parseInt(process.env.PORT || "3000"),
    mode,
  };

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
    const server =
      mode === "sse"
        ? new NostrSseServer(config, serverConfig)
        : new NostrStdioServer(config);

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
