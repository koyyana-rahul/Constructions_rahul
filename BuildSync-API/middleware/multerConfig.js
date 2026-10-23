import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { v2 as cloudinaryUploader } from "cloudinary";

/**
 * Paths are anchored to the API package, not the process working directory.
 * This keeps uploads, private files and the static mount consistent whether
 * the server is started with `npm start` inside BuildSync-API or with
 * `node BuildSync-API/index.js` from the repository root.
 */
const API_ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Upload storage.
 *
 * Profile pictures and work-request attachments remain on the public tree
 * because they are rendered by the browser directly. Anything private -
 * contracts, permits, drawings, bills and receipts - goes to `private/` and is
 * only readable through an authenticated download route. Express never serves
 * the `private/` directory.
 */
const UPLOAD_DIR = path.join(API_ROOT, "public", "uploads");
const REPORT_PHOTO_DIR = path.join(UPLOAD_DIR, "reports");
const PRIVATE_DOCUMENT_DIR = path.join(API_ROOT, "private", "documents");
const PRIVATE_RECEIPT_DIR = path.join(API_ROOT, "private", "receipts");

const ensureDir = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

const ensureUploadDir = () => ensureDir(UPLOAD_DIR);
const ensureReportPhotoDir = () => ensureDir(REPORT_PHOTO_DIR);
const ensurePrivateDocumentDir = () => ensureDir(PRIVATE_DOCUMENT_DIR);
const ensurePrivateReceiptDir = () => ensureDir(PRIVATE_RECEIPT_DIR);

/**
 * Collision-resistant, unpredictable filename. The original name is kept in
 * the database for display, never used as the on-disk path.
 */
const uniqueName = (req, file, cb) => {
  const suffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  const ext = path.extname(file.originalname).toLowerCase();
  cb(null, `${suffix}${ext}`);
};

const diskStorage = (directory, ensure) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      ensure();
      cb(null, directory);
    },
    filename: uniqueName,
  });

/** Strip a directory component from a browser-supplied filename. */
const originalName = (file) =>
  path.basename(String(file.originalname || "file")).replace(/[\r\n"]/g, "");

const extensionOf = (file) => path.extname(originalName(file)).toLowerCase();

/** Reject a file unless its extension AND declared MIME type are allowed. */
const fileFilterFor = (extensions, mimetypePattern, label) => (req, file, cb) => {
  const extension = extensionOf(file);
  const mimetype = String(file.mimetype || "").toLowerCase();
  if (extensions.has(extension) && mimetypePattern.test(mimetype)) {
    return cb(null, true);
  }
  return cb(
    new Error(`Only ${label} files are allowed (received ${extension || "unknown type"})`)
  );
};

/* --------------------------------------------------------------- public */

const upload = multer({
  storage: diskStorage(UPLOAD_DIR, ensureUploadDir),
  fileFilter: fileFilterFor(
    new Set([".pdf", ".doc", ".docx", ".txt", ".xlsx"]),
    /pdf|msword|officedocument|text\/plain|sheet/,
    "PDF, DOC, DOCX, XLSX and TXT"
  ),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const IMAGE_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];

// Single image uploader used for registration profile photos.
const uploadImage = multer({
  storage: diskStorage(UPLOAD_DIR, ensureUploadDir),
  fileFilter: (req, file, cb) => {
    const extname = /\.(jpe?g|png|webp)$/i.test(extensionOf(file));
    if (extname && IMAGE_MIMETYPES.includes(String(file.mimetype).toLowerCase())) {
      return cb(null, true);
    }
    cb(new Error("Only JPG, PNG and WEBP images are allowed!"));
  },
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

/** Site photographs attached to a daily progress report. */
const uploadReportPhotos = multer({
  storage: diskStorage(REPORT_PHOTO_DIR, ensureReportPhotoDir),
  fileFilter: fileFilterFor(
    new Set([".jpg", ".jpeg", ".png", ".webp"]),
    /^image\/(jpeg|png|webp)$/,
    "JPG, PNG and WEBP image"
  ),
  limits: { fileSize: 8 * 1024 * 1024, files: 6 },
});

/* -------------------------------------------------------------- private */

const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".dwg",
  ".dxf",
  ".zip",
]);

/**
 * Private project documents. Never exposed by `express.static`; the
 * controller streams them after checking project/site/client visibility.
 */
const uploadDocumentFile = multer({
  storage: diskStorage(PRIVATE_DOCUMENT_DIR, ensurePrivateDocumentDir),
  fileFilter: fileFilterFor(
    DOCUMENT_EXTENSIONS,
    /^(application|image|text)\/|^application\/vnd\./,
    "PDF, Office, image, CAD or ZIP"
  ),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});

/** Expense bills/receipts. Private for the same reason as documents. */
const uploadReceipt = multer({
  storage: diskStorage(PRIVATE_RECEIPT_DIR, ensurePrivateReceiptDir),
  fileFilter: fileFilterFor(
    new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]),
    /^(application\/pdf|image\/(jpeg|png|webp))$/,
    "PDF, JPG, PNG or WEBP"
  ),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

/**
 * Cloudinary integration for Builtra file uploads.
 *
 * After multer saves a file to disk, this helper uploads it to Cloudinary
 * and returns the secure URL. If CLOUDINARY_URL is not configured, it
 * returns the local file path as a fallback so development can proceed
 * without a Cloudinary account.
 */
export const uploadFileFromMulter = async (req, fieldName) => {
  if (!req.file) {
    throw new Error("No file uploaded");
  }

  // Check if Cloudinary is configured
  if (!process.env.CLOUDINARY_URL) {
    // Return local path as fallback
    return req.file.path;
  }

  const result = await cloudinaryUploader.uploader.upload_large(
    req.file.path,
    {
      folder: getFolderForField(fieldName),
      resource_type: getResourceTypeForField(fieldName),
      chunk_size: 6_000_000,
    }
  );

  // Clean up local temp file
  try {
    fs.unlinkSync(req.file.path);
  } catch (e) {
    // ignore cleanup errors
  }

  return result.secure_url;
};

export const getFolderForField = (fieldName) => {
  const folderMap = {
    image: "profiles",
    photos: "reports",
    document: "documents",
    receipt: "receipts",
    default: "builtra",
  };
  return folderMap[fieldName] || folderMap.default;
};

export const getResourceTypeForField = (fieldName) => {
  const resourceTypeMap = {
    image: "image",
    photos: "image",
    document: "raw",
    receipt: "raw",
    default: "raw",
  };
  return resourceTypeMap[fieldName] || resourceTypeMap.default;
};

export default upload;
export {
  upload,
  uploadImage,
  uploadReportPhotos,
  uploadDocumentFile,
  uploadReceipt,
  ensureUploadDir,
  ensureReportPhotoDir,
  ensurePrivateDocumentDir,
  ensurePrivateReceiptDir,
  UPLOAD_DIR,
  REPORT_PHOTO_DIR,
  PRIVATE_DOCUMENT_DIR,
  PRIVATE_RECEIPT_DIR,
};
