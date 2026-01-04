const axios = require('axios');
const logger = require('./logger');

class SheerIDAPI {
  constructor() {
    this.baseURL = 'https://services.sheerid.com/rest/v2';
  }

  /**
   * Submit verification form via API
   */
  async submitVerification(verificationId, data) {
    try {
      logger.info('Submitting verification via API', {
        verificationId,
        university: data.universityName
      });

      // ✅ Format sesuai Python bot yang sukses
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        birthDate: data.birthDate,
        organization: {
          id: parseInt(data.universityId),  // ✅ Must be integer
          name: data.universityName
        },
        deviceFingerprintHash: this._generateDeviceFingerprint(),
        locale: 'id'  // ✅ Indonesian locale
      };

      logger.debug('API payload', payload);

      // ✅ Endpoint untuk STUDENT (bukan teacher)
      const response = await axios.post(
        `${this.baseURL}/verification/${verificationId}/step/collectStudentPersonalInfo`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 30000
        }
      );

      logger.success('✅ Form submitted via API', {
        verificationId,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep
      });

      return {
        success: true,
        data: response.data,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep
      };

    } catch (error) {
      logger.error('❌ API form submission failed', {
        verificationId,
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        response: error.response?.data
      };
    }
  }

  /**
   * Get verification status
   */
  async getStatus(verificationId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/verification/${verificationId}`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 15000
        }
      );

      logger.info('Status retrieved', {
        verificationId,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep
      });

      return {
        success: true,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to get status', { verificationId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate device fingerprint (random)
   */
  _generateDeviceFingerprint() {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

module.exports = SheerIDAPI;
