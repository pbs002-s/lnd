const net = require('net');

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.on('connect', () => {
      console.log(`Port ${port} is OPEN!`);
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      console.log(`Port ${port} TIMEOUT`);
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (err) => {
      console.log(`Port ${port} ERROR:`, err.message);
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

async function run() {
  await checkPort(5432);
  await checkPort(5433);
  await checkPort(5000);
  await checkPort(5173);
}

run();
