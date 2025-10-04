import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
  ErrorCode,
  McpError,
  TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { NostrClient } from "./nostr-client.js";
import {
  Config,
  ConfigSchema,
  PostNoteSchema,
  PostCommentSchema,
  NostrError,
  NostrServer,
  ServerConfig,
  ZapNoteSchema,
  UpdateProfileSchema,
  GetRepliesSchema,
  GetLatestPostsSchema,
  CreateTimestampAttestationSchema,
  GetUnansweredCommentsSchema,
} from "./types.js";
import logger from "./utils/logger.js";
import express from "express";
const SERVER_NAME = "nostr-mcp";
const SERVER_VERSION = "0.0.15";

/**
 * NostrServer implements a Model Context Protocol server for Nostr
 * It provides tools for interacting with the Nostr network, such as posting notes
 */
export class NostrSseServer implements NostrServer {
  private server: Server;
  private client: NostrClient;
  private transport?: SSEServerTransport;
  private app: express.Application;

  constructor(config: Config, serverConfig: ServerConfig) {
    // Validate configuration using Zod schema
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    // Initialize Nostr client and MCP server
    this.client = new NostrClient(config);
    this.server = new Server(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );
    this.app = express();

    // Initialize transport based on mode
    this.app.get("/sse", async (req, res) => {
      this.transport = new SSEServerTransport("/messages", res);
      await this.server.connect(this.transport);
    });

    this.app.post("/messages", async (req, res) => {
      if (!this.transport) {
        res.status(400).json({ error: "No active SSE connection" });
        return;
      }
      await this.transport.handlePostMessage(req, res);
    });

    this.app.listen(serverConfig.port, () => {
      logger.info(`SSE Server listening on port ${serverConfig.port}`);
    });

    this.setupHandlers();
  }

  /**
   * Sets up error and signal handlers for the server
   */
  private setupHandlers(): void {
    // Log MCP errors
    this.server.onerror = (error) => {
      logger.error({ error }, "MCP Server Error");
    };

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      await this.shutdown();
    });

    process.on("SIGTERM", async () => {
      await this.shutdown();
    });

    // Handle uncaught errors
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", error);
      this.shutdown(1);
    });

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection", reason);
      this.shutdown(1);
    });

    this.setupToolHandlers();
  }

  public async shutdown(code = 0): Promise<never> {
    logger.info("Shutting down server...");
    try {
      await this.client.disconnect();
      if (this.transport) {
        await this.server.close();
      }
      logger.info("Server shutdown complete");
      process.exit(code);
    } catch (error) {
      logger.error({ error }, "Error during shutdown");
      process.exit(1);
    }
  }

  /**
   * Registers available tools with the MCP server
   */
  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "post_note",
          description: "Post a new note to Nostr",
          inputSchema: {
            type: "object",
            properties: {
              content: {
                type: "string",
                description: "The content of your note",
              },
            },
            required: ["content"],
          },
        } as Tool,
        {
          name: "post_comment",
          description:
            "Reply to a note by posting a comment with NIP-10 threading tags",
          inputSchema: {
            type: "object",
            properties: {
              rootId: {
                type: "string",
                description: "ID of the original note (64-char hex)",
              },
              parentId: {
                type: "string",
                description:
                  "Optional ID of the comment you're replying to (64-char hex)",
              },
              content: {
                type: "string",
                description: "The content of your comment",
              },
            },
            required: ["rootId", "content"],
          },
        } as Tool,
        {
          name: "update_profile",
          description:
            "Update your profile metadata (NIP-01 kind 0: name, about, picture, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Display name" },
              display_name: {
                type: "string",
                description: "Full display name",
              },
              about: { type: "string", description: "About/Bio" },
              picture: {
                type: "string",
                description: "Profile image URL",
              },
              banner: {
                type: "string",
                description: "Banner image URL",
              },
              website: { type: "string", description: "Website URL" },
              nip05: {
                type: "string",
                description: "NIP-05 identifier (e.g., user@domain.com)",
              },
              lud16: {
                type: "string",
                description: "Lightning address (LUD-16)",
              },
            },
          },
        } as Tool,
        {
          name: "send_zap",
          description: "Send a Lightning zap to a Nostr user",
          inputSchema: {
            type: "object",
            properties: {
              nip05Address: {
                type: "string",
                description: "The NIP-05 address of the recipient",
              },
              amount: {
                type: "number",
                description: "Amount in sats to zap",
              },
            },
            required: ["nip05Address", "amount"],
          },
        } as Tool,
        {
          name: "get_replies",
          description:
            "List replies to a given Nostr note id (kind 1 with '#e' tag)",
          inputSchema: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "The 64-char hex id of the original note",
              },
              limit: {
                type: "number",
                description: "Max number of replies to return (default 50)",
              },
            },
            required: ["eventId"],
          },
        } as Tool,
        {
          name: "get_latest_posts",
          description:
            "Fetch the latest kind 1 posts, defaulting to the connected author",
          inputSchema: {
            type: "object",
            properties: {
              authorPubkey: {
                type: "string",
                description:
                  "Optional author public key (64-char hex); defaults to the connected user",
              },
              limit: {
                type: "number",
                description: "Max number of posts to return (default 1)",
              },
            },
            required: [],
          },
        } as Tool,
        {
          name: "create_timestamp_attestation",
          description:
            "Create a NIP-03 OpenTimestamps attestation for a Nostr event",
          inputSchema: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "ID of the event to attest (64-char hex string)",
                pattern: "^[0-9a-fA-F]{64}$",
              },
              eventKind: {
                type: "number",
                description: "Kind of the event being attested",
                minimum: 0,
                maximum: 65535,
              },
              otsProof: {
                type: "string",
                description: "OpenTimestamps proof content (base64 or hex)",
                minLength: 1,
              },
            },
            required: ["eventId", "eventKind", "otsProof"],
          },
        } as Tool,
        {
          name: "get_unanswered_comments",
          description:
            "Find comments on a note that you haven't replied to yet",
          inputSchema: {
            type: "object",
            properties: {
              eventId: {
                type: "string",
                description: "ID of the original note (64-char hex string)",
                pattern: "^[0-9a-fA-F]{64}$",
              },
              limit: {
                type: "number",
                description: "Max comments to inspect (default 50)",
                minimum: 1,
                maximum: 500,
              },
            },
            required: ["eventId"],
          },
        } as Tool,
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug({ name, args }, "Tool called");

      try {
        switch (name) {
          case "post_note":
            return await this.handlePostNote(args);
          case "post_comment":
            return await this.handlePostComment(args);
          case "update_profile":
            return await this.handleUpdateProfile(args);
          case "send_zap":
            return await this.handleSendZap(args);
          case "get_replies":
            return await this.handleGetReplies(args);
          case "get_latest_posts":
            return await this.handleGetLatestPosts(args);
          case "create_timestamp_attestation":
            return await this.handleCreateTimestampAttestation(args);
          case "get_unanswered_comments":
            return await this.handleGetUnansweredComments(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`,
            );
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

  /**
   * Handles the post_note tool execution
   * @param args - Tool arguments containing note content
   */
  private async handlePostNote(args: unknown) {
    const result = PostNoteSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const note = await this.client.postNote(result.data.content);
    return {
      content: [
        {
          type: "text",
          text: `Note posted successfully!\nID: ${note.id}\nPublic Key: ${note.pubkey}`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the post_comment tool execution
   */
  private async handlePostComment(args: unknown) {
    const result = PostCommentSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const comment = await this.client.postComment(result.data);
    return {
      content: [
        {
          type: "text",
          text: `Comment posted!\nID: ${comment.id}\nRoot: ${comment.rootId}\nParent: ${comment.parentId}`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the update_profile tool execution
   */
  private async handleUpdateProfile(args: unknown) {
    const result = UpdateProfileSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const ev = await this.client.updateProfileMetadata(result.data);
    return {
      content: [
        {
          type: "text",
          text: `Profile metadata updated!\nID: ${ev.id}\nPublic Key: ${ev.pubkey}`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the send_zap tool execution
   * @param args - Tool arguments containing recipient and amount
   */
  private async handleSendZap(args: unknown) {
    const result = ZapNoteSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const zap = await this.client.sendZap(
      result.data.nip05Address,
      result.data.amount,
    );

    return {
      content: [
        {
          type: "text",
          text: `Zap request sent successfully!\nRecipient: ${zap.recipientPubkey}\nAmount: ${zap.amount} sats\nInvoice: ${zap.invoice}`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the get_replies tool execution
   */
  private async handleGetReplies(args: unknown) {
    const result = GetRepliesSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const replies = await this.client.getReplies(result.data);
    const lines = replies.map(
      (r, idx) =>
        `${idx + 1}. ${r.id} by ${r.pubkey}\n${r.content.slice(0, 280)}`,
    );
    const body = lines.length ? lines.join("\n\n") : "No replies found.";

    return {
      content: [
        {
          type: "text",
          text: body,
        },
      ] as TextContent[],
    };
  }

  private async handleGetLatestPosts(args: unknown) {
    const result = GetLatestPostsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const posts = await this.client.getLatestPosts(result.data);
    const lines = posts.map(
      (post, idx) =>
        `${idx + 1}. ${post.id} by ${post.pubkey}\n${post.content.slice(0, 280)}`,
    );
    const body = lines.length ? lines.join("\n\n") : "No posts found.";

    return {
      content: [
        {
          type: "text",
          text: body,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the create_timestamp_attestation tool execution
   */
  private async handleCreateTimestampAttestation(args: unknown) {
    const result = CreateTimestampAttestationSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const attestation = await this.client.createTimestampAttestation(
      result.data,
    );

    return {
      content: [
        {
          type: "text",
          text: `NIP-03 timestamp attestation created!\nAttestation ID: ${attestation.id}\nPublic Key: ${attestation.pubkey}\nEvent ID: ${attestation.eventId}\nEvent Kind: ${attestation.eventKind}\nOTS Proof Length: ${attestation.otsProofLength} bytes`,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles the get_unanswered_comments tool execution
   */
  private async handleGetUnansweredComments(args: unknown) {
    const result = GetUnansweredCommentsSchema.safeParse(args);
    if (!result.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid parameters: ${result.error.message}`,
      );
    }

    const comments = await this.client.getUnansweredComments(result.data);
    const lines = comments.map(
      (comment, idx) =>
        `${idx + 1}. ${comment.id} by ${comment.pubkey}\n${comment.content.slice(0, 280)}`,
    );
    const body = lines.length
      ? lines.join("\n\n")
      : "No unanswered comments found.";

    return {
      content: [
        {
          type: "text",
          text: body,
        },
      ] as TextContent[],
    };
  }

  /**
   * Handles errors during tool execution
   * @param error - The error to handle
   */
  private handleError(error: unknown) {
    if (error instanceof McpError) {
      throw error;
    }

    if (error instanceof NostrError) {
      return {
        content: [
          {
            type: "text",
            text: `Nostr error: ${error.message}`,
            isError: true,
          },
        ] as TextContent[],
      };
    }

    logger.error({ error }, "Unexpected error");
    throw new McpError(ErrorCode.InternalError, "An unexpected error occurred");
  }

  /**
   * Starts the MCP server
   */
  async start(): Promise<void> {
    await this.client.connect();
    logger.info({ mode: "sse" }, "Nostr MCP server running");
  }
}
