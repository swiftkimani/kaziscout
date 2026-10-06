import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { UnsafeUrlError } from '../errors.js';

// Addresses a page fetch must never reach: this machine, private networks and cloud metadata.
const blocked = new BlockList();
blocked.addSubnet('0.0.0.0', 8, 'ipv4');
blocked.addSubnet('10.0.0.0', 8, 'ipv4');
blocked.addSubnet('100.64.0.0', 10, 'ipv4');
blocked.addSubnet('127.0.0.0', 8, 'ipv4');
blocked.addSubnet('169.254.0.0', 16, 'ipv4');
blocked.addSubnet('172.16.0.0', 12, 'ipv4');
blocked.addSubnet('192.168.0.0', 16, 'ipv4');
blocked.addSubnet('::', 128, 'ipv6');
blocked.addSubnet('::1', 128, 'ipv6');
blocked.addSubnet('fc00::', 7, 'ipv6');
blocked.addSubnet('fe80::', 10, 'ipv6');

export type ResolveHost = (hostname: string) => Promise<string[]>;

const resolveWithDns: ResolveHost = async (hostname) =>
  (await lookup(hostname, { all: true })).map((entry) => entry.address);

function isBlockedAddress(address: string): boolean {
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) must be judged as the IPv4 address it carries.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return blocked.check(mapped, 'ipv4');
  return blocked.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Validates a user-supplied address before the server fetches it, so the page-to-Markdown
 * endpoint cannot be used to reach services on the local network.
 */
export async function assertPublicHttpUrl(
  input: string,
  resolveHost: ResolveHost = resolveWithDns,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError('it is not a valid web address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError('only http and https addresses are supported');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('addresses with embedded credentials are not supported');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  try {
    addresses = isIP(hostname) ? [hostname] : await resolveHost(hostname);
  } catch {
    throw new UnsafeUrlError('the site name could not be resolved');
  }
  if (addresses.length === 0 || addresses.some(isBlockedAddress)) {
    throw new UnsafeUrlError('it points to a private or local network');
  }
  return url;
}
