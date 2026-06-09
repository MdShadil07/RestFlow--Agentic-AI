import { GoogleGenerativeAI, Schema, SchemaType as Type } from "@google/generative-ai";
import RoadmapModel, { IRoadmapTask } from '../models/Roadmap';

export async function generateStandaloneRoadmap(roadmapId: string) {
  const roadmap = await RoadmapModel.findById(roadmapId).exec();
  if (!roadmap) throw new Error('Roadmap not found');

  try {
    // Set status to running
    roadmap.status = 'running';
    roadmap.progress = 20;
    await roadmap.save();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      systemInstruction: `You are a master technical planner and expert roadmap architect. Your job is to build a highly detailed, professional, in-depth learning tree or execution roadmap for the provided topic.

CRITICAL INSTRUCTIONS:
1. COMPREHENSIVE TREE: Break the topic down into 8 to 15 modules/tasks.
2. IN-DEPTH DETAILS: Provide subtopics, resources, common mistakes, and study notes for every single task.
3. STRUCTURE: Assign each task to a specific, sequential "category" or phase (e.g., Phase 1: Fundamentals, Phase 2: Core Architecture, etc.).
4. QUALITY: Emulate the deep, premium tree structure seen in tools like Notion or professional roadmap builders.
5. Provide the final output strictly as JSON following the schema.`
    });

    const user = `Topic to generate roadmap for: ${roadmap.topic}
${roadmap.role ? `Target Role: ${roadmap.role}\n` : ''}${roadmap.company ? `Target Company: ${roadmap.company}\n` : ''}${roadmap.competency ? `Target Competency: ${roadmap.competency}\n` : ''}
Build the deeply nested professional roadmap now.`;

    const schema: Schema = {
      type: Type.OBJECT,
      properties: {
        tasks: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              focusArea: { type: Type.STRING },
              priority: { type: Type.INTEGER },
              estimatedMinutes: { type: Type.INTEGER },
              resources: { type: Type.ARRAY, items: { type: Type.STRING } },
              subtopics: { type: Type.ARRAY, items: { type: Type.STRING } },
              notes: { type: Type.ARRAY, items: { type: Type.STRING } },
              commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
              teachingPrompts: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "description", "category", "focusArea", "priority", "estimatedMinutes", "resources", "subtopics", "notes", "commonMistakes", "teachingPrompts"]
          }
        }
      },
      required: ["tasks"]
    };

    let generatedTasks: IRoadmapTask[] = [];
    let lastError: any;

    roadmap.progress = 50;
    await roadmap.save();

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });

        const text = result.response.text();
        const args = JSON.parse(text);
        generatedTasks = args.tasks || [];
        break; // Success
      } catch (error) {
        lastError = error;
        console.warn(`[RoadmapAgent] Attempt ${attempt} failed:`, error);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    if (generatedTasks.length === 0) {
      console.error("[RoadmapAgent] All retry attempts failed. Gemini SDK error:", lastError);
      throw new Error("The Roadmap Agent failed to generate the roadmap structure.");
    }

    // Set all tasks prepStatus to completed so they render as fully expanded and ready
    generatedTasks = generatedTasks.map((task) => ({
      ...task,
      prepStatus: 'completed',
      prepSummary: 'Roadmap node automatically prepped by Roadmap Agent.',
    }));

    roadmap.tasks = generatedTasks;
    roadmap.status = 'completed';
    roadmap.progress = 100;
    await roadmap.save();

  } catch (error: any) {
    console.error(`[RoadmapAgent:${roadmapId}] failed:`, error);
    roadmap.status = 'failed';
    roadmap.progress = 0;
    await roadmap.save();
  }
}
