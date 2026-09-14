import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const distDir = join(root, "dist");
const publicDir = join(root, "..", "..", "frontend", "public", "extensions");

if (!existsSync(publicDir)) {
    console.log("no frontend/public/extensions, skipping local install");
    process.exit(0);
}

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
const outName = `${manifest.driverId.replace(/\./g, "-")}.drawdyx`;
const source = join(distDir, outName);
if (!existsSync(source)) {
    console.error(`${outName} not found in dist, run the build first`);
    process.exit(1);
}

copyFileSync(source, join(publicDir, outName));
console.log(`installed ${outName} -> frontend/public/extensions/`);
