async function getBundle() {
  const res = await fetch('https://novapulse-hiring-crm.vercel.app/');
  const html = await res.text();
  const m = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!m) return console.log('no script found');
  const jsUrl = 'https://novapulse-hiring-crm.vercel.app' + m[1];
  console.log('Fetching JS bundle:', jsUrl);
  const jsRes = await fetch(jsUrl);
  const js = await jsRes.text();
  const apiKeyMatch = js.match(/apiKey:"([^"]+)"/);
  const projMatch = js.match(/projectId:"([^"]+)"/);
  const authDomMatch = js.match(/authDomain:"([^"]+)"/);
  const appIdMatch = js.match(/appId:"([^"]+)"/);
  const storageBucketMatch = js.match(/storageBucket:"([^"]+)"/);
  const messagingSenderIdMatch = js.match(/messagingSenderId:"([^"]+)"/);
  console.log('Firebase Config found in deployed bundle:');
  console.log('apiKey:', apiKeyMatch ? apiKeyMatch[1] : null);
  console.log('projectId:', projMatch ? projMatch[1] : null);
  console.log('authDomain:', authDomMatch ? authDomMatch[1] : null);
  console.log('appId:', appIdMatch ? appIdMatch[1] : null);
  console.log('storageBucket:', storageBucketMatch ? storageBucketMatch[1] : null);
  console.log('messagingSenderId:', messagingSenderIdMatch ? messagingSenderIdMatch[1] : null);
}
getBundle().catch(console.error);
