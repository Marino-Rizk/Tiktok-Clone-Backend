const fs = require('fs').promises;
const sharp = require('sharp');
const path = require('path');

async function compressImage(imagePath) {
  try {
    // Get the image filename and directory
    const filename = path.basename(imagePath);
    const directory = path.dirname(imagePath);

    // Read the image from the local file system
    const imageBuffer = await fs.readFile(imagePath);

    // Process the image with sharp
    const outputBuffer = await sharp(imageBuffer)
      .resize(500, 500)
      .toFormat('jpeg')
      .jpeg({ quality: 90 })
      .toBuffer();

    // Replace the original image
    const outputPath = path.join(directory, filename);
    await fs.writeFile(outputPath, outputBuffer);

    console.log(`Image compressed and saved to ${outputPath}`);
  } catch (error) {
    console.error('Error compressing image:', error);
  }
}


module.exports = compressImage;