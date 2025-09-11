// netlify/functions/list-thread.js
export const handler = async (event) => {
  try {
    const thread = event.queryStringParameters?.thread
    if (!thread) return json(400, { error: 'thread required' })

    const { Blobs } = await import('@netlify/blobs')
    const store = new Blobs({ token: process.env.NETLIFY_BLOBS_TOKEN, siteID: process.env.SITE_ID })
    const key = `threads/${thread}.json`
    const file = await store.get(key)
    if (!file) return json(200, [])

    const data = JSON.parse(await file.text())
    // sort old->new (UI sorts as well, but nice to be consistent)
    data.sort((a,b) => new Date(a.date||0) - new Date(b.date||0))
    return json(200, data)
  } catch (e) {
    console.error(e)
    return json(500, { error: 'list failed' })
  }
}

const json = (s, b) => ({ statusCode: s, body: JSON.stringify(b), headers: { 'content-type': 'application/json' } })