const axios = require('axios');
const logger = require('./logger');

class SheerIDAPI {
  constructor() {
    this.baseURL = 'https://services.sheerid.com/rest/v2';
  }

  /**
   * Submit verification form via API
   */
  async submitVerificationForm(data) {
    try {
      logger.info('Submitting form via API', {
        verificationId: data.verificationId,
        country: data.country
      });

      // Step 1: Collect personal info
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        birthDate: data.birthDate,
        organization: data.universityId
      };

      const response = await axios.post(
        `${this.baseURL}/verification/${data.verificationId}/step/collectStudentPersonalInfo`,
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

      logger.success('Form submitted via API', {
        verificationId: data.verificationId,
        currentStep: response.data?.currentStep
      });

      return {
        success: true,
        data: response.data,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep
      };

    } catch (error) {
      logger.error('API form submission failed', {
        error: error.message,
        response: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        fallbackToBrowser: true
      };
    }
  }

  /**
   * Check verification status
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

      return {
        success: true,
        currentStep: response.data?.currentStep,
        awaitingStep: response.data?.awaitingStep,
        data: response.data
      };

    } catch (error) {
      logger.error('Failed to get status', { error: error.message });
      return { success: false, error: error.message };
    }
  }
}

module.exports = SheerIDAPI;
