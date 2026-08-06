import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const PHOTOS_DIR = path.resolve('src/photos');
const MANIFEST_PATH = path.resolve('src/photos-manifest.json');
const CLOUDINARY_FOLDER = 'visualtales142';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error(
    'Missing Cloudinary credentials. Copy .env.example to .env and fill in\n' +
      'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(fullPath));
    } else if (/\.(jpe?g|png|webp)$/i.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function main() {
  const files = walkDir(PHOTOS_DIR);

  if (files.length === 0) {
    console.log('No photos found in src/photos — nothing to upload.');
    return;
  }

  console.log(`Found ${files.length} photo(s). Uploading to Cloudinary…`);

  const manifest = [];

  for (const filePath of files) {
    const filename = path.basename(filePath);
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: CLOUDINARY_FOLDER,
        public_id: path.parse(filename).name,
        overwrite: true,
        resource_type: 'image',
      });
      manifest.push({ url: result.secure_url, filename });
      console.log(`  ✓ ${filename}`);
    } catch (err) {
      console.error(`  ✗ Failed to upload ${filename}:`, err.message);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. Wrote ${manifest.length} entries to src/photos-manifest.json`);
}

main();
