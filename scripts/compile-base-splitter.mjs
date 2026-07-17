import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import solc from "solc";

const root = process.cwd();
const sourcePath = path.join(root, "contracts", "BaseUsdcSplitter.sol");
const outputDirectory = path.join(root, "contracts", "artifacts");
const outputPath = path.join(outputDirectory, "BaseUsdcSplitter.json");
const source = await readFile(sourcePath, "utf8");

const compiled = JSON.parse(solc.compile(JSON.stringify({
  language: "Solidity",
  sources: { "BaseUsdcSplitter.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
})));

const errors = (compiled.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) {
  throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));
}

const contract = compiled.contracts?.["BaseUsdcSplitter.sol"]?.BaseUsdcSplitter;
if (!contract?.evm?.bytecode?.object) throw new Error("Base splitter bytecode was not produced.");

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  contractName: "BaseUsdcSplitter",
  compilerVersion: solc.version(),
  abi: contract.abi,
  bytecode: `0x${contract.evm.bytecode.object}`,
}, null, 2)}\n`);

console.log(`Compiled BaseUsdcSplitter to ${path.relative(root, outputPath)}`);
