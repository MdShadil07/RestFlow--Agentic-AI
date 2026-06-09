const { GoogleGenerativeAI, SchemaType: Type } = require("@google/generative-ai");
const dotenv = require("dotenv");
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY not found in env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const modelsToTest = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
];

async function testModel(modelName) {
  console.log(`Testing model: ${modelName}...`);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: "Output a JSON object containing a greeting."
  });

  const schema = {
    type: Type.OBJECT,
    properties: {
      greeting: { type: Type.STRING }
    },
    required: ["greeting"]
  };

  try {
    const start = Date.now();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: "Hello!" }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });
    console.log(`[SUCCESS] ${modelName} responded in ${Date.now() - start}ms:`, result.response.text().trim());
    return true;
  } catch (err) {
    console.error(`[FAILED] ${modelName}:`, err.message || err);
    return false;
  }
}

async function runAll() {
  for (const m of modelsToTest) {
    await testModel(m);
    console.log("------------------------");
  }
}

runAll();
