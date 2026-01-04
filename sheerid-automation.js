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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });

      const context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
      });

      this.page = await context.newPage();
      this.page.setDefaultTimeout(config.TIMEOUT);

      logger.success('Browser initialized');
    } catch (error) {
      logger.error('Failed to initialize browser', { error: error.message });
      throw error;
    }
  }

  async navigateToVerificationPage(url) {
    try {
      logger.info('Opening verification page');
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await this.page.waitForLoadState('networkidle');
      
      await this.screenshot('/tmp/01_page_loaded.png');
      logger.success('Page loaded');
    } catch (error) {
      logger.error('Navigation failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Fill complete form - University, Personal Info, Submit
   */
  async fillCompleteForm(data) {
    try {
      logger.info('Starting form filling process');
      
      await this.page.waitForLoadState('networkidle');
      await this.screenshot('/tmp/02_before_form.png');

      // ==========================================
      // 1. UNIVERSITY FIELD
      // ==========================================
      logger.info('Looking for university field...');
      
      // Wait for page to be interactive
      await this.page.waitForTimeout(2000);

      const universitySelectors = [
        'input[name="organization"]',
        'input[placeholder*="school" i]',
        'input[placeholder*="university" i]',
        'input[placeholder*="organisation" i]',
        'input[type="text"]:visible',
        'input[type="search"]:visible'
      ];

      let universityField = null;
      let usedSelector = null;

      for (const selector of universitySelectors) {
        try {
          universityField = await this.page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible' 
          });
          if (universityField) {
            usedSelector = selector;
            logger.info('University field found', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (universityField) {
        logger.info('Filling university field');
        
        // Click to focus
        await universityField.click();
        await this.page.waitForTimeout(500);
        
        // Type slowly to trigger autocomplete
        await universityField.type(data.universityName, { delay: 150 });
        await this.page.waitForTimeout(2500);
        
        await this.screenshot('/tmp/03_after_typing_uni.png');

        // Try to select from dropdown
        const dropdownSelectors = [
          'div[role="option"]:first-child',
          'li[role="option"]:first-child',
          '.dropdown-item:first-child',
          '[data-testid="university-option"]:first-child'
        ];

        let selected = false;
        for (const selector of dropdownSelectors) {
          try {
            const option = await this.page.waitForSelector(selector, { timeout: 3000 });
            if (option) {
              await option.click();
              logger.info('University selected from dropdown', { selector });
              selected = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!selected) {
          logger.info('No dropdown found, pressing Enter');
          await this.page.keyboard.press('Enter');
        }

        await this.page.waitForTimeout(1500);
      } else {
        logger.warn('University field not found, may be pre-filled');
      }

      await this.screenshot('/tmp/04_after_uni_select.png');

      // ==========================================
      // 2. PERSONAL INFO FIELDS
      // ==========================================
      logger.info('Filling personal information');

      // First Name
      const firstNameSelectors = [
        'input[name="firstName"]',
        'input#firstName',
        'input[placeholder*="first" i]',
        'input[data-testid="first-name"]'
      ];

      for (const selector of firstNameSelectors) {
        try {
          const field = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (field) {
            await field.fill(data.firstName);
            logger.debug('First name filled', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Last Name
      const lastNameSelectors = [
        'input[name="lastName"]',
        'input#lastName',
        'input[placeholder*="last" i]',
        'input[data-testid="last-name"]'
      ];

      for (const selector of lastNameSelectors) {
        try {
          const field = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (field) {
            await field.fill(data.lastName);
            logger.debug('Last name filled', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Email
      const emailSelectors = [
        'input[name="email"]',
        'input[type="email"]',
        'input[placeholder*="email" i]',
        'input[data-testid="email"]'
      ];

      for (const selector of emailSelectors) {
        try {
          const field = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (field) {
            await field.fill(data.email);
            logger.debug('Email filled', { selector });
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Birth Date
      if (data.birthDate) {
        await this.fillBirthDate(data.birthDate);
      }

      await this.page.waitForTimeout(1000);
      await this.screenshot('/tmp/05_form_filled.png');

      // ==========================================
      // 3. SUBMIT FORM
      // ==========================================
      logger.info('Submitting form');

      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("Verify")',
        '[data-testid="submit-button"]'
      ];

      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          const button = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (button) {
            await button.click();
            logger.info('Submit button clicked', { selector });
            submitted = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (submitted) {
        await this.page.waitForLoadState('networkidle', { timeout: 30000 });
        await this.page.waitForTimeout(2000);
      } else {
        logger.warn('Submit button not found, trying Enter key');
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(3000);
      }

      await this.screenshot('/tmp/06_after_submit.png');
      logger.success('Form submission completed');

    } catch (error) {
      logger.error('Form filling failed', { error: error.message });
      await this.screenshot('/tmp/error_form_fill.png');
      throw error;
    }
  }

  async fillBirthDate(birthDate) {
    try {
      const birthParts = birthDate.split('-'); // [YYYY, MM, DD]
      
      // Try single date input
      const dateInputSelectors = [
        'input[name="birthDate"]',
        'input[type="date"]',
        'input[placeholder*="date" i]'
      ];

      for (const selector of dateInputSelectors) {
        try {
          const dateInput = await this.page.waitForSelector(selector, { timeout: 2000 });
          if (dateInput) {
            await dateInput.fill(birthDate);
            logger.debug('Birth date filled (single field)', { selector });
            return;
          }
        } catch (e) {
          continue;
        }
      }

      // Try separate fields (day, month, year)
      const dayField = await this.page.$('select[name="birthDay"], input[name="day"]');
      const monthField = await this.page.$('select[name="birthMonth"], select[name="month"]');
      const yearField = await this.page.$('input[name="birthYear"], input[name="year"]');

      if (dayField && monthField && yearField) {
        await dayField.fill(birthParts[2]); // DD
        await monthField.selectOption(birthParts[1]); // MM
        await yearField.fill(birthParts[0]); // YYYY
        logger.debug('Birth date filled (separate fields)');
        return;
      }

      logger.warn('Birth date field not found, skipping');
    } catch (error) {
      logger.warn('Failed to fill birth date', { error: error.message });
    }
  }

  /**
   * Trigger document upload by Portal → Back flow
   */
  async triggerDocumentUpload() {
    try {
      logger.info('Triggering document upload option');
      await this.screenshot('/tmp/07_before_trigger.png');

      // Wait for page to settle
      await this.page.waitForTimeout(2000);

      // Check if upload already visible
      const uploadInput = await this.page.$('input[type="file"]');
      if (uploadInput) {
        logger.info('Upload input already visible');
        return { triggered: true, method: 'already_visible' };
      }

      // Look for Portal/Login button
      const portalSelectors = [
        'button:has-text("Portal")',
        'a:has-text("Portal")',
        'button:has-text("Student Portal")',
        'button:has-text("Login")',
        'a:has-text("Student Login")',
        'button:has-text("Access Portal")',
        'a:has-text("Access Portal")',
        'button:has-text("Sign In")',
        '[data-testid="portal-button"]'
      ];

      let portalButton = null;
      let usedSelector = null;

      for (const selector of portalSelectors) {
        try {
          portalButton = await this.page.waitForSelector(selector, { 
            timeout: 5000,
            state: 'visible'
          });
          if (portalButton) {
            usedSelector = selector;
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
        await this.page.waitForLoadState('domcontentloaded');
        await this.screenshot('/tmp/08_after_portal_click.png');

        // Click back button
        const backSelectors = [
          'button:has-text("Back")',
          'button:has-text("Kembali")',
          'button:has-text("Return")',
          'button:has-text("Cancel")',
          'a:has-text("Back")',
          '[data-testid="back-button"]'
        ];

        let backClicked = false;
        for (const selector of backSelectors) {
          try {
            const backButton = await this.page.waitForSelector(selector, { timeout: 3000 });
            if (backButton) {
              await backButton.click();
              logger.info('Back button clicked', { selector });
              backClicked = true;
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!backClicked) {
          logger.info('Back button not found, using browser back');
          await this.page.goBack();
        }

        await this.page.waitForLoadState('networkidle');
        await this.page.waitForTimeout(2000);
        await this.screenshot('/tmp/09_after_back.png');

        return { triggered: true, method: 'portal_back_flow' };
      }

      logger.warn('Portal button not found');
      
      // Check if we can find alternative upload trigger
      const alternativeButtons = await this.page.$$('button, a');
      logger.info(`Found ${alternativeButtons.length} clickable elements`);
      
      return { triggered: false, method: 'not_found' };

    } catch (error) {
      logger.error('Failed to trigger upload', { error: error.message });
      await this.screenshot('/tmp/error_trigger.png');
      return { triggered: false, error: error.message };
    }
  }

  /**
   * Upload document
   */
  async uploadDocument(imageBuffer) {
    const tempFilePath = `/tmp/student_id_${Date.now()}.png`;
    
    try {
      logger.info('Looking for file upload input');

      // Wait for upload input to appear
      const fileInput = await this.page.waitForSelector('input[type="file"]', { 
        timeout: 20000,
        state: 'attached'
      });
      
      if (!fileInput) {
        throw new Error('File input not found after 20 seconds');
      }

      logger.info('File input found, uploading document');

      // Write temp file
      fs.writeFileSync(tempFilePath, imageBuffer);
      logger.debug('Temp file created', { path: tempFilePath, size: imageBuffer.length });

      // Upload file
      await fileInput.setInputFiles(tempFilePath);
      await this.page.waitForTimeout(3000);
      
      await this.screenshot('/tmp/10_after_upload.png');
      logger.success('Document uploaded');

      // Try to find and click submit button
      const submitSelectors = [
        'button[type="submit"]',
        'button:has-text("Submit")',
        'button:has-text("Done")',
        'button:has-text("Complete")',
        'button:has-text("Finish")',
        'button:has-text("Upload")'
      ];

      let submitClicked = false;
      for (const selector of submitSelectors) {
        try {
          const submitButton = await this.page.waitForSelector(selector, { timeout: 3000 });
          if (submitButton) {
            await submitButton.click();
            logger.info('Upload submit button clicked', { selector });
            submitClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (submitClicked) {
        await this.page.waitForLoadState('networkidle', { timeout: 30000 });
        await this.screenshot('/tmp/11_after_upload_submit.png');
        logger.success('Upload submitted');
      } else {
        logger.warn('Upload submit button not found, document may auto-submit');
      }

      return { success: true };

    } catch (error) {
      logger.error('Upload failed', { error: error.message });
      await this.screenshot('/tmp/error_upload.png');
      throw error;
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          logger.debug('Temp file cleaned up');
        } catch (cleanupError) {
          logger.warn('Failed to cleanup temp file', { error: cleanupError.message });
        }
      }
    }
  }

  /**
   * Check verification status from page
   */
  async checkVerificationStatus() {
    try {
      await this.page.waitForTimeout(2000);
      await this.screenshot('/tmp/12_final_status.png');

      // Success patterns
      const successPatterns = [
        'text=/verified/i',
        'text=/success/i',
        'text=/approved/i',
        'text=/complete/i',
        'text=/congratulations/i'
      ];

      for (const pattern of successPatterns) {
        try {
          const element = await this.page.$(pattern);
          if (element) {
            const text = await element.textContent();
            logger.info('Success indicator found', { text });
            return { status: 'success', message: text.trim() };
          }
        } catch (e) {
          continue;
        }
      }

      // Pending patterns
      const pendingPatterns = [
        'text=/pending/i',
        'text=/review/i',
        'text=/processing/i',
        'text=/under review/i',
        'text=/submitted/i'
      ];

      for (const pattern of pendingPatterns) {
        try {
          const element = await this.page.$(pattern);
          if (element) {
            const text = await element.textContent();
            logger.info('Pending indicator found', { text });
            return { status: 'pending', message: text.trim() };
          }
        } catch (e) {
          continue;
        }
      }

      // Failed patterns
      const failedPatterns = [
        'text=/failed/i',
        'text=/rejected/i',
        'text=/error/i',
        'text=/invalid/i',
        'text=/unable/i'
      ];

      for (const pattern of failedPatterns) {
        try {
          const element = await this.page.$(pattern);
          if (element) {
            const text = await element.textContent();
            logger.info('Failed indicator found', { text });
            return { status: 'failed', message: text.trim() };
          }
        } catch (e) {
          continue;
        }
      }

      logger.warn('No clear status indicator found');
      return { status: 'unknown', message: 'Status tidak dapat ditentukan, silakan cek manual' };

    } catch (error) {
      logger.error('Failed to check status', { error: error.message });
      return { status: 'error', message: error.message };
    }
  }

  async screenshot(filename) {
    try {
      await this.page.screenshot({ path: filename, fullPage: true });
      logger.debug(`Screenshot: ${filename}`);
    } catch (error) {
      logger.warn('Screenshot failed', { error: error.message });
    }
  }

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        logger.info('Browser closed');
      }
    } catch (error) {
      logger.error('Failed to close browser', { error: error.message });
    }
  }
}

module.exports = SheerIDAutomation;
