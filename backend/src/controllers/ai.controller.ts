import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { ai, setAccessToken } from "swiftbase-admin-sdk";

export function registerAIRoutes(app: FastifyInstance) {
  app.post("/ai/design", async (request: FastifyRequest<{ Body: { prompt: string, currentHtml?: string, currentCss?: string } }>, reply) => {
    try {
      const { prompt, currentHtml = "", currentCss = "" } = request.body;
      if (!prompt) return reply.status(400).send({ message: "Prompt is required" });

      // Check if we can delegate to Swiftbase AI
      const aiKey = process.env.SWIFTBASE_AI_KEY;

      if (aiKey) {
        try {
          // Set access token with a long future expiration timestamp (e.g. 1 hour from now)
          // to prevent decodeExpiration from marking the raw API key token as expired/invalid
          const expirationTime = Date.now() + 3600 * 1000;
          setAccessToken(aiKey, expirationTime);

          const systemPrompt = `You are a web design assistant that outputs valid raw HTML and inline Tailwind CSS code.
You must return ONLY a JSON object with properties 'html' and 'css'.
The user has requested you to create or modify a design.
Here is the current HTML in the editor:
\`\`\`html
${currentHtml}
\`\`\`
Here is the current CSS in the editor:
\`\`\`css
${currentCss}
\`\`\`

Analyze the current HTML and CSS layout. If the user's prompt asks to modify, edit, or adjust the current layout, update the code accordingly. If the prompt asks for a completely new section, generate a new design. Output the full final result in the requested JSON object format.`;

          const data = await ai.chat.completions.create({
            model: "gemma-4",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: prompt
              }
            ]
          });

          const textResponse = data.choices?.[0]?.message?.content || "";
          // Extract JSON from response
          const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return reply.send({
              html: parsed.html,
              css: parsed.css || ""
            });
          }
        } catch (err) {
          app.log.warn(err, "Swiftbase AI completions request failed, using mock layouts");
        }
      }

      // Fallback/Mock layout generation when AI API is unavailable
      const lower = prompt.toLowerCase();
      let html = "";
      let css = "";

      if (lower.includes("hero")) {
        html = `
          <div class="relative bg-slate-950 text-white py-32 px-8 overflow-hidden rounded-3xl shadow-xl border border-white/5">
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,#3b82f6_0,transparent_50%)] opacity-30"></div>
            <div class="relative max-w-4xl mx-auto text-center space-y-6">
              <span class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">New Release</span>
              <h1 class="text-5xl md:text-7xl font-black tracking-tighter leading-none">Designed for Developers. Built for Scale.</h1>
              <p class="text-lg opacity-60 max-w-2xl mx-auto">Create beautiful digital experiences in minutes using the Swiftbase Content Management System.</p>
              <div class="flex gap-4 justify-center pt-4">
                <button onclick="window.trackCMSConversion('hero_click')" class="btn bg-primary text-white font-black px-8 py-3 rounded-2xl shadow-lg hover:bg-opacity-90">Get Started</button>
                <button class="btn btn-ghost text-white border border-white/10 hover:bg-white/5 px-8 py-3 rounded-2xl">Learn More</button>
              </div>
            </div>
          </div>
        `;
      } else if (lower.includes("pricing") || lower.includes("store")) {
        html = `
          <div class="py-20 px-8 max-w-6xl mx-auto text-center">
            <h2 class="text-4xl font-black mb-12 tracking-tighter">Choose Your Plan</h2>
            <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div class="border border-base-200 bg-white rounded-3xl p-8 flex flex-col justify-between shadow-xl">
                <div>
                  <h3 class="text-xl font-bold mb-2">Starter</h3>
                  <div class="text-4xl font-black mb-4">$0 <span class="text-sm opacity-50 font-normal">/mo</span></div>
                  <p class="text-sm opacity-60 mb-6">Perfect for small personal site tests.</p>
                </div>
                <button class="w-full bg-slate-950 text-white font-bold py-3 rounded-2xl">Select Starter</button>
              </div>
              <div class="border-2 border-primary bg-white rounded-3xl p-8 flex flex-col justify-between shadow-2xl relative">
                <span class="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 bg-primary text-white font-black text-[9px] uppercase px-3 py-1 rounded-full">Popular</span>
                <div>
                  <h3 class="text-xl font-bold mb-2">Professional</h3>
                  <div class="text-4xl font-black mb-4">$29 <span class="text-sm opacity-50 font-normal">/mo</span></div>
                  <p class="text-sm opacity-60 mb-6">Best for active websites and growing startups.</p>
                </div>
                <button class="w-full bg-primary text-white font-bold py-3 rounded-2xl shadow-lg">Upgrade Now</button>
              </div>
            </div>
          </div>
        `;
      } else {
        html = `
          <div class="py-16 px-8 max-w-4xl mx-auto">
            <h2 class="text-3xl font-black mb-4">${prompt}</h2>
            <p class="opacity-75 leading-relaxed">Generated layout mockup for prompt: "${prompt}". You can fully customize this block inside GrapesJS.</p>
          </div>
        `;
      }

      return reply.send({ html, css });
    } catch (err: any) {
      return reply.status(500).send({ message: err.message });
    }
  });
}
