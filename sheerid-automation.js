const { chromium } = require('playwright');
const config = require('./config');
const logger = require('./logger');
const fs = require('fs');

class SheerIDAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    try {
      logger.info('Initializing browser...');
      
      this.browser = await chromium.launch({
        headless: config.HEADLESS,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      this.page = await context.newPage();
      this.page.setDefaultTimeout(30000);

      logger.success('✅ Browser initialized');
    } catch (error) {
      logger.error('❌ Browser init failed', { error: error.message });
      throw error;
    }
  }

  async openVerificationPage(url) {
    try {
      logger.info('Opening verification page');
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await this.page.waitForTimeout(3000);
      
      await this.screenshot('/tmp/01_page_opened.png');
      logger.success('✅ Page opened');
    } catch (error) {
      logger.error('❌ Page open failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle SSO flow: Click Portal → Click Back → Upload appears
   */
  async handleSSOFlow() {
    try {
      logger.info('Handling SSO flow (Portal → Back)');
      await this.screenshot('/tmp/02_before_sso.png');
      await this.page.waitForTimeout(2000);

      // Look for Portal/SSO button
      const portalSelectors = [
        'button:has-text("Portal")',
        'a:has-text("Portal")',
        'button:has-text("Student Portal")',
        'button:has-text("Login")',
        'a:has-text("Student Login")',
        'button:has-text("Access")',
        'a[href*="sso"]',
        'button:has-text("Microsoft")',
        'button:has-text("Google")'
      ];

      let portalButton = null;
      for (const selector of portalSelectors) {
        try {
          portalButton = await this.page.waitForSelector(selector, { timeout: 5000, state: 'visible' });
          if (portalButton) {
            logger.info('✅ Portal button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!portalButton) {
        throw new Error('Portal button not found');
      }

      // Click portal button
      logger.info('Clicking portal button');
      await portalButton.click();
      await this.page.waitForTimeout(3000);
      await this.screenshot('/tmp/03_after_portal_click.png');

      // Click back/cancel button
      const backSelectors = [
        'button:has-text("Back")',
        'button:has-text("Cancel")',
        'button:has-text("Kembali")',
        'a:has-text("Back")',
        'button:has-text("Return")'
      ];

      let backButton = null;
      for (const selector of backSelectors) {
        try {
          backButton = await this.page.waitForSelector(selector, { timeout: 3000, state: 'visible' });
          if (backButton) {
            logger.info('✅ Back button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (backButton) {
        await backButton.click();
        logger.info('✅ Back button clicked');
      } else {
        logger.info('Back button not found, using browser back');
        await this.page.goBack();
      }

      await this.page.waitForTimeout(3000);
      await this.screenshot('/tmp/04_after_back.png');

      logger.success('✅ SSO flow completed');
      return { success: true };

    } catch (error) {
      logger.error('❌ SSO flow failed', { error: error.message });
      await this.screenshot('/tmp/error_sso.png');
      throw error;
    }
  }

  /**
   * Check if upload input is visible
   */
  async isUploadInputVisible() {
    try {
      const uploadInput = await this.page.$('input[type="file"]');
      return uploadInput !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(imageBuffer) {
    const tempFilePath = `/tmp/student_id_${Date.now()}.png`;
    
    try {
      logger.info('Looking for file input');

      // Wait for file input with retry
      let fileInput = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          fileInput = await this.page.waitForSelector('input[type="file"]', { 
            timeout: 20000,
            state: 'attached'
          });
          
          if (fileInput) {
            logger.info(`✅ File input found (attempt ${attempt})`);
            break;
          }
        } catch (e) {
          logger.warn(`File input not found (attempt ${attempt}/3)`);
          await this.page.waitForTimeout(2000);
          await this.screenshot(`/tmp/attempt_${attempt}.png`);
        }
      }
    
    if (!fileInput) {
      throw new Error('File input not found after 3 attempts');
    }

    logger.info('Uploading document');
    fs.writeFileSync(tempFilePath, imageBuffer);

    await fileInput.setInputFiles(tempFilePath);
    await this.page.waitForTimeout(3000);
    
    await this.screenshot('/tmp/05_after_upload.png');
    logger.success('✅ Document uploaded');

    // Submit if button exists
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Done")',
      'button:has-text("Continue")',
      'button:has-text("Next")'
    ];

    for (const selector of submitSelectors) {
      try {
        const submitButton = await this.page.$(selector);
        if (submitButton) {
          await submitButton.click();
          logger.info('✅ Submit button clicked', { selector });
          await this.page.waitForTimeout(3000);
          await this.screenshot('/tmp/06_after_submit.png');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    return { success: true };

  } catch (error) {
    logger.error('❌ Upload failed', { error: error.message });
    await this.screenshot('/tmp/error_upload.png');
    throw error;
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

  async checkStatus() {
    try {
      await this.page.waitForTimeout(2000);
      await this.screenshot('/tmp/07_final_status.png');

      // Success patterns
      if (await this.page.$('text=/verified|success|approved|complete/i')) {
        return { status: 'success', message: 'Verification successful!' };
      }

      // Pending patterns
      if (await this.page.$('text=/pending|review|processing|submitted/i')) {
        return { status: 'pending', message: 'Verification pending review' };
      }

      // Failed patterns
      if (await this.page.$('text=/failed|rejected|error|invalid/i')) {
        return { status: 'failed', message: 'Verification failed' };
      }

      return { status: 'unknown', message: 'Status tidak dapat ditentukan' };

    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  async screenshot(filename) {
    try {
      await this.page.screenshot({ path: filename, fullPage: true });
      logger.debug(`Screenshot: ${filename}`);
    } catch (error) {
      // Ignore
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.error('❌ Browser close failed', { error: error.message });
    }
  }
}

module.exports = SheerIDAutomation;
