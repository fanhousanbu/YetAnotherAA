import { URL } from "url";

/**
 * Validator class for gossip endpoints to prevent SSRF attacks
 */
export class GossipEndpointValidator {
  // Allowed protocols for gossip connections
  private static readonly ALLOWED_PROTOCOLS = ["ws:", "wss:"];

  // Blocked IP ranges (private networks and loopback)
  private static readonly BLOCKED_IP_PATTERNS = [
    /^127\./,                    // Loopback (127.0.0.0/8)
    /^10\./,                      // Private network (10.0.0.0/8)
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private network (172.16.0.0/12)
    /^192\.168\./,                // Private network (192.168.0.0/16)
    /^169\.254\./,                // Link-local (169.254.0.0/16)
    /^::1$/,                      // IPv6 loopback
    /^fe80::/,                    // IPv6 link-local
    /^fc00::/,                    // IPv6 unique local
  ];

  // Blocked hostnames
  private static readonly BLOCKED_HOSTNAMES = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "metadata.google.internal",  // GCP metadata service
    "169.254.169.254",           // AWS/Azure metadata service
  ];

  // Allowed ports for gossip protocol
  private static readonly ALLOWED_PORTS = {
    min: 1024,  // Avoid well-known ports
    max: 65535,
    defaults: [3000, 3001, 3002, 3003, 3004, 3005, 8080, 8081], // Common gossip ports
  };

  /**
   * Check if running in development mode
   */
  private static isDevelopmentMode(): boolean {
    const nodeEnv = process.env.NODE_ENV?.toLowerCase();
    return nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === 'local';
  }

  /**
   * Validate and sanitize a gossip endpoint URL
   * @param endpoint The endpoint URL to validate
   * @param allowPrivateNetworks Whether to allow connections to private networks (default: false)
   * @returns Sanitized endpoint URL
   * @throws Error if the endpoint is invalid or potentially dangerous
   */
  public static validateEndpoint(endpoint: string, allowPrivateNetworks = false): string {
    // Basic validation
    if (!endpoint || typeof endpoint !== "string") {
      throw new Error("Endpoint must be a non-empty string");
    }

    // Trim whitespace
    endpoint = endpoint.trim();

    // Parse URL
    let url: URL;
    try {
      url = new URL(endpoint);
    } catch (error) {
      throw new Error(`Invalid URL format: ${endpoint}`);
    }

    // Validate protocol
    if (!this.ALLOWED_PROTOCOLS.includes(url.protocol)) {
      throw new Error(
        `Invalid protocol: ${url.protocol}. Allowed protocols: ${this.ALLOWED_PROTOCOLS.join(", ")}`
      );
    }

    // Validate hostname
    const hostname = url.hostname.toLowerCase();

    // In development mode, allow localhost connections
    const isDev = this.isDevelopmentMode();
    if (isDev && (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1')) {
      console.log(`🔧 Development mode: Allowing local connection to ${hostname}`);
      // Skip further hostname validation for localhost in dev mode
    } else {
      // Check against blocked hostnames in production
      if (this.BLOCKED_HOSTNAMES.includes(hostname)) {
        throw new Error(`Blocked hostname: ${hostname}`);
      }
    }

    // Check if hostname is an IP address
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
      // Skip private network check for localhost in dev mode
      if (!isDev || (hostname !== '127.0.0.1' && hostname !== '::1')) {
        if (!allowPrivateNetworks) {
          // Check against blocked IP patterns
          for (const pattern of this.BLOCKED_IP_PATTERNS) {
            if (pattern.test(hostname)) {
              throw new Error(`Private or reserved IP address not allowed: ${hostname}`);
            }
          }
        }
      }
    } else if (!isDev || hostname !== 'localhost') {
      // Validate domain name
      const domainPattern = /^([a-z0-9-]+\.)*[a-z0-9-]+$/i;
      if (!domainPattern.test(hostname)) {
        throw new Error(`Invalid hostname: ${hostname}`);
      }

      // Prevent DNS rebinding attacks - check for suspicious patterns
      if (hostname.includes("xip.io") || hostname.includes("nip.io") || hostname.includes("sslip.io")) {
        throw new Error(`Suspicious hostname pattern detected: ${hostname}`);
      }
    }

    // Validate port
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === "wss:" ? 443 : 80);
    if (isNaN(port) || port < this.ALLOWED_PORTS.min || port > this.ALLOWED_PORTS.max) {
      throw new Error(`Invalid port: ${port}. Port must be between ${this.ALLOWED_PORTS.min} and ${this.ALLOWED_PORTS.max}`);
    }

    // Warn about non-standard ports (but allow them)
    if (!this.ALLOWED_PORTS.defaults.includes(port) && port !== 443 && port !== 80) {
      console.warn(`⚠️ Non-standard port detected: ${port}`);
    }

    // Validate path (should be minimal for WebSocket connections)
    if (url.pathname && url.pathname !== "/" && url.pathname !== "/gossip") {
      console.warn(`⚠️ Non-standard path detected: ${url.pathname}`);
    }

    // Remove any authentication info for security
    url.username = "";
    url.password = "";

    // Remove query parameters and fragments for security
    url.search = "";
    url.hash = "";

    return url.toString();
  }

  /**
   * Validate multiple endpoints at once
   * @param endpoints Array of endpoints to validate
   * @param allowPrivateNetworks Whether to allow connections to private networks
   * @returns Array of validated endpoints
   */
  public static validateEndpoints(endpoints: string[], allowPrivateNetworks = false): string[] {
    const validatedEndpoints: string[] = [];
    const errors: string[] = [];

    for (const endpoint of endpoints) {
      try {
        const validated = this.validateEndpoint(endpoint, allowPrivateNetworks);
        validatedEndpoints.push(validated);
      } catch (error) {
        errors.push(`${endpoint}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      console.warn("⚠️ Some endpoints failed validation:", errors);
    }

    return validatedEndpoints;
  }

  /**
   * Check if an endpoint is from the same origin (for CORS-like validation)
   * @param endpoint The endpoint to check
   * @param selfEndpoint The current node's endpoint
   * @returns true if the endpoints are from the same origin
   */
  public static isSameOrigin(endpoint: string, selfEndpoint: string): boolean {
    try {
      const url1 = new URL(endpoint);
      const url2 = new URL(selfEndpoint);

      return (
        url1.protocol === url2.protocol &&
        url1.hostname === url2.hostname &&
        url1.port === url2.port
      );
    } catch {
      return false;
    }
  }

  /**
   * Create a whitelist of allowed endpoints
   * @param endpoints Array of trusted endpoints
   * @returns Set of validated and normalized endpoints
   */
  public static createWhitelist(endpoints: string[]): Set<string> {
    const whitelist = new Set<string>();

    for (const endpoint of endpoints) {
      try {
        const validated = this.validateEndpoint(endpoint, false);
        whitelist.add(validated);
      } catch (error) {
        console.error(`Failed to add endpoint to whitelist: ${endpoint} - ${error.message}`);
      }
    }

    return whitelist;
  }
}