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
  ZAP_ERROR = "zap_error",
  INVALID_RECIPIENT = "invalid_recipient",
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

export enum ServerMode {
  STDIO = "stdio",
  SSE = "sse",
}

export interface ServerConfig {
  mode: ServerMode;
  port?: number; // For SSE mode
}

// Add new schema for zap arguments
export const ZapNoteSchema = z.object({
  nip05Address: z.string().min(1, "NIP-05 address is required"),
  amount: z.number().min(1, "Amount must be greater than 0"),
});

export type ZapNoteArgs = z.infer<typeof ZapNoteSchema>;

// Add new interface for zap result
export interface ZappedNote {
  recipientPubkey: string;
  amount: number;
  invoice: string;
}

export interface NostrServer {
  start(): Promise<void>;
  shutdown(code?: number): Promise<never>;
}
