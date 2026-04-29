import fetch from 'node-fetch';
async function run() {
    const res = await fetch('http://localhost:3005/api/iiko/organizations');
    const data = await res.json();
    console.log(data);
}
run();
