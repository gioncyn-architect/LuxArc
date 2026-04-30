// netlify/functions/get-youcam-key.js
exports.handler = async function(event, context) {
  const apiKey    = process.env.YOUCAM_API_KEY;
  const apiSecret = process.env.YOUCAM_API_SECRET;

  if (!apiKey || !apiSecret) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API keys belum dikonfigurasi di Netlify." })
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({ apiKey, apiSecret })
  };
};
