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

export const PostCommentSchema = z.object({
  rootId: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "rootId must be a 64-char hex string"),
  content: z.string().min(1, "Comment content cannot be empty"),
  parentId: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "parentId must be a 64-char hex string")
    .optional(),
});

export type PostCommentArgs = z.infer<typeof PostCommentSchema>;

export interface PostedComment {
  id: string;
  content: string;
  pubkey: string;
  rootId: string;
  parentId: string;
  tags: string[][];
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

// Replies lookup
export const GetRepliesSchema = z.object({
  eventId: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "eventId must be a 64-char hex string"),
  limit: z.number().int().min(1).max(500).optional(),
});

export type GetRepliesArgs = z.infer<typeof GetRepliesSchema>;

export interface ReplyNote {
  id: string;
  pubkey: string;
  content: string;
  created_at?: number;
}

export const GetLatestPostsSchema = z.object({
  authorPubkey: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "authorPubkey must be a 64-char hex string")
    .optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export type GetLatestPostsArgs = z.infer<typeof GetLatestPostsSchema>;

export interface LatestPost {
  id: string;
  pubkey: string;
  content: string;
  created_at?: number;
}

export const GetUnansweredCommentsSchema = z.object({
  eventId: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "eventId must be a 64-char hex string"),
  limit: z.number().int().min(1).max(500).optional(),
});

export type GetUnansweredCommentsArgs = z.infer<
  typeof GetUnansweredCommentsSchema
>;

export interface UnansweredComment extends ReplyNote {
  tags: string[][];
  parentId?: string;
  rootId: string;
}

// NIP-01 profile metadata (kind 0). Only standard fields are defined here; others are ignored.
export const UpdateProfileSchema = z
  .object({
    name: z.string().min(1).optional(),
    about: z.string().min(1).optional(),
    picture: z.string().url().optional(),
    // Common, but optional extras supported by many clients
    banner: z.string().url().optional(),
    website: z.string().url().optional(),
    nip05: z.string().optional(),
    lud16: z.string().optional(),
    display_name: z.string().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one profile field must be provided",
    path: [],
  });

export type UpdateProfileArgs = z.infer<typeof UpdateProfileSchema>;

export interface UpdatedProfileMetadata {
  id: string;
  pubkey: string;
  content: string; // JSON string of metadata
}

// NIP-03 OpenTimestamps Attestations for Events (kind 1040)
export const CreateTimestampAttestationSchema = z.object({
  eventId: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/i, "eventId must be a 64-char hex string"),
  eventKind: z.number().int().min(0).max(65535),
  otsProof: z.string().min(1, "OpenTimestamps proof content is required"),
});

export type CreateTimestampAttestationArgs = z.infer<
  typeof CreateTimestampAttestationSchema
>;

export interface CreatedTimestampAttestation {
  id: string;
  pubkey: string;
  eventId: string;
  eventKind: number;
  otsProofLength: number;
}
