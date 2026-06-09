const nodemailer = require('nodemailer');
require('dotenv').config();
async function sendEmailNow(to, subject, body){
  if(!process.env.SMTP_HOST) return { skipped:true, reason:'SMTP not configured' };
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transporter.sendMail({ from: process.env.SMTP_FROM || 'Crafted Visual <do-not-reply@craftedvisual.com>', to, subject, text: body });
}
async function sendWhatsAppNow(to, body){
  if(!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) return { skipped:true, reason:'WhatsApp Cloud API not configured' };
  const url = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v20.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to: String(to).replace(/\D/g,''), type:'text', text:{ body } }) });
  return { ok: res.ok, status: res.status, body: await res.text() };
}
module.exports = { sendEmailNow, sendWhatsAppNow };
