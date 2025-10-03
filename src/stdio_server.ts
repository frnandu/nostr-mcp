import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  NostrError,
  NostrServer,
  ZapNoteSchema,
  UpdateProfileSchema,
  GetRepliesSchema,
} from "./types.js";
import logger from "./utils/logger.js";

const SERVER_NAME = "nostr-mcp";
const SERVER_VERSION = "0.0.15";

export class NostrStdioServer implements NostrServer {
  private server: Server;
  private client: NostrClient;
  private originalStdout: NodeJS.WriteStream;

  constructor(config: Config) {
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    // Save original stdout
    this.originalStdout = process.stdout;

    // Redirect stdout to stderr for non-JSON-RPC output
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const customWrite = function (
      str: string | Uint8Array,
      encodingOrCb?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void,
    ): boolean {
      let encoding: BufferEncoding | undefined;
      let callback: ((err?: Error) => void) | undefined;
      if (typeof encodingOrCb === "function") {
        callback = encodingOrCb;
        encoding = undefined;
      } else {
        encoding = encodingOrCb;
        callback = cb;
      }

      // Only allow JSON-RPC messages through stdout
      if (typeof str === "string" && str.includes('"jsonrpc":"2.0"')) {
        return stdoutWrite(str, encoding, callback);
      }
      // Redirect everything else to stderr
      return process.stderr.write(str, encoding, callback);
    };
    process.stdout.write = customWrite as typeof process.stdout.write;

    // Initialize client after stdout redirection
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

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.onerror = (error) => {
      logger.error({ error }, "MCP Server Error");
    };

    process.on("SIGINT", async () => {
      await this.shutdown();
    });

    process.on("SIGTERM", async () => {
      await this.shutdown();
    });

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

  async shutdown(code = 0): Promise<never> {
    logger.info("Shutting down server...");
    try {
      // Restore original stdout
      process.stdout.write = this.originalStdout.write.bind(
        this.originalStdout,
      );
      await this.client.disconnect();
      await this.server.close();
      logger.info("Server shutdown complete");
      process.exit(code);
    } catch (error) {
      logger.error({ error }, "Error during shutdown");
      process.exit(1);
    }
  }

  private setupToolHandlers(): void {
    // Same tool handlers as SSE server
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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug({ name, args }, "Tool called");

      try {
        switch (name) {
          case "post_note":
            return await this.handlePostNote(args);
          case "update_profile":
            return await this.handleUpdateProfile(args);
          case "send_zap":
            return await this.handleSendZap(args);
          case "get_replies":
            return await this.handleGetReplies(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`,
            );
        }
      } catch (error) {
        return this.handleError(error);
      }
    });
  }

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

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.client.connect();
    await this.server.connect(transport);
    logger.info({ mode: "stdio" }, "Nostr MCP server running");
  }
}
