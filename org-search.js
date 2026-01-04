const axios = require('axios');
const config = require('./config');
const logger = require('./logger');

class OrganizationSearch {
  async search(accountId, query, country = 'US') {
    try {
      logger.info('Searching organizations', { query, country, accountId });
      
      const response = await axios.get(config.SHEERID_ORG_SEARCH_URL, {
        params: {
          accountId: accountId,
          country: country,
          format: 'detailed',
          name: query,
          tags: 'HEI,qualifying_ps',
          type: 'UNIVERSITY,POST_SECONDARY'
        },
        timeout: 10000
      });

      const organizations = response.data;
      logger.success(`Found ${organizations.length} organizations for country ${country}`);
      
      return organizations;
    } catch (error) {
      logger.error('Organization search failed', { 
        error: error.message,
        country,
        accountId,
        query
      });
      throw new Error(`Gagal mencari universitas di ${country}. Silakan coba lagi.`);
    }
  }

  formatOrganizationsList(organizations) {
    if (!organizations || organizations.length === 0) {
      return 'Tidak ada universitas ditemukan.';
    }

    return organizations.slice(0, 10).map((org, index) => {
      const location = org.city && org.state 
        ? `${org.city}, ${org.state}` 
        : org.city || org.state || '';
      return `${index + 1}. ${org.name}${location ? ` (${location})` : ''}`;
    }).join('\n');
  }

  getOrganizationById(organizations, index) {
    if (index < 0 || index >= organizations.length) {
      return null;
    }
    return organizations[index];
  }
}

module.exports = new OrganizationSearch();
