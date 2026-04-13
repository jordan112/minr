import { readFileSync, writeFileSync, mkdirSync } from "fs";

// Bundle the TypeScript
const result = await Bun.build({
  entrypoints: ["./src/main.ts"],
  outdir: "./dist",
  minify: true,
  sourcemap: "none",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

// Copy and patch index.html to reference the bundled JS
let html = readFileSync("./index.html", "utf-8");
html = html.replace(
  '<script type="module" src="./src/main.ts"></script>',
  '<script type="module" src="./main.js"></script>'
);
writeFileSync("./dist/index.html", html);

console.log("Build complete → dist/");
