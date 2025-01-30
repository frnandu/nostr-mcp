import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { Config, NostrError, PostedNote } from "./types.js";
import logger from "./utils/logger.js";
import { NostrErrorCode } from "./types.js";

/**
 * NostrClient provides a high-level interface for interacting with the Nostr network
 * It wraps the NDK (Nostr Development Kit) client and provides error handling
 */
export class NostrClient {
  private ndk: NDK;
  private connected = false;

  /**
   * Creates a new NostrClient instance
   * @param config - Configuration containing relays and private key
   */
  constructor(config: Config) {
    logger.debug({ relays: config.relays }, "Initializing NostrClient");

    // Initialize NDK with provided relays and signer
    this.ndk = new NDK({
      explicitRelayUrls: config.relays,
      signer: new NDKPrivateKeySigner(config.nsecKey),
    });
  }

  /**
   * Validates client state before operations
   * @throws {NostrError} When client is not properly connected
   */
  private validateState(): void {
    if (!this.connected) {
      throw new NostrError(
        "Client is not connected",
        NostrErrorCode.NOT_CONNECTED,
        400,
      );
    }
  }

  /**
   * Establishes connections to configured Nostr relays
   * @throws {NostrError} When connection fails
   */
  async connect(): Promise<void> {
    try {
      logger.info("Connecting to Nostr relays...");
      await this.ndk.connect();
      this.connected = true;
      logger.info("Successfully connected to Nostr network");
    } catch (error) {
      logger.error({ error }, "Failed to connect to relays");
      this.connected = false;
      throw new NostrError(
        "Failed to connect to relays",
        NostrErrorCode.CONNECTION_ERROR,
        500,
      );
    }
  }

  /**
   * Posts a new note (kind 1 event) to the Nostr network
   * @param content - The text content of the note
   * @returns Promise resolving to the posted note details
   * @throws {NostrError} When note creation or publishing fails
   */
  async postNote(content: string): Promise<PostedNote> {
    try {
      this.validateState();

      logger.debug({ content }, "Creating new note");

      // Create a new kind 1 (text note) event
      const event = new NDKEvent(this.ndk);
      event.kind = 1; // Text note
      event.content = content;

      // Sign the event with our private key
      await event.sign();
      logger.debug({ id: event.id }, "Note signed successfully");

      // Publish to connected relays
      await event.publish();
      logger.info(
        { id: event.id, pubkey: event.pubkey },
        "Note published successfully",
      );

      return {
        id: event.id,
        content: event.content,
        pubkey: event.pubkey,
      };
    } catch (error) {
      logger.error({ error, content }, "Failed to post note");

      if (error instanceof NostrError) {
        throw error;
      }

      throw new NostrError(
        "Failed to post note",
        NostrErrorCode.POST_ERROR,
        500,
      );
    }
  }

  /**
   * Closes connections to all relays
   */
  async disconnect(): Promise<void> {
    try {
      logger.info("Disconnecting from Nostr network...");
      for (const relay of this.ndk.pool.connectedRelays()) {
        relay.disconnect();
      }
      this.connected = false;
      logger.info("Successfully disconnected from Nostr network");
    } catch (error) {
      logger.error({ error }, "Error during disconnect");
      throw new NostrError(
        "Failed to disconnect cleanly",
        NostrErrorCode.DISCONNECT_ERROR,
        500,
      );
    }
  }
}
