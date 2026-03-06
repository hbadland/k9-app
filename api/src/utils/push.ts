export async function sendPush(token: string, title: string, body: string, data?: object) {
  await fetch('https://exp.host/--/expo-push-notification/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: token, title, body, data: data ?? {} }),
  }).catch(e => console.warn('[push]', e));
}
