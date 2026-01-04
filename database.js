const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, 'data');
    this.verificationFile = path.join(this.dbPath, 'verifications.json');
    
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
    
    if (!fs.existsSync(this.verificationFile)) {
      fs.writeFileSync(this.verificationFile, JSON.stringify([]));
    }
  }

  _readData() {
    try {
      const data = fs.readFileSync(this.verificationFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  _writeData(data) {
    try {
      fs.writeFileSync(this.verificationFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Failed to write database:', error.message);
    }
  }

  saveVerification(userId, username, data) {
    const verifications = this._readData();
    verifications.push({
      userId,
      username,
      timestamp: new Date().toISOString(),
      ...data
    });
    this._writeData(verifications);
  }

  getVerificationsByUser(userId) {
    const verifications = this._readData();
    return verifications.filter(v => v.userId === userId);
  }

  getAllVerifications() {
    return this._readData();
  }

  getStats() {
    const verifications = this._readData();
    const total = verifications.length;
    const success = verifications.filter(v => v.status === 'success').length;
    const pending = verifications.filter(v => v.status === 'pending').length;
    const failed = verifications.filter(v => v.status === 'failed').length;
    
    return { total, success, pending, failed };
  }
}

module.exports = new Database();
