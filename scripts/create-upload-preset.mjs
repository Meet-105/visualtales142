import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const PRESET_NAME = 'visualtales142_unsigned';
const CLOUDINARY_FOLDER = 'visualtales142';

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

async function main() {
  try {
    await cloudinary.api.create_upload_preset({
      name: PRESET_NAME,
      unsigned: true,
      folder: CLOUDINARY_FOLDER,
    });
    console.log(`Created unsigned upload preset "${PRESET_NAME}".`);
  } catch (err) {
    if (err?.error?.message?.includes('already exists')) {
      console.log(`Upload preset "${PRESET_NAME}" already exists — nothing to do.`);
    } else {
      console.error('Failed to create upload preset:', err?.error?.message || err.message);
      process.exit(1);
    }
  }
}

main();
