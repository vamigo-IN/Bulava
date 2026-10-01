import { Inject, Injectable } from '@nestjs/common';
import { ObjectStorage, StorageKeys } from '@bulava/storage';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { STORAGE } from '../../infrastructure/storage/storage.module';
import { AppError } from '../../common/errors/app-error';

const HOUR_MS = 3_600_000;

/**
 * Painted artwork for invitations, catalogue posters and film previews.
 * Storage stays private: the public route hands out a short-lived signed URL
 * only for art that may be shown to anyone.
 */
@Injectable()
export class TemplateAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
  ) {}

  /**
   * The asset must be an approved image with a current commercial, on-demand
   * licence, used by a published template version (templates that were later
   * unpublished or deleted keep serving the events pinned to them). Picks the
   * smallest rendition at least `width` wide. URLs are signed at the start of
   * the hour, so repeat visits get the same URL and reuse the browser's copy.
   */
  async publicUrl(assetId: string, width: number): Promise<string> {
    const now = new Date();
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        type: 'IMAGE',
        status: 'APPROVED',
        license: { commercialUse: true, onDemandUse: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        templates: { some: { templateVersion: { status: 'PUBLISHED' } } },
      },
      select: { id: true, storageKey: true, renditions: true },
    });
    if (!asset) throw AppError.notFound('Artwork');
    const widths = [...asset.renditions].sort((a, b) => a - b);
    const pick = widths.find((w) => w >= width) ?? widths[widths.length - 1];
    const key = pick ? StorageKeys.templateAssetRendition(asset.id, pick) : asset.storageKey;
    const hour = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
    // Signed at the top of the hour for two hours: always at least an hour of validity left.
    return this.storage.presignDownload(key, { expiresInSeconds: 7200, signingDate: hour });
  }
}
