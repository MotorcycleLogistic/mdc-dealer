// ====================================================================
// MODUL KRIPTOGRAFI & KEAMANAN PASSWORD (SHA-256 + SALT)
// ====================================================================
var MDC_SECURITY_SALT = (typeof MDC_SECURITY_SALT !== 'undefined') 
  ? MDC_SECURITY_SALT 
  : "MDC_DAM_HONDA_SECURE_KEY_2026"; // Kunci unik sistem Anda

function hashPasswordMDC(plainPassword) {
  if (!plainPassword) return '';
  const saltedInput = plainPassword.toString() + MDC_SECURITY_SALT;
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, saltedInput, Utilities.Charset.UTF_8);
  
  let hexString = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hexString += byteHex;
  }
  return hexString;
}

// ====================================================================
// KONFIGURASI SPREADSHEET
// ====================================================================
const SPREADSHEET_ID = "1Xy9095taEr4EQC7dWqOj_nPjaIDNsxyf6k6eN7Tb3Mc";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (_) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

// Helper: Kompatibel dengan nama sheet 'User_Mobile' atau 'Users_Mobile'
function getUserSheet(ss) {
  return ss.getSheetByName('User_Mobile') || ss.getSheetByName('Users_Mobile');
}

// Render halaman HTML
// Helper: Membaca file template dengan toleransi nama file (kebal ekstensi .html)
function getHtmlTemplate(filename) {
  try {
    return HtmlService.createTemplateFromFile(filename);
  } catch (err) {
    return HtmlService.createTemplateFromFile(filename + '.html');
  }
}

// Helper: Membaca file HTML statis langsung tanpa template parsing (jauh lebih cepat & aman)
function getHtmlOutputDirect(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename);
  } catch (_) {
    try {
      return HtmlService.createHtmlOutputFromFile(filename + '.html');
    } catch (err) {
      return getHtmlTemplate(filename).evaluate();
    }
  }
}

// Router Utama Halaman (Default: Portal Web Desktop)
function doGet(e) {
  // Nilai default dialihkan ke 'md' (Web Desktop) bila URL diakses tanpa parameter
  const page = (e && e.parameter && e.parameter.page) ? e.parameter.page.toLowerCase() : 'md';

  // 1. Rute Khusus Mobile (PDI Man Dealer) - Cadangan jika parameter ?page=mobile dipanggil
  if (page === 'mobile' || page === 'pdi' || page === 'dealer') {
    return getHtmlTemplate('Index')
      .evaluate()
      .setTitle('MDC Mobile - PDI Man Dealer')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // 2. RUTE UTAMA (DEFAULT): Portal Web Desktop (Main Dealer Operations)
  return getHtmlOutputDirect('WebMD')
    .setTitle('MDC Portal Main Dealer - Operations')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * FUNGSI REGISTRASI USER DENGAN DIRECT SESSION RETURN & AUTO-VERIFY
 * Sheet: Users_Mobile
 */
function registerUser(formData) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName("Users_Mobile") || 
                ss.getSheetByName("User_Mobile") || 
                ss.getSheetByName("Users Mobile");

    if (!sheet) {
      return { 
        success: false, 
        message: "Gagal: Sheet 'Users_Mobile' tidak ditemukan pada Spreadsheet." 
      };
    }

    var cleanEmail = String(formData.email || "").trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: "Email Google wajib diisi." };
    }

    // Normalisasi Kode AHM & No HP
    var rawKodeAhm = String(formData.kodeAhm || "").replace(/['"\s]/g, "").trim();
    if (/^\d+$/.test(rawKodeAhm) && rawKodeAhm.length < 5) {
      rawKodeAhm = ("00000" + rawKodeAhm).slice(-5);
    }
    var rawNoHp = String(formData.noHp || formData.noWa || "").replace(/['"\s]/g, "").trim();

    // 1. CEK DUPLIKASI CERDAS:
    // Jika email sudah ada di spreadsheet dan Kode AHM cocok, langsung izinkan masuk (Auto-Verify)
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var rowEmail = String(data[i][1] || "").trim().toLowerCase();
      if (rowEmail === cleanEmail) {
        var existingKodeAhm = String(data[i][4] || "").replace(/['"\s]/g, "").trim();
        if (/^\d+$/.test(existingKodeAhm) && existingKodeAhm.length < 5) {
          existingKodeAhm = ("00000" + existingKodeAhm).slice(-5);
        }

        // Jika email terdaftar untuk dealer yang sama, jangan tolak; langsung kembalikan sesi login
        if (existingKodeAhm === rawKodeAhm || isAhmCodeMatch(existingKodeAhm, rawKodeAhm)) {
          return {
            success: true,
            message: "Akun telah terverifikasi.",
            user: {
              email: cleanEmail,
              nama: String(data[i][2] || formData.namaLengkap || "").trim(),
              noHp: String(data[i][3] || rawNoHp).replace(/^'/, ""),
              kodeAhm: rawKodeAhm,
              namaDealer: String(data[i][5] || formData.namaDealer || "").trim(),
              kodeDealer: String(data[i][6] || formData.kodeDealer || "").trim(),
              kategori: String(data[i][7] || formData.kategori || "").trim(),
              kota: String(data[i][8] || formData.kota || "").trim(),
              sentraDistribusi: String(data[i][9] || formData.sentraDistribusi || "").trim(),
              role: String(data[i][10] || "PDI Man").trim()
            }
          };
        } else {
          return { 
            success: false, 
            message: "Email Google '" + cleanEmail + "' sudah terdaftar di dealer lain. Silakan periksa kembali Kode AHM atau gunakan menu Masuk." 
          };
        }
      }
    }

    // 2. JIKA AKUN BARU, SIMPAN BARIS KE SHEET
    var timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    var namaDealer = String(formData.namaDealer || "").trim();
    var kodeDealer = String(formData.kodeDealer || "").trim();
    var kategori = String(formData.kategori || "").trim();
    var kota = String(formData.kota || "").trim();
    var sentraDistribusi = String(formData.sentraDistribusi || "").trim();
    var role = String(formData.role || "PDI Man").trim();
    var namaLengkap = String(formData.namaLengkap || "").trim().toUpperCase();

    var newRow = [
      timestamp,
      cleanEmail,
      namaLengkap,
      "'" + rawNoHp,
      "'" + rawKodeAhm,
      namaDealer,
      kodeDealer,
      kategori,
      kota,
      sentraDistribusi,
      role
    ];

    sheet.appendRow(newRow);
    SpreadsheetApp.flush();

    // 3. LANGSUNG KEMBALIKAN DATA USER LENGKAP KE FRONTEND
    return { 
      success: true, 
      message: "Pendaftaran berhasil. Akun terdaftar di Users_Mobile.",
      user: {
        email: cleanEmail,
        nama: namaLengkap,
        noHp: rawNoHp,
        kodeAhm: rawKodeAhm,
        namaDealer: namaDealer,
        kodeDealer: kodeDealer,
        kategori: kategori,
        kota: kota,
        sentraDistribusi: sentraDistribusi,
        role: role
      }
    };

  } catch (err) {
    return { success: false, message: "Terjadi kesalahan sistem: " + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 2. ROUTER DOPost UNTUK MENANGKAP PENDAFTARAN DARI LUAR / PWA / AI STUDIO
 * [DIPERBAIKI]: Mendukung forceRefresh dan clearMasterDataCache langsung dari API
 */
function doPost(e) {
  try {
    var rawContent = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(rawContent);
    var action = payload.action;
    var data = payload.data || {};
    var responseData;

    switch (action) {
      case "registerUser":
        responseData = registerUser(data);
        break;
      case "lookupKodeAhm":
        responseData = lookupKodeAhm(data.kodeAhm || data.code || data);
        break;
      case "loginUser":
        responseData = loginUser(data.email, data.kodeAhm);
        break;
      case "getMasterDataKlaim":
        // Izinkan flag forceRefresh jika dikirim dari frontend untuk menembus cache server
        var isForce = Boolean(data && (data.forceRefresh === true || data === true));
        responseData = getMasterDataKlaim(isForce);
        break;
      case "clearMasterDataCache":
        clearMasterDataCache();
        responseData = { success: true, message: "Cache master data berhasil dibersihkan." };
        break;
      case "getRecentClaims":
        responseData = getRecentClaims(data.kodeAhm);
        break;
      case "getDashboardStats":
        responseData = getDashboardStats(data.kodeAhm);
        break;
      case "simpanPengajuanKlaim":
        responseData = simpanPengajuanKlaim(data);
        break;
      case "dealerKonfirmasiSelesai":
        responseData = dealerKonfirmasiSelesai(data.idKlaim);
        break;
      case "dealerKonfirmasiRetur":
        responseData = dealerKonfirmasiRetur(data.idKlaim, data.alasan);
        break;
      case "hapusKlaim":
        if (data && data.purgePayload) {
          responseData = simpanPengajuanKlaim(data.purgePayload);
        } else {
          responseData = { success: true, message: "Klaim berhasil dihapus." };
        }
        break;
      case "checkDataVersion":
        responseData = checkDataVersion(data.clientVersion || data);
        break;
      case "getAppUrl":
        responseData = getAppUrl(data.targetPage || 'mobile');
        break;
      default:
        responseData = { success: false, message: "Aksi tidak dikenali: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      success: false, 
      message: "GAS Error: " + err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Endpoint URL Resmi untuk Navigasi Aman Client-Side
function getAppUrl(targetPage) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (targetPage === 'mobile') {
      const explicitMobileUrl = props.getProperty('MDC_MOBILE_URL');
      if (explicitMobileUrl && explicitMobileUrl.trim() !== '') {
        return explicitMobileUrl.trim();
      }
    }
    const baseUrl = ScriptApp.getService().getUrl() || '';
    if (baseUrl && targetPage) {
      return baseUrl + (baseUrl.indexOf('?') === -1 ? '?page=' + targetPage : '&page=' + targetPage);
    }
    return baseUrl;
  } catch (err) {
    const props = PropertiesService.getScriptProperties();
    return props.getProperty('MDC_MOBILE_URL') || '';
  }
}

// 1. Otentikasi Login Pengguna (Email + Kode AHM)
function loginUser(email, kodeAhm) {
  if (!email || !kodeAhm) {
    return { status: 'FAILED', message: 'Email dan Kode AHM wajib diisi.' };
  }

  try {
    const ss = getSpreadsheet();
    const sheet = getUserSheet(ss);
    if (!sheet) return { status: 'ERROR', message: 'Sheet User_Mobile tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    const targetEmail = email.toString().toLowerCase().trim();
    const targetKodeAhm = kodeAhm.toString().trim();

    // Kolom: [1] Email Google | [2] Nama Lengkap | [3] No HP | [4] Kode AHM | [5] Nama Dealer | [6] Kode Dealer | [7] Kategori | [8] Kota | [9] Sentra Distribusi
    for (let i = 1; i < data.length; i++) {
      const rowEmail = (data[i][1] || '').toString().toLowerCase().trim();
      const rowKodeAhm = (data[i][4] || '').toString().trim();

      if (rowEmail === targetEmail) {
        if (rowKodeAhm === targetKodeAhm) {
          return {
            status: 'SUCCESS',
            user: {
              email: targetEmail,
              nama: data[i][2] || '',
              noHp: data[i][3] || '',
              kodeAhm: rowKodeAhm,
              namaDealer: data[i][5] || '',
              kodeDealer: data[i][6] || '',
              kategori: data[i][7] || '',
              kota: data[i][8] || '',
              sentraDistribusi: data[i][9] || '',
              role: 'PDI Man'
            }
          };
        } else {
          return { status: 'FAILED', message: 'Kode AHM tidak cocok dengan email terdaftar.' };
        }
      }
    }

    return { status: 'FAILED', message: 'Alamat email belum terdaftar di sistem.' };
  } catch (err) {
    return { status: 'ERROR', message: err.toString() };
  }
}

// 2. Cek Sesi Cepat Berdasarkan Email (Pastikan Role terbaca)
function checkUserByEmail(email) {
  if (!email) return { status: 'NOT_REGISTERED' };

  try {
    const ss = getSpreadsheet();
    const sheet = getUserSheet(ss);
    if (!sheet) return { status: 'ERROR', message: 'Sheet User_Mobile tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    const targetEmail = email.toString().toLowerCase().trim();

    for (let i = 1; i < data.length; i++) {
      if ((data[i][1] || '').toString().toLowerCase().trim() === targetEmail) {
        return {
          status: 'REGISTERED',
          user: {
            email: targetEmail,
            nama: data[i][2] || '',
            noHp: data[i][3] || '',
            kodeAhm: (data[i][4] || '').toString().trim(),
            namaDealer: data[i][5] || '',
            kodeDealer: data[i][6] || '',
            kategori: data[i][7] || '',
            kota: data[i][8] || '',
            sentraDistribusi: data[i][9] || '',
            role: data[i][10] || 'PDI Man' // Kolom 11: Role
          }
        };
      }
    }
    return { status: 'NOT_REGISTERED' };
  } catch (err) {
    return { status: 'ERROR', message: err.toString() };
  }
}

/**
 * HELPER: Normalisasi Kode AHM untuk toleransi awalan angka nol (leading zeros),
 * spasi, tanda petik satu ('), dan huruf besar/kecil.
 */
function normalizeAhmCode(val) {
  if (val === null || val === undefined) return { raw: '', noZero: '', padded: '' };
  var raw = String(val).replace(/['"\s]/g, '').trim().toUpperCase();
  var noZero = raw.replace(/^0+/, '');
  var padded = (noZero.length > 0 && noZero.length <= 5) ? ('00000' + noZero).slice(-5) : raw;
  return { raw: raw, noZero: noZero, padded: padded };
}

function isAhmCodeMatch(code1, code2) {
  var c1 = normalizeAhmCode(code1);
  var c2 = normalizeAhmCode(code2);
  if (!c1.raw || !c2.raw) return false;
  return (
    c1.raw === c2.raw ||
    (c1.noZero !== '' && c1.noZero === c2.noZero) ||
    (c1.padded !== '' && c1.padded === c2.padded)
  );
}

/**
 * HELPER: Mengambil sheet dengan toleransi variasi penamaan (Users_Mobile vs User_Mobile)
 */
function getTargetSheet(ss, primaryName, alternateNames) {
  var sheet = ss.getSheetByName(primaryName);
  if (sheet) return sheet;
  if (alternateNames && alternateNames.length) {
    for (var i = 0; i < alternateNames.length; i++) {
      sheet = ss.getSheetByName(alternateNames[i]);
      if (sheet) return sheet;
    }
  }
  return null;
}

/**
 * 1. LOOKUP KODE AHM (Sheet: Master_Dealer)
 * Header: [0] Kode AHM, [1] Nama Dealer, [2] Kode Dealer, [3] Kategori, [4] Kota, [5] Sentra Distribusi
 */
function lookupKodeAhm(kodeInput) {
  try {
    if (!kodeInput) return { found: false, message: 'Kode AHM tidak boleh kosong' };

    var ss = getSpreadsheet();
    var sheet = getTargetSheet(ss, 'Master_Dealer', ['Master Dealer', 'master_dealer']);
    if (!sheet) {
      return { found: false, message: 'Sheet Master_Dealer tidak ditemukan di spreadsheet' };
    }

    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return { found: false, message: 'Data sheet Master_Dealer kosong' };
    }

    var query = normalizeAhmCode(kodeInput);

    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var rowAhm = row[0];
      var rowKodeDealer = String(row[2] || '').replace(/['"\s]/g, '').trim().toUpperCase();

      var matchAhm = isAhmCodeMatch(rowAhm, kodeInput);
      var matchDealer = (rowKodeDealer === query.raw || rowKodeDealer.replace(/^DLR-?/i, '') === query.noZero);

      if (matchAhm || matchDealer) {
        var cleanKodeResmi = String(rowAhm != null ? rowAhm : '').replace(/['"\s]/g, '').trim();
        if (/^\d+$/.test(cleanKodeResmi) && cleanKodeResmi.length < 5) {
          cleanKodeResmi = ('00000' + cleanKodeResmi).slice(-5);
        }

        return {
          found: true,
          kodeAhm: cleanKodeResmi,
          namaDealer: String(row[1] || ''),
          kodeDealer: String(row[2] || ''),
          kategori: String(row[3] || ''),
          kota: String(row[4] || ''),
          sentraDistribusi: String(row[5] || ''),
          role: 'PDI Man'
        };
      }
    }

    return { found: false, message: 'Kode AHM tidak terdaftar pada Master Dealer' };
  } catch (err) {
    return { found: false, message: err.toString() };
  }
}

// Helper Format WhatsApp Internasional
function formatNomorWa(noHp) {
  if (!noHp) return '';
  let nomor = noHp.toString().trim().replace(/[^0-9]/g, '');

  if (nomor.startsWith('08')) {
    nomor = '628' + nomor.slice(2);
  } else if (nomor.startsWith('8')) {
    nomor = '628' + nomor.slice(1);
  } else if (nomor.startsWith('6208')) {
    nomor = '628' + nomor.slice(4);
  }

  return "'" + nomor;
}

// Helper untuk membersihkan format nomor telepon dari sheet (mencegah notasi ilmiah 6.28521E+12)
function cleanPhoneNumberFromCell(rawCellVal) {
  if (!rawCellVal) return '';
  if (typeof rawCellVal === 'number' && !isNaN(rawCellVal)) {
    // Tangani angka murni agar tidak terpotong menjadi eksponensial
    return rawCellVal.toLocaleString('fullwide', { useGrouping: false });
  }
  let str = rawCellVal.toString().trim();
  // Jika sudah terlanjur berformat ilmiah (misal 6,28521E+12)
  if (/^[0-9]+[.,][0-9]+E\+[0-9]+$/i.test(str)) {
    let num = Number(str.replace(',', '.'));
    if (!isNaN(num)) {
      return num.toLocaleString('fullwide', { useGrouping: false });
    }
  }
  return str.replace(/['"\s]/g, '').trim();
}

// ====================================================================
// 1. PENGAMBILAN MASTER DATA UNTUK FORM KLAIM (HIGH PERFORMANCE & CACHED)
// [DIPERBAIKI]: 
// - Mendukung forceRefresh untuk langsung membaca sheet terbaru
// - Penanganan nomor kontak transporter anti-eksponensial
// ====================================================================
function getMasterDataKlaim(forceRefresh) {
  const CACHE_KEY = 'MDC_MASTER_DATA_KLAIM';
  const cache = CacheService.getScriptCache();

  // 1. Cek Cache Server GAS (Jika ada dan tidak dipaksa refresh, kembalikan instan)
  if (!forceRefresh) {
    try {
      const cached = cache.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (_) {
      // Jika cache corrupt, lanjutkan pembacaan langsung dari sheet
    }
  }

  try {
    const ss = getSpreadsheet();
    
    // Helper pembacaan sheet dengan toleransi spasi/underscore
    const readSheet = (sheetName) => {
      const sheet = ss.getSheetByName(sheetName) || 
                    ss.getSheetByName(sheetName.replace(/_/g, ' '));
      if (!sheet) return [];
      const values = sheet.getDataRange().getValues();
      return values.length > 1 ? values.slice(1) : [];
    };

    // 2. Master Transporter: [1] Transporter, [2] Nopol, [6] Kontak Pengurus
    const rawTransporter = readSheet('Master_Transporter');
    const seenNopol = new Set();
    const transporterList = [];
    
    for (let i = 0; i < rawTransporter.length; i++) {
      const r = rawTransporter[i];
      const nopol = (r[2] || '').toString().replace(/['"\s]/g, '').trim().toUpperCase();
      const kontak = cleanPhoneNumberFromCell(r[6]);

      if (nopol && !seenNopol.has(nopol)) {
        seenNopol.add(nopol);
        transporterList.push({
          transporter: (r[1] || '').toString().trim(),
          nopol: (r[2] || '').toString().trim().toUpperCase(),
          kontak: kontak
        });
      }
    }

    // 3. Master Motor: [0] Jenis Motor, [1] Tipe Motor, [2] Warna, [3] Nama Warna
    const rawMotor = readSheet('Master_Motor');
    const seenMotor = new Set();
    const motorList = [];

    for (let i = 0; i < rawMotor.length; i++) {
      const r = rawMotor[i];
      const jenis = (r[0] || '').toString().trim();
      const tipe = (r[1] || '').toString().trim();
      const warna = (r[2] || '').toString().trim().toUpperCase();
      const key = `${tipe.toUpperCase()}|${warna}`;
      
      if (tipe && !seenMotor.has(key)) {
        seenMotor.add(key);
        motorList.push({
          jenisMotor: jenis,
          tipe: tipe,
          warna: warna,
          namaWarna: (r[3] || '').toString().trim()
        });
      }
    }

    // 4. Master Part: [0] Tipe Motor, [1] Nama Part
    const rawPart = readSheet('Master_Part');
    const seenPart = new Set();
    const partList = [];

    for (let i = 0; i < rawPart.length; i++) {
      const r = rawPart[i];
      const tipe = (r[0] || '').toString().trim().toUpperCase();
      const namaPart = (r[1] || '').toString().trim();
      const key = `${tipe}|${namaPart.toUpperCase()}`;

      if (namaPart && !seenPart.has(key)) {
        seenPart.add(key);
        partList.push({
          tipe: tipe,
          namaPart: namaPart
        });
      }
    }

    // 5. Master Kerusakan & Penyebab (Deduplikasi Set)
    const rawKerusakan = readSheet('Master_Kerusakan');
    const kerusakanList = [...new Set(
      rawKerusakan.map(r => (r[0] || '').toString().trim()).filter(Boolean)
    )];

    const rawPenyebab = readSheet('Master_Penyebab');
    const penyebabList = [...new Set(
      rawPenyebab.map(r => (r[0] || '').toString().trim()).filter(Boolean)
    )];

    const result = {
      success: true,
      transporterList: transporterList,
      motorList: motorList,
      partList: partList,
      kerusakanList: kerusakanList,
      penyebabList: penyebabList
    };

    // 6. Simpan hasil ke Cache Google Apps Script selama 6 jam (21600 detik)
    try {
      const payloadString = JSON.stringify(result);
      if (payloadString.length < 95000) {
        cache.put(CACHE_KEY, payloadString, 21600);
      }
    } catch (_) {}

    return result;

  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * FUNGSI PEMBERSIH CACHE: Jalankan fungsi ini jika Anda mengubah data di sheet Master
 */
function clearMasterDataCache() {
  CacheService.getScriptCache().remove('MDC_MASTER_DATA_KLAIM');
}

// ====================================================================
// SIMPAN PENGAJUAN KLAIM: SELESAIKAN DRIVE DAHULU, BARU LOCK SPREADSHEET
// ====================================================================
function simpanPengajuanKlaim(payload) {
  if (!payload || !payload.step1 || !payload.motors) {
    return { success: false, message: 'Payload data tidak lengkap.' };
  }

  // TAHAP 1: Unggah Foto ke Drive DILUAR LockService (Agar lock tidak macet)
  let idKlaim = payload.idKlaim || ('CLM-' + new Date().getTime());
  const preparedDetailRows = [];

  // Unggah Foto Sopir PJ ke Drive (MDC_Foto_Part_Klaim)
  let fotoSopirPJUrl = '';
  if (payload.step1 && payload.step1.fotoSopirPJ) {
    if (payload.step1.fotoSopirPJ.toString().startsWith('http')) {
      fotoSopirPJUrl = payload.step1.fotoSopirPJ;
    } else if (payload.step1.fotoSopirPJ.toString().includes('base64,')) {
      fotoSopirPJUrl = simpanFotoSopirPJDrive(payload.step1.fotoSopirPJ, idKlaim);
    }
  }

  payload.motors.forEach((motor, mIdx) => {
    motor.parts.forEach((part, pIdx) => {
      const idDetail = idKlaim + '-D' + (mIdx + 1) + '-' + (pIdx + 1) + '-' + Math.floor(Math.random() * 1000);
      let fotoUrl = '';

      if (part.fotoPart) {
        if (part.fotoPart.toString().startsWith('http')) {
          fotoUrl = part.fotoPart;
        } else if (part.fotoPart.toString().includes('base64,')) {
          fotoUrl = simpanFotoPartDrive(part.fotoPart, idKlaim, (mIdx + 1) + '_' + (pIdx + 1));
        }
      }

      preparedDetailRows.push([
        idDetail,
        idKlaim,
        mIdx + 1,
        (motor.tipeMotor || '').toString().toUpperCase(),
        (motor.warna || '').toString().toUpperCase(),
        "'" + (motor.noMesin || '').toString().toUpperCase(),
        "'" + (motor.noRangka || '').toString().toUpperCase(),
        part.namaPart || '',
        part.jenisKerusakan || '',
        part.penyebab || '',
        fotoUrl
      ]);
    });
  });

  // TAHAP 2: Kunci Spreadsheet & Lakukan Batch Insert Cepat
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { success: false, message: 'Lalu lintas sistem padat, data Anda belum tersimpan. Silakan coba lagi.' };
  }

  try {
    const ss = getSpreadsheet();
    const headerSheet = ss.getSheetByName('Klaim_Header');
    const detailSheet = ss.getSheetByName('Klaim_Detail');

    if (!headerSheet || !detailSheet) {
      return { success: false, message: 'Struktur sheet Klaim_Header atau Klaim_Detail belum dibuat.' };
    }

    let isUpdate = false;
    let headerRowIndex = -1;
    const hData = headerSheet.getDataRange().getValues();

    if (payload.idKlaim) {
      for (let i = 1; i < hData.length; i++) {
        if (hData[i][0] && hData[i][0].toString().trim() === idKlaim.toString().trim()) {
          isUpdate = true;
          headerRowIndex = i + 1;
          break;
        }
      }
    }

    const now = new Date();
    let draftDeadline = '';
    if (payload.status === 'Draft') {
      const deadlineDate = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      draftDeadline = Utilities.formatDate(deadlineDate, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    }

    const cleanKode = (payload.user && payload.user.kodeAhm) ? cleanKodeAhm(payload.user.kodeAhm) : '';

    // Siapkan baris header konsisten 30 kolom (A s/d AD)
    const rowData = [
      idKlaim,                                      // 0: ID_KLAIM (A)
      now,                                          // 1: TIMESTAMP (B)
      payload.status,                               // 2: STATUS (C)
      "'" + payload.step1.noSj,                     // 3: NO_SJ (D)
      payload.step1.tglDo,                          // 4: TGL_DO (E)
      payload.step1.tglPemeriksaan,                 // 5: TGL_PERIKSA (F)
      cleanKode,                                    // 6: KODE_AHM (G)
      (payload.user.namaDealer || ''),              // 7: NAMA_DEALER (H)
      (payload.step1.namaSopirPJ || '').toUpperCase(), // 8: SOPIR_PJ (I)
      (payload.step1.nopolPJ || '').toUpperCase(),     // 9: NOPOL_PJ (J)
      payload.step1.transporterPJ || '',            // 10: TRANSPORTER_PJ (K)
      payload.step1.parafSopir || '',               // 11: PARAF_SOPIR (L)
      payload.step3.metode || 'LANGSUNG',           // 12: METODE_KEMBALI (M)
      (payload.step3.namaSopirKembali || '').toUpperCase(), // 13: SOPIR_KEMBALI (N)
      (payload.step3.nopolKembali || '').toUpperCase(),     // 14: NOPOL_KEMBALI (O)
      payload.step3.transporterKembali || '',       // 15: TRANSPORTER_KEMBALI (P)
      payload.step3.parafUser || '',                // 16: PARAF_USER (Q)
      draftDeadline,                                // 17: DRAFT_DEADLINE (R)
      '', '', '', '', '', '', '', '', '',           // 18-26: Operasional MD & Tgl Selesai (S-AA)
      '', '',                                       // 27-28: Komentar SLA & Is Urgent (AB-AC)
      fotoSopirPJUrl                                // 29: FOTO_SOPIR_PJ (AD / Kolom ke-30)
    ];

    if (isUpdate) {
      // Pertahankan nilai kolom operasional MD sebelumnya (18 s/d 28)
      const existing = headerSheet.getRange(headerRowIndex, 1, 1, 30).getValues()[0];
      for (let c = 18; c <= 28; c++) {
        rowData[c] = existing[c] !== undefined ? existing[c] : '';
      }
      // Pertahankan URL foto lama jika saat edit draft tidak mengambil foto baru
      if (!fotoSopirPJUrl && existing[29]) {
        rowData[29] = existing[29];
      }
      headerSheet.getRange(headerRowIndex, 1, 1, 30).setValues([rowData]);

      // Hapus detail part lama sekaligus
      const dData = detailSheet.getDataRange().getValues();
      for (let i = dData.length - 1; i >= 1; i--) {
        if ((dData[i][1] || '').toString().trim() === idKlaim.toString().trim()) {
          detailSheet.deleteRow(i + 1);
        }
      }
    } else {
      headerSheet.appendRow(rowData);
    }

    // BATCH INSERT KE SHEET DETAIL (Jauh lebih cepat dibandingkan appendRow dalam loop)
    if (preparedDetailRows.length > 0) {
      const nextRow = detailSheet.getLastRow() + 1;
      detailSheet.getRange(nextRow, 1, preparedDetailRows.length, preparedDetailRows[0].length)
        .setValues(preparedDetailRows);
    }

    SpreadsheetApp.flush();
    triggerDataMutation(); // Trigger notifikasi refresh ke seluruh client
    return { success: true, idKlaim: idKlaim, status: payload.status };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ====================================================================
// FUNGSI SIMPAN FOTO PART KE GOOGLE DRIVE (AMAN DARI CRASH SHARING)
// ====================================================================
function simpanFotoPartDrive(base64Data, idKlaim, idx) {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.includes('base64,')) {
    return '';
  }

  try {
    const parts = base64Data.split('base64,');
    const contentType = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const decoded = Utilities.base64Decode(parts[1]);
    const fileName = idKlaim + '_part' + idx + '.jpg';
    const blob = Utilities.newBlob(decoded, contentType, fileName);

    const folderName = "MDC_Foto_Part_Klaim";
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (errShare) {
      Logger.log("Domain membatasi ANYONE_WITH_LINK: " + errShare.toString());
    }

    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (e) {
    Logger.log("Gagal simpan foto part: " + e.toString());
    return '';
  }
}

// ====================================================================
// FUNGSI SIMPAN FOTO BUKTI SOPIR PJ KE GOOGLE DRIVE
// ====================================================================
function simpanFotoSopirPJDrive(base64Data, idKlaim) {
  if (!base64Data || typeof base64Data !== 'string' || !base64Data.includes('base64,')) {
    return '';
  }

  try {
    const parts = base64Data.split('base64,');
    const contentType = (parts[0].match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const decoded = Utilities.base64Decode(parts[1]);
    const fileName = idKlaim + '_sopirPJ.jpg';
    const blob = Utilities.newBlob(decoded, contentType, fileName);

    const folderName = "MDC_Foto_Part_Klaim";
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (errShare) {
      Logger.log("Domain membatasi ANYONE_WITH_LINK: " + errShare.toString());
    }

    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (e) {
    Logger.log("Gagal simpan foto sopir PJ: " + e.toString());
    return '';
  }
}

// 3. STATISTIK DASHBOARD & DETEKSI SIRINE DRAFT
function getDashboardStats(kodeAhm) {
  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Klaim_Header');
    if (!sheet) return { draft: 0, kirimMD: 0, prosesMD: 0, kirimDealer: 0, selesai: 0, alertDraft: false };

    const data = sheet.getDataRange().getValues();
    let stats = { draft: 0, kirimMD: 0, prosesMD: 0, kirimDealer: 0, selesai: 0, alertDraft: false };
    const now = new Date();
    const targetAhm = cleanKodeAhm(kodeAhm);

    for (let i = 1; i < data.length; i++) {
      const rowAhm = cleanKodeAhm(data[i][6]);
      const rowDealerAhm = cleanKodeAhm(data[i][7]);

      const matchAhm = targetAhm ? (
        rowAhm === targetAhm || 
        (!isNaN(targetAhm) && !isNaN(rowAhm) && Number(rowAhm) === Number(targetAhm)) ||
        rowDealerAhm === targetAhm
      ) : true;

      if (targetAhm && !matchAhm) continue;

      const status = (data[i][2] || '').toString().trim();
      if (status === 'Draft') {
        stats.draft++;
        const deadlineStr = data[i][17];
        if (deadlineStr) {
          try {
            const deadline = new Date(deadlineStr);
            if (!isNaN(deadline.getTime()) && now > deadline) {
              stats.alertDraft = true;
            }
          } catch (e) {}
        }
      } else if (status === 'Dikirim ke MD') {
        stats.kirimMD++;
      } else if (status === 'Proses di MD') {
        stats.prosesMD++;
      } else if (status === 'Dikirim ke Dealer') {
        stats.kirimDealer++;
      } else if (status === 'Selesai') {
        stats.selesai++;
      }
    }

    return stats;
  } catch (e) {
    return { draft: 0, kirimMD: 0, prosesMD: 0, kirimDealer: 0, selesai: 0, alertDraft: false };
  }
}

// Helper pembersih Kode AHM
function cleanKodeAhm(val) {
  if (val === null || val === undefined) return '';
  return val.toString().replace(/['"`\s]/g, '').trim();
}

// 4. QUERY RECENT CLAIMS & STATUS TRACKING UNTUK DEALER
function getRecentClaims(kodeAhm) {
  try {
    const ss = getSpreadsheet();
    const headerSheet = ss.getSheetByName('Klaim_Header');
    const detailSheet = ss.getSheetByName('Klaim_Detail');
    const transSheet = ss.getSheetByName('Master_Transporter');
    const userWebSheet = getUserWebSheet(ss);
    const userMobSheet = getUserMobileSheet(ss);
    const dealerSheet = ss.getSheetByName('Master_Dealer');

    if (!headerSheet) {
      return JSON.stringify({ success: true, data: [] });
    }

    const headerData = headerSheet.getDataRange().getValues();
    if (headerData.length <= 1) {
      return JSON.stringify({ success: true, data: [] });
    }

    // 1. Lookup Kontak Transporter dari Master_Transporter
    const kontakMap = {};
    if (transSheet) {
      const tData = transSheet.getDataRange().getValues();
      for (let i = 1; i < tData.length; i++) {
        const nopolRaw = (tData[i][2] || '').toString().trim().toUpperCase().replace(/\s+/g, '');
        const kontak = cleanPhoneNumberFromCell(tData[i][6]);
        if (nopolRaw) kontakMap[nopolRaw] = kontak;
      }
    }

    // 2. Lookup Sentra Distribusi Dealer dari Master_Dealer
    const dealerSentraMap = {};
    if (dealerSheet) {
      const dlData = dealerSheet.getDataRange().getValues();
      for (let i = 1; i < dlData.length; i++) {
        const kAhm = cleanKodeAhm(dlData[i][0]);
        const sentra = (dlData[i][5] || '').toString().trim().toUpperCase();
        if (kAhm) dealerSentraMap[kAhm] = sentra;
      }
    }

    // 3. Lookup Kontak PDI Man dari User_Mobile
    const pdiPhoneMap = {};
    const pdiNamaMap = {};
    if (userMobSheet) {
      const mData = userMobSheet.getDataRange().getValues();
      for (let i = 1; i < mData.length; i++) {
        const kAhm = cleanKodeAhm(mData[i][4]);
        const nama = (mData[i][2] || '').toString().trim().toUpperCase();
        const noHp = (mData[i][3] || '').toString().replace(/^'+/, '').trim();
        if (kAhm) {
          if (noHp) pdiPhoneMap[kAhm] = noHp;
          if (nama) pdiNamaMap[kAhm] = nama;
        }
      }
    }

    // 4. Lookup Kontak MD (Repairman & Kepala Gudang) dari User_Web
    const kontakMdMap = {};
    if (userWebSheet) {
      const wData = userWebSheet.getDataRange().getValues();
      for (let w = 1; w < wData.length; w++) {
        const noHp = (wData[w][4] || '').toString().replace(/^'+/, '').trim();
        const sentra = (wData[w][5] || '').toString().trim().toUpperCase();
        const role = (wData[w][6] || '').toString().trim();

        if (role && noHp) {
          if (sentra) {
            kontakMdMap[sentra + '_' + role] = noHp;
          }
          if (!kontakMdMap[role]) {
            kontakMdMap[role] = noHp;
          }
        }
      }
    }

    // 5. Lookup Rincian Motor & Part
    const detailMap = {};
    if (detailSheet) {
      const dData = detailSheet.getDataRange().getValues();
      for (let i = 1; i < dData.length; i++) {
        const idKlaim = (dData[i][1] || '').toString().trim();
        if (!idKlaim) continue;
        if (!detailMap[idKlaim]) detailMap[idKlaim] = [];
        detailMap[idKlaim].push({
          indexMotor: Number(dData[i][2]) || 1,
          tipe: (dData[i][3] || '').toString().trim(),
          warna: (dData[i][4] || '').toString().trim(),
          noMesin: (dData[i][5] || '').toString().replace(/^'+/, '').trim(),
          noRangka: (dData[i][6] || '').toString().replace(/^'+/, '').trim(),
          namaPart: (dData[i][7] || '').toString().trim(),
          kerusakan: (dData[i][8] || '').toString().trim(),
          penyebab: (dData[i][9] || '').toString().trim(),
          fotoPart: (dData[i][10] || '').toString().trim()
        });
      }
    }

    const claims = [];
    const targetAhm = cleanKodeAhm(kodeAhm);

    for (let i = headerData.length - 1; i >= 1; i--) {
      const row = headerData[i];
      if (!row[0]) continue;

      const rowAhm = cleanKodeAhm(row[6]);
      const rowDealerAhm = cleanKodeAhm(row[7]);

      const matchAhm = targetAhm ? (
        rowAhm === targetAhm || 
        (!isNaN(targetAhm) && !isNaN(rowAhm) && Number(rowAhm) === Number(targetAhm)) ||
        rowDealerAhm === targetAhm
      ) : true;

      if (targetAhm && !matchAhm) continue;

      const tglFormatted = fastFormatDateGAS(row[1], true);
      const tglDoFormatted = fastFormatDateGAS(row[4], false);
      const tglPeriksaFormatted = fastFormatDateGAS(row[5], false);
      const deadlineFormatted = fastFormatDateGAS(row[17], true);

      const idKlaim = (row[0] || '').toString().trim();
      const nopolPJ = (row[9] || '').toString().trim().toUpperCase();
      const nopolKembali = (row[14] || '').toString().trim().toUpperCase();

      const rawTime = row[1] ? (row[1] instanceof Date ? row[1].getTime() : new Date(row[1]).getTime()) : 0;
      const tglSelesaiStr = fastFormatDateGAS(row[26], true);

      const sentraDealer = dealerSentraMap[rowAhm] || '';
      const noHpPdi = pdiPhoneMap[rowAhm] || '';
      const kontakRepairman = kontakMdMap[sentraDealer + '_Repairman'] || kontakMdMap['Repairman'] || '';
      const kontakKaGudang = kontakMdMap[sentraDealer + '_Kepala Gudang'] || kontakMdMap['Kepala Gudang'] || '';

      let tglTerimaStr = '';
      const rawStatusTerima = (row[18] || '').toString();
      const matchDate = rawStatusTerima.match(/\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2})?/);
      if (matchDate) {
        tglTerimaStr = matchDate[0];
      }

      const nopolPJClean = nopolPJ.replace(/\s+/g, '');
      const nopolKembaliClean = nopolKembali.replace(/\s+/g, '');

      claims.push({
        idKlaim: idKlaim,
        rawTimestamp: isNaN(rawTime) ? 0 : rawTime,
        rawDate: row[1] ? row[1].toString() : '',
        tgl: tglFormatted,
        tglSelesai: tglSelesaiStr,
        status: (row[2] || 'Draft').toString().trim(),
        noSj: (row[3] || '').toString().replace(/^'+/, '').trim(),
        tglDo: tglDoFormatted,
        tglPeriksa: tglPeriksaFormatted,
        kodeAhm: rowAhm,
        namaDealer: (row[7] || '').toString().trim(),
        namaPemeriksa: pdiNamaMap[rowAhm] || '',
        sopirPJ: (row[8] || '').toString().trim(),
        nopolPJ: nopolPJ,
        transporterPJ: (row[10] || '').toString().trim(),
        parafSopirPJ: (row[11] || '').toString(),
        fotoSopirPJ: (row[29] || '').toString().trim(), // Ambil dari Kolom AD (Index 29)
        metodeKembali: (row[12] || 'LANGSUNG').toString().trim(),
        sopirKembali: (row[13] || '').toString().trim(),
        nopolKembali: nopolKembali,
        transporterKembali: (row[15] || '').toString().trim(),
        parafUser: (row[16] || '').toString(),
        draftDeadline: deadlineFormatted,
        kontakPengurusPJ: (kontakMap[nopolPJClean] || '').toString(),
        kontakPengurusKembali: (kontakMap[nopolKembaliClean] || '').toString(),
        kontakRepairman: kontakRepairman,
        kontakKaGudang: kontakKaGudang,
        noHpPdi: noHpPdi,

        mdStatusPenerimaan: rawStatusTerima,
        tglTerimaMD: tglTerimaStr,
        mdJenisPerbaikan: (row[19] || '').toString(),
        mdTargetSelesai: (row[20] || '').toString(),
        mdApprovalKaGudang: (row[21] || '').toString(),
        mdValidasiRepairman: (row[22] || '').toString(),
        mdSopirBalik: (row[23] || '').toString().trim(),
        mdNopolBalik: (row[24] || '').toString().trim().toUpperCase(),
        mdTransporterBalik: (row[25] || '').toString().trim().toUpperCase(),
        isUrgent: (row[28] || '').toString() === 'URGENT',
        items: detailMap[idKlaim] || []
      });
    }

    return JSON.stringify({ success: true, data: claims });
  } catch (err) {
    return JSON.stringify({ success: false, message: err.toString() });
  }
}

// D. Dealer: Update Penerimaan Menjadi Selesai
function dealerKonfirmasiSelesai(idKlaim) {
  return updateKlaimHeaderRow(idKlaim, (row) => {
    row[2] = 'Selesai';
    row[26] = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm");
  });
}

// E. Dealer: Update Penerimaan Menjadi Retur ke MD
function dealerKonfirmasiRetur(idKlaim, alasan) {
  return updateKlaimHeaderRow(idKlaim, (row) => {
    row[2] = 'Proses di MD';
    row[23] = 'Retur: ' + (alasan || 'Pengembalian oleh dealer');
  });
}

// ====================================================================
// SINKRONISASI VERSI DATA REAL-TIME (LIGHTWEIGHT HEARTBEAT)
// ====================================================================
function triggerDataMutation() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('LAST_DATA_VERSION', new Date().getTime().toString());
}

function checkDataVersion(clientVersion) {
  const props = PropertiesService.getScriptProperties();
  const serverVersion = props.getProperty('LAST_DATA_VERSION') || '0';
  return {
    isOutdated: serverVersion.toString() !== (clientVersion || '').toString(),
    serverVersion: serverVersion
  };
}

// ====================================================================
// UPDATE HEADER KLAIM SECARA ATOMIK & AMAN DARI RACE CONDITION
// ====================================================================
function updateKlaimHeaderRow(idKlaim, callback) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(12000);
  } catch (e) {
    return { success: false, message: 'Server sibuk memproses transaksi lain. Coba sesaat lagi.' };
  }

  try {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName('Klaim_Header');
    if (!sheet) return { success: false, message: 'Sheet Klaim_Header tidak ditemukan.' };

    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim() === idKlaim.toString().trim()) {
        callback(data[i]);
        sheet.getRange(i + 1, 1, 1, data[i].length).setValues([data[i]]);
        SpreadsheetApp.flush();
        triggerDataMutation();
        return { success: true };
      }
    }
    return { success: false, message: 'ID Klaim tidak ditemukan.' };
  } catch (err) {
    return { success: false, message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// Fungsi Pembuka Akses Google Drive
function testDriveAuth() {
  DriveApp.getRootFolder();
  Logger.log("DriveApp berhasil diotorisasi!");
}

// Helper pembaca sheet Web (prioritas Users_Web, fallback User_Web)
function getUserWebSheet(ss) {
  return ss.getSheetByName('Users_Web') || ss.getSheetByName('User_Web');
}

// Helper pembaca sheet Mobile (prioritas Users_Mobile, fallback User_Mobile)
function getUserMobileSheet(ss) {
  return ss.getSheetByName('Users_Mobile') || ss.getSheetByName('User_Mobile');
}

// ====================================================================
// SERVER-SIDE SESSION TOKEN (ANTI-CONSOLE SPOOFING)
// ====================================================================
function createServerSession(username, role) {
  const token = Utilities.getUuid();
  const sessionData = {
    username: username,
    role: (role || '').toString().toLowerCase(),
    createdAt: new Date().getTime()
  };
  CacheService.getScriptCache().put('MDC_SESS_' + token, JSON.stringify(sessionData), 21600);
  return token;
}

function verifyAdminToken(sessionObj) {
  if (!sessionObj) return false;
  
  if (typeof sessionObj === 'object') {
    const role = (sessionObj.role || '').toString().toLowerCase();
    if (role === 'admin') return true;
    if (sessionObj.authToken) {
      const rawCache = CacheService.getScriptCache().get('MDC_SESS_' + sessionObj.authToken);
      if (rawCache) {
        try {
          const verified = JSON.parse(rawCache);
          return (verified.role === 'admin');
        } catch (e) {}
      }
    }
  }

  if (typeof sessionObj === 'string') {
    try {
      const rawCache = CacheService.getScriptCache().get('MDC_SESS_' + sessionObj);
      if (rawCache) {
        const verified = JSON.parse(rawCache);
        return (verified.role === 'admin');
      }
      const decoded = Utilities.newBlob(Utilities.base64Decode(sessionObj)).getDataAsString();
      const parts = decoded.split('|');
      if (parts.length >= 2 && parts[1].toLowerCase() === 'admin') {
        return true;
      }
    } catch (e) {}
  }

  return false;
}

// ====================================================================
// SIMPAN & BUAT LINK DOWNLOAD PDF LKUAT (KHUSUS APK & MOBILE WEB)
// ====================================================================
function simpanPdfLkuatDrive(base64Data, fileName) {
  try {
    if (!base64Data) return { success: false, message: 'Data PDF kosong' };

    const parts = base64Data.split('base64,');
    const decoded = Utilities.base64Decode(parts[1] || parts[0]);
    const blob = Utilities.newBlob(decoded, 'application/pdf', fileName);

    const folderName = "MDC_LKUAT_PDF";
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const file = folder.createFile(blob);

    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (errShare) {
      Logger.log("Domain membatasi ANYONE_WITH_LINK: " + errShare.toString());
    }

    const downloadUrl = "https://drive.google.com/uc?export=download&id=" + file.getId();
    const previewUrl = "https://drive.google.com/file/d/" + file.getId() + "/view";

    return { 
      success: true, 
      downloadUrl: downloadUrl,
      previewUrl: previewUrl,
      fileId: file.getId()
    };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

// ====================================================================
// NATIVE V8 ULTRA-FAST DATE ENGINE (MOBILE & DESKTOP)
// ====================================================================
function fastFormatDateGAS(val, withTime) {
  if (!val || val === '-') return '-';
  let d = val;
  if (!(d instanceof Date)) {
    let s = d.toString().trim();
    if (!s) return '-';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) s = s.replace(' ', 'T');
    d = new Date(s);
    if (isNaN(d.getTime())) return d.toString();
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (!withTime) return y + '-' + m + '-' + day;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
}

function getMasterKerusakanDanPenyebab() {
  const ss = getSpreadsheet();
  
  const sheetKerusakan = ss.getSheetByName('Master_Kerusakan');
  const listKerusakan = sheetKerusakan 
    ? [...new Set(sheetKerusakan.getDataRange().getValues().slice(1).map(r => String(r[0] || '').trim()).filter(Boolean))]
    : [];

  const sheetPenyebab = ss.getSheetByName('Master_Penyebab') || ss.getSheetByName('Master_ Penyebab');
  const listPenyebab = sheetPenyebab
    ? [...new Set(sheetPenyebab.getDataRange().getValues().slice(1).map(r => String(r[0] || '').trim()).filter(Boolean))]
    : [];

  return {
    kerusakan: listKerusakan,
    penyebab: listPenyebab
  };
}
