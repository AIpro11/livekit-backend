// agent.ts
import {
  type JobContext,
  ServerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';

import * as google from '@livekit/agents-plugin-google';
import * as aiCoustics from '@livekit/plugins-ai-coustics';

import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Store credentials per room
const roomCredentials = new Map<string, { apiKey: string; apiSecret: string; wsUrl: string }>();

export default defineAgent({
  entry: async (ctx: JobContext) => {
    const roomName = ctx.room.name;
    
    // Try to get credentials from environment or wait for frontend
    let credentials = roomCredentials.get(roomName);
    
    // 🎤 Create session with Gemini Realtime (using LiveKit Inference - no API key needed!)
    const session = new voice.AgentSession({
      llm: new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp", // Using available model
        voice: "Puck",
        apiKey: undefined, // ✅ No API key needed - uses LiveKit Inference
      }),
      turnHandling: {
        interruptions: true, // user can interrupt AI speaking
      },
    });

    // 🚀 Start agent session
    await session.start({
      agent: new MyAgent(),
      room: ctx.room,
      inputOptions: {
        noiseCancellation: aiCoustics.audioEnhancement({
          model: 'quailVfL',
        }),
      },
    });

    // 🔗 Connect to LiveKit room
    await ctx.connect();

    console.log(`✅ Agent connected to room: ${roomName}`);

    // 🎧 Listen for frontend messages (credentials and chat)
    ctx.room.on("dataReceived", async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        
        // Handle credential update from frontend
        if (data.type === 'credentials') {
          roomCredentials.set(roomName, {
            apiKey: data.apiKey,
            apiSecret: data.apiSecret,
            wsUrl: data.wsUrl
          });
          console.log(`🔑 Credentials received for room: ${roomName}`);
          
          // Send confirmation back
          const confirmMsg = JSON.stringify({ type: 'credential_status', status: 'received' });
          await ctx.room.localParticipant.publishData(new TextEncoder().encode(confirmMsg));
          return;
        }
        
        // Handle regular chat message
        if (data.type === 'message' && data.text) {
          console.log(`📩 Message from ${participant?.identity}:`, data.text);
          
          // 🧠 Generate AI response
          const handle = session.generateReply({
            instructions: data.text,
          });
          
          // 🔊 Wait until audio is fully played
          await handle.waitForPlayout();
          console.log("🔊 Reply finished");
        }
        
      } catch (error) {
        console.error("❌ Error handling message:", error);
      }
    });

    // 👋 Auto greet when user joins
    setTimeout(async () => {
      try {
        const greet = session.generateReply({
          instructions: "Greet the user warmly. Say 'Hello! I'm your AI voice assistant. I'm ready to help you with anything you need. How can I assist you today?'",
        });
        await greet.waitForPlayout();
      } catch (error) {
        console.error("Greeting error:", error);
      }
    }, 2000);
  },
});

// Custom Agent class
class MyAgent {
  constructor() {
    console.log("🤖 Agent initialized");
  }
}

// 🧩 Run the agent worker
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'falcon-gpt-agent',
  })
);
