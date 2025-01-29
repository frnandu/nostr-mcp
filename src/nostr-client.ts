import NDK, { NDKEvent, NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";
import { Config, NostrError, PostedNote } from "./types.js";

export class NostrClient {
  private ndk: NDK;

  constructor(config: Config) {
    this.ndk = new NDK({
      explicitRelayUrls: config.relays,
      signer: new NDKPrivateKeySigner(config.nsecKey),
    });
  }

  async connect(): Promise<void> {
    try {
      await this.ndk.connect();
      console.error("Connected to Nostr relays");
    } catch (error) {
      throw new NostrError(
        "Failed to connect to relays",
        "connection_error",
        500,
      );
    }
  }

  async postNote(content: string): Promise<PostedNote> {
    try {
      const event = new NDKEvent(this.ndk);
      event.kind = 1;
      event.content = content;

      await event.sign();
      await event.publish();

      console.error(`Note posted successfully with ID: ${event.id}`);

      return {
        id: event.id,
        content: event.content,
        pubkey: event.pubkey,
      };
    } catch (error) {
      console.error("Error posting note:", error);
      throw new NostrError("Failed to post note", "post_error", 500);
    }
  }
}
