import { NostrClient } from "../nostr-client.js";

describe("NostrClient", () => {
  const _config = {
    nsecKey: process.env.NOSTR_NSEC_KEY || "",
    relays: (process.env.NOSTR_RELAYS || "").split(","),
  };

  let _client: NostrClient;

  beforeEach(() => {
    //_client = new NostrClient(config);
  });

  afterEach(async () => {});

  describe("connect", () => {
    it("should connect to relays successfully", async () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });
  });

  describe("postNote", () => {
    it("should throw NOT_CONNECTED error when not connected", async () => {
      // TODO: Implement test
      expect(true).toBe(true);
    });
  });
});
