import { createHash, randomInt } from 'node:crypto';
import { CardDesignSchema, cardAssetIds, cardFromTemplate, hasCardDesign, stableStringify, type CardDesign, type TemplateDefinition } from '@bulava/template-schema';
import { AppError } from '../../common/errors/app-error';

/** A published template, as the card flow uses it. */
export interface CardTemplate {
  key: string;
  versionId: string;
  name: string;
  definition: TemplateDefinition;
  tags: string[];
  eventTypes: string[];
  /** Licensed assets a card from it may show. */
  assets: ReadonlySet<string>;
}

/** The largest design accepted, serialised (a phone card is usually 20–60 KB). */
const MAX_DESIGN_BYTES = 240_000;

/** Equal designs hash equally, whatever the order of their keys. */
export function designHash(design: CardDesign): string {
  return createHash('sha256').update(stableStringify(design)).digest('hex');
}

/** A design from the browser, checked against its template (its own assets only, its languages and occasions). */
export function checkDesign(raw: unknown, template: CardTemplate): CardDesign {
  const parsed = CardDesignSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(
      'CUSTOMIZATION_INVALID',
      'This card design could not be saved.',
      parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const design = parsed.data;
  if (design.templateKey !== template.key) throw new AppError('CUSTOMIZATION_INVALID', 'This design belongs to another template.');
  if (!hasCardDesign(template.definition)) throw new AppError('TEMPLATE_NOT_AVAILABLE', 'This template cannot be made into a card.');
  if (!template.definition.languages.includes(design.language)) throw new AppError('UNSUPPORTED_LANGUAGE', 'This template is not available in that language.');
  if (template.eventTypes.length && !template.eventTypes.includes(design.eventType)) throw new AppError('INVALID_EVENT_TYPE', 'This template is not made for that occasion.');
  if (cardAssetIds(design).some((id) => !template.assets.has(id))) throw new AppError('CUSTOMIZATION_INVALID', 'This design shows an image that is not part of its template.');
  if (stableStringify(design).length > MAX_DESIGN_BYTES) throw new AppError('CUSTOMIZATION_INVALID', 'This card has too much in it. Remove a few elements and try again.');
  return design;
}

/** The hash of a new card from the template with the same choices: a design still equal to it is not customised yet. */
export function freshDesignHash(template: CardTemplate, design: Pick<CardDesign, 'format' | 'eventType' | 'language'>): string {
  return designHash(cardFromTemplate(template.definition, { format: design.format, eventType: design.eventType, language: design.language, tags: template.tags }));
}

const REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** A receipt reference people can read out: BC- and eight letters and digits (no 0, O, 1 or I). */
export function cardOrderReference(): string {
  return `BC-${Array.from({ length: 8 }, () => REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)]).join('')}`;
}

/** The downloaded file's name: the template and the format, never anything about the customer. */
export function cardFileName(templateKey: string, format: string): string {
  return `${templateKey}-${format}.jpg`;
}

/** Retention of exported images (docs/cards.md#retention). */
export const CARD_EXPORT_DAYS = { FREE: 7, PLAN: 30, PAID: 365 } as const;
