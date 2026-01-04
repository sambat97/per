const axios = require('axios');
const config = require('./config');
const logger = require('./logger');
const { format } = require('date-fns');

class StudentIDGenerator {
  async generate(userData) {
    try {
      const { firstName, lastName, birthDate, universityName, countryId } = userData;
      
      logger.info('Generating student ID card', { 
        firstName, 
        lastName, 
        countryId: countryId || 'default' 
      });

      const params = {
        name: `${firstName} ${lastName}`,
        dob: birthDate,
        country: countryId || 129,
        academicyear: this._generateAcademicYear(),
        template: '1',
        style: Math.floor(Math.random() * 6) + 1,
        issue_date: format(new Date(), 'dd MMM yyyy').toUpperCase(),
        exp_date: format(new Date(new Date().setFullYear(new Date().getFullYear() + 3)), 'dd MMM yyyy').toUpperCase(),
        id: '2',
        opacity: '0.1'
      };

      logger.debug('Student ID API params', params);

      const response = await axios.get(config.STUDENT_ID_API, {
        params: params,
        responseType: 'arraybuffer',
        timeout: 30000
      });

      logger.success('Student ID card generated successfully', { countryId: params.country });
      
      return {
        success: true,
        buffer: Buffer.from(response.data),
        filename: `student_id_${firstName}_${lastName}.png`
      };
    } catch (error) {
      logger.error('Failed to generate student ID', { error: error.message });
      throw new Error('Gagal membuat student ID card. Silakan coba lagi.');
    }
  }

  _generateAcademicYear() {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 3}`;
  }
}

module.exports = new StudentIDGenerator();
