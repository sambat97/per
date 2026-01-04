const { Telegraf } = require('telegraf');
const fs = require('fs');
const config = require('./config');
const logger = require('./logger');
const database = require('./database');
const orgSearch = require('./org-search');
const studentIdGen = require('./student-id-generator');
const SheerIDAutomation = require('./sheerid-automation');

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);
const userSessions = new Map();

// ============================================
// SESSION MANAGEMENT
// ============================================
function getSession(userId) {
  if (!userSessions.has(userId)) {
    userSessions.set(userId, {
      step: 'idle',
      data: {},
      lastActivity: Date.now()
    });
  }
  
  const session = userSessions.get(userId);
  session.lastActivity = Date.now();
  
  return session;
}

function clearSession(userId) {
  if (userSessions.has(userId)) {
    userSessions.delete(userId);
    logger.info('Session cleared', { userId });
  }
}

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 3600000; // 1 hour
  
  for (const [userId, session] of userSessions.entries()) {
    if (now - session.lastActivity > timeout) {
      userSessions.delete(userId);
      logger.info('Session cleaned up (timeout)', { userId });
    }
  }
}, 1800000);

async function notifyAdmins(message, extra = {}) {
  for (const adminId of config.ADMIN_IDS) {
    try {
      await bot.telegram.sendMessage(adminId, message, extra);
    } catch (error) {
      logger.error(`Failed to notify admin ${adminId}`, { error: error.message });
    }
  }
}

// ============================================
// COMMANDS
// ============================================
bot.command('start', async (ctx) => {
  const session = getSession(ctx.from.id);
  session.step = 'idle';
  session.data = {};

  const welcomeMessage = `
🎓 *Selamat Datang di SheerID Verification Bot*

Bot ini membantu Anda melakukan verifikasi mahasiswa secara otomatis.

*Fitur:*
✅ Pencarian universitas otomatis
✅ Generate student ID card
✅ Upload dokumen otomatis
✅ Monitoring status verifikasi
✅ Support 138 negara

*Perintah:*
/verify - Mulai verifikasi baru
/status - Cek status verifikasi terakhir
/help - Bantuan lengkap

Silakan gunakan /verify untuk memulai!
`;

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
  logger.info('User started bot', { userId: ctx.from.id, username: ctx.from.username });
});

bot.command('help', async (ctx) => {
  const helpMessage = `
📚 *Bantuan SheerID Bot*

*Cara Menggunakan:*
1. Kirim /verify untuk memulai
2. Masukkan URL verifikasi SheerID
3. Ketik nama universitas
4. Pilih universitas dari daftar
5. Masukkan nama depan
6. Masukkan nama belakang
7. Masukkan tanggal lahir (format: YYYY-MM-DD)
8. Masukkan email
9. Bot akan otomatis memproses verifikasi

*Perintah Lain:*
/cancel - Batalkan proses
/status - Lihat riwayat verifikasi
/stats - Statistik bot (admin only)

*Catatan:*
- Pastikan URL SheerID valid
- Format tanggal: YYYY-MM-DD (contoh: 2003-01-21)
- Email harus valid
- Bot auto-detect negara dari URL
`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

bot.command('stats', async (ctx) => {
  if (!config.ADMIN_IDS.includes(ctx.from.id)) {
    return ctx.reply('⛔ Perintah ini hanya untuk admin.');
  }

  try {
    const stats = database.getStats();
    const message = `
📊 *Statistik Verifikasi*

Total: ${stats.total}
✅ Berhasil: ${stats.success}
⏳ Pending: ${stats.pending}
❌ Gagal: ${stats.failed}

Success Rate: ${stats.total > 0 ? ((stats.success / stats.total) * 100).toFixed(2) : 0}%
`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    await ctx.reply('❌ Gagal mengambil statistik.');
  }
});

bot.command('cancel', async (ctx) => {
  const session = getSession(ctx.from.id);
  session.step = 'idle';
  session.data = {};

  await ctx.reply('❌ Proses dibatalkan. Gunakan /verify untuk memulai lagi.');
  logger.info('User canceled process', { userId: ctx.from.id });
});

bot.command('verify', async (ctx) => {
  const session = getSession(ctx.from.id);
  session.step = 'waiting_url';
  session.data = {};

  await ctx.reply(
    '🔗 Silakan kirim URL verifikasi SheerID Anda.\n\n' +
    'Contoh:\n' +
    'https://services.sheerid.com/verify/123abc...?verificationId=...\n\n' +
    'Ketik /cancel untuk membatalkan.'
  );

  logger.info('User started verification', { userId: ctx.from.id, username: ctx.from.username });
});

bot.command('status', async (ctx) => {
  try {
    const verifications = database.getVerificationsByUser(ctx.from.id);

    if (verifications.length === 0) {
      return ctx.reply('📭 Anda belum memiliki riwayat verifikasi.');
    }

    const lastVerification = verifications[verifications.length - 1];
    const statusEmoji = {
      'success': '✅',
      'pending': '⏳',
      'failed': '❌'
    };

    const message = `
📋 *Status Verifikasi Terakhir*

Status: ${statusEmoji[lastVerification.status] || '❓'} ${lastVerification.status}
Nama: ${lastVerification.firstName} ${lastVerification.lastName}
Universitas: ${lastVerification.universityName}
Negara: ${lastVerification.countryName || '-'}
Waktu: ${new Date(lastVerification.timestamp).toLocaleString('id-ID')}

Total verifikasi Anda: ${verifications.length}
`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Failed to get status', { error: error.message });
    await ctx.reply('❌ Gagal mengambil status verifikasi.');
  }
});

// ============================================
// MESSAGE HANDLERS
// ============================================
bot.on('text', async (ctx) => {
  const session = getSession(ctx.from.id);
  const text = ctx.message.text;

  try {
    switch (session.step) {
      case 'waiting_url':
        await handleURL(ctx, session, text);
        break;
      case 'waiting_university_name':
        await handleUniversitySearch(ctx, session, text);
        break;
      case 'waiting_university_selection':
        await handleUniversitySelection(ctx, session, text);
        break;
      case 'waiting_first_name':
        await handleFirstName(ctx, session, text);
        break;
      case 'waiting_last_name':
        await handleLastName(ctx, session, text);
        break;
      case 'waiting_birth_date':
        await handleBirthDate(ctx, session, text);
        break;
      case 'waiting_email':
        await handleEmail(ctx, session, text);
        break;
      default:
        await ctx.reply(
          '❓ Saya tidak mengerti. Gunakan /verify untuk memulai verifikasi atau /help untuk bantuan.'
        );
    }
  } catch (error) {
    logger.error('Error handling message', {
      userId: ctx.from.id,
      step: session.step,
      error: error.message
    });

    await ctx.reply(
      '❌ Terjadi kesalahan. Silakan coba lagi atau gunakan /cancel untuk membatalkan.'
    );
  }
});

// ============================================
// HANDLER FUNCTIONS
// ============================================
async function handleURL(ctx, session, text) {
  if (!text.includes('sheerid.com')) {
    return ctx.reply(
      '❌ URL tidak valid. Pastikan URL dari SheerID.\n\n' +
      'Contoh: https://services.sheerid.com/verify/...'
    );
  }

  const accountIdMatch = text.match(/\/verify\/([a-f0-9]+)/i);
  if (!accountIdMatch) {
    return ctx.reply('❌ Account ID tidak ditemukan dalam URL.');
  }

  const verificationIdMatch = text.match(/verificationId=([a-f0-9-]+)/i);
  const verificationId = verificationIdMatch ? verificationIdMatch[1] : accountIdMatch[1];
  const accountId = accountIdMatch[1];

  const countryMatch = text.match(/[?&]country=([A-Z]{2})/i);
  const localeMatch = text.match(/[?&]locale=([a-z]{2})/i);

  let country = 'US';
  let countryName = 'United States';

  if (countryMatch) {
    country = countryMatch[1].toUpperCase();
  } else if (localeMatch) {
    const localeToCountry = {
      'id': 'ID', 'nl': 'NL', 'en': 'US', 'de': 'DE',
      'fr': 'FR', 'es': 'ES', 'it': 'IT', 'pt': 'BR',
      'ja': 'JP', 'zh': 'CN', 'ko': 'KR'
    };
    country = localeToCountry[localeMatch[1].toLowerCase()] || 'US';
  }

  const countryNames = {
    'ID': 'Indonesia', 'NL': 'Netherlands', 'US': 'United States',
    'GB': 'United Kingdom', 'CA': 'Canada', 'AU': 'Australia',
    'DE': 'Germany', 'FR': 'France', 'ES': 'Spain', 'IT': 'Italy',
    'BR': 'Brazil', 'MX': 'Mexico', 'AR': 'Argentina', 'JP': 'Japan',
    'CN': 'China', 'KR': 'South Korea', 'IN': 'India', 'SG': 'Singapore',
    'MY': 'Malaysia', 'TH': 'Thailand', 'PH': 'Philippines', 'VN': 'Vietnam'
  };
  countryName = countryNames[country] || country;

  const countryId = config.COUNTRY_MAPPING[country] || 129;

  session.data.url = text;
  session.data.verificationId = verificationId;
  session.data.accountId = accountId;
  session.data.country = country;
  session.data.countryName = countryName;
  session.data.countryId = countryId;

  logger.info('URL parsed successfully', {
    userId: ctx.from.id,
    verificationId: verificationId,
    accountId: accountId,
    country: country,
    countryId: countryId
  });

  session.step = 'waiting_university_name';

  await ctx.reply(
    `✅ *URL tersimpan!*\n\n` +
    `🌍 Negara: *${countryName}* (${country})\n` +
    `🆔 Account ID: \`${accountId}\`\n\n` +
    `🏫 Sekarang ketik nama universitas Anda untuk mencari.\n\n` +
    `Contoh: universitas brawijaya`,
    { parse_mode: 'Markdown' }
  );
}

async function handleUniversitySearch(ctx, session, text) {
  if (text.length < 2) {
    return ctx.reply('❌ Nama universitas terlalu pendek. Minimal 2 karakter.');
  }

  const loadingMsg = await ctx.reply('🔍 Mencari universitas...');

  try {
    if (!session.data.accountId) {
      throw new Error('Account ID tidak ditemukan. Pastikan URL valid.');
    }

    if (!session.data.country) {
      throw new Error('Country code tidak ditemukan. Pastikan URL valid.');
    }

    const organizations = await orgSearch.search(
      session.data.accountId,
      text,
      session.data.country
    );

    if (!organizations || organizations.length === 0) {
      await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
      return ctx.reply(
        `❌ Universitas tidak ditemukan di *${session.data.countryName}*.\n\n` +
        `Coba dengan kata kunci lain atau pastikan country code di URL benar.`,
        { parse_mode: 'Markdown' }
      );
    }

    session.data.organizations = organizations;
    session.step = 'waiting_university_selection';

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    const orgList = organizations.slice(0, 10).map((org, index) => {
      const location = org.city && org.state
        ? `${org.city}, ${org.state}`
        : org.city || org.state || '';
      return `${index + 1}. ${org.name}${location ? ` - ${location}` : ''}`;
    }).join('\n');

    await ctx.reply(
      `📚 *Daftar Universitas Ditemukan (${session.data.countryName}):*\n\n${orgList}\n\n` +
      '💡 Balas dengan nomor universitas yang Anda pilih (contoh: 1)',
      { parse_mode: 'Markdown' }
    );

    logger.info('Organizations found', {
      userId: ctx.from.id,
      count: organizations.length,
      query: text,
      country: session.data.country
    });

  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    logger.error('Organization search failed', {
      userId: ctx.from.id,
      error: error.message,
      country: session.data.country
    });

    await ctx.reply(
      `❌ Gagal mencari universitas.\n\n` +
      `Error: ${error.message}\n\n` +
      `Pastikan:\n` +
      `• Account ID valid\n` +
      `• Country code benar (${session.data.country})\n` +
      `• Universitas ada di negara tersebut`
    );

    session.step = 'waiting_university_name';
  }
}

async function handleUniversitySelection(ctx, session, text) {
  const selection = parseInt(text);

  if (isNaN(selection) || selection < 1 || selection > session.data.organizations.length) {
    return ctx.reply(
      `❌ Pilihan tidak valid. Pilih nomor 1-${Math.min(10, session.data.organizations.length)}`
    );
  }

  const selectedOrg = session.data.organizations[selection - 1];
  session.data.university = selectedOrg;
  session.data.universityName = selectedOrg.name;
  session.data.universityId = selectedOrg.id;

  logger.info('University selected', {
    userId: ctx.from.id,
    university: selectedOrg.name,
    universityId: selectedOrg.id
  });

  session.step = 'waiting_first_name';

  await ctx.reply(
    `✅ Universitas dipilih: *${selectedOrg.name}*\n\n` +
    '👤 Sekarang masukkan *NAMA DEPAN* Anda:',
    { parse_mode: 'Markdown' }
  );
}

async function handleFirstName(ctx, session, text) {
  if (text.length < 2) {
    return ctx.reply('❌ Nama depan terlalu pendek.');
  }

  session.data.firstName = text.trim();
  session.step = 'waiting_last_name';

  await ctx.reply(
    `✅ Nama depan: ${text}\n\n` +
    '👤 Sekarang masukkan *NAMA BELAKANG* Anda:',
    { parse_mode: 'Markdown' }
  );

  logger.info('First name saved', { userId: ctx.from.id, firstName: text });
}

async function handleLastName(ctx, session, text) {
  if (text.length < 2) {
    return ctx.reply('❌ Nama belakang terlalu pendek.');
  }

  session.data.lastName = text.trim();
  session.step = 'waiting_birth_date';

  await ctx.reply(
    `✅ Nama belakang: ${text}\n\n` +
    '📅 Masukkan *TANGGAL LAHIR* Anda:\n\n' +
    'Format: YYYY-MM-DD\n' +
    'Contoh: 2003-01-21',
    { parse_mode: 'Markdown' }
  );

  logger.info('Last name saved', { userId: ctx.from.id, lastName: text });
}

async function handleBirthDate(ctx, session, text) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

  if (!dateRegex.test(text)) {
    return ctx.reply(
      '❌ Format tanggal salah!\n\n' +
      'Gunakan format: YYYY-MM-DD\n' +
      'Contoh: 2003-01-21'
    );
  }

  const date = new Date(text);
  if (isNaN(date.getTime())) {
    return ctx.reply('❌ Tanggal tidak valid.');
  }

  session.data.birthDate = text;
  session.step = 'waiting_email';

  await ctx.reply(
    `✅ Tanggal lahir: ${text}\n\n` +
    '📧 Masukkan *EMAIL* Anda:',
    { parse_mode: 'Markdown' }
  );

  logger.info('Birth date saved', { userId: ctx.from.id, birthDate: text });
}

async function handleEmail(ctx, session, text) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(text)) {
    return ctx.reply('❌ Format email tidak valid.');
  }

  session.data.email = text.trim();

  logger.info('Email saved, starting verification', {
    userId: ctx.from.id,
    email: text
  });

  const summary = `
📋 *Ringkasan Data:*

Nama: ${session.data.firstName} ${session.data.lastName}
Tanggal Lahir: ${session.data.birthDate}
Email: ${session.data.email}
Universitas: ${session.data.universityName}
Negara: ${session.data.countryName}

🚀 Memulai proses verifikasi otomatis...
`;

  await ctx.reply(summary, { parse_mode: 'Markdown' });
  await startVerificationProcess(ctx, session);
}

// ============================================
// VERIFICATION PROCESS
// ============================================
async function startVerificationProcess(ctx, session) {
  const automation = new SheerIDAutomation();
  let status = 'failed';
  let message = 'Unknown error';

  try {
    // Step 1: Open Browser
    await ctx.reply('🌐 Step 1/4: Membuka browser...');
    await automation.initialize();
    await automation.openVerificationPage(session.data.url);
    logger.info('Browser opened', { userId: ctx.from.id });

    // Step 2: Trigger Upload
    await ctx.reply('🔄 Step 2/4: Memicu opsi upload dokumen...');
    const triggerResult = await automation.triggerDocumentUpload();
    
    if (triggerResult.triggered) {
      logger.info('Upload triggered', { method: triggerResult.method, userId: ctx.from.id });
      await ctx.reply(`✅ Upload siap! (${triggerResult.method})`);
    } else {
      logger.warn('Upload trigger failed', { userId: ctx.from.id });
      await ctx.reply('⚠️ Mencoba upload langsung...');
    }

    // Step 3: Generate Student ID
    await ctx.reply('🎓 Step 3/4: Generate student ID card...');
    
    const studentIdResult = await studentIdGen.generate({
      firstName: session.data.firstName,
      lastName: session.data.lastName,
      birthDate: session.data.birthDate,
      universityName: session.data.universityName,
      countryId: session.data.countryId
    });

    if (!studentIdResult.success) {
      throw new Error('Failed to generate student ID');
    }

    logger.info('Student ID generated', { 
      userId: ctx.from.id,
      university: session.data.universityName 
    });

    await ctx.replyWithPhoto(
      { source: studentIdResult.buffer },
      { caption: `✅ Student ID berhasil di-generate!\n🎓 ${session.data.universityName}\n🌍 ${session.data.countryName}` }
    );

    // Step 4: Upload Document
    await ctx.reply('📤 Step 4/4: Uploading document...');
    await automation.uploadDocument(studentIdResult.buffer);
    logger.info('Document uploaded', { userId: ctx.from.id });

    // Check status
    await ctx.reply('⏳ Checking verification status...');
    await automation.page.waitForTimeout(3000);

    const verificationStatus = await automation.checkStatus();
    status = verificationStatus.status;
    message = verificationStatus.message;

    // Screenshot
    const screenshotPath = `/tmp/final_${ctx.from.id}_${Date.now()}.png`;
    await automation.screenshot(screenshotPath);

    try {
      await ctx.replyWithPhoto(
        { source: fs.readFileSync(screenshotPath) },
        { caption: '📸 Screenshot hasil verifikasi' }
      );
      fs.unlinkSync(screenshotPath);
    } catch (e) {
      logger.warn('Screenshot send failed');
    }

    // Result
    const statusEmoji = { 'success': '✅', 'pending': '⏳', 'failed': '❌' };
    const resultMessage = `
${statusEmoji[status] || '❓'} *Verifikasi ${status.toUpperCase()}*

${message}

Nama: ${session.data.firstName} ${session.data.lastName}
Universitas: ${session.data.universityName}
Negara: ${session.data.countryName}
Verification ID: ${session.data.verificationId}
`;

    await ctx.reply(resultMessage, { parse_mode: 'Markdown' });

    // Save database
    try {
      database.saveVerification(ctx.from.id, ctx.from.username, {
        status, message,
        ...session.data
      });
    } catch (dbError) {
      logger.error('Database save failed', { error: dbError.message });
    }

    // Notify admins
    await notifyAdmins(
      `📊 New Verification\n\n` +
      `User: ${ctx.from.username || ctx.from.id}\n` +
      `Status: ${status}\n` +
      `University: ${session.data.universityName}\n` +
      `Country: ${session.data.countryName}\n` +
      `Name: ${session.data.firstName} ${session.data.lastName}`
    );

    logger.info('Verification completed', {
      userId: ctx.from.id,
      username: ctx.from.username,
      status: status,
      university: session.data.universityName
    });

  } catch (error) {
    logger.error('Verification failed', { 
      userId: ctx.from.id, 
      error: error.message,
      stack: error.stack 
    });

    await ctx.reply(
      `❌ *Verifikasi Gagal*\n\nError: ${error.message}\n\nCoba lagi: /verify`,
      { parse_mode: 'Markdown' }
    );

    try {
      database.saveVerification(ctx.from.id, ctx.from.username, {
        status: 'failed',
        message: error.message,
        ...session.data
      });
    } catch (dbError) {
      logger.error('Failed to save error to database');
    }

  } finally {
    await automation.close();
    session.step = 'idle';
    session.data = {};
    clearSession(ctx.from.id);
  }
}

// ============================================
// ERROR HANDLER & LAUNCH
// ============================================
bot.catch((err, ctx) => {
  logger.error('Bot error', {
    error: err.message,
    userId: ctx?.from?.id,
    stack: err.stack
  });

  if (ctx) {
    ctx.reply('❌ Terjadi kesalahan internal. Silakan coba lagi nanti.').catch(() => {});
  }
});

// Launch bot
bot.launch({
  dropPendingUpdates: true
}).then(() => {
  logger.success('✅ Bot started successfully');
  console.log('🤖 Bot is running...');
}).catch((error) => {
  logger.error('❌ Failed to start bot', { error: error.message });
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('SIGINT received, stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  logger.info('SIGTERM received, stopping bot...');
  bot.stop('SIGTERM');
});

module.exports = bot;
