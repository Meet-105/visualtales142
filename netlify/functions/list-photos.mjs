import { v2 as cloudinary } from 'cloudinary';

const CLOUDINARY_FOLDER = 'visualtales142';

export const handler = async () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Cloudinary credentials not configured on the server.' }),
    };
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });

  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: `${CLOUDINARY_FOLDER}/`,
      max_results: 500,
      context: false,
    });

    const photos = result.resources.map((r) => ({
      url: r.secure_url,
      filename: `${r.public_id.split('/').pop()}.${r.format}`,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=30',
      },
      body: JSON.stringify(photos),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
