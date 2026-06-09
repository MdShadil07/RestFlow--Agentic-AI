import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/jwt.middleware';
import RoadmapModel from '../models/Roadmap';
import { generateStandaloneRoadmap } from '../agents/roadmap.agent';

const router = Router();

// Create a new standalone roadmap
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { topic, role, company, competency } = req.body;
    const userId = req.userId!;

    if (!topic || topic.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Please provide a valid topic for the roadmap.' });
    }

    const roadmap = await RoadmapModel.create({
      userId,
      topic: topic.trim(),
      role: role?.trim(),
      company: company?.trim(),
      competency: competency?.trim(),
      status: 'pending',
      progress: 0,
      tasks: []
    });

    // Trigger roadmap agent asynchronously
    generateStandaloneRoadmap(roadmap._id.toString()).catch((err) => {
      console.error('[RoadmapRoute] Background roadmap agent error:', err);
    });

    res.status(201).json({ success: true, message: 'Roadmap creation started', data: { id: roadmap._id } });
  } catch (err: any) {
    console.error('Create roadmap error:', err.message || err);
    res.status(500).json({ success: false, message: 'Unable to create roadmap' });
  }
});

// List all roadmaps for user
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roadmaps = await RoadmapModel.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .exec();
    res.json({ success: true, data: roadmaps });
  } catch (err: any) {
    console.error('List roadmaps error:', err.message || err);
    res.status(500).json({ success: false, message: 'Error fetching roadmaps' });
  }
});

// Get a specific roadmap
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roadmap = await RoadmapModel.findById(req.params.id).exec();
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    if (roadmap.userId !== req.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    res.json({ success: true, data: roadmap });
  } catch (err: any) {
    console.error('Get roadmap error:', err.message || err);
    res.status(500).json({ success: false, message: 'Error fetching roadmap' });
  }
});

// Delete a roadmap
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const roadmap = await RoadmapModel.findById(req.params.id).exec();
    if (!roadmap) return res.status(404).json({ success: false, message: 'Roadmap not found' });
    if (roadmap.userId !== req.userId) return res.status(403).json({ success: false, message: 'Forbidden' });

    await RoadmapModel.deleteOne({ _id: req.params.id }).exec();
    res.json({ success: true, message: 'Roadmap deleted successfully' });
  } catch (err: any) {
    console.error('Delete roadmap error:', err.message || err);
    res.status(500).json({ success: false, message: 'Error deleting roadmap' });
  }
});

export default router;
