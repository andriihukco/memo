const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Dev sign-in is allowed only in `next dev` and only for loopback hosts. */
export function isDevAuthAllowed(nodeEnv: string | undefined, host: string | null): boolean {
  if (nodeEnv !== "development" || !host) return false;
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return LOCAL_HOSTS.has(hostname);
}
