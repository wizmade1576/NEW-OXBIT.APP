// Simple Express proxy to call Aligo SMS from a fixed IP server
// Required env (.env):
// ALIGO_USER_ID=...
// ALIGO_API_KEY=...
// ALIGO_SENDER=01012345678 (numbers only, registered/approved in Aligo)
// PROXY_PORT=3001
// PROXY_TOKEN=optional-shared-secret

const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')
const morgan = require('morgan')
require('dotenv').config()

const {
  ALIGO_USER_ID,
  ALIGO_API_KEY,
  ALIGO_SENDER,
  PROXY_PORT = 3001,
  PROXY_TOKEN = '',
} = process.env

if (!ALIGO_USER_ID || !ALIGO_API_KEY || !ALIGO_SENDER) {
  console.error('Missing Aligo env. Please set ALIGO_USER_ID, ALIGO_API_KEY, ALIGO_SENDER')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('combined'))

function json(res, status, body) {
  return res.status(status).json(body)
}

app.post('/send-otp', async (req, res) => {
  try {
    if (PROXY_TOKEN && req.headers['x-proxy-token'] !== PROXY_TOKEN) {
      return json(res, 401, { error: 'unauthorized' })
    }
    const { phone, msg } = req.body || {}
    if (!phone || !msg) return json(res, 400, { error: 'invalid_input' })

    const body = new URLSearchParams({
      user_id: ALIGO_USER_ID,
      key: ALIGO_API_KEY,
      sender: ALIGO_SENDER,
      receiver: phone,
      msg: msg,
    })

    const aligoRes = await fetch('https://apis.aligo.in/send/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const text = await aligoRes.text()

    if (!aligoRes.ok) {
      console.error('[proxy] aligo send failed', aligoRes.status, text)
      return json(res, 500, { error: 'aligo_send_failed', status: aligoRes.status, body: text })
    }

    const success = /"result_code"\s*:\s*1/.test(text) || /success/i.test(text)
    if (!success) {
      console.error('[proxy] aligo non-success', text)
      return json(res, 500, { error: 'aligo_send_failed', body: text })
    }

    return json(res, 200, { ok: true })
  } catch (err) {
    console.error('[proxy] internal error', err)
    return json(res, 500, { error: 'proxy_internal_error' })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PROXY_PORT, () => {
  console.log(`Aligo proxy listening on ${PROXY_PORT}`)
})
