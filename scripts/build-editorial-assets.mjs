import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "assets", "editorial");
const output = path.join(root, "public", "editorial");
const heroSource = path.join(root, "assets", "hero", "bgbw-source.png");
const heroOutput = path.join(root, "public", "hero-collage.webp");

const portraits = [
  ["dinner-party.jpg", "amara.webp", "centre"],
  ["black-dress-back.jpg", "celine.webp", "centre"],
  ["fringe-back.jpg", "sofia.webp", "centre"],
  ["night-silhouette.jpg", "maya.webp", "centre"],
  ["noir-from-behind.jpg", "elena.webp", "centre"],
  ["midnight-gown.jpg", "naomi.webp", "north"]
];

await Promise.all(portraits.map(async ([input, filename, position]) => {
  await sharp(path.join(source, input))
    .resize(1100, 1320, { fit: "cover", position })
    .modulate({ saturation: 0.82, brightness: 0.88 })
    .webp({ quality: 84 })
    .toFile(path.join(output, filename));
}));

await sharp(heroSource)
  .webp({ quality: 88 })
  .toFile(heroOutput);
