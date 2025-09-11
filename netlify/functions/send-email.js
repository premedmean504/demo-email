// netlify/functions/send-email.js
import nodemailer from 'nodemailer'

export const handler = async (event) => {
  try {
    const { to, subject, body, headers = {}, threadId } = JSON.parse(event.body || '{}')
    if (!to || !body) return resp(400, { error: 'to and body required' })

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
    })

    const info = await transporter.sendMail({
      from: `"AI Mail Demo" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
      headers: {
        'X-Thread-Id': headers['X-Thread-Id'] || threadId || '',
      },
      // Pro tip: set Reply-To to your inbound mailbox so Zendesk/assistant replies go there
      replyTo: process.env.INBOUND_ADDRESS // e.g. reply@inbound.lat
    })

    // (optional) also store the outbound message so it shows in UI instantly after reload
    await saveToBlobs(threadId, {
      id: info.messageId || Date.now().toString(),
      from: `You <you@local>`,
      text: body,
      date: new Date().toISOString()
    })

    return resp(200, { ok: true, id: info.messageId })
  } catch (e) {
    console.error(e)
    return resp(500, { error: 'send failed' })
  }
}

// ---- helpers
const resp = (s, b) => ({ statusCode: s, body: JSON.stringify(b), headers: { 'content-type': 'application/json' } })
async function saveToBlobs(threadId, msg) {
  const { Blobs } = await import('@netlify/blobs')
  const store = new Blobs({ token: process.env.NETLIFY_BLOBS_TOKEN, siteID: process.env.SITE_ID })
  const key = `threads/${threadId}.json`
  const existing = (await store.get(key)) ? JSON.parse(await store.get(key).text()) : []
  existing.push(msg)
  await store.set(key, JSON.stringify(existing))
}