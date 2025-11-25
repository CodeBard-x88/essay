const LEVELS = ["error", "warn", "info", "http", "debug"];
const normalizeLevel = (level) => level.toLowerCase();

const configuredLevel = normalizeLevel(process.env.LOG_LEVEL || "info");
const configuredIndex = LEVELS.indexOf(configuredLevel);

const shouldLog = (level) => {
  const levelIndex = LEVELS.indexOf(normalizeLevel(level));
  if (levelIndex === -1) {
    return false;
  }
  if (configuredIndex === -1) {
    return true;
  }
  return levelIndex <= configuredIndex;
};

const serializeMeta = (meta) => {
  if (!meta) return "";
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return "";
  }
};

const emit = (level, message, meta) => {
  if (!shouldLog(level)) return;
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${serializeMeta(meta)}`;
  // eslint-disable-next-line no-console
  console.log(line);
};

const buildLogger = (scope) => {
  const prefix = scope ? `[${scope}] ` : "";
  return {
    error: (message, meta) => emit("error", `${prefix}${message}`, meta),
    warn: (message, meta) => emit("warn", `${prefix}${message}`, meta),
    info: (message, meta) => emit("info", `${prefix}${message}`, meta),
    http: (message, meta) => emit("http", `${prefix}${message}`, meta),
    debug: (message, meta) => emit("debug", `${prefix}${message}`, meta),
    child: (childScope) => buildLogger(childScope ? `${scope}:${childScope}` : scope),
  };
};

const logger = buildLogger();

export default logger;

