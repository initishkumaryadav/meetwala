const logger = require("../utils/logger");

function errorHandler(err, req, res, _next) {
  // Extract meaningful info from axios errors
  const status  = err.response?.status || err.statusCode || 500;
  const message = err.response?.data?.detail
    || err.response?.data?.error
    || err.message
    || "Internal Server Error";
  logger.error(`[${req.method}] ${req.path} → ${status}: ${message}`);
  if (err.code) logger.error(`  Error code: ${err.code}`);
  res.status(status).json({ success: false, error: message });
}

module.exports = { errorHandler };
