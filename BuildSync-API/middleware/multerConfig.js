import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = 'public/uploads';

const ensureUploadDir = () => {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
};

const uniqueName = (req, file, cb) => {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  cb(null, uniqueSuffix + path.extname(file.originalname));
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: uniqueName,
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx|txt|xlsx/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, XLSX and TXT files are allowed!'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, 
});

const IMAGE_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Single image uploader used for registration profile photos.
// Serves files from public/uploads which is exposed at the server root.
const uploadImage = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      ensureUploadDir();
      cb(null, UPLOAD_DIR);
    },
    filename: uniqueName,
  }),
  fileFilter: (req, file, cb) => {
    const extname = /\.(jpe?g|png|webp)$/i.test(path.extname(file.originalname));
    if (extname && IMAGE_MIMETYPES.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Only JPG, PNG and WEBP images are allowed!'));
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

export default upload;
export { uploadImage, ensureUploadDir, UPLOAD_DIR };