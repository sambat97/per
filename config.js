require('dotenv').config();

module.exports = {
  // Telegram Bot
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [],

  // Student ID Generator API (Updated)
  STUDENT_ID_API: 'https://id-livid-phi.vercel.app/generate',

  // SheerID Organization Search API
  SHEERID_ORG_API: 'https://services.sheerid.com/rest/v2/organization',

  // Browser Settings
  HEADLESS: process.env.HEADLESS !== 'false',
  TIMEOUT: parseInt(process.env.TIMEOUT) || 60000,

  // Country ID Mapping (untuk fallback jika user tidak pilih)
  COUNTRY_MAPPING: {
    'ID': 54,  // Indonesia
    'US': 129, // United States
    'GB': 50,  // United Kingdom
    'CA': 19,  // Canada
    'AU': 6,   // Australia
    'NL': 98,  // Netherlands
    'DE': 41,  // Germany
    'FR': 37,  // France
    'ES': 118, // Spain
    'IT': 61,  // Italy
    'BR': 14,  // Brazil
    'MX': 91,  // Mexico
    'JP': 63,  // Japan
    'KR': 119, // South Korea
    'SG': 112, // Singapore
    'MY': 92,  // Malaysia
    'TH': 125, // Thailand
    'PH': 103, // Philippines
    'VN': 136, // Vietnam
    'IN': 57   // India
  }
};
