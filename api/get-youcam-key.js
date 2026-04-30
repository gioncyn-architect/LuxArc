export default async function handler(req, res) {
  const apiKey = process.env.YOUCAM_API_KEY;
  const apiSecret = process.env.YOUCAM_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: "API keys not configured" });
  }

  return res.status(200).json({ apiKey, apiSecret });
}
