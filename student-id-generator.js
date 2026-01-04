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
        universityName,
        countryId
      });

      // Generate student ID number
      const studentIdNumber = this._generateStudentId();

      // Prepare API payload
      const payload = {
        name: `${firstName} ${lastName}`,
        university_name: universityName,  // ✅ CUSTOM UNIVERSITY NAME
        dob: birthDate,
        id: '2',  // Alphanumeric format
        id_value: studentIdNumber,
        academicyear: this._generateAcademicYear(),
        country: countryId || 54,  // Fallback to Indonesia
        template: '1',
        style: Math.floor(Math.random() * 6) + 1,  // Random 1-6
        opacity: '0.1',
        issue_date: format(new Date(), 'dd MMM yyyy').toUpperCase(),
        exp_date: format(
          new Date(new Date().setFullYear(new Date().getFullYear() + 3)),
          'dd MMM yyyy'
        ).toUpperCase()
      };

      logger.debug('Student ID API payload', payload);

      // Call API
      const response = await axios.post(config.STUDENT_ID_API, payload, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      logger.success('Student ID card generated successfully', { 
        university: universityName,
        countryId: payload.country
      });

      return {
        success: true,
        buffer: Buffer.from(response.data),
        filename: `student_id_${firstName}_${lastName}.png`
      };

    } catch (error) {
      logger.error('Failed to generate student ID', { 
        error: error.message,
        response: error.response?.data 
      });
      
      throw new Error('Gagal membuat student ID card. Silakan coba lagi.');
    }
  }

  _generateStudentId() {
    // Generate format: ABC123456789
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const randomLetters = Array.from({ length: 3 }, () => 
      letters.charAt(Math.floor(Math.random() * letters.length))
    ).join('');
    
    const randomNumbers = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    
    return `${randomLetters}${randomNumbers}`;
  }

  _generateAcademicYear() {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-${currentYear + 3}`;
  }
}

module.exports = new StudentIDGenerator();
