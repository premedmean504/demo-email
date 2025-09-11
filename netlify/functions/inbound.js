// netlify/functions/inbound.js
import { simpleParser } from 'mailparser'

export const handler = async (event) => {
  try {
    // If SendGrid sends JSON, adapt accordingly; for raw MIME use body directly
    const mime = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : Buffer.from(event.body || '', 'utf8')
    const mail = await simpleParser(mime)

    // Try to recover thread id
    const threadId =
      mail.headers.get('x-thread-id') ||
      firstRefId(mail.headers.get('references')) ||
      mail.headers.get('in-reply-to') ||
      'unknown'

    const msg = {
      id: mail.messageId || Date.now().toString(),
      from: `${mail.from?.text || 'unknown'}`,
      text: mail.text || '',
      html: mail.html || '',
      date: mail.date ? mail.date.toISOString() : new Date().toISOString()
    }

    await saveToBlobs(threadId, msg)
    return json(200, { ok: true })
  } catch (e) {
    console.error(e)
    return json(500, { error: 'parse failed' })
  }
}

function firstRefId(refs) {
  if (!refs) return null
  const s = Array.isArray(refs) ? refs[0] : String(refs)
  return s?.trim() || null
}

const json = (s, b) => ({ statusCode: s, body: JSON.stringify(b), headers: { 'content-type': 'application/json' } })
async function saveToBlobs(threadId, msg) {
  const { Blobs } = await import('@netlify/blobs')
  const store = new Blobs({ token: process.env.NETLIFY_BLOBS_TOKEN, siteID: process.env.SITE_ID })
  const key = `threads/${threadId}.json`
  const existing = (await store.get(key)) ? JSON.parse(await store.get(key).text()) : []
  // de-dupe by id
  if (!existing.some(m => m.id === msg.id)) existing.push(msg)
  await store.set(key, JSON.stringify(existing))
}