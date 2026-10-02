import { readFile, writeFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = process.env.npm_package_version ?? packageJson.version;
manifest.version = version;
await writeFile("manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

const versions = JSON.parse(await readFile("versions.json", "utf8"));
versions[version] = manifest.minAppVersion;
await writeFile("versions.json", `${JSON.stringify(versions, null, 2)}\n`);
