#!/usr/bin/env node
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
import { config } from "dotenv";
import NDK, { NDKPrivateKeySigner } from "@nostr-dev-kit/ndk";

export class NostrServer {
  private server: Server;
  private client: NostrClient;

  constructor(config: Config) {
    const result = ConfigSchema.safeParse(config);
    if (!result.success) {
      throw new Error(`Invalid configuration: ${result.error.message}`);
    }

    this.client = new NostrClient(config);
    this.server = new Server(
      {
        name: "nostr-mcp",
        version: "0.0.1",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]:", error);
    };

    process.on("SIGINT", async () => {
      console.error("Shutting down server...");
      await this.server.close();
      process.exit(0);
    });

    this.setupToolHandlers();
  }

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
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`Tool called: ${name}`, args);

      try {
        switch (name) {
          case "post_note":
            return await this.handlePostNote(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
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
        `Invalid parameters: ${result.error.message}`
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

    console.error("Unexpected error:", error);
    throw new McpError(ErrorCode.InternalError, "An unexpected error occurred");
  }

  async start(): Promise<void> {
    await this.client.connect();
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Nostr MCP server running on stdio");
  }
}

config();

async function main() {
  const relays = process.env.NOSTR_RELAYS?.split(",") || [];
  const nsec = process.env.NOSTR_NSEC_KEY;

  if (!nsec) {
    throw new Error("NOSTR_NSEC_KEY environment variable is required");
  }

  const ndk = new NDK({
    explicitRelayUrls: relays,
    signer: new NDKPrivateKeySigner(nsec),
  });

  try {
    await ndk.connect();
    console.log("Connected to Nostr relays");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
