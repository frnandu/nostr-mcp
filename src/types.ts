import { z } from "zod";

export const ConfigSchema = z.object({
  nsecKey: z.string().min(1, "Nostr private key is required"),
  relays: z
    .array(z.string().url("Invalid relay URL"))
    .min(1, "At least one relay is required"),
});

export type Config = z.infer<typeof ConfigSchema>;

export const PostNoteSchema = z.object({
  content: z.string().min(1, "Note content cannot be empty"),
});

export type PostNoteArgs = z.infer<typeof PostNoteSchema>;

export interface PostedNote {
  id: string;
  content: string;
  pubkey: string;
}

/**
 * Error codes for Nostr operations
 */
export enum NostrErrorCode {
  CONNECTION_ERROR = "connection_error",
  POST_ERROR = "post_error",
  NOT_CONNECTED = "not_connected",
  DISCONNECT_ERROR = "disconnect_error",
}

export class NostrError extends Error {
  constructor(
    message: string,
    public readonly code: NostrErrorCode | string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "NostrError";
  }
}
