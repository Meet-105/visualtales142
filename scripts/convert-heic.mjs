import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import convert from 'heic-convert';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const PHOTOS_DIR = path.resolve('src/photos');

function walkDir(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (/\.heic$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const heicFiles = walkDir(PHOTOS_DIR);

  if (heicFiles.length === 0) {
    console.log('No .heic files found — nothing to convert.');
    return;
  }

  console.log(`Found ${heicFiles.length} HEIC file(s). Converting…`);

  for (const filePath of heicFiles) {
    try {
      const inputBuffer = await readFile(filePath);
      const outputBuffer = await convert({
        buffer: inputBuffer,
        format: 'JPEG',
        quality: 0.92,
      });

      const outputPath = filePath.replace(/\.heic$/i, '.jpeg');
      await writeFile(outputPath, outputBuffer);
      await unlink(filePath);
      console.log(`  ✓ ${path.basename(filePath)} → ${path.basename(outputPath)}`);
    } catch (err) {
      console.error(`  ✗ Failed to convert ${path.basename(filePath)}:`, err.message);
    }
  }

  console.log('Done.');
}

main();
