/**
 * Test different Grok model names to find the correct one
 */

const API_KEY = process.env.XAI_API_KEY || "xai-YOUR-API-KEY-HERE";
const BASE_URL = "https://api.x.ai/v1";

// Try different model name variations
const MODELS_TO_TEST = [
  "grok-2",
  "grok-2-beta",
  "grok-beta",
  "grok",
  "grok-3",
  "grok-2-vision",
];

async function testModel(model: string): Promise<boolean> {
  const url = `${BASE_URL}/chat/completions`;
  
  const payload = {
    model: model,
    messages: [
      {
        role: "user",
        content: "Hello",
      },
    ],
    max_tokens: 50,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Model "${model}" - SUCCESS`);
      console.log(`   Response: "${(data.choices?.[0]?.message?.content || "").substring(0, 50)}..."`);
      return true;
    } else {
      const error = data.error || data.message || "Unknown error";
      console.log(`❌ Model "${model}" - FAILED: ${error}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Model "${model}" - ERROR: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function testAllModels() {
  console.log("🧪 Testing xAI Grok models...\n");
  
  for (const model of MODELS_TO_TEST) {
    await testModel(model);
    await new Promise(r => setTimeout(r, 500)); // Small delay between requests
  }
}

testAllModels().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
