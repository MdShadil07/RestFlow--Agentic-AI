import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/jwt.middleware';
import SessionModel from '../models/Session';
import { sessionQueue } from '../queues';
import { processSessionPayload } from '../services/session-processing.service';
import { generateTaskPreparation } from '../services/task-preparation.service';
import { isLikelyMeaningfulSessionText, normalizeSessionText, qualityLabel } from '../services/session-input.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { supabaseAdmin } from '../integrations/supabase/client.server';

const router = Router();

// Ensure uploads dir exists
const uploadsDir = path.join(__dirname, '../../uploads');
try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch {}

// Setup multer for file uploads
const upload = multer({ dest: uploadsDir });

// Create a new session (accepts optional resume PDF upload as 'resume')
router.post('/', authenticateToken, upload.single('resume'), async (req: Request, res: Response) => {
  try {
    const { extraContext, company, role, deadline, competency, agents, resumeText: resumeTextField } = req.body;
    const userId = req.userId!;

    const normalizedExtraContext = normalizeSessionText(extraContext);
    const normalizedCompany = normalizeSessionText(company);
    const normalizedRole = normalizeSessionText(role);
    const normalizedResumeText = normalizeSessionText(resumeTextField);

    const hasUploadedResume = Boolean(req.file);
    const hasUsefulResumeText = isLikelyMeaningfulSessionText(normalizedResumeText, { minLength: 60, minWords: 8 });
    const hasUsefulContext = isLikelyMeaningfulSessionText(normalizedExtraContext, { minLength: 40, minWords: 6 });
    const hasUsefulRoleOrCompany =
      isLikelyMeaningfulSessionText(normalizedRole, { minLength: 3, minWords: 1 }) ||
      isLikelyMeaningfulSessionText(normalizedCompany, { minLength: 3, minWords: 1 });

    if (!hasUsefulContext) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a clear goal prompt with enough detail to build a reliable plan.',
      });
    }

    if (!hasUploadedResume && !hasUsefulResumeText && !hasUsefulRoleOrCompany) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a meaningful resume, a target role, or a company name so the plan can be grounded.',
      });
    }

    let parsedAgents: string[] = [];
    if (Array.isArray(agents)) {
      parsedAgents = agents;
    } else if (typeof agents === 'string' && agents.trim()) {
      try {
        const decoded = JSON.parse(agents);
        if (Array.isArray(decoded)) parsedAgents = decoded.filter((value) => typeof value === 'string');
      } catch {
        parsedAgents = [];
      }
    }

    // create session placeholder
    const session = await SessionModel.create({
      userId,
      resumeText: normalizedResumeText,
      extraContext: normalizedExtraContext,
      company: normalizedCompany,
      role: normalizedRole,
      deadline: deadline ? new Date(deadline) : undefined,
      competency,
      agents: parsedAgents
    } as any);

    await SessionModel.updateOne(
      { _id: session._id },
      {
        $set: { progress: 0, currentStep: 'session-created', status: 'pending' },
        $push: {
          activityLog: {
            stage: 'session-created',
            message: 'Session created. The agent is preparing to inspect your resume and build a plan.',
            details: `Agents: ${parsedAgents.length ? parsedAgents.join(', ') : 'default'} | Role: ${normalizedRole || 'not provided'} | Company: ${normalizedCompany || 'not provided'} | Context: ${qualityLabel(normalizedExtraContext)}`,
            createdAt: new Date(),
          },
        },
      }
    ).exec();

    if (req.file) {
      console.log(`[SessionRoute:${session._id}] received-upload`, {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        tempPath: req.file.path,
      });
    } else {
      console.log(`[SessionRoute:${session._id}] received-inline-context`, {
        resumeTextChars: normalizedResumeText.length,
        extraContextChars: normalizedExtraContext.length,
      });
    }

    // If file uploaded, upload to Supabase and process either via queue or inline fallback
    if (req.file) {
      const localPath = req.file.path;
      const fileName = `${session._id}_${Date.now()}${path.extname(req.file.originalname)}`;

      try {
        const fileBuffer = fs.readFileSync(localPath);
        const { error: uploadError } = await supabaseAdmin.storage.from('resumes').upload(fileName, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });
        if (uploadError) {
          console.error('Supabase upload error:', uploadError.message);
        } else {
          console.log('Uploaded resume to Supabase as', fileName);
        }
      } catch (e: any) {
        console.error('Failed to upload to Supabase:', e.message || e);
      }

      const queueAvailable = Boolean(sessionQueue);
      if (queueAvailable && sessionQueue) {
        await sessionQueue.add('process-session', { sessionId: session._id.toString(), fileName }, { attempts: 5, backoff: { type: 'exponential', delay: 1000 } });
        try { fs.unlinkSync(localPath); } catch (e) {}
      } else {
        void processSessionPayload({ sessionId: session._id.toString(), fileName, localPath }).catch((err) => {
          console.error('Inline session processing error:', err);
        });
      }
    } else {
      // No file: enqueue job when available, otherwise process inline
      if (sessionQueue) {
        await sessionQueue.add('process-session', { sessionId: session._id.toString(), fileName: null }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });
      } else {
        void processSessionPayload({ sessionId: session._id.toString(), fileName: null, localPath: null }).catch((err) => {
          console.error('Inline session processing error:', err);
        });
      }
    }

    res.status(201).json({ success: true, message: 'Session created', data: { id: session._id } });
  } catch (err: any) {
    console.error('Create session error:', err.message || err);
    res.status(500).json({ success: false, message: 'Unable to create session' });
  }
});

// Get session details
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const session = await SessionModel.findById(req.params.id).exec();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.userId !== req.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    // Convert document to plain object and unsanitize skill keys for response
    const result = session.toObject();
    try {
      const { unsanitizeSkillConfidence } = await import('../models/Session');
      if (result.sharedContext?.userProfile?.skillConfidence) {
        result.sharedContext.userProfile.skillConfidence = unsanitizeSkillConfidence(result.sharedContext.userProfile.skillConfidence);
      }
    } catch {
      // ignore if helper unavailable
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Get session error:', err.message || err);
    res.status(500).json({ success: false, message: 'Error fetching session' });
  }
});

// Development-only debug route: return unsanitized userProfile without auth (local only)
router.get('/debug/:id', async (req: Request, res: Response) => {
  if (process.env.NODE_ENV !== 'development') return res.status(403).json({ success: false, message: 'Forbidden' });
  try {
    const session = await SessionModel.findById(req.params.id).exec();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    const result = session.toObject();
    const { unsanitizeSkillConfidence } = await import('../models/Session');
    if (result.sharedContext?.userProfile?.skillConfidence) {
      result.sharedContext.userProfile.skillConfidence = unsanitizeSkillConfidence(result.sharedContext.userProfile.skillConfidence);
    }
    console.log(`[SessionDebug:${req.params.id}] unsanitized userProfile:`, result.sharedContext?.userProfile);
    res.json({ success: true, data: result.sharedContext?.userProfile || null });
  } catch (err: any) {
    console.error('Get session debug error:', err.message || err);
    res.status(500).json({ success: false, message: 'Error fetching session debug' });
  }
});

router.post('/:id/tasks/:index/preparation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const session = await SessionModel.findById(req.params.id).exec();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
    if (session.userId !== req.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    const taskIndex = Number(req.params.index);
    if (!Number.isInteger(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ success: false, message: 'Invalid task index' });
    }

    const result = await generateTaskPreparation(session._id.toString(), taskIndex);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('Generate task preparation error:', err.message || err);
    res.status(500).json({ success: false, message: err?.message || 'Unable to create preparation' });
  }
});

export default router;
