import NDK, {
  NDKEvent,
  NDKPrivateKeySigner,
  NDKZapper,
  LnPaymentInfo,
  NDKZapDetails,
} from "@nostr-dev-kit/ndk";
import {
  Config,
  NostrError,
  PostedNote,
  ZappedNote,
  PostCommentArgs,
  PostedComment,
  UpdateProfileArgs,
  UpdatedProfileMetadata,
  GetRepliesArgs,
  ReplyNote,
  GetLatestPostsArgs,
  LatestPost,
  GetUnansweredCommentsArgs,
  UnansweredComment,
} from "./types.js";
import logger from "./utils/logger.js";
import { NostrErrorCode } from "./types.js";
import { getPublicKey } from "nostr-tools";
import { hexToBytes } from "@noble/hashes/utils";

/**
 * NostrClient provides a high-level interface for interacting with the Nostr network
 * It wraps the NDK (Nostr Development Kit) client and provides error handling
 */
export class NostrClient {
  private ndk: NDK;
  private pubkey: string;
  private connected = false;

  /**
   * Creates a new NostrClient instance
   * @param config - Configuration containing relays and private key
   */
  constructor(config: Config) {
    logger.debug({ relays: config.relays }, "Initializing NostrClient");

    const signer = new NDKPrivateKeySigner(config.nsecKey);
    this.pubkey = getPublicKey(hexToBytes(signer.privateKey || ""));
    // Initialize NDK with provided relays and signer
    this.ndk = new NDK({
      explicitRelayUrls: config.relays,
      signer,
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
      const publishedToRelays = await event.publish();
      logger.info(
        { id: event.id, pubkey: event.pubkey, publishedToRelays },
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
   * Posts a comment (reply) to an existing note using NIP-10 tagging.
   */
  async postComment(args: PostCommentArgs): Promise<PostedComment> {
    try {
      this.validateState();

      const { rootId, parentId, content } = args;
      const replyParentId = parentId ?? rootId;

      logger.debug(
        { rootId, parentId: replyParentId },
        "Creating comment event",
      );

      const event = new NDKEvent(this.ndk);
      event.kind = 1;
      event.content = content;
      const baseTags = event.tags ?? [];
      event.tags = [
        ...baseTags,
        ["e", rootId, "", "root"],
        ["e", replyParentId, "", "reply"],
      ];

      await event.sign();
      logger.debug({ id: event.id }, "Comment signed successfully");

      const publishedToRelays = await event.publish();
      logger.info(
        {
          id: event.id,
          pubkey: event.pubkey,
          rootId,
          parentId: replyParentId,
          publishedToRelays,
        },
        "Comment published successfully",
      );

      return {
        id: event.id,
        content: event.content,
        pubkey: event.pubkey,
        rootId,
        parentId: replyParentId,
        tags: event.tags,
      };
    } catch (error) {
      logger.error({ error, args }, "Failed to post comment");
      if (error instanceof NostrError) {
        throw error;
      }

      throw new NostrError(
        "Failed to post comment",
        NostrErrorCode.POST_ERROR,
        500,
      );
    }
  }

  /**
   * Sends a zap to a Nostr user
   * @param nip05Address - The NIP-05 address of the recipient
   * @param amount - Amount in sats to zap
   * @returns Promise resolving to the zap details
   * @throws {NostrError} When zap creation or sending fails
   */
  async sendZap(nip05Address: string, amount: number): Promise<ZappedNote> {
    try {
      this.validateState();

      logger.debug({ nip05Address, amount }, "Creating zap");

      const recipient = await this.ndk.getUserFromNip05(nip05Address);
      if (!recipient) {
        throw new Error(`Could not find user ${nip05Address}`);
      }

      logger.info({ recipient: recipient.npub }, "Found recipient");

      // Setup zapper with Lightning payment handler
      const lnPay = async (payment: NDKZapDetails<LnPaymentInfo>) => {
        logger.info("please pay this invoice to complete the zap", payment.pr);
        return undefined;
      };
      // Create and send zap
      const zapper = new NDKZapper(recipient, amount, "sat", { lnPay });

      await zapper.zap();

      logger.info(
        { pubkey: recipient.pubkey, amount },
        "Zap request sent successfully",
      );

      return {
        recipientPubkey: recipient.pubkey,
        amount,
        invoice: "",
      };
    } catch (error) {
      logger.error({ error, nip05Address, amount }, "Failed to send zap");

      if (error instanceof NostrError) {
        throw error;
      }

      throw new NostrError("Failed to send zap", NostrErrorCode.ZAP_ERROR, 500);
    }
  }

  /**
   * Updates profile metadata (NIP-01 kind 0 event)
   * @param metadata - Partial profile fields to set
   * @returns Promise resolving to the published metadata event
   * @throws {NostrError} When publishing fails
   */
  async updateProfileMetadata(
    metadata: UpdateProfileArgs,
  ): Promise<UpdatedProfileMetadata> {
    try {
      this.validateState();

      logger.debug({ metadata }, "Creating profile metadata event");

      // First, try to fetch existing profile metadata to preserve existing fields
      let existingMetadata: Record<string, unknown> = {};
      try {
        const currentUser = this.ndk.getUser({ pubkey: this.pubkey });
        const existingProfile = await currentUser.fetchProfile();

        if (existingProfile) {
          // Convert NDKUserProfile to plain object, excluding internal fields
          existingMetadata = { ...existingProfile };
          // Remove NDK-specific fields that shouldn't be in the metadata
          delete existingMetadata.created_at;
          delete existingMetadata.profileEvent;

          logger.debug({ existingMetadata }, "Found existing profile metadata");
        } else {
          logger.debug(
            "No existing profile metadata found, creating new profile",
          );
        }
      } catch (error) {
        logger.warn(
          { error },
          "Failed to fetch existing profile, proceeding with new metadata only",
        );
      }

      // Merge existing metadata with new fields (new fields take precedence)
      const mergedMetadata = { ...existingMetadata, ...metadata };

      const event = new NDKEvent(this.ndk);
      event.kind = 0; // Metadata
      // Content must be a JSON string per NIP-01
      event.content = JSON.stringify(mergedMetadata);

      await event.sign();
      logger.debug({ id: event.id }, "Metadata event signed successfully");

      const publishedToRelays = await event.publish();
      logger.info(
        {
          id: event.id,
          pubkey: event.pubkey,
          publishedToRelays,
          mergedMetadata,
        },
        "Profile metadata published successfully",
      );

      return {
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
      };
    } catch (error) {
      logger.error({ error, metadata }, "Failed to update profile metadata");
      if (error instanceof NostrError) {
        throw error;
      }

      throw new NostrError(
        "Failed to update profile metadata",
        NostrErrorCode.POST_ERROR,
        500,
      );
    }
  }

  /**
   * Fetch latest posts authored by a specific pubkey.
   */
  async getLatestPosts(args: GetLatestPostsArgs): Promise<LatestPost[]> {
    try {
      this.validateState();

      const { limit } = args;
      const authorPubkey = args.authorPubkey ?? this.pubkey;
      if (!authorPubkey) {
        throw new NostrError(
          "Author public key is unavailable",
          NostrErrorCode.POST_ERROR,
          400,
        );
      }
      const filter: Record<string, unknown> = {
        kinds: [1],
        authors: [authorPubkey],
        limit: limit ?? 1,
      };

      // fetchEvents returns a Set<NDKEvent>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: Set<NDKEvent> = (await (this.ndk as any).fetchEvents(
        filter,
      )) as Set<NDKEvent>;

      const posts: LatestPost[] = Array.from(events)
        .map((ev) => ({
          id: ev.id,
          pubkey: ev.pubkey,
          content: ev.content,
          created_at: ev.created_at,
        }))
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

      logger.info(
        { authorPubkey, count: posts.length },
        "Fetched latest posts successfully",
      );

      return posts;
    } catch (error) {
      logger.error({ error, args }, "Failed to fetch latest posts");
      if (error instanceof NostrError) {
        throw error;
      }

      throw new NostrError(
        "Failed to fetch latest posts",
        NostrErrorCode.POST_ERROR,
        500,
      );
    }
  }

  /**
   * Fetch replies (kind 1) to a given note id by filtering on '#e' tag.
   */
  async getReplies(args: GetRepliesArgs): Promise<ReplyNote[]> {
    try {
      this.validateState();

      const { eventId, limit } = args;
      const filter: Record<string, unknown> = {
        kinds: [1],
        "#e": [eventId],
      };
      if (limit) {
        (filter as { limit: number }).limit = limit;
      }

      // fetchEvents returns a Set<NDKEvent>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: Set<NDKEvent> = (await (this.ndk as any).fetchEvents(
        filter,
      )) as Set<NDKEvent>;

      const replies: ReplyNote[] = Array.from(events)
        .map((ev) => ({
          id: ev.id,
          pubkey: ev.pubkey,
          content: ev.content,
          created_at: ev.created_at,
        }))
        .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

      logger.info(
        { eventId, count: replies.length },
        "Fetched replies successfully",
      );
      return replies;
    } catch (error) {
      logger.error({ error, args }, "Failed to fetch replies");
      if (error instanceof NostrError) {
        throw error;
      }
      throw new NostrError(
        "Failed to fetch replies",
        NostrErrorCode.POST_ERROR,
        500,
      );
    }
  }

  /**
   * Find comments on a note that have not received a reply from the current signer.
   */
  async getUnansweredComments(
    args: GetUnansweredCommentsArgs,
  ): Promise<UnansweredComment[]> {
    try {
      this.validateState();

      const { eventId, limit } = args;
      const authorPubkey = this.pubkey;
      if (!authorPubkey) {
        throw new NostrError(
          "Signer public key is unavailable",
          NostrErrorCode.POST_ERROR,
          400,
        );
      }

      const filter: Record<string, unknown> = {
        kinds: [1],
        "#e": [eventId],
      };
      if (limit) {
        (filter as { limit: number }).limit = limit;
      }

      // fetchEvents returns a Set<NDKEvent>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events: Set<NDKEvent> = (await (this.ndk as any).fetchEvents(
        filter,
      )) as Set<NDKEvent>;

      const ourComments = Array.from(events).filter(
        (event) => event.pubkey === authorPubkey,
      );
      const othersComments = Array.from(events).filter(
        (event) => event.pubkey !== authorPubkey,
      );

      if (othersComments.length === 0) {
        logger.info({ eventId }, "No external comments found to reply");
        return [];
      }

      const repliedIds: string[] = [];
      Array.from(ourComments).forEach((ev) => {
        const ids = ev.tags
          .filter(
            (tag) => tag[0] === "e" && tag.length > 3 && tag[3] === "reply",
          )
          .map((ev) => ev[1]);
        repliedIds.push(...ids);
      });

      const unrepliedComments = Array.from(othersComments).filter(
        (event) => !repliedIds.includes(event.id),
      );

      logger.info(
        {
          eventId,
          pendingReplies: unrepliedComments.length,
        },
        "Identified comments awaiting reply",
      );

      return unrepliedComments.map((event) => ({
        id: event.id,
        pubkey: event.pubkey,
        content: event.content,
        created_at: event.created_at,
        tags: event.tags,
        rootId: eventId,
      }));
    } catch (error) {
      logger.error({ error, args }, "Failed to find unanswered comments");
      if (error instanceof NostrError) {
        throw error;
      }
      throw new NostrError(
        "Failed to find unanswered comments",
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
