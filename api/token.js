
import {
  defineAgent,
  cli,
  voice,
  ServerOptions,
} from '@livekit/agents';

import * as google from '@livekit/agents-plugin-google';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

// Store credentials per room
const roomCredentials = new Map();

// 🚀 Define agent
export default defineAgent({
  entry: async (ctx) => {
    const roomName = ctx.room.name;

    console.log(`🚀 Joining room: ${roomName}`);

    // Wait for credentials from frontend before initializing LLM
    let credentials = null;
    let llmInstance = null;
    let session = null;

    // Function to initialize LLM with credentials
    function initLLM(apiKey, apiSecret, wsUrl) {
      console.log(`🔑 Initializing LLM with provided credentials for room: ${roomName}`);
      
      // For Google Gemini - uses LiveKit Inference, no API key needed in agent
      // The credentials are used for token generation on the frontend side
      // The agent itself just needs to know it's connected
      return new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp",
        voice: "Puck",
        apiKey: undefined, // Uses LiveKit Inference automatically
        temperature: 0.7,
      });
    }

    // Listen for credential updates from frontend
    ctx.room.on("dataReceived", async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // Handle credential update from frontend
        if (data.type === 'credentials') {
          console.log(`🔑 Received credentials from ${participant?.identity} for room: ${roomName}`);
          
          credentials = {
            apiKey: data.apiKey,
            apiSecret: data.apiSecret,
            wsUrl: data.wsUrl
          };
          
          roomCredentials.set(roomName, credentials);
          
          // Send confirmation back to frontend
          const confirmMsg = JSON.stringify({ 
            type: 'credential_status', 
            status: 'received',
            message: 'Credentials received successfully'
          });
          await ctx.room.localParticipant.publishData(new TextEncoder().encode(confirmMsg));
          
          // If session exists, recreate it with new credentials
          if (session) {
            console.log(`🔄 Recreating session with new credentials...`);
            // Recreate session
            const newLLM = initLLM(credentials.apiKey, credentials.apiSecret, credentials.wsUrl);
            const newSession = new voice.AgentSession({
              llm: newLLM,
              turnHandling: { interruptions: true },
            });
            
            await newSession.start({
              agent: new MyAgent(),
              room: ctx.room,
            });
            
            session = newSession;
            console.log(`✅ Session recreated with credentials`);
          }
          return;
        }
        
        // Handle regular chat message
        if (data.type === 'message' && data.text && session) {
          console.log(`📩 ${participant?.identity}: ${data.text}`);
          
          const handle = session.generateReply({
            instructions: data.text,
          });
          
          await handle.waitForPlayout();
        }
        
      } catch (err) {
        console.error("❌ Message error:", err);
      }
    });

    // Wait a moment for credentials to arrive from frontend
    console.log(`⏳ Waiting for credentials from frontend...`);
    
    // Set timeout to wait for credentials (max 10 seconds)
    const waitForCredentials = new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (roomCredentials.has(roomName)) {
          clearInterval(checkInterval);
          resolve(roomCredentials.get(roomName));
        }
      }, 500);
      
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, 10000);
    });
    
    const receivedCreds = await waitForCredentials;
    
    if (receivedCreds) {
      console.log(`✅ Credentials received, initializing LLM...`);
      llmInstance = initLLM(receivedCreds.apiKey, receivedCreds.apiSecret, receivedCreds.wsUrl);
    } else {
      console.log(`⚠️ No credentials received, using default configuration...`);
      llmInstance = new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp",
        voice: "Puck",
        apiKey: undefined,
        temperature: 0.7,
      });
    }
    
    // 🎤 Create AI session
    session = new voice.AgentSession({
      llm: llmInstance,
      turnHandling: {
        interruptions: true,
      },
    });

    // 🔗 Start session
    await session.start({
      agent: new MyAgent(),
      room: ctx.room,
    });

    // 🔌 Connect to room
    await ctx.connect();

    console.log(`✅ Agent connected to room: ${roomName}`);

    // 👋 Auto greeting
    setTimeout(async () => {
      try {
        if (session) {
          const greet = session.generateReply({
            instructions: "Hey! I'm your AI voice assistant. How can I help you today?",
          });
          await greet.waitForPlayout();
        }
      } catch (err) {
        console.error("Greeting error:", err);
      }
    }, 2000);
  },
});

// 🤖 Agent class
class MyAgent {
  constructor() {
    console.log("🤖 Agent initialized");
  }
}

// 🧩 Run agent
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'falcon-gpt-agent',
  })
);
