/**
 * Minimal ZIP reader/writer using only Node built-ins (zlib + Buffer).
 *
 * Supports the subset of the ZIP spec that real-world .skill files use:
 *   - Reading: STORE (method 0) and DEFLATE (method 8) entries.
 *   - Writing: DEFLATE compression for all entries.
 *   - Central directory & End Of Central Directory (EOCD) records.
 *
 * Does NOT support: ZIP64, encryption, Zip streaming, multi-disk archives.
 *
 * This replaces `adm-zip` so the extension has zero runtime dependencies.
 */

import * as zlib from 'zlib';

export interface ZipEntryRead {
    entryName: string;
    isDirectory: boolean;
    uncompressedSize: number;
    compressedSize: number;
    compressionMethod: number;
    crc32: number;
    data: Buffer; // lazily-decompressed raw data
}

interface CentralDirEntry {
    entryName: string;
    isDirectory: boolean;
    uncompressedSize: number;
    compressedSize: number;
    compressionMethod: number;
    localHeaderOffset: number;
    crc32: number;
    externalAttr: number;
}

export class ZipReader {
    private buf: Buffer;
    private entries: CentralDirEntry[];

    constructor(buf: Buffer) {
        this.buf = buf;
        this.entries = this.readCentralDirectory();
    }

    getEntries(): ZipEntryRead[] {
        return this.entries.map((e) => ({
            entryName: e.entryName,
            isDirectory: e.isDirectory,
            uncompressedSize: e.uncompressedSize,
            compressedSize: e.compressedSize,
            compressionMethod: e.compressionMethod,
            crc32: e.crc32,
            data: this.readEntryData(e)
        }));
    }

    /** Convenience: read a single entry's decompressed bytes by name. */
    readFile(entryName: string): Buffer | null {
        for (const e of this.entries) {
            if (e.entryName === entryName) {
                return this.readEntryData(e);
            }
        }
        return null;
    }

    private readCentralDirectory(): CentralDirEntry[] {
        const eocdOffset = this.findEOCD();
        if (eocdOffset < 0) {
            throw new Error('Not a valid ZIP file (EOCD not found)');
        }
        const totalEntries = this.buf.readUInt16LE(eocdOffset + 10);
        const cdSize = this.buf.readUInt32LE(eocdOffset + 12);
        const cdOffset = this.buf.readUInt32LE(eocdOffset + 16);

        const entries: CentralDirEntry[] = [];
        let off = cdOffset;
        const endCd = cdOffset + cdSize;
        for (let i = 0; i < totalEntries; i++) {
            if (off + 46 > endCd) {
                throw new Error('Corrupt central directory');
            }
            const sig = this.buf.readUInt32LE(off);
            if (sig !== 0x02014b50) {
                throw new Error(`Bad central directory signature at ${off}`);
            }
            const method = this.buf.readUInt16LE(off + 10);
            const crc32 = this.buf.readUInt32LE(off + 16);
            const compSize = this.buf.readUInt32LE(off + 20);
            const uncompSize = this.buf.readUInt32LE(off + 24);
            const nameLen = this.buf.readUInt16LE(off + 28);
            const extraLen = this.buf.readUInt16LE(off + 30);
            const commentLen = this.buf.readUInt16LE(off + 32);
            const externalAttr = this.buf.readUInt32LE(off + 38);
            const localOff = this.buf.readUInt32LE(off + 42);
            const name = this.buf
                .subarray(off + 46, off + 46 + nameLen)
                .toString('utf8');
            entries.push({
                entryName: name,
                isDirectory: name.endsWith('/'),
                uncompressedSize: uncompSize,
                compressedSize: compSize,
                compressionMethod: method,
                localHeaderOffset: localOff,
                crc32,
                externalAttr
            });
            off += 46 + nameLen + extraLen + commentLen;
        }
        return entries;
    }

    private findEOCD(): number {
        // EOCD is at most 65557 bytes from the end (header is 22, comment up to 65535).
        const minOff = Math.max(0, this.buf.length - 65557);
        for (let i = this.buf.length - 22; i >= minOff; i--) {
            if (this.buf.readUInt32LE(i) === 0x06054b50) {
                return i;
            }
        }
        return -1;
    }

    private readEntryData(e: CentralDirEntry): Buffer {
        if (e.isDirectory) {
            return Buffer.alloc(0);
        }
        const off = e.localHeaderOffset;
        if (this.buf.readUInt32LE(off) !== 0x04034b50) {
            throw new Error(`Bad local header signature at ${off}`);
        }
        const nameLen = this.buf.readUInt16LE(off + 26);
        const extraLen = this.buf.readUInt16LE(off + 28);
        const dataStart = off + 30 + nameLen + extraLen;
        const compData = this.buf.subarray(dataStart, dataStart + e.compressedSize);

        if (e.compressionMethod === 0) {
            return Buffer.from(compData);
        }
        if (e.compressionMethod === 8) {
            return zlib.inflateRawSync(compData);
        }
        throw new Error(`Unsupported compression method: ${e.compressionMethod}`);
    }
}

// ---- Writer ----

interface WriteEntry {
    name: string;
    data: Buffer;
    isDirectory: boolean;
    externalAttr: number;
}

export class ZipWriter {
    private entries: WriteEntry[] = [];

    /** Add a file. `name` uses forward slashes. */
    addFile(name: string, data: Buffer | string, mode = 0o644): void {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
        // External attributes: Unix permissions go in high 16 bits, shifted.
        // Low byte is MS-DOS attrs (0 = normal file). 0o100000 = regular file.
        const externalAttr = ((0o100000 | mode) << 16) >>> 0;
        this.entries.push({
            name,
            data: buf,
            isDirectory: false,
            externalAttr
        });
    }

    /** Add a directory entry (optional — ZIP files can omit these). */
    addDirectory(name: string): void {
        const normalized = name.endsWith('/') ? name : name + '/';
        const externalAttr = ((0o040000 | 0o755) << 16) >>> 0 | 0x10; // MS-DOS directory bit
        this.entries.push({
            name: normalized,
            data: Buffer.alloc(0),
            isDirectory: true,
            externalAttr
        });
    }

    /** Build the final zip buffer. */
    toBuffer(): Buffer {
        const parts: Buffer[] = [];
        const cdEntries: Buffer[] = [];
        let offset = 0;

        for (const entry of this.entries) {
            const nameBuf = Buffer.from(entry.name, 'utf8');
            const crc = crc32(entry.data);
            let compressed: Buffer;
            let method: number;
            if (entry.isDirectory || entry.data.length === 0) {
                compressed = Buffer.alloc(0);
                method = 0;
            } else {
                compressed = zlib.deflateRawSync(entry.data, { level: 9 });
                method = 8;
                // If compression expanded data (tiny files), fall back to STORE.
                if (compressed.length >= entry.data.length) {
                    compressed = entry.data;
                    method = 0;
                }
            }

            // Local file header
            const local = Buffer.alloc(30);
            local.writeUInt32LE(0x04034b50, 0);
            local.writeUInt16LE(20, 4); // version needed
            local.writeUInt16LE(0x0800, 6); // general purpose flag: bit 11 = UTF-8 names
            local.writeUInt16LE(method, 8);
            local.writeUInt16LE(0, 10); // mod time
            local.writeUInt16LE(0x21, 12); // mod date (arbitrary)
            local.writeUInt32LE(crc, 14);
            local.writeUInt32LE(compressed.length, 18);
            local.writeUInt32LE(entry.data.length, 22);
            local.writeUInt16LE(nameBuf.length, 26);
            local.writeUInt16LE(0, 28); // extra length

            const localHeaderOffset = offset;
            parts.push(local, nameBuf, compressed);
            offset += local.length + nameBuf.length + compressed.length;

            // Central directory header
            const cd = Buffer.alloc(46);
            cd.writeUInt32LE(0x02014b50, 0);
            cd.writeUInt16LE(0x033f, 4); // version made by (Unix | 63)
            cd.writeUInt16LE(20, 6); // version needed
            cd.writeUInt16LE(0x0800, 8); // general purpose flag
            cd.writeUInt16LE(method, 10);
            cd.writeUInt16LE(0, 12); // mod time
            cd.writeUInt16LE(0x21, 14); // mod date
            cd.writeUInt32LE(crc, 16);
            cd.writeUInt32LE(compressed.length, 20);
            cd.writeUInt32LE(entry.data.length, 24);
            cd.writeUInt16LE(nameBuf.length, 28);
            cd.writeUInt16LE(0, 30); // extra
            cd.writeUInt16LE(0, 32); // comment
            cd.writeUInt16LE(0, 34); // disk
            cd.writeUInt16LE(0, 36); // internal attr
            cd.writeUInt32LE(entry.externalAttr, 38);
            cd.writeUInt32LE(localHeaderOffset, 42);

            cdEntries.push(cd, nameBuf);
        }

        const cdStart = offset;
        let cdSize = 0;
        for (const b of cdEntries) {
            cdSize += b.length;
        }

        const eocd = Buffer.alloc(22);
        eocd.writeUInt32LE(0x06054b50, 0);
        eocd.writeUInt16LE(0, 4); // disk
        eocd.writeUInt16LE(0, 6); // disk w/ CD
        eocd.writeUInt16LE(this.entries.length, 8);
        eocd.writeUInt16LE(this.entries.length, 10);
        eocd.writeUInt32LE(cdSize, 12);
        eocd.writeUInt32LE(cdStart, 16);
        eocd.writeUInt16LE(0, 20); // comment

        return Buffer.concat([...parts, ...cdEntries, eocd]);
    }
}

// CRC-32 table
const CRC_TABLE: Uint32Array = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[n] = c >>> 0;
    }
    return table;
})();

export function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}
