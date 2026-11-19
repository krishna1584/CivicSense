const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Stored extensions come from this list, never from the client's filename.
const MEDIA_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
};

const mediaFilter = (req, file, cb) => {
  if (MEDIA_EXTENSIONS[file.mimetype]) cb(null, true);
  else cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
};

const imageFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') && MEDIA_EXTENSIONS[file.mimetype]) cb(null, true);
  else cb(new Error('Invalid file type. Only images are allowed.'), false);
};

// Files go to the temp directory so large uploads don't sit in server memory.
const upload = multer({
  dest: os.tmpdir(),
  fileFilter: mediaFilter,
  limits: { fileSize: 50 * 1024 * 1024, files: 5 },
});

const uploadAvatar = multer({
  dest: os.tmpdir(),
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

// Anonymous reports accept only formats whose metadata we can reliably remove.
const uploadAnonymous = multer({
  dest: os.tmpdir(),
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type. Anonymous reports accept JPG, PNG or WEBP images only.'), false);
  },
  limits: { fileSize: 15 * 1024 * 1024, files: 5 },
});

/** Re-encode images in place, dropping EXIF data such as GPS position and device. */
const stripImageMetadata = async (files) => {
  for (const file of files) {
    const cleanPath = `${file.path}.clean`;
    try {
      await sharp(file.path).rotate().toFile(cleanPath); // sharp drops metadata unless told to keep it
      await fs.rename(cleanPath, file.path);
    } catch (err) {
      await fs.unlink(cleanPath).catch(() => {});
      throw err;
    }
  }
};

const isCloudinaryConfigured = () =>
  !!process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name';

/**
 * Store one uploaded file. Uses Cloudinary when configured and only falls back
 * to local disk when it isn't, so a failed upload is reported, not hidden.
 */
const storeUpload = async (file, req, { folder, prefix }) => {
  const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
  const name = `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  if (isCloudinaryConfigured()) {
    const result = await cloudinary.uploader.upload(file.path, {
      folder,
      resource_type: mediaType,
      public_id: name,
      transformation: mediaType === 'image' ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
    });
    return { mediaUrl: result.secure_url, publicId: result.public_id, mediaType };
  }

  const fileName = `${name}${MEDIA_EXTENSIONS[file.mimetype]}`;
  const uploadDir = path.join(__dirname, '../../public/uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.copyFile(file.path, path.join(uploadDir, fileName));
  return { mediaUrl: `${req.protocol}://${req.get('host')}/uploads/${fileName}`, publicId: `local_${fileName}`, mediaType };
};

const storeUploads = async (files, req, options) => {
  const stored = [];
  for (const file of files) stored.push(await storeUpload(file, req, options));
  return stored;
};

/** Express middleware: delete a request's temp files once its response ends. */
const cleanupTempUploads = (req, res, next) => {
  res.on('close', () => {
    for (const file of [...(req.files || []), req.file].filter(Boolean)) {
      fs.unlink(file.path).catch(() => {});
    }
  });
  next();
};

const deleteMedia = async (publicId, resourceType = 'image') => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = { upload, uploadAvatar, uploadAnonymous, stripImageMetadata, cloudinary, storeUpload, storeUploads, cleanupTempUploads, deleteMedia };
