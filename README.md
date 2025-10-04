# 🌐 Nostr MCP Server

A Model Context Protocol (MCP) server that enables AI models to interact with Nostr, allowing them to post notes and interact with the freedom of speech protocol.

Censorship resistance matters, even for LLMs.

[![smithery badge](https://smithery.ai/badge/@AbdelStark/nostr-mcp)](https://smithery.ai/server/@AbdelStark/nostr-mcp)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blue?style=flat-square)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple?style=flat-square)](https://nostr.com/)

BTW, you should [join Nostr now!](https://start.njump.me/?s=npub1hr6v96g0phtxwys4x0tm3khawuuykz6s28uzwtj5j0zc7lunu99snw2e29)

## 🚀 Features

- 📝 Post notes to Nostr network
- 💬 Reply to notes and review unanswered conversations
- 🔌 Connect to multiple relays
- 🤖 MCP-compliant API for AI integration
- 💸 Send Lightning zaps to Nostr users (WIP)
- 📡 Server-Sent Events (SSE) support for real-time communication

## 👷‍♂️ TODOs

- [ ] Add support for multiple simultaneous connections
- [ ] Implement stdin transport mode (configurable via environment variable)

## 📋 Prerequisites

- Node.js 18+

## 🛠️ Installation

### Installing via Smithery

To install Nostr MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@AbdelStark/nostr-mcp):

```bash
npx -y @smithery/cli install @AbdelStark/nostr-mcp --client claude
```

### Manual Installation
1. Clone the repository:

```bash
git clone https://github.com/AbdelStark/nostr-mcp
cd nostr-mcp
```

1. Install dependencies:

```bash
npm install
```

1. Create a `.env` file:

> 💡 You can copy the `.env.example` file and modify it as needed.

```env
# Log level (debug, info, warn, error)
LOG_LEVEL=debug
# Node environment (development, production)
NODE_ENV=development
# List of Nostr relays to connect to
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol
# Your Nostr private key (starts with nsec)
NOSTR_NSEC_KEY=your_nsec_key_here
# Server mode (stdio or sse)
SERVER_MODE=sse
# Port for SSE mode
PORT=9000
```

## 🚦 Usage

### Starting the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

### Available Tools

#### `post_note`

Posts a new note to the Nostr network.

Example input:

```json
{
  "content": "Hello from Nostr! 👋"
}
```

#### `post_comment`

Replies to an existing note (or comment) using NIP-10 threading tags.

Example input:

```json
{
  "rootId": "<64-hex-root-event-id>",
  "parentId": "<64-hex-comment-id>",
  "content": "Thanks for the feedback!"
}
```

Omit `parentId` when replying directly to the root note.

#### `update_profile`

Updates your Nostr profile metadata (NIP-01 kind 0). Provide any subset of fields.

Example input:

```json
{
  "name": "Satoshi",
  "about": "Building open money.",
  "picture": "https://example.com/avatar.png",
  "banner": "https://example.com/banner.jpg",
  "website": "https://bitcoin.org",
  "nip05": "satoshi@example.com",
  "lud16": "satoshi@getalby.com",
  "display_name": "Satoshi Nakamoto"
}
```

#### `create_timestamp_attestation`

Creates a NIP-03 OpenTimestamps attestation for a Nostr event (kind 1040). This allows you to cryptographically prove
that a specific Nostr event existed at a certain point in time using the Bitcoin blockchain.

Example input:

```json
{
  "eventId": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "eventKind": 1,
  "otsProof": "004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294..."
}
```

Note: The `otsProof` should be the complete OpenTimestamps proof data (usually obtained from another
OpenTimestamps-capable MCP server or tool).

#### `send_zap`

Sends a Lightning zap to a Nostr user.

Example input:

```json
{
  "nip05Address": "user@domain.com",
  "amount": 1000
}
```

#### `get_replies`

Lists replies to a specific Nostr post (kind 1 events tagged with the original note id using `#e`).

Example input:

```json
{
  "eventId": "<64-hex-event-id>",
  "limit": 20
}
```

#### `get_unanswered_comments`

Finds comments on a note that you (the signer) have not responded to yet.

Example input:

```json
{
  "eventId": "<64-hex-event-id>",
  "limit": 50
}
```

Results include the comment id, author pubkey, and truncated content so you can decide what to answer next.

## 🔧 Development

### Project Structure

```text
nostr-mcp/
├── src/
│   ├── index.ts        # Main server entry point
│   ├── nostr-client.ts # Nostr client implementation
│   └── types.ts        # TypeScript type definitions
├── .env               # Environment configuration
└── tsconfig.json     # TypeScript configuration
```

### Running Tests

```bash
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Resources

- [Join Nostr](https://start.njump.me/?s=npub1hr6v96g0phtxwys4x0tm3khawuuykz6s28uzwtj5j0zc7lunu99snw2e29)
- [Nostr Manifesto](https://fiatjaf.com/nostr.html)
- [Nostr Specifications](https://github.com/nostr-protocol/nips)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [Visual testing tool for MCP servers](https://github.com/modelcontextprotocol/inspector)
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)
- [Awesome MCP Clients](https://github.com/punkpeye/awesome-mcp-clients)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Nostr Development Kit (NDK)](https://github.com/nostr-dev-kit/ndk)

## 📬 Contact

Feel free to follow me if you'd like, using my public key:

```text
npub1hr6v96g0phtxwys4x0tm3khawuuykz6s28uzwtj5j0zc7lunu99snw2e29
```

Or just **scan this QR code** to find me:

![Nostr Public Key QR Code](https://hackmd.io/_uploads/SkAvwlYYC.png)

---

<p align="center">
  Made with ❤️ for the Nostr community
</p>
