require('dotenv').config();

module.exports = {
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  ADMIN_IDS: process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',').map(id => parseInt(id)) : [],

  // SheerID Configuration
  SHEERID_BASE_URL: 'https://services.sheerid.com',
  SHEERID_ORG_SEARCH_URL: 'https://orgsearch.sheerid.net/rest/organization/search',
  
  // Student ID Generator API
  STUDENT_ID_API: 'https://sicg.vercel.app/generate',
  
  // Country Code Mapping (ISO 2-letter to Student ID API country ID)
  COUNTRY_MAPPING: {
    'AF': 0, 'AL': 1, 'DZ': 2, 'AR': 3, 'AM': 4, 'AU': 5, 'AT': 6, 'AZ': 7,
    'BS': 8, 'BH': 9, 'BD': 10, 'BB': 11, 'BY': 12, 'BE': 13, 'BT': 14, 'BO': 15,
    'BR': 16, 'BG': 17, 'KH': 18, 'CM': 19, 'CA': 20, 'CF': 21, 'CL': 22, 'CN': 23,
    'CO': 24, 'KM': 25, 'CR': 26, 'CI': 27, 'HR': 28, 'DK': 29, 'DM': 30, 'DO': 31,
    'EC': 32, 'EG': 33, 'SV': 34, 'ER': 35, 'EE': 36, 'ET': 37, 'FI': 38, 'FR': 39,
    'GM': 40, 'GE': 41, 'DE': 42, 'GH': 43, 'GR': 44, 'GD': 45, 'GT': 46, 'GN': 47,
    'GY': 48, 'HT': 49, 'HN': 50, 'HU': 51, 'IS': 52, 'IN': 53, 'ID': 54, 'IR': 55,
    'IQ': 56, 'IE': 57, 'IT': 58, 'JM': 59, 'JP': 60, 'JO': 61, 'KZ': 62, 'KE': 63,
    'XK': 64, 'KW': 65, 'KG': 66, 'LA': 67, 'LV': 68, 'LB': 69, 'LR': 70, 'LY': 71,
    'LT': 72, 'LU': 73, 'MG': 74, 'MY': 75, 'MV': 76, 'MX': 77, 'MC': 78, 'MN': 79,
    'MA': 80, 'MM': 81, 'NA': 82, 'NP': 83, 'NL': 84, 'NZ': 85, 'NG': 86, 'KP': 87,
    'NO': 88, 'OM': 89, 'PK': 90, 'PA': 91, 'PE': 92, 'PH': 93, 'PL': 94, 'PT': 95,
    'QA': 96, 'RO': 97, 'RU': 98, 'LC': 99, 'WS': 100, 'SM': 101, 'SA': 102, 'SN': 103,
    'RS': 104, 'SG': 105, 'SO': 106, 'ZA': 107, 'KR': 108, 'SS': 109, 'ES': 110, 'LK': 111,
    'SD': 112, 'SE': 113, 'CH': 114, 'SY': 115, 'TW': 116, 'TJ': 117, 'TZ': 118, 'TH': 119,
    'TG': 120, 'TT': 121, 'TN': 122, 'TR': 123, 'TM': 124, 'UG': 125, 'UA': 126, 'AE': 127,
    'GB': 128, 'US': 129, 'UY': 130, 'UZ': 131, 'VA': 132, 'VE': 133, 'VN': 134, 'YE': 135,
    'ZM': 136, 'ZW': 137
  },
  
  // Playwright Configuration
  HEADLESS: process.env.HEADLESS !== 'false',
  TIMEOUT: 60000,
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};
