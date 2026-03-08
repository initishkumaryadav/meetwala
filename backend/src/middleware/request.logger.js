const logger = require("../utils/logger");

function requestLogger(req, _res, next) {
  logger.debug(`→ ${req.method} ${req.path}`);
  next();
}

module.exports = { requestLogger };