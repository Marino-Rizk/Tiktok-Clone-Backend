const fs = require('fs').promises;
const sharp = require('sharp');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

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

async function compressVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const filename = path.basename(videoPath, path.extname(videoPath)) + '.mp4';
    const directory = path.dirname(videoPath);
    const outputPath = path.join(directory, filename);
    ffmpeg(videoPath)
      .outputOptions([
        '-vf scale=640:-2', // Resize width to 640px, keep aspect ratio
        '-b:v 800k',        // Set video bitrate
        '-c:v libx264',     // Use H.264 codec
        '-preset veryfast', // Faster compression
        '-movflags +faststart',
        '-c:a aac',         // Audio codec
        '-b:a 128k'         // Audio bitrate
      ])
      .toFormat('mp4')
      .on('end', () => {
        console.log(`Video compressed and saved to ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error compressing video:', err);
        reject(err);
      })
      .save(outputPath);
  });
}

async function compressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".bmp"].includes(ext)) {
    await compressImage(filePath);
  } else if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext)) {
    await compressVideo(filePath);
  } else {
    console.log('Unsupported file type for compression:', ext);
  }
}

module.exports = compressFile;