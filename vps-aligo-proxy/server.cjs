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
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      return callback(null, true)
    },
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type', 'x-proxy-token'],
    credentials: true,
  }),
)
app.use(express.urlencoded({ extended: true }))
app.use(express.json({ limit: '1mb' }))
app.use(morgan('combined'))

function json(res, status, body) {
  return res.status(status).json(body)
}

async function handleSend(req, res) {
  try {
    if (PROXY_TOKEN && req.headers['x-proxy-token'] !== PROXY_TOKEN) {
      return json(res, 401, { error: 'unauthorized' })
    }
    const { phone, hp, msg } = req.body || {}
    const target = (hp || phone || '').toString().trim()
    if (!target || !msg) {
      console.error('[proxy] invalid_input', { body: req.body })
      return json(res, 400, { error: 'invalid_input' })
    }

    const body = new URLSearchParams({
      user_id: ALIGO_USER_ID,
      key: ALIGO_API_KEY,
      sender: ALIGO_SENDER,
      receiver: target,
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
}

// 경로: /send-otp, /send-sms
app.options('/send-otp', cors(), (_req, res) => res.sendStatus(204))
app.options('/send-sms', cors(), (_req, res) => res.sendStatus(204))
app.post('/send-otp', handleSend)
app.post('/send-sms', handleSend)

app.get('/health', (_req, res) => res.json({ ok: true }))

app.listen(PROXY_PORT, () => {
  console.log(`Aligo proxy listening on ${PROXY_PORT}`)
})
