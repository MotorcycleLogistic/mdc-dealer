const DEFAULT_GAS_URL =
  "https://script.google.com/macros/s/AKfycbyPMN2vvUNysv-Tn_2YCfzNcBLHC8FluGF0BwdHt07YrKT4lHMxQqkKjYsPd2DJ2v9ekQ/exec";

export default async function handler(req: any, res: any) {
  // 1. Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed. Use POST." });
  }

  const { action, data } = req.body || {};
  if (!action) {
    return res.status(400).json({ success: false, message: "Parameter 'action' diperlukan." });
  }

  const gasUrl =
    process.env.GAS_WEBAPP_URL || process.env.VITE_GAS_URL || DEFAULT_GAS_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000); // 55 detik timeout

    const gasResponse = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, data }),
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await gasResponse.text();

    // Deteksi jika Google Apps Script mengembalikan halaman HTML error
    if (
      responseText.includes("<!DOCTYPE") ||
      responseText.includes("<!doctype") ||
      responseText.includes("<html")
    ) {
      console.error(`[API /api/gas] GAS mengembalikan respon HTML untuk aksi: ${action}`);
      return res.status(502).json({
        success: false,
        message:
          "Google Apps Script mengembalikan halaman HTML. Pastikan deployment Web App diatur 'Who has access: Anyone' dan 'Execute as: Me'.",
        raw: responseText.slice(0, 300),
      });
    }

    let json: any;
    try {
      json = JSON.parse(responseText);
      if (typeof json === "string") {
        try {
          json = JSON.parse(json);
        } catch (_) {}
      }
    } catch (_parseErr) {
      return res.status(502).json({
        success: false,
        message: "Gagal mem-parsing respon JSON dari Google Apps Script.",
        raw: responseText.slice(0, 300),
      });
    }

    return res.status(200).json(json);
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return res.status(504).json({
        success: false,
        message: `Batas waktu tunggu (timeout) terlampaui saat memproses aksi '${action}' ke Google Apps Script.`,
      });
    }

    console.error(`[API /api/gas] Error:`, error);
    return res.status(500).json({
      success: false,
      message: `Terjadi kendala saat menghubungi Google Apps Script: ${error?.message || error}`,
    });
  }
}
