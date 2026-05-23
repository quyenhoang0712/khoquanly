const crypto = require("crypto");

const CLOUDINARY_UPLOAD_URL = (cloudName) => `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
const DEFAULT_FOLDER = "warehouse-management/reports";

const signParams = (params, apiSecret) => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + apiSecret).digest("hex");
};

const requireCloudinaryConfig = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || (!uploadPreset && (!apiKey || !apiSecret))) {
    const error = new Error("Cloudinary upload is not configured");
    error.statusCode = 500;
    throw error;
  }

  return { apiKey, apiSecret, cloudName, uploadPreset };
};

const uploadImage = async (file, folder = DEFAULT_FOLDER) => {
  const { apiKey, apiSecret, cloudName, uploadPreset } = requireCloudinaryConfig();
  const formData = new FormData();
  formData.append("file", `data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
  formData.append("folder", folder);

  if (uploadPreset) {
    formData.append("upload_preset", uploadPreset);
  } else {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedParams = { folder, timestamp };
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signParams(signedParams, apiSecret));
  }

  const response = await fetch(CLOUDINARY_UPLOAD_URL(cloudName), {
    method: "POST",
    body: formData,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error?.message || "Cloudinary upload failed");
    error.statusCode = 502;
    throw error;
  }

  return data.secure_url;
};

const uploadImages = (files = []) => Promise.all(files.map((file) => uploadImage(file)));

module.exports = { uploadImage, uploadImages };
