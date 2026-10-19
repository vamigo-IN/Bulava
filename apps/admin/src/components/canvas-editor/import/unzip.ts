import { t } from '@/lib/i18n';

/** What one archive may unpack to (a deck with its pictures is far less): guards against zip bombs. */
const MAX_TOTAL = 300 * 1024 * 1024;
const MAX_ENTRY = 60 * 1024 * 1024;

async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new Error(t('design.import.error.tooLarge'));
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/**
 * The files of a ZIP archive (Office files such as PPTX are ZIPs), unpacked
 * with the browser's own inflate. Only the files `wanted` names are read.
 */
export async function unzip(buffer: ArrayBuffer, wanted: (name: string) => boolean): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  // The end of central directory record: within the last 64 KiB (its comment) and 22 bytes.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error(t('design.import.error.unreadable'));
  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) throw new Error(t('design.import.error.unreadable'));
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + extraLength + commentLength;
    if (name.endsWith('/') || !wanted(name)) continue;
    if (local + 30 > bytes.length || view.getUint32(local, true) !== 0x04034b50) throw new Error(t('design.import.error.unreadable'));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.subarray(start, start + compressed);
    let content: Uint8Array;
    if (method === 0) content = data.slice();
    else if (method === 8) content = await inflate(data, Math.min(MAX_ENTRY, MAX_TOTAL - total));
    else continue;
    total += content.length;
    if (total > MAX_TOTAL) throw new Error(t('design.import.error.tooLarge'));
    files.set(name, content);
  }
  return files;
}
