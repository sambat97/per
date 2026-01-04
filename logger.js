const fs = require('fs');
const path = require('path');
const { format } = require('date-fns');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  _getLogFile() {
    const date = format(new Date(), 'yyyy-MM-dd');
    return path.join(this.logDir, `${date}.log`);
  }

  _formatMessage(level, message, metadata = {}) {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    const metaStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}\n`;
  }

  _write(level, message, metadata) {
    const logMessage = this._formatMessage(level, message, metadata);
    console.log(logMessage.trim());
    
    try {
      fs.appendFileSync(this._getLogFile(), logMessage);
    } catch (error) {
      console.error('Failed to write log:', error.message);
    }
  }

  info(message, metadata = {}) {
    this._write('info', message, metadata);
  }

  success(message, metadata = {}) {
    this._write('success', `✅ ${message}`, metadata);
  }

  error(message, metadata = {}) {
    this._write('error', `❌ ${message}`, metadata);
  }

  warn(message, metadata = {}) {
    this._write('warn', `⚠️  ${message}`, metadata);
  }

  debug(message, metadata = {}) {
    this._write('debug', message, metadata);
  }

  logVerification(userId, username, status, data = {}) {
    const logData = {
      userId,
      username,
      status,
      timestamp: new Date().toISOString(),
      ...data
    };
    
    this._write('info', `Verification ${status}`, logData);
    return logData;
  }
}

module.exports = new Logger();
