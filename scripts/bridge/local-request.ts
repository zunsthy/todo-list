import type { IncomingMessage } from "node:http";

export const isLocalBridgeRequest = (request: IncomingMessage): boolean => {
  try {
    const address = request.socket.remoteAddress;
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address ?? ""))
      return false;
    const host = new URL(`http://${request.headers.host}`);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(host.hostname))
      return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).origin === host.origin;
  } catch {
    return false;
  }
};
