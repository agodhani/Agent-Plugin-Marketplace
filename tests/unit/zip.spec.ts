import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { createZip, readZip, ZipError } from "../../lib/zipstore";

const LIMITS = { maxEntries: 500, maxTotalBytes: 50 * 1024 * 1024 };
const FX = path.join(__dirname, "..", "fixtures");
const KNOWN = {
  "fixture/plugin.json": '{"name":"fixture","version":"1.0.0"}\n',
  "fixture/README.md": "# Fixture plugin\nUsed by the zip reader unit tests.\n",
};

test("stored + deflate round trips", () => {
  const entries = [
    { name: "a/b.txt", data: "hello world" },
    { name: "c.bin", data: Buffer.alloc(5000, 7) },
  ];
  for (const opts of [undefined, { deflate: true }]) {
    const out = readZip(createZip(entries, opts), LIMITS);
    expect(out.map((e) => e.name).sort()).toEqual(["a/b.txt", "c.bin"]);
    expect(out.find((e) => e.name === "a/b.txt")!.data.toString()).toBe("hello world");
    expect(out.find((e) => e.name === "c.bin")!.data.length).toBe(5000);
  }
});

for (const fx of ["ditto.zip", "infozip.zip", "jszip-deflate.zip"]) {
  test(`fixture ${fx} extracts known content`, () => {
    const out = readZip(fs.readFileSync(path.join(FX, fx)), LIMITS).filter((e) => !e.name.startsWith("__MACOSX/"));
    expect(out.length).toBe(3);
    for (const [name, content] of Object.entries(KNOWN)) {
      expect(out.find((e) => e.name === name)?.data.toString()).toBe(content);
    }
    expect(out.find((e) => e.name === "fixture/src/index.js")!.data.length).toBeGreaterThan(2000);
  });
}

test("501 entries → maxEntries error", () => {
  const zip = createZip(Array.from({ length: 501 }, (_, i) => ({ name: `f${i}.txt`, data: "x" })));
  expect(() => readZip(zip, LIMITS)).toThrowError(/more than 500 files/);
});

test("60 MB of zeros deflated → size error", () => {
  const zip = createZip([{ name: "zeros.bin", data: Buffer.alloc(60 * 1024 * 1024) }], { deflate: true });
  expect(() => readZip(zip, LIMITS)).toThrowError(/more than 50 MB/);
});

test("encrypted flag throws", () => {
  const zip = createZip([{ name: "a.txt", data: "hi" }]);
  // set the general-purpose flag bit 0 in the central directory entry
  const cd = zip.indexOf(Buffer.from("PK\x01\x02", "binary"));
  zip.writeUInt16LE(1, cd + 8);
  expect(() => readZip(zip, LIMITS)).toThrowError(/Encrypted archives aren't supported/);
});

test("unsupported method throws", () => {
  const zip = createZip([{ name: "a.txt", data: "hi" }]);
  const cd = zip.indexOf(Buffer.from("PK\x01\x02", "binary"));
  zip.writeUInt16LE(9, cd + 10);
  expect(() => readZip(zip, LIMITS)).toThrowError(/Unsupported compression method 9 in a.txt/);
});

test("garbage bytes throw", () => {
  expect(() => readZip(Buffer.from("definitely not a zip"), LIMITS)).toThrowError(/Not a valid .zip archive/);
});

test("ZIP64 marker throws", () => {
  const zip = createZip([{ name: "a.txt", data: "hi" }]);
  const eocd = zip.indexOf(Buffer.from("PK\x05\x06", "binary"));
  zip.writeUInt16LE(0xffff, eocd + 8);
  zip.writeUInt16LE(0xffff, eocd + 10);
  expect(() => readZip(zip, LIMITS)).toThrowError(/ZIP64 archives aren't supported/);
});
test("corrupted deflate payload → Not a valid .zip archive", () => {
  const zip = createZip([{ name: "a.txt", data: "hello world hello world" }], { deflate: true });
  // first payload byte of the local data
  const local = zip.indexOf(Buffer.from("PK\x03\x04", "binary"));
  const dataStart = local + 30 + "a.txt".length;
  // first byte 0x07 = BFINAL|BTYPE=11 (reserved block type) → data error, not a size error
  zip.writeUInt8(0x07, dataStart);
  expect(() => readZip(zip, LIMITS)).toThrowError(/Not a valid \.zip archive\./);
});
