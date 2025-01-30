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
import { Config, ConfigSchema, PostNoteSchema, NostrError } from "./types.js";
import logger from "./utils/logger.js";

const SERVER_NAME = "nostr-mcp";
const SERVER_VERSION = "0.0.1";

/**
 * NostrServer implements a Model Context Protocol server for Nostr
 * It provides tools for interacting with the Nostr network, such as posting notes
 */
export class NostrServer {
  private server: Server;
  private client: NostrClient;

  constructor(config: Config) {
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

  private async shutdown(code = 0): Promise<never> {
    logger.info("Shutting down server...");
    try {
      await this.client.disconnect();
      await this.server.close();
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
    // Register tool list handler
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
      ],
    }));

    // Register tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.debug({ name, args }, "Tool called");

      try {
        switch (name) {
          case "post_note":
            return await this.handlePostNote(args);
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
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info("Nostr MCP server running on stdio");
  }
}
