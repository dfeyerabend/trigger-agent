import { z } from "zod";
import OpenAI from "openai";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { appendFile } from "fs/promises";

// ============================================
// TEIL 1: AI Setup
// ============================================

const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
const apiKey = process.env.OPENAI_API_KEY!;

const openai = new OpenAI({
    apiKey: apiKey,
});

console.log("🔷 Provider: OpenAI");
console.log(`   Model: ${modelName}`);

// ============================================
// Trigger Schema
// ============================================

const TriggerSchema = z.object({
    source: z.enum(["api", "websocket"]), //Source muss "api" oder "websocket" sein
    payload: z.object({
        task: z.string().min(1) //Task muss ein String mit mindestens 1 Zeichen sein
    }),
    metadata: z.object({
        traceId: z.string().default(() => crypto.randomUUID()) //Wenn traceId fehlt → generiere automatisch eine UUID.
    }).default({}) //Wenn metadata komplett fehlt → benutze {}
});

// ============================================
// Stats Tracking
// ============================================

const stats = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalDurationMs: 0,
    startTime: new Date()
};

// Helper function for logging results
async function logRequest(entry: Record<string, unknown>) {
    try { await appendFile("requests.log", JSON.stringify(entry) + "\n"); } catch {} // Prevents logging errors from crashing the app
}

// ============================================
// Unified Trigger Handler
// ============================================

class UnifiedTriggerHandler {
    async handle(rawTrigger: unknown) {
        const start = Date.now();
        stats.totalRequests++;

        // Validate Trigger schema
        let trigger;
        try {
            trigger = TriggerSchema.parse(rawTrigger);
        } catch (error) {
            const durationMs = Date.now() - start;
            stats.failedRequests++;

            // Logg error
            await logRequest({
                timestamp: new Date().toISOString(),
                source: "unknown",
                taskPreview: null,
                success: false,
                error: "Invalid trigger format",
                durationMs: durationMs
            });

            return {
                success: false,
                error: "Invalid trigger format",
                durationMs: Date.now() - start
            };
        }

        console.log(`📥 [${trigger.source}] ${trigger.payload.task.slice(0, 50)}...`)

        //LLM aufrufen
        try {
            const completion = await openai.chat.completions.create({
                model: modelName,
                messages: [
                    { role: "system", content: `Du bist ein hilfreicher Agent. Source: ${trigger.source}` },
                    { role: "user", content: trigger.payload.task }
                ]
            });

            const durationMs = Date.now() - start;
            stats.successfulRequests++;
            stats.totalDurationMs += durationMs;

            // Build result object to return and for Log
            const result = {
                success: true,
                result: completion.choices[0]?.message?.content,
                traceId: trigger.metadata.traceId,
                source: trigger.source,
                durationMs: durationMs
            };

            // Create Log
            await logRequest({
                timestamp: new Date().toISOString(),
                source: trigger.source,
                traceId: trigger.metadata.traceId,
                taskPreview: trigger.payload.task.slice(0, 50),
                success: true,
                durationMs: durationMs
            });

            console.log(`✅ Done in ${durationMs}ms`);

            return result;

        } catch (error: any) {
            const durationMs = Date.now() - start;
            stats.failedRequests++;
            stats.totalDurationMs += durationMs;

            // Log for failed request
            await logRequest({
                timestamp: new Date().toISOString(),
                source: trigger.source,
                traceId: trigger.metadata.traceId,
                taskPreview: trigger.payload.task.slice(0, 50),
                success: false,
                error: error?.message ?? "Unknown error",
                durationMs: durationMs
            });

            console.log(`❌ Error: ${error.message}`);
            return {
                success: false,
                error: error.message,
                durationMs: durationMs
            };
        }
    }
}

const handler = new UnifiedTriggerHandler();

// ============================================
// HTTP Server (Express)
// ============================================

const app = express();
app.use(express.json());

const HTTP_PORT = 3333;

// Health-Endpoint -> GET http://localhost:3333/health -> User bekommt Status-Infos über den laufenden Server zurück
app.get("/health", (_, res) => {
    const uptime = Math.floor((Date.now() - stats.startTime.getTime()) / 1000);
    const avgDuration = stats.totalRequests > 0
        ? Math.floor(stats.totalDurationMs / stats.totalRequests)
        : 0;

    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: `${uptime}s`,
        stats: {
            totalRequests: stats.totalRequests,
            successfulRequests: stats.successfulRequests,
            failedRequests: stats.failedRequests,
            averageDurationMs: avgDuration
        }
    });
});

// Agent Endpoint
app.post("/agent", async (req, res) => {
    const result = await handler.handle({
        source: "api",
        payload: req.body,
        metadata: {
            traceId: (req.headers["x-trace-id"] as string) || crypto.randomUUID()
        }
    });
    res.json(result);
});

// Start Server
app.listen(HTTP_PORT, () => {
    console.log(`\n🌐 HTTP Server: http://localhost:${HTTP_PORT}`);
    console.log(`   POST /agent - Send tasks`);
    console.log(`   GET /health - Health check with stats`);
});

// ============================================
// WebSocket Server
// ============================================

const WS_PORT = 8555;

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("connection", (ws:WebSocket) => {
    console.log("🔌 WebSocket connected")

    // Wird aufgerufen bei jeder Nachricht
    ws.on("message", async (data) => {
        try {
            const payload = JSON.parse(data.toString());
            const result = await handler.handle({
                source: "websocket",
                payload,
                metadata: {traceId: `ws-${Date.now()}`}
            });
            ws.send(JSON.stringify(result));
        } catch (error) {
            ws.send(JSON.stringify({
                success: false,
                error: "Invalid JSON"
            }));
        }
    });

    ws.on("close", () => console.log("🔌 WebSocket disconnected"));
});

console.log(`\n⚡ WebSocket Server: ws://localhost:${WS_PORT}`);
console.log(`   Send JSON: {"task": "your question"}`);

// ============================================
// Startup
// ============================================

console.log("\n" + "═".repeat(50));
console.log("🚀 FACTOR #11: TRIGGER FROM ANYWHERE - RUNNING");
console.log("═".repeat(50) + "\n");

