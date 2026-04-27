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

export default defineAgent({
  entry: async (ctx) => {
    const roomName = ctx.room.name;

    console.log(`🚀 Joining room: ${roomName}`);

    // 🎤 Create AI session
    const session = new voice.AgentSession({
      llm: new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp",
        voice: "Puck",
        temperature: 0.7,
      }),
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

    // 👋 Greeting
    setTimeout(async () => {
      try {
        const greet = session.generateReply({
          instructions: "Hey! I'm your AI voice assistant. How can I help you today?",
        });
        await greet.waitForPlayout();
      } catch (err) {
        console.error("Greeting error:", err);
      }
    }, 2000);

    // 📩 Listen for chat messages
    ctx.room.on("dataReceived", async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "message" && data.text) {
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
  },
});

class MyAgent {
  constructor() {
    console.log("🤖 Agent initialized");
  }
}

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'falcon-gpt-agent',
  })
);
