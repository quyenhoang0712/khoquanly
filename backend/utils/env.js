const weakSecrets = new Set(["change-this-secret", "warehouse-admin-secret", "secret", "changeme"]);

const getRequiredEnv = (name) => {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const getJwtSecret = () => {
  const secret = getRequiredEnv("JWT_SECRET");
  if (weakSecrets.has(secret) || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters and not use the default example value");
  }
  return secret;
};

module.exports = { getJwtSecret, getRequiredEnv };
