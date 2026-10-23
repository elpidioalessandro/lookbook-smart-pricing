import multer from 'multer';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED.includes(file.mimetype)) return cb(null, true);
    const err = new Error('Formato immagine non supportato (usa jpg, png, webp o heic)');
    err.status = 400;
    cb(err);
  },
});
