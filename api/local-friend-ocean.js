const oceanClaimHandler = require('../server/push/oceanClaimHandler');
const oceanReplyHandler = require('../server/push/oceanReplyHandler');
const oceanRevealHandler = require('../server/push/oceanRevealHandler');

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body && typeof body === 'object' ? body : {};
}

function resolveAction(req) {
  const q = String(req.query?.action || '').trim().toLowerCase();
  if (q) return q;
  const body = parseBody(req);
  return String(body.action || '').trim().toLowerCase();
}

/** Single serverless route: ?action=claim|reply|reveal (legacy paths rewritten in vercel.json). */
module.exports = async function handler(req, res) {
  const action = resolveAction(req);
  if (action === 'claim') return oceanClaimHandler(req, res);
  if (action === 'reply') return oceanReplyHandler(req, res);
  if (action === 'reveal') return oceanRevealHandler(req, res);
  return res.status(400).json({ error: 'action required: claim, reply, or reveal' });
};
