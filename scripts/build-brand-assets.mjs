import sharp from "sharp";

const source = "assets/branding/csb-coin-source.png";
const canvasSize = 1024;
const ellipseMask = Buffer.from(`
  <svg width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}">
    <ellipse cx="512" cy="503" rx="493" ry="499" fill="white"/>
  </svg>
`);

const maskedCoin = await sharp(source)
  .resize(canvasSize, canvasSize, { fit: "fill" })
  .composite([{ input: ellipseMask, blend: "dest-in" }])
  .png()
  .toBuffer();

await Promise.all([
  sharp(maskedCoin).resize(512, 512).png({ compressionLevel: 9 }).toFile("public/csb-coin-logo.png"),
  sharp(maskedCoin).resize(512, 512).png({ compressionLevel: 9 }).toFile("app/icon.png"),
  sharp(maskedCoin).resize(180, 180).png({ compressionLevel: 9 }).toFile("app/apple-icon.png")
]);
