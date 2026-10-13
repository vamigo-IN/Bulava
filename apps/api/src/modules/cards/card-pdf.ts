/**
 * A card as a one-page PDF (docs/cards.md#files): the rendered image itself,
 * not a second drawing, so the PDF is exactly what the editor showed. A JPEG
 * goes into a PDF as it is (the DCTDecode filter), so nothing is decoded or
 * re-encoded and no library is needed: the file is the image plus a few
 * hundred bytes of structure.
 */

/** The print resolution the page is sized for: a Portrait 5 × 7 card (1500 × 2100 px) prints at exactly 5 × 7 inches. */
export const CARD_PDF_DPI = 300;

export interface JpegInfo {
  width: number;
  height: number;
  /** 1 grey, 3 colour (YCbCr/RGB), 4 CMYK. */
  components: number;
}

/** The size and colour components of a JPEG, from its frame header; null when it is not a JPEG. */
export function jpegInfo(jpeg: Buffer): JpegInfo | null {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return null;
  let i = 2;
  while (i + 4 <= jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    const marker = jpeg[i + 1]!;
    // Fill bytes, and markers that stand alone (no length).
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2;
      continue;
    }
    const length = jpeg.readUInt16BE(i + 2);
    if (length < 2) return null;
    // A start of frame (SOF0–SOF15; C4, C8 and CC are other tables).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      if (i + 10 > jpeg.length) return null;
      const height = jpeg.readUInt16BE(i + 5);
      const width = jpeg.readUInt16BE(i + 7);
      const components = jpeg[i + 9]!;
      return width > 0 && height > 0 ? { width, height, components } : null;
    }
    // The image data starts before any frame header: not a JPEG we can read.
    if (marker === 0xda || marker === 0xd9) return null;
    i += 2 + length;
  }
  return null;
}

/** Points (1/72 inch) for a length in pixels at the card's print resolution, to two decimals. */
const points = (pixels: number, dpi: number) => Math.round(((pixels * 72) / dpi) * 100) / 100;

/**
 * A single-page PDF showing the JPEG edge to edge, the page sized to the image
 * at `dpi` (300 by default: the card's print size). Throws for anything but a
 * grey or colour JPEG (the export renderer only makes colour ones).
 */
export function jpegPdf(jpeg: Buffer, options: { dpi?: number; title?: string } = {}): Buffer {
  const info = jpegInfo(jpeg);
  if (!info || (info.components !== 1 && info.components !== 3)) throw new Error('Only grey or colour JPEG images can be made into a card PDF');
  const dpi = options.dpi ?? CARD_PDF_DPI;
  const w = points(info.width, dpi);
  const h = points(info.height, dpi);
  const content = Buffer.from(`q\n${w} 0 0 ${h} 0 0 cm\n/Card Do\nQ\n`, 'latin1');
  const stream = (dict: string, data: Buffer) => Buffer.concat([Buffer.from(`${dict}\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1')]);
  const title = options.title ? `/Title ${pdfString(options.title)} ` : '';

  const objects: Buffer[] = [
    Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1'),
    Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>', 'latin1'),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Card 4 0 R >> >> /Contents 5 0 R >>`, 'latin1'),
    stream(`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /${info.components === 1 ? 'DeviceGray' : 'DeviceRGB'} /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg),
    stream(`<< /Length ${content.length} >>`, content),
    Buffer.from(`<< ${title}>>`, 'latin1'),
  ];

  // Header with a comment of high bytes, so tools treat the file as binary.
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let offset = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(offset);
    const part = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')]);
    parts.push(part);
    offset += part.length;
  });
  // Each cross-reference entry is exactly 20 bytes: ten digits, five digits, a letter, then " \n".
  const xref = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ', ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `)].join('\n');
  parts.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${offset}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(parts);
}

/** A PDF text string: printable ASCII kept (with \ ( ) escaped), anything else left out. */
function pdfString(text: string): string {
  const ascii = text.replace(/[^\x20-\x7e]/g, '').slice(0, 120);
  return `(${ascii.replace(/[\\()]/g, (c) => `\\${c}`)})`;
}
