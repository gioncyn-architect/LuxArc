// netlify/functions/get-youcam-key.js
// File ini berjalan di server Netlify, API key TIDAK pernah terekspos ke browser

exports.handler = async function(event, context) {
  // Ambil environment variable dari Netlify Dashboard
  const apiKey    = process.env.YOUCAM_API_KEY;
  const apiSecret = process.env.YOUCAM_API_SECRET;

  // Validasi: pastikan env var sudah di-set di Netlify
  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "API keys belum dikonfigurasi di Netlify Environment Variables." 
      })
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      // Hanya izinkan request dari domain sendiri
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      apiKey:    apiKey,
      apiSecret: apiSecret
    })
  };
};
