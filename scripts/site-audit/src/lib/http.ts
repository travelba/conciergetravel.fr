/**
 * Thin network layer for the auditor: timeouts, a realistic UA, and a
 * shared status cache so the same internal link / image asset is only
 * probed once across the whole crawl.
 */

const USER_AGENT = 'MCH-SiteAudit/1.0 (+https://myconciergehotel.com; internal health crawler)';

export interface PageResponse {
  readonly url: string;
  readonly finalUrl: string;
  readonly status: number;
  readonly contentType: string;
  readonly html: string;
  readonly elapsedMs: number;
}

/** GET a URL, following redirects. Returns null on network failure. */
export async function fetchPage(url: string, timeoutMs: number): Promise<PageResponse | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    const contentType = res.headers.get('content-type') ?? '';
    const html =
      contentType.includes('text/html') || contentType.includes('xml') ? await res.text() : '';
    return {
      url,
      finalUrl: res.url || url,
      status: res.status,
      contentType,
      html,
      elapsedMs: Date.now() - started,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** GET raw text (for sitemaps). Returns null on failure or non-2xx. */
export async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface AssetProbe {
  readonly url: string;
  readonly status: number | null;
}

/**
 * A minimal counting semaphore — bounds how many asset probes run at once.
 * Without it, a crawl at concurrency C with up to L links + I images per page
 * fires C×(L+I) parallel sockets to a single origin, which undici queues and
 * times out, producing spurious `null` ("ERR") statuses on perfectly healthy
 * URLs (observed against prod: `/marque/aman` returns 200 to curl but ERR'd
 * under a 320-socket flood).
 */
class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((res) => this.queue.push(res));
    this.active += 1;
  }
  release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }
}

/**
 * Probe an asset/link URL for liveness, caching the result. Tries HEAD
 * first (cheap), falls back to a ranged GET when the origin rejects HEAD
 * (403 / 405 / 501) — Cloudinary and some CDNs only answer GET. Bounded by a
 * shared semaphore and retried once on a network null to absorb undici jitter.
 */
export function createAssetProber(
  timeoutMs: number,
  maxConcurrent = 16,
): (url: string) => Promise<AssetProbe> {
  const cache = new Map<string, AssetProbe>();
  const inflight = new Map<string, Promise<AssetProbe>>();
  const gate = new Semaphore(maxConcurrent);

  async function probe(url: string): Promise<AssetProbe> {
    const cached = cache.get(url);
    if (cached) return cached;
    const pending = inflight.get(url);
    if (pending) return pending;

    const run = (async (): Promise<AssetProbe> => {
      await gate.acquire();
      try {
        let status = await statusFor(url, timeoutMs);
        // One retry on a network null — distinguishes a flaky socket from a
        // genuinely dead endpoint (which answers a real 4xx/5xx both times).
        if (status === null) status = await statusFor(url, timeoutMs);
        const result: AssetProbe = { url, status };
        cache.set(url, result);
        return result;
      } finally {
        gate.release();
        inflight.delete(url);
      }
    })();
    inflight.set(url, run);
    return run;
  }
  return probe;
}

async function statusFor(url: string, timeoutMs: number): Promise<number | null> {
  const head = await requestStatus(url, 'HEAD', timeoutMs);
  if (head !== null && head !== 405 && head !== 501 && head !== 403) return head;
  // Fall back to a lightweight ranged GET for origins that dislike HEAD.
  const get = await requestStatus(url, 'GET', timeoutMs, { Range: 'bytes=0-0' });
  return get ?? head;
}

async function requestStatus(
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
  extraHeaders: Record<string, string> = {},
): Promise<number | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: ac.signal,
      headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
    });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
