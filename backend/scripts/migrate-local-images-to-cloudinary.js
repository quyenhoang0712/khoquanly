require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const mongoose = require("mongoose");
const CheckoutLog = require("../models/CheckoutLog");
const ReportImage = require("../models/ReportImage");
const TaskReport = require("../models/TaskReport");
const { uploadImage } = require("../utils/cloudinary");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/warehouse-management";
const ROOT_DIR = path.join(__dirname, "..");

const isLocalUploadPath = (value) => typeof value === "string" && value.startsWith("/uploads/");

const mimeByExt = {
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const fileToUpload = async (value) => {
  const filePath = path.join(ROOT_DIR, value.replace(/^\//, ""));
  const buffer = await fs.readFile(filePath);
  const mimetype = mimeByExt[path.extname(filePath).toLowerCase()] || "image/jpeg";
  return { buffer, mimetype };
};

const uploadLocalPath = async (value, cache) => {
  if (!isLocalUploadPath(value)) return value;
  if (cache.has(value)) return cache.get(value);

  try {
    const uploaded = await uploadImage(await fileToUpload(value));
    cache.set(value, uploaded);
    console.log(`Migrated ${value} -> ${uploaded}`);
    return uploaded;
  } catch (error) {
    console.warn(`Skipped ${value}: ${error.message}`);
    cache.set(value, value);
    return value;
  }
};

const migrateTaskReports = async (cache) => {
  const reports = await TaskReport.find({ images: /^\/uploads\// });
  let updated = 0;

  for (const report of reports) {
    const images = await Promise.all(report.images.map((image) => uploadLocalPath(image, cache)));
    if (images.some((image, index) => image !== report.images[index])) {
      report.images = images;
      await report.save();
      updated += 1;
    }
  }

  return updated;
};

const migrateReportImages = async (cache) => {
  const images = await ReportImage.find({ path: /^\/uploads\// });
  let updated = 0;

  for (const image of images) {
    const nextPath = await uploadLocalPath(image.path, cache);
    if (nextPath !== image.path) {
      image.path = nextPath;
      await image.save();
      updated += 1;
    }
  }

  return updated;
};

const migrateCheckoutLogs = async (cache) => {
  const logs = await CheckoutLog.find({ images: /^\/uploads\// });
  let updated = 0;

  for (const log of logs) {
    const images = await Promise.all(log.images.map((image) => uploadLocalPath(image, cache)));
    if (images.some((image, index) => image !== log.images[index])) {
      log.images = images;
      await log.save();
      updated += 1;
    }
  }

  return updated;
};

const main = async () => {
  await mongoose.connect(MONGO_URI);
  const cache = new Map();
  const taskReports = await migrateTaskReports(cache);
  const reportImages = await migrateReportImages(cache);
  const checkoutLogs = await migrateCheckoutLogs(cache);

  console.log(`Updated taskreports: ${taskReports}`);
  console.log(`Updated reportimages: ${reportImages}`);
  console.log(`Updated checkoutlogs: ${checkoutLogs}`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
