// blurhash.js

// const sharp = require("sharp");
// const { encode } = require("blurhash");
// const { createCanvas, loadImage } = require("canvas");

// async function getBlurHash(imagePath) {
//   const image = await loadImage(imagePath);
//   const canvas = createCanvas(image.width, image.height);
//   const ctx = canvas.getContext("2d");
//   ctx.drawImage(image, 0, 0);

//   const imageData = ctx.getImageData(0, 0, image.width, image.height);
//   const blurHash = encode(
//     imageData.data,
//     imageData.width,
//     imageData.height,
//     4,
//     4
//   );
//   return blurHash;
// }

// module.exports = getBlurHash;

const sharp = require("sharp");
const { encode } = require("blurhash");
const fs = require("fs").promises;

// const loadImage = async (src) => {
//   return sharp(src).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
// };

// const getBlurHash = async (imagePath) => {
//   try {
//     const { data, info } = await loadImage(imagePath);
//     return encode(data, info.width, info.height, 4, 4);
//   } catch (error) {
//     console.error("Failed to encode image to BlurHash:", error);
//     throw error;
//   }
// };

const getBlurHash = async (imagePath) => {
  try {
    // Users can specify the number of components in each axis.
    const componentX = 4;
    const componentY = 4;

    // We're converting the provided image to a byte buffer using sharp.
    const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({
      resolveWithObject: true,
    });

    // Encode the image data to blurhash
    const blurhash = encode(
      data,
      info.width,
      info.height,
      componentX,
      componentY
    );

    // console.log("blurhash " + blurhash);
    return blurhash;
  } catch (error) {
    console.error("Failed to encode image to BlurHash:", error);
    return "";
    // console.error("Failed to encode image to BlurHash:", error);
    // throw error;
  }
};

module.exports = getBlurHash;
