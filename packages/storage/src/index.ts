import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'node:stream';

/**
 * Object storage over the S3 API (Cloudflare R2 in production, SeaweedFS in
 * development). The bucket is private: every read and write happens through
 * short-lived signed URLs or server-side calls. Never build public URLs.
 */

export interface StorageConfig {
  endpoint: string;
  /** Endpoint that browsers can reach, used only for signing URLs. */
  publicEndpoint?: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export function storageConfigFromEnv(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const required = (key: string) => {
    const value = env[key];
    if (!value) throw new Error(`${key} is required for object storage`);
    return value;
  };
  return {
    endpoint: required('R2_ENDPOINT'),
    publicEndpoint: env.R2_PUBLIC_ENDPOINT || env.R2_ENDPOINT,
    region: env.R2_REGION || 'auto',
    accessKeyId: required('R2_ACCESS_KEY'),
    secretAccessKey: required('R2_SECRET_KEY'),
    bucket: required('R2_BUCKET'),
  };
}

// ─────────────────────────── Key layout (docs/media.md) ───────────────────────────

const safe = (part: string) => {
  if (!/^[A-Za-z0-9._-]+$/.test(part) || part.includes('..')) throw new Error(`Unsafe storage key part: ${part}`);
  return part;
};

export const StorageKeys = {
  mediaOriginal: (eventId: string, itemId: string, ext: string) => `events/${safe(eventId)}/original/${safe(itemId)}.${safe(ext)}`,
  mediaOptimized: (eventId: string, itemId: string) => `events/${safe(eventId)}/optimized/${safe(itemId)}.webp`,
  mediaThumbnail: (eventId: string, itemId: string) => `events/${safe(eventId)}/thumbnails/${safe(itemId)}.webp`,
  templateAsset: (assetId: string, ext: string) => `templates/assets/${safe(assetId)}.${safe(ext)}`,
  /** Web-sized WebP rendition of an image asset (alpha kept). */
  templateAssetRendition: (assetId: string, width: number) => `templates/assets/${safe(assetId)}-w${Math.round(width)}.webp`,
  templatePreview: (templateId: string, name: string) => `templates/${safe(templateId)}/previews/${safe(name)}`,
  generatedVideo: (eventId: string, jobId: string) => `videos/${safe(eventId)}/generated/${safe(jobId)}.mp4`,
  music: (musicId: string, ext: string) => `music/${safe(musicId)}.${safe(ext)}`,
  font: (name: string) => `fonts/${safe(name)}`,
  /** Logo, favicon and share image uploaded in the admin console. */
  siteAsset: (kind: string, id: string, ext: string) => `site/${safe(kind)}-${safe(id)}.${safe(ext)}`,
  /** Short-lived object written and deleted by the admin storage check. */
  healthProbe: (id: string) => `health/probe-${safe(id)}.txt`,
  export: (eventId: string, name: string) => `exports/${safe(eventId)}/${safe(name)}`,
  /** A photo placed in a digital card, as uploaded (deleted once processed). */
  cardUploadOriginal: (sessionId: string, uploadId: string, ext: string) => `cards/uploads/${safe(sessionId)}/${safe(uploadId)}-original.${safe(ext)}`,
  /** The photo as the card shows it: re-encoded without metadata, at most 2400 px. */
  cardUpload: (sessionId: string, uploadId: string) => `cards/uploads/${safe(sessionId)}/${safe(uploadId)}.webp`,
  /** A rendered digital card. */
  cardExport: (exportId: string) => `cards/exports/${safe(exportId)}.jpg`,
};

export const ALLOWED_UPLOAD_TYPES: Record<string, { ext: string; kind: 'image' | 'video' | 'audio' | 'font' | 'svg'; maxBytes: number }> = {
  'image/jpeg': { ext: 'jpg', kind: 'image', maxBytes: 25 * 1024 * 1024 },
  'image/png': { ext: 'png', kind: 'image', maxBytes: 25 * 1024 * 1024 },
  'image/webp': { ext: 'webp', kind: 'image', maxBytes: 25 * 1024 * 1024 },
  'video/mp4': { ext: 'mp4', kind: 'video', maxBytes: 200 * 1024 * 1024 },
  'video/quicktime': { ext: 'mov', kind: 'video', maxBytes: 200 * 1024 * 1024 },
  'audio/mpeg': { ext: 'mp3', kind: 'audio', maxBytes: 20 * 1024 * 1024 },
  'audio/mp4': { ext: 'm4a', kind: 'audio', maxBytes: 20 * 1024 * 1024 },
  'image/svg+xml': { ext: 'svg', kind: 'svg', maxBytes: 2 * 1024 * 1024 },
  'font/woff2': { ext: 'woff2', kind: 'font', maxBytes: 5 * 1024 * 1024 },
};

// ─────────────────────────── Client ───────────────────────────

export class ObjectStorage {
  private readonly client: S3Client;
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor(config: StorageConfig) {
    const base = {
      region: config.region ?? 'auto',
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      forcePathStyle: true,
      // Avoid optional checksum headers in presigned PUTs that browsers would have to send.
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
    };
    this.client = new S3Client({ ...base, endpoint: config.endpoint });
    this.signer = new S3Client({ ...base, endpoint: config.publicEndpoint ?? config.endpoint });
    this.bucket = config.bucket;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ObjectStorage {
    return new ObjectStorage(storageConfigFromEnv(env));
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  /** Signed PUT for direct browser uploads. The browser must send the same Content-Type. */
  presignUpload(key: string, contentType: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(this.signer, new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** Signed GET. `downloadName` forces a download with that file name. */
  /**
   * A short-lived signed download URL. `signingDate` pins the signature time
   * (for example to the start of the hour) so repeated requests get the same
   * URL and browsers can reuse their cached copy.
   */
  presignDownload(key: string, options: { expiresInSeconds?: number; downloadName?: string; signingDate?: Date } = {}): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(options.downloadName
          ? { ResponseContentDisposition: `attachment; filename="${options.downloadName.replace(/[^\w.\- ]/g, '_')}"` }
          : {}),
      }),
      { expiresIn: options.expiresInSeconds ?? 3600, ...(options.signingDate ? { signingDate: options.signingDate } : {}) },
    );
  }

  async head(key: string): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (error as Error).name === 'NotFound') return null;
      throw error;
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const body = res.Body;
    if (!body) throw new Error(`Empty object: ${key}`);
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk as Uint8Array));
      return Buffer.concat(chunks);
    }
    return Buffer.from(await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray());
  }

  async put(key: string, body: Buffer | Uint8Array | string, contentType: string, cacheControl = 'private, max-age=31536000, immutable'): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }),
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
