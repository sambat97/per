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
      logger.info('Initializing browser for upload...');
      
      this.browser = await chromium.launch({
        headless: config.HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      this.page = await context.newPage();
      this.page.setDefaultTimeout(30000);

      logger.success('Browser initialized');
    } catch (error) {
      logger.error('Browser init failed', { error: error.message });
      throw error;
    }
  }

  async openVerificationPage(url) {
    try {
      logger.info('Opening verification page');
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await this.page.waitForTimeout(3000);
      
      await this.screenshot('/tmp/01_page_opened.png');
      logger.success('Page opened');
    } catch (error) {
      logger.error('Page open failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Trigger document upload via Portal → Back
   */
  async triggerDocumentUpload() {
    try {
      logger.info('Triggering document upload');
      await this.screenshot('/tmp/02_before_trigger.png');

      // Check if upload already visible
      await this.page.waitForTimeout(2000);
      const uploadInput = await this.page.$('input[type="file"]');
      if (uploadInput) {
        logger.info('Upload already visible');
        return { triggered: true, method: 'already_visible' };
      }

      // Look for Portal button
      const portalSelectors = [
        'button:has-text("Portal")',
        'a:has-text("Portal")',
        'button:has-text("Student Portal")',
        'button:has-text("Login")',
        'a:has-text("Student Login")'
      ];

      let portalButton = null;
      for (const selector of portalSelectors) {
        try {
          portalButton = await this.page.waitForSelector(selector, { timeout: 5000 });
          if (portalButton) {
            logger.info('Portal button found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (portalButton) {
        logger.info('Clicking portal button');
        await portalButton.click();
        await this.page.waitForTimeout(2000);
        await this.screenshot('/tmp/03_after_portal_click.png');

        // Click back
        const backButton = await this.page.$('button:has-text("Back"), button:has-text("Kembali"), a:has-text("Back")');
        if (backButton) {
          await backButton.click();
          logger.info('Back button clicked');
        } else {
          await this.page.goBack();
          logger.info('Browser back');
        }

        await this.page.waitForTimeout(2000);
        await this.screenshot('/tmp/04_after_back.png');

        return { triggered: true, method: 'portal_back' };
      }

      logger.warn('Portal button not found');
      return { triggered: false };

    } catch (error) {
      logger.error('Trigger failed', { error: error.message });
      return { triggered: false, error: error.message };
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(imageBuffer) {
    const tempFilePath = `/tmp/student_id_${Date.now()}.png`;
    
    try {
      logger.info('Looking for file input');

      const fileInput = await this.page.waitForSelector('input[type="file"]', { 
        timeout: 20000,
        state: 'attached'
      });
      
      if (!fileInput) {
        throw new Error('File input not found');
      }

      logger.info('Uploading document');
      fs.writeFileSync(tempFilePath, imageBuffer);

      await fileInput.setInputFiles(tempFilePath);
      await this.page.waitForTimeout(3000);
      
      await this.screenshot('/tmp/05_after_upload.png');
      logger.success('Document uploaded');

      // Submit if button exists
      const submitButton = await this.page.$('button[type="submit"], button:has-text("Submit"), button:has-text("Done")');
      if (submitButton) {
        await submitButton.click();
        logger.info('Submit clicked');
        await this.page.waitForTimeout(3000);
        await this.screenshot('/tmp/06_after_submit.png');
      }

      return { success: true };

    } catch (error) {
      logger.error('Upload failed', { error: error.message });
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
      await this.screenshot('/tmp/07_status.png');

      if (await this.page.$('text=/verified|success|approved/i')) {
        return { status: 'success', message: 'Verification successful!' };
      }

      if (await this.page.$('text=/pending|review/i')) {
        return { status: 'pending', message: 'Verification pending review' };
      }

      if (await this.page.$('text=/failed|rejected|error/i')) {
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
      logger.error('Browser close failed', { error: error.message });
    }
  }
}

module.exports = SheerIDAutomation;
