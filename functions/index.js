const { onRequest } = require('firebase-functions/v2/https');
const express = require('express');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const app = express();

app.use(express.json());
app.use(cookieParser());

// --- Rate Limiting ---
const rateBuckets = new Map();
function rateLimit(windowMs, maxReqs) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter(t => t > now - windowMs);
    if (hits.length >= maxReqs) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}
// No periodic cleanup needed — Cloud Functions instances are short-lived.

// --- Connected-user presence ---
const connectedUsers = new Map();

// --- Conference Talk Data ---
const talks = [
  // Saturday Morning Session – April 4, 2026
  { id: 2,  speaker: "Elder Patrick Kearon",             title: "About His Business",                                            session: "Saturday Morning",   sessionOrder: 1, order: 2, topic: "Ministering & Service",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-patrick-kearon-april-2026-general-conference-about-his-business/" },
  { id: 3,  speaker: "Sister Kristin M. Yee",            title: "Ministering — That Ye Love One Another; as I Have Loved You",    session: "Saturday Morning",   sessionOrder: 1, order: 3, topic: "Ministering & Service",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/sister-kristin-yee-april-2026-general-conference-ministering/" },
  { id: 4,  speaker: "Elder Clark G. Gilbert",           title: "Come Home",                                                     session: "Saturday Morning",   sessionOrder: 1, order: 4, topic: "Grace & Redemption",         summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-clark-gilbert-april-2026-general-conference-come-home/" },
  { id: 5,  speaker: "Elder David A. Bednar",            title: "All Who Have Endured Valiantly",                                session: "Saturday Morning",   sessionOrder: 1, order: 5, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-bednar-april-2026-general-conference-endure-to-the-end/" },
  { id: 6,  speaker: "Elder Michael John U. Teh",        title: "Follow the Prophet, He Knows the Way",                          session: "Saturday Morning",   sessionOrder: 1, order: 6, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-michael-john-u-teh-april-2026-general-conference-follow-the-prophet/" },
  { id: 7,  speaker: "Elder Jorge T. Becerra",           title: "Tithing — Putting God First",                                   session: "Saturday Morning",   sessionOrder: 1, order: 7, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-becerra-april-2026-general-conference-tithing-putting-god-first/" },
  { id: 8,  speaker: "President Henry B. Eyring",        title: "Prayers for Peace",                                             session: "Saturday Morning",   sessionOrder: 1, order: 8, topic: "Prayer & Spiritual Growth",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/president-eyring-april-2026-general-conference-prayers-for-peace/" },

  // Saturday Afternoon Session – April 4, 2026
  { id: 9,  speaker: "Elder Gary E. Stevenson",          title: "Lost Luggage, Redeemed Souls",                                  session: "Saturday Afternoon", sessionOrder: 2, order: 1, topic: "Ministering & Service",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-gary-stevenson-april-2026-general-conference-lost-luggage-redeemed-souls/" },
  { id: 10, speaker: "Elder Eduardo F. Ortega",          title: "Christ, Author and Finisher of Our Faith",                      session: "Saturday Afternoon", sessionOrder: 2, order: 2, topic: "Faith & Testimony",          summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-ortega-april-2026-general-conference-christ-author-finisher-faith/" },
  { id: 11, speaker: "Elder Wan-Liang Wu",               title: "I Will Give Away All My Sins To Know Thee",                     session: "Saturday Afternoon", sessionOrder: 2, order: 3, topic: "Grace & Redemption",         summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-wan-liang-wu-april-2026-general-conference-come-unto-christ/" },
  { id: 12, speaker: "Brother David J. Wunderli",        title: "Jesus Christ Is Not Our Burden; He Is Our Relief",              session: "Saturday Afternoon", sessionOrder: 2, order: 4, topic: "Grace & Redemption",         summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/brother-wunderli-april-2026-general-conference-he-is-our-relief/" },
  { id: 13, speaker: "Elder Gérald Caussé",              title: "Love All, Love Each",                                           session: "Saturday Afternoon", sessionOrder: 2, order: 5, topic: "Love & Relationships",       summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-causse-april-2026-general-conference-love-all-love-each/" },
  { id: 14, speaker: "Elder Brian J. Holmes",            title: "Jesus Christ Is the Way",                                       session: "Saturday Afternoon", sessionOrder: 2, order: 6, topic: "Faith & Testimony",          summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-brian-holmes-april-2026-general-conference-jesus-christ-is-the-way/" },
  { id: 15, speaker: "Elder Clement M. Matswagothata",   title: "He Knows You by Name",                                          session: "Saturday Afternoon", sessionOrder: 2, order: 7, topic: "Love & Relationships",       summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-clement-m-matswagothata-april-2026-general-conference-he-knows-you-by-name/" },
  { id: 16, speaker: "Elder Ulisses Soares",             title: "Jesus Christ — the True Vine",                                  session: "Saturday Afternoon", sessionOrder: 2, order: 8, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/04/elder-ulisses-soares-april-2026-general-conference-jesus-christ-the-true-vine/" },

  // Sunday Morning Session – April 5, 2026
  { id: 17, speaker: "President Dieter F. Uchtdorf",     title: "Encounter at the Empty Tomb",                                   session: "Sunday Morning",     sessionOrder: 3, order: 1, topic: "Easter & the Resurrection",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/president-uchtdorf-april-2026-general-conference-encounter-empty-tomb/" },
  { id: 18, speaker: "President Emily Belle Freeman",    title: "Best Days and Worst Days",                                      session: "Sunday Morning",     sessionOrder: 3, order: 2, topic: "Prayer & Spiritual Growth",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/president-emily-belle-freeman-april-2026-general-conference-best-days-worst-days/" },
  { id: 19, speaker: "Elder Pedro X. Larreal",           title: "I Feel My Savior's Love",                                       session: "Sunday Morning",     sessionOrder: 3, order: 3, topic: "Love & Relationships",       summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-larreal-april-2026-general-conference-i-feel-my-saviors-love/" },
  { id: 20, speaker: "Elder Edward B. Rowe",             title: "Choose Jesus Christ as Your Guide",                              session: "Sunday Morning",     sessionOrder: 3, order: 4, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-rowe-april-2026-general-conference-christ-guide-covenant-path/" },
  { id: 21, speaker: "Elder Ronald A. Rasband",          title: "He Is Risen",                                                   session: "Sunday Morning",     sessionOrder: 3, order: 5, topic: "Easter & the Resurrection",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-ronald-a-rasband-october-2026-general-conference-christ-he-is-risen/" },
  { id: 22, speaker: "Elder Dale G. Renlund",            title: "Because of Jesus Christ",                                       session: "Sunday Morning",     sessionOrder: 3, order: 6, topic: "Grace & Redemption",         summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-dale-g-renlund-april-2026-general-conference-because-of-jesus-christ/" },
  { id: 23, speaker: "Elder Thierry K. Mutombo",         title: "The Joy of a Covenant Relationship with God",                   session: "Sunday Morning",     sessionOrder: 3, order: 7, topic: "Covenant Discipleship",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-theirry-mutombo-april-2026-general-conference-covenant-relationship-with-god/" },
  { id: 24, speaker: "Elder Alan R. Walker",             title: "A Peculiar Treasure",                                           session: "Sunday Morning",     sessionOrder: 3, order: 8, topic: "Faith & Testimony",          summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-alan-walker-april-2026-general-conference-a-peculiar-treasure/" },
  { id: 25, speaker: "President Dallin H. Oaks",        title: "Alive in Christ",                                                session: "Sunday Morning",     sessionOrder: 3, order: 9, topic: "Easter & the Resurrection",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/president-oaks-april-2026-general-conference-alive-in-christ-peacemakers/" },

  // Sunday Afternoon Session – April 5, 2026
  { id: 26, speaker: "President D. Todd Christofferson", title: "The Character of Christ",                                       session: "Sunday Afternoon",   sessionOrder: 4, order: 1, topic: "Faith & Testimony",          summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/president-christofferson-april-2026-general-conference-character-of-christ/" },
  { id: 27, speaker: "Elder Chi Hong (Sam) Wong",       title: "Remember 'Remember, Remember'",                                  session: "Sunday Afternoon",   sessionOrder: 4, order: 2, topic: "Prayer & Spiritual Growth",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-chi-hong-sam-wong-april-2026-general-conference-remember-remember-remember/" },
  { id: 28, speaker: "Elder Aaron T. Hall",              title: "I Glory in My Jesus",                                            session: "Sunday Afternoon",   sessionOrder: 4, order: 3, topic: "Faith & Testimony",          summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-aaron-hall-april-2026-general-conference-i-glory-in-my-jesus/" },
  { id: 29, speaker: "President Susan H. Porter",       title: "Here Am I, Send Me",                                             session: "Sunday Afternoon",   sessionOrder: 4, order: 4, topic: "Ministering & Service",      summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/president-susan-porter-april-2026-general-conference-here-am-i-send-me/" },
  { id: 30, speaker: "Elder Neil L. Andersen",           title: "Eternal Marriage is an Eternal Journey",                         session: "Sunday Afternoon",   sessionOrder: 4, order: 5, topic: "Love & Relationships",       summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-neil-l-andersen-april-2026-general-conference-eternal-marriage-eternal-journey/" },
  { id: 31, speaker: "Elder Quentin L. Cook",           title: "Keys, Covenants and Easter",                                     session: "Sunday Afternoon",   sessionOrder: 4, order: 6, topic: "Easter & the Resurrection",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-quentin-cook-april-2026-general-conference-easter-covenants-sealing/" },
  { id: 32, speaker: "Elder Taniela B. Wakolo",         title: "Come Unto Christ — Together",                                    session: "Sunday Afternoon",   sessionOrder: 4, order: 7, topic: "Love & Relationships",       summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-taniela-wakolo-april-2026-general-conference-marriage-families-temple-sealing/" },
  { id: 33, speaker: "Elder Gerrit W. Gong",            title: "Abide With Me; 'Tis Eastertide",                                 session: "Sunday Afternoon",   sessionOrder: 4, order: 8, topic: "Easter & the Resurrection",  summaryUrl: "https://www.thechurchnews.com/general-conference/2026/04/05/elder-gerrit-w-gong-april-2026-general-conference-abide-with-me-tis-eastertide/" },
];

// --- In-memory state ---
let adminPassword = process.env.ADMIN_PASSWORD || 'Nanito42';

let pollState = {
  maxVotes: 3,
  votes: {},
  voters: new Set(),
  voterSelections: {},
  pollGeneration: 1
};

const adminSessions = new Map();

function initializeVotes() {
  pollState.votes = {};
  talks.forEach(t => { pollState.votes[t.id] = 0; });
  pollState.voters = new Set();
  pollState.voterSelections = {};
}
initializeVotes();

// --- Middleware ---
function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !adminSessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Admin Routes ---
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === adminPassword) {
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, true);
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  const token = req.headers['x-admin-token'];
  adminSessions.delete(token);
  res.json({ success: true });
});

app.get('/api/admin/results', requireAdmin, (req, res) => {
  const results = talks.map(t => ({
    ...t,
    votes: pollState.votes[t.id] || 0
  })).sort((a, b) => (b.votes - a.votes) || a.id - b.id);

  const cutoff = Date.now() - 30000;
  let connectedCount = 0, votingCount = 0, submittedCount = 0, totalRemaining = 0;
  for (const [, d] of connectedUsers) {
    if (d.lastSeen >= cutoff) {
      connectedCount++;
      if (d.hasVoted) { submittedCount++; }
      else { votingCount++; totalRemaining += (pollState.maxVotes - (d.currentSelections || 0)); }
    }
  }

  res.json({
    results,
    totalVoters: pollState.voters.size,
    maxVotes: pollState.maxVotes,
    pollGeneration: pollState.pollGeneration,
    connected: { total: connectedCount, voting: votingCount, submitted: submittedCount,
      avgRemaining: votingCount ? +(totalRemaining / votingCount).toFixed(1) : 0 }
  });
});

app.post('/api/admin/reset', requireAdmin, (req, res) => {
  const { maxVotes } = req.body;
  if (maxVotes && Number.isInteger(maxVotes) && maxVotes >= 1 && maxVotes <= 32) {
    pollState.maxVotes = maxVotes;
  }
  pollState.pollGeneration++;
  initializeVotes();
  res.json({ success: true, maxVotes: pollState.maxVotes, pollGeneration: pollState.pollGeneration });
});

app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters.' });
  }
  adminPassword = newPassword;
  res.json({ success: true });
});

app.get('/api/admin/qrcode', requireAdmin, async (req, res) => {
  const forwardedHost = req.headers['x-forwarded-host'] || req.get('host');
  const forwardedProto = req.headers['x-forwarded-proto'] || req.protocol;
  const baseUrl = req.query.baseUrl || `${forwardedProto}://${forwardedHost}`;
  const pollUrl = `${baseUrl}/`;
  try {
    const QRCode = require('qrcode');
    const qrDataUrl = await QRCode.toDataURL(pollUrl, { width: 400, margin: 2 });
    res.json({ qrDataUrl, pollUrl });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// --- Poll Taker Routes ---
app.get('/api/talks', (req, res) => {
  res.json({
    talks,
    maxVotes: pollState.maxVotes,
    pollGeneration: pollState.pollGeneration
  });
});

app.get('/api/voter/status', (req, res) => {
  const voterId = req.cookies.voterId;
  const pollGen = parseInt(req.cookies.pollGeneration, 10);

  if (!voterId || pollGen !== pollState.pollGeneration) {
    return res.json({ hasVoted: false, selections: [], votesRemaining: pollState.maxVotes });
  }

  const hasVoted = pollState.voters.has(voterId);
  const selections = pollState.voterSelections[voterId] || [];
  res.json({
    hasVoted,
    selections,
    votesRemaining: pollState.maxVotes - selections.length
  });
});

// --- Heartbeat (presence) ---
app.post('/api/heartbeat', (req, res) => {
  let voterId = req.cookies.voterId;
  if (!voterId) {
    voterId = uuidv4();
    const cookieOpts = { httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'lax' };
    res.cookie('voterId', voterId, cookieOpts);
  }
  const hasVoted = pollState.voters.has(voterId);
  const currentSelections = parseInt(req.body.currentSelections, 10) || 0;
  connectedUsers.set(voterId, {
    lastSeen: Date.now(),
    hasVoted,
    currentSelections: hasVoted ? (pollState.voterSelections[voterId] || []).length : currentSelections
  });
  res.json({ ok: true, pollGeneration: pollState.pollGeneration });
});

app.post('/api/vote', rateLimit(60000, 10), (req, res) => {
  let voterId = req.cookies.voterId;
  const cookieGen = parseInt(req.cookies.pollGeneration, 10);

  if (!voterId || cookieGen !== pollState.pollGeneration) {
    voterId = uuidv4();
  }

  if (pollState.voters.has(voterId)) {
    return res.status(403).json({ error: 'You have already submitted your votes for this poll.' });
  }

  const { talkIds } = req.body;
  if (!Array.isArray(talkIds) || talkIds.length === 0) {
    return res.status(400).json({ error: 'Please select at least one talk.' });
  }
  if (talkIds.length > pollState.maxVotes) {
    return res.status(400).json({ error: `You may select at most ${pollState.maxVotes} talks.` });
  }

  const validIds = new Set(talks.map(t => t.id));
  for (const id of talkIds) {
    if (!validIds.has(id)) {
      return res.status(400).json({ error: `Invalid talk ID: ${id}` });
    }
  }

  if (new Set(talkIds).size !== talkIds.length) {
    return res.status(400).json({ error: 'Duplicate selections are not allowed.' });
  }

  for (const id of talkIds) {
    pollState.votes[id] = (pollState.votes[id] || 0) + 1;
  }
  pollState.voters.add(voterId);
  pollState.voterSelections[voterId] = talkIds;

  const cookieOpts = { httpOnly: true, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'lax' };
  res.cookie('voterId', voterId, cookieOpts);
  res.cookie('pollGeneration', String(pollState.pollGeneration), cookieOpts);

  res.json({ success: true, message: 'Your votes have been recorded. Thank you!' });
});

// Export as Firebase Cloud Function (public so Firebase Hosting can reach it)
exports.api = onRequest({ invoker: 'public' }, app);
