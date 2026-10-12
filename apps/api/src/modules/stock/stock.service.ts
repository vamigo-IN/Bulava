import { createHash } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettingsStore } from '@bulava/settings';
import type { StockKind, StockSearchInput } from '@bulava/validation';
import { AppError } from '../../common/errors/app-error';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SETTINGS_STORE } from '../settings/settings.service';

export type StockProvider = 'pexels' | 'pixabay';

/** A search result: a small image on the library's own servers, and who made it. */
export interface StockResult {
  /** "pexels:123": the library and its id there. Importing names this, never a file address. */
  id: string;
  provider: StockProvider;
  thumb: string;
  width: number;
  height: number;
  alt: string;
  author: string;
  authorUrl: string | null;
  pageUrl: string;
}

export interface StockPage {
  results: StockResult[];
  page: number;
  more: boolean;
  /** The libraries searched, to name and link beside the results (their terms ask for it). */
  credits: Array<{ provider: StockProvider; name: string; url: string }>;
}

/** An image brought in from a library, checked: what arrived is the image type it claims. */
export interface StockImage {
  data: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  credit: string;
}

const LIBRARIES: Record<StockProvider, { name: string; url: string; kinds: readonly StockKind[]; base: string; envBase: string; budget: { limit: number; windowSec: number }; cacheSec: number; cdn: readonly string[] }> = {
  // 200 requests an hour on a new key; Pexels asks for a link back.
  pexels: { name: 'Pexels', url: 'https://www.pexels.com', kinds: ['photo'], base: 'https://api.pexels.com', envBase: 'PEXELS_API_BASE', budget: { limit: 180, windowSec: 3600 }, cacheSec: 6 * 3600, cdn: ['images.pexels.com'] },
  // 100 requests a minute; Pixabay asks that searches be cached for 24 hours and that results say where they are from.
  pixabay: { name: 'Pixabay', url: 'https://pixabay.com', kinds: ['photo', 'illustration'], base: 'https://pixabay.com', envBase: 'PIXABAY_API_BASE', budget: { limit: 90, windowSec: 60 }, cacheSec: 24 * 3600, cdn: ['pixabay.com', 'cdn.pixabay.com'] },
};

const PER_PAGE = 24;
const TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 20_000;
/** As much as a card photo may be (and less than a design upload). */
const MAX_BYTES = 15 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

type Config = { safeSearch: boolean; keys: Partial<Record<StockProvider, string>> };

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** What a file's first bytes say it is. */
function sniff(data: Buffer): StockImage['contentType'] | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg';
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (data.length >= 12 && data.subarray(0, 4).toString('ascii') === 'RIFF' && data.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Stock photos and illustrations for the editors (ADR-064), from licensed
 * libraries with the platform's keys (Integrations): Pexels for photos,
 * Pixabay for photos and illustrations. Searches are cached and kept within
 * each library's rate limit, so one busy evening never gets a key blocked.
 * Importing finds the file through the library's API by the result's id
 * (never an address from the browser), downloads it only from the library's
 * own servers, and checks it is the image it claims to be; the caller stores
 * it like an upload (design photos, card photos), and the media worker
 * re-encodes it.
 */
@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    @Inject(SETTINGS_STORE) private readonly store: SettingsStore,
    private readonly redis: RedisService,
  ) {}

  private base(provider: StockProvider): string {
    const lib = LIBRARIES[provider];
    return (process.env[lib.envBase] || lib.base).replace(/\/$/, '');
  }

  /** The library's own servers, and (in tests) the stand-in its API address points at. */
  private allowedHost(provider: StockProvider, url: URL): boolean {
    const override = process.env[LIBRARIES[provider].envBase];
    if (override && url.host === new URL(override).host) return true;
    return url.protocol === 'https:' && LIBRARIES[provider].cdn.includes(url.hostname);
  }

  private async config(): Promise<Config & { enabled: boolean }> {
    const s = await this.store.get('stock');
    const keys: Config['keys'] = {};
    if (s.value.enabled && s.value.pexels && s.secrets.pexelsApiKey) keys.pexels = s.secrets.pexelsApiKey;
    if (s.value.enabled && s.value.pixabay && s.secrets.pixabayApiKey) keys.pixabay = s.secrets.pixabayApiKey;
    return { enabled: s.value.enabled, safeSearch: s.value.safeSearch, keys };
  }

  private providersFor(config: Config, kind: StockKind): StockProvider[] {
    return (Object.keys(LIBRARIES) as StockProvider[]).filter((p) => config.keys[p] && LIBRARIES[p].kinds.includes(kind));
  }

  private credits(providers: StockProvider[]): StockPage['credits'] {
    return providers.map((p) => ({ provider: p, name: LIBRARIES[p].name, url: LIBRARIES[p].url }));
  }

  /** What the editors may offer: photos, illustrations, and whose. */
  async status(): Promise<{ photo: boolean; illustration: boolean; credits: StockPage['credits'] }> {
    const config = await this.config();
    const photo = this.providersFor(config, 'photo');
    const illustration = this.providersFor(config, 'illustration');
    return { photo: photo.length > 0, illustration: illustration.length > 0, credits: this.credits([...new Set([...photo, ...illustration])]) };
  }

  /** A call to a library within its limit; false when this window's budget is spent. */
  private async spend(provider: StockProvider): Promise<boolean> {
    const { limit, windowSec } = LIBRARIES[provider].budget;
    const key = `bulava:stock:budget:${provider}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const used = await this.redis.client.incr(key);
    if (used === 1) await this.redis.client.expire(key, windowSec + 5);
    return used <= limit;
  }

  async search(input: StockSearchInput): Promise<StockPage> {
    const config = await this.config();
    const providers = this.providersFor(config, input.kind);
    if (!providers.length) throw new AppError('STOCK_UNAVAILABLE', 'Searching photos is not available.');
    const q = input.q.normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
    const pages = await Promise.all(
      providers.map((p) =>
        this.cachedSearch(p, config, q, input.kind, input.page).catch((error: unknown) => {
          this.logger.warn({ provider: p, err: error instanceof Error ? error.message : String(error) }, 'Stock search failed');
          return null;
        }),
      ),
    );
    const answered = pages.filter((p): p is { results: StockResult[]; more: boolean } => p !== null);
    if (!answered.length) throw new AppError('STOCK_UNAVAILABLE', 'The photo libraries did not answer. Please try again in a little while.');
    // One from each library in turn, so neither crowds out the other.
    const results: StockResult[] = [];
    for (let i = 0; i < PER_PAGE; i++) for (const page of answered) if (page.results[i]) results.push(page.results[i]!);
    return { results, page: input.page, more: answered.some((p) => p.more), credits: this.credits(providers) };
  }

  private async cachedSearch(provider: StockProvider, config: Config, q: string, kind: StockKind, page: number) {
    const hash = createHash('sha256').update(`${kind}\n${page}\n${config.safeSearch}\n${q}`).digest('hex').slice(0, 32);
    const key = `bulava:stock:search:v1:${provider}:${hash}`;
    const hit = await this.redis.client.get(key);
    if (hit) return JSON.parse(hit) as { results: StockResult[]; more: boolean };
    if (!(await this.spend(provider))) throw new Error('rate budget spent');
    const fresh = provider === 'pexels' ? await this.pexelsSearch(config.keys.pexels!, q, page) : await this.pixabaySearch(config.keys.pixabay!, q, kind, page, config.safeSearch);
    await this.redis.client.set(key, JSON.stringify(fresh), 'EX', LIBRARIES[provider].cacheSec);
    return fresh;
  }

  private async getJson(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
    const res = await fetch(url, { headers: { accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'error' });
    const body = (await res.json().catch(() => ({}))) as unknown;
    return { status: res.status, body: body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {} };
  }

  private async pexelsSearch(key: string, q: string, page: number) {
    const { status, body } = await this.getJson(`${this.base('pexels')}/v1/search?${new URLSearchParams({ query: q, per_page: String(PER_PAGE), page: String(page) })}`, { authorization: key });
    if (status !== 200) throw new Error(`Pexels answered ${status}`);
    const photos = Array.isArray(body.photos) ? (body.photos as Array<Record<string, unknown>>) : [];
    const results = photos.flatMap((p): StockResult[] => {
      const src = (p.src ?? {}) as Record<string, unknown>;
      const thumb = str(src.medium) || str(src.small);
      if (!num(p.id) || !thumb || !this.safeUrl('pexels', thumb)) return [];
      return [{ id: `pexels:${num(p.id)}`, provider: 'pexels', thumb, width: num(p.width), height: num(p.height), alt: str(p.alt).slice(0, 200), author: str(p.photographer).slice(0, 120), authorUrl: this.pageUrl(str(p.photographer_url), 'pexels'), pageUrl: this.pageUrl(str(p.url), 'pexels') ?? LIBRARIES.pexels.url }];
    });
    return { results, more: Boolean(body.next_page) };
  }

  private async pixabaySearch(key: string, q: string, kind: StockKind, page: number, safeSearch: boolean) {
    const params = new URLSearchParams({ key, q, image_type: kind === 'illustration' ? 'illustration' : 'photo', per_page: String(PER_PAGE), page: String(page), safesearch: String(safeSearch) });
    const { status, body } = await this.getJson(`${this.base('pixabay')}/api/?${params}`);
    if (status !== 200) throw new Error(`Pixabay answered ${status}`);
    const hits = Array.isArray(body.hits) ? (body.hits as Array<Record<string, unknown>>) : [];
    const results = hits.flatMap((h): StockResult[] => {
      // The small preview lives on Pixabay's CDN for good; the bigger links expire within a day, sooner than the cache.
      const thumb = str(h.previewURL);
      if (!num(h.id) || !thumb || !this.safeUrl('pixabay', thumb)) return [];
      const user = str(h.user).slice(0, 120);
      return [
        {
          id: `pixabay:${num(h.id)}`,
          provider: 'pixabay',
          thumb,
          width: num(h.imageWidth),
          height: num(h.imageHeight),
          alt: str(h.tags).slice(0, 200),
          author: user,
          authorUrl: user && num(h.user_id) ? `https://pixabay.com/users/${encodeURIComponent(user)}-${num(h.user_id)}/` : null,
          pageUrl: this.pageUrl(str(h.pageURL), 'pixabay') ?? LIBRARIES.pixabay.url,
        },
      ];
    });
    return { results, more: page * PER_PAGE < Math.min(num(body.totalHits), 500) };
  }

  /** Images shown to browsers: https, on the library's own servers. */
  private safeUrl(provider: StockProvider, value: string): boolean {
    try {
      return this.allowedHost(provider, new URL(value));
    } catch {
      return false;
    }
  }

  /** Links to the library's pages (the photographer, the image): https on the library's site only. */
  private pageUrl(value: string, provider: StockProvider): string | null {
    try {
      const url = new URL(value);
      const site = new URL(LIBRARIES[provider].url).hostname.replace(/^www\./, '');
      return url.protocol === 'https:' && (url.hostname === site || url.hostname.endsWith(`.${site}`)) ? url.toString() : null;
    } catch {
      return null;
    }
  }

  /**
   * The image behind a search result, from the library: its API names the
   * file (a size fit for a phone-wide design or a printed card), which is then
   * downloaded from the library's servers and checked.
   */
  async fetchImage(id: string): Promise<StockImage> {
    const [provider, ref] = id.split(':') as [StockProvider, string];
    const config = await this.config();
    const key = config.keys[provider];
    if (!key) throw new AppError('STOCK_UNAVAILABLE', 'Searching photos is not available.');
    if (!(await this.spend(provider))) throw new AppError('STOCK_UNAVAILABLE', 'The photo library is busy. Please try again in a minute.');
    let file: string;
    let credit: string;
    if (provider === 'pexels') {
      const { status, body } = await this.getJson(`${this.base('pexels')}/v1/photos/${ref}`, { authorization: key });
      if (status === 404) throw AppError.notFound('Photo');
      if (status !== 200) throw new AppError('STOCK_UNAVAILABLE', 'The photo library did not answer. Please try again.');
      const src = (body.src ?? {}) as Record<string, unknown>;
      file = str(src.large2x) || str(src.large);
      credit = `Photo by ${str(body.photographer).slice(0, 120) || 'a photographer'} on Pexels`;
    } else {
      const { status, body } = await this.getJson(`${this.base('pixabay')}/api/?${new URLSearchParams({ key, id: ref })}`);
      const hit = Array.isArray(body.hits) ? (body.hits[0] as Record<string, unknown> | undefined) : undefined;
      if (status === 400 || status === 404 || (status === 200 && !hit)) throw AppError.notFound('Photo');
      if (status !== 200 || !hit) throw new AppError('STOCK_UNAVAILABLE', 'The photo library did not answer. Please try again.');
      file = str(hit.largeImageURL) || str(hit.webformatURL);
      credit = `Image by ${str(hit.user).slice(0, 120) || 'an artist'} from Pixabay`;
    }
    if (!file) throw AppError.notFound('Photo');
    return { ...(await this.download(provider, file)), credit };
  }

  /** Downloads from the library's servers only (redirects included), at most MAX_BYTES, and checks the bytes. */
  private async download(provider: StockProvider, address: string): Promise<Omit<StockImage, 'credit'>> {
    let url: URL;
    try {
      url = new URL(address);
    } catch {
      throw new AppError('STOCK_UNAVAILABLE', 'The photo library sent an address that could not be used.');
    }
    const refuse = () => new AppError('UPLOAD_REJECTED', 'This image could not be used. Try another one.');
    for (let hop = 0; hop < 4; hop++) {
      if (!this.allowedHost(provider, url)) throw refuse();
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get('location');
        await res.body?.cancel();
        if (!next) throw refuse();
        url = new URL(next, url);
        continue;
      }
      if (!res.ok || !res.body) throw new AppError('STOCK_UNAVAILABLE', 'The image could not be downloaded. Please try again.');
      const declared = Number(res.headers.get('content-length') ?? 0);
      if (declared > MAX_BYTES) {
        await res.body.cancel();
        throw refuse();
      }
      const chunks: Buffer[] = [];
      let size = 0;
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BYTES) {
          await reader.cancel();
          throw refuse();
        }
        chunks.push(Buffer.from(value));
      }
      const data = Buffer.concat(chunks);
      const type = sniff(data);
      const said = (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
      // The bytes decide; a library that says one image type and sends another is refused.
      if (!type || (said && said !== 'application/octet-stream' && (IMAGE_TYPES as readonly string[]).includes(said) && said !== type)) throw refuse();
      return { data, contentType: type };
    }
    throw refuse();
  }
}
