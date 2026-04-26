import { AccessToken } from 'livekit-server-sdk';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get credentials from frontend request body
  const { name, room, apiKey, apiSecret, wsUrl } = req.body;

  // Validate required fields
  if (!name || !room) {
    return res.status(400).json({ error: 'Missing name or room' });
  }

  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: 'Missing LiveKit API Key or Secret' });
  }

  if (!wsUrl) {
    return res.status(400).json({ error: 'Missing WebSocket URL' });
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

    // Return both token and the wsUrl for connection
    return res.status(200).json({ 
      token,
      wsUrl 
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return res.status(500).json({ error: 'Failed to generate token: ' + error.message });
  }
}
