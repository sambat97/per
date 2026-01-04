const axios = require('axios');
const logger = require('./logger');

class SheerIDAPI {
  constructor() {
    this.baseURL = 'https://services.sheerid.com/rest/v2';
  }

  /**
   * Submit verification form via API
   */
  async submitVerification(data) {
    try {
      logger.info('Submitting verification via API', {
        accountId: data.accountId,
        country: data.country
      });

      const payload = {
        programId: data.accountId,
        verificationId: data.verificationId,
        organization: {
          id: data.universityId,
          name: data.universityName
        },
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        birthDate: data.birthDate,
        metadata: {
          country: data.country
        }
      };

      const response = await axios.post(
        `${this.baseURL}/verification/step/collectStudentPersonalInfo`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 30000
        }
      );

      logger.success('API submission successful', {
        status: response.status,
        verificationId: response.data?.verificationId
      });

      return {
        success: true,
        data: response.data,
        verificationId: response.data?.verificationId || data.verificationId
      };

    } catch (error) {
      logger.error('API submission failed', {
        error: error.message,
        response: error.response?.data
      });

      // Return fallback - akan pakai browser method
      return {
        success: false,
        error: error.message,
        fallbackToBrowser: true
      };
    }
  }

  /**
   * Check verification status via API
   */
  async checkStatus(verificationId, accountId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/verification/${verificationId}`,
        {
          params: { programId: accountId },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 15000
        }
      );

      const status = response.data?.currentStep || response.data?.status;
      
      return {
        success: true,
        status: status,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to check status via API', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = SheerIDAPI;
