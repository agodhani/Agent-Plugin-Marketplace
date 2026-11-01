// Minimal ZIP writer (STORED or DEFLATE) + a bounded reader used for uploads/seeds.
import zlib from "node:zlib";
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export class ZipError extends Error {}

const DOS_TIME = 0x8000; // 16:00:00
const DOS_DATE = ((2025 - 1980) << 9) | (10 << 5) | 30; // 2025-10-30

export function createZip(entries: { name: string; data: Buffer | string }[], opts?: { deflate?: boolean }): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name.replace(/^\/+/, ""), "utf8");
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, "utf8");
    const crc = crc32(data);
    const method = opts?.deflate ? 8 : 0;
    const payload = opts?.deflate ? zlib.deflateRawSync(data) : data;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, payload);

    const cdir = Buffer.alloc(46);
    cdir.writeUInt32LE(0x02014b50, 0);
    cdir.writeUInt16LE(20, 4);
    cdir.writeUInt16LE(20, 6);
    cdir.writeUInt16LE(0, 8);
    cdir.writeUInt16LE(method, 10);
    cdir.writeUInt16LE(DOS_TIME, 12);
    cdir.writeUInt16LE(DOS_DATE, 14);
    cdir.writeUInt32LE(crc, 16);
    cdir.writeUInt32LE(payload.length, 20);
    cdir.writeUInt32LE(data.length, 24);
    cdir.writeUInt16LE(name.length, 28);
    cdir.writeUInt16LE(0, 30);
    cdir.writeUInt16LE(0, 32);
    cdir.writeUInt16LE(0, 34);
    cdir.writeUInt16LE(0, 36);
    cdir.writeUInt32LE(0, 38);
    cdir.writeUInt32LE(offset, 42);
    central.push(cdir, name);

    offset += 30 + name.length + payload.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...chunks, cd, end]);
}

// ---------------- bounded reader ----------------

const EOCD_MAX_TAIL = 22 + 65535; // record + max comment length

/**
 * Read a .zip archive with hard limits. Throws ZipError (user-facing message)
 * on malformed archives, unsupported features, or exceeded limits.
 */
export function readZip(
  buf: Buffer,
  limits: { maxEntries: number; maxTotalBytes: number }
): { name: string; data: Buffer }[] {
  const bad = () => new ZipError("Not a valid .zip archive.");

  // Locate the End Of Central Directory record scanning backwards.
  let eocd = -1;
  const start = Math.max(0, buf.length - EOCD_MAX_TAIL);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw bad();

  const diskEntries = buf.readUInt16LE(eocd + 8);
  const totalEntries = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (diskEntries !== totalEntries) throw new ZipError("Multi-disk archives aren't supported.");
  if (
    diskEntries === 0xffff ||
    totalEntries === 0xffff ||
    cdSize === 0xffffffff ||
    cdOffset === 0xffffffff
  ) {
    throw new ZipError("ZIP64 archives aren't supported.");
  }
  if (cdOffset < 0 || cdOffset + cdSize > eocd || cdOffset + cdSize > buf.length) throw bad();

  const entries: { name: string; data: Buffer }[] = [];
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  let count = 0;
  let totalBytes = 0;

  while (pos < cdEnd) {
    if (pos + 46 > cdEnd || buf.readUInt32LE(pos) !== 0x02014b50) throw bad();
    const flags = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const compSize = buf.readUInt32LE(pos + 20);
    const uncompSize = buf.readUInt32LE(pos + 24);
    const nameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    if (nameLen === 0xffff || extraLen === 0xffff || compSize === 0xffffffff || uncompSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new ZipError("ZIP64 archives aren't supported.");
    }
    const nameStart = pos + 46;
    if (nameStart + nameLen > cdEnd) throw bad();
    const name = buf.subarray(nameStart, nameStart + nameLen).toString("utf8");
    pos = nameStart + nameLen + extraLen + commentLen;
    if (pos > cdEnd) throw bad();

    if (name.endsWith("/")) continue; // directory entry

    count++;
    if (count > limits.maxEntries) throw new ZipError(`Archive has more than ${limits.maxEntries} files.`);

    if (flags & 0x1) throw new ZipError("Encrypted archives aren't supported.");
    if (method !== 0 && method !== 8) throw new ZipError(`Unsupported compression method ${method} in ${name}.`);

    // Read via the LOCAL header (data descriptors are fine — sizes come from central dir).
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw bad();
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    if (dataStart < 0 || dataStart + compSize > buf.length) throw bad();
    const raw = buf.subarray(dataStart, dataStart + compSize);

    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(raw);
    } else {
      const remaining = limits.maxTotalBytes - totalBytes;
      try {
        data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(1, remaining) });
      } catch (e) {
        if (e instanceof RangeError) {
          throw new ZipError(`Archive expands to more than ${limits.maxTotalBytes / 1048576} MB.`);
        }
        throw new ZipError("Not a valid .zip archive.");
      }
    }
    totalBytes += data.length;
    if (totalBytes > limits.maxTotalBytes) {
      throw new ZipError(`Archive expands to more than ${limits.maxTotalBytes / 1048576} MB.`);
    }
    entries.push({ name, data });
  }

  return entries;
}
