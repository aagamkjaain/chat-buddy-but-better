/**
 * Quick test script for xAI Grok API
 * Run with: npx ts-node test-xai-api.ts
 */

const API_KEY = process.env.XAI_API_KEY || "xai-YOUR-API-KEY-HERE";
const BASE_URL = "https://api.x.ai/v1";
const MODEL = "grok-3";

async function testGrokAPI() {
  const url = `${BASE_URL}/chat/completions`;
  
  const payload = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content: "Say hello in exactly 3 words",
      },
    ],
    temperature: 0.7,
    max_tokens: 100,
  };

  console.log("🧪 Testing xAI Grok API...");
  console.log(`URL: ${url}`);
  console.log(`Model: ${MODEL}`);
  console.log(`Key: ${API_KEY.substring(0, 15)}...`);
  console.log(`Payload:`, JSON.stringify(payload, null, 2));

  try {
    console.log("\n📤 Sending request...");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log("\n📋 Response Body:", JSON.stringify(data, null, 2));

    if (response.ok && data.choices?.[0]?.message?.content) {
      console.log("\n✅ SUCCESS!");
      console.log(`Response: "${data.choices[0].message.content}"`);
      return true;
    } else {
      console.log("\n❌ FAILED!");
      return false;
    }
  } catch (error) {
    console.error("\n💥 ERROR:", error instanceof Error ? error.message : error);
    return false;
  }
}

testGrokAPI()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
