export async function sendLineNotification(message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  // グループIDがあればグループへ、なければ個人IDへ送信
  const to = process.env.LINE_GROUP_ID || process.env.LINE_USER_ID
  if (!token || !to) return

  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text: message }],
    }),
  })
}
