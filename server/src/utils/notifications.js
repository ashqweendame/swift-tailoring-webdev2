import nodemailer from 'nodemailer';
import { config } from '../config.js';

const transporter = config.smtp.host
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    })
  : null;

export async function sendReadyNotification({ order_code, firstname, email }) {
  const subject = `Your Swift Tailoring order ${order_code} is ready for pickup`;
  const text = `Hi ${firstname},\n\nYour order ${order_code} is ready for pickup at Swift Tailoring.\nHours: Mon-Fri 8AM-7PM | Sat 9AM-5PM\n\nSwift Tailoring - Elegance In Motion`;
  if (!transporter) {
    console.log(`[notify:simulated] to ${email} | ${subject}`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to: email, subject, text });
}
