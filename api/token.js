import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req, res) {
  // Enable CORS for frontend requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, room, apiKey, apiSecret } = req.body;

  // Validate required fields
  if (!name || !room) {
    return res.status(400).json({ error: 'Missing name or room' });
  }

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'Missing LiveKit API Key or Secret' });
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: name,
      ttl: '1h',
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.status(200).json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Failed to generate token: ' + error.message });
  }
}
