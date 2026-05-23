require('dotenv').config();
const mongoose = require('mongoose');

const mongodbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/taskscheduler';

async function unsanitize(obj) {
  if (!obj) return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    out[k.replace(/__dot__/g, '.')] = obj[k];
  }
  return out;
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node inspectSession.js <sessionId>');
    process.exit(2);
  }

  await mongoose.connect(mongodbUri, { dbName: 'taskscheduler' });
  const db = mongoose.connection.db;
  const sessions = db.collection('sessions');
  const doc = await sessions.findOne({ _id: require('mongodb').ObjectId(id) });
  if (!doc) {
    console.error('Session not found:', id);
    process.exit(1);
  }
  console.log('Stored userProfile.skillConfidence (raw):', doc.sharedContext?.userProfile?.skillConfidence || null);
  console.log('Unsanitized skillConfidence:', await unsanitize(doc.sharedContext?.userProfile?.skillConfidence || {}));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
