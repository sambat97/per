const axios = require('axios');
const logger = require('./logger');

class OrganizationSearch {
  constructor() {
    this.baseURL = 'https://orgsearch.sheerid.net/rest/organization/search';
  }

  async search(accountId, query, country = 'US') {
    try {
      logger.info('Searching organizations', { query, country, accountId });

      const params = {
        accountId: accountId,
        country: country,
        format: 'detailed',
        name: query,
        tags: 'HEI,qualifying_ps',
        type: 'UNIVERSITY,POST_SECONDARY'
      };

      const response = await axios.get(this.baseURL, {
        params: params,
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const organizations = response.data || [];

      if (organizations.length === 0) {
        logger.warn('No organizations found', { query, country });
        return [];
      }

      // Filter hanya UNIVERSITY dan POST_SECONDARY
      const filtered = organizations.filter(org => 
        org.type === 'UNIVERSITY' || org.type === 'POST_SECONDARY'
      );

      logger.success(`✅ Found ${filtered.length} organizations for country ${country}`);

      return filtered;

    } catch (error) {
      logger.error('❌ Organization search failed', {
        error: error.message,
        country: country,
        accountId: accountId,
        query: query
      });

      throw new Error(`Gagal mencari universitas di ${country}. Silakan coba lagi.`);
    }
  }
}

module.exports = new OrganizationSearch();
