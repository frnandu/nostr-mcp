# 🌐 Nostr MCP Server

A Model Context Protocol (MCP) server that enables AI models to interact with Nostr, allowing them to post notes and interact with the freedom of speech protocol.

Censorship resistance matters, even for LLMs.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-blue?style=flat-square)](https://github.com/modelcontextprotocol/typescript-sdk)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple?style=flat-square)](https://nostr.com/)

## 🚀 Features

- 📝 Post notes to Nostr network
- 🔌 Connect to multiple relays
- 🤖 MCP-compliant API for AI integration

## 📋 Prerequisites

- Node.js 18+

## 🛠️ Installation

1. Clone the repository:

```bash
git clone https://github.com/AbdelStark/nostr-mcp
cd nostr-mcp
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file:

```env
# List of Nostr relays to connect to
NOSTR_RELAYS=wss://relay.damus.io,wss://relay.primal.net,wss://nos.lol
# Your Nostr private key (starts with nsec)
NOSTR_NSEC_KEY=your_nsec_key_here
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

## 🔧 Development

### Project Structure

```
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

## 🔗 Related Projects

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Nostr Development Kit (NDK)](https://github.com/nostr-dev-kit/ndk)

## 🙏 Acknowledgments

- Model Context Protocol team for the MCP specification
- Nostr community for the protocol and infrastructure
- NDK team for the excellent Nostr development kit

## 📬 Contact

- GitHub: [@AbdelStark](https://github.com/AbdelStark)
- Nostr: [npub1hr6v96g0phtxwys4x0tm3khawuuykz6s28uzwtj5j0zc7lunu99snw2e29]

---

<p align="center">
  Made with ❤️ for the Nostr community
</p>
