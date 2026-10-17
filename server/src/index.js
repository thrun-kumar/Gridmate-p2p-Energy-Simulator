/**
 * SolarShare - Server Entrypoint
 */

const http = require('http');
const { createApp } = require('./app');

const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST; // When unset, Node.js listens dual-stack on :: and 0.0.0.0

const app = createApp();
const server = http.createServer(app.handleRequest);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`\n[SolarShare Notice] Port ${PORT} is already in use by an active instance.`);
    console.log(`[SolarShare Notice] Backend service is ALREADY ONLINE and accessible at:`);
    console.log(`   👉 http://localhost:${PORT}`);
    console.log(`   👉 http://127.0.0.1:${PORT}\n`);
    process.exit(0);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

const onListening = () => {
  console.log('================================================================');
  console.log('⚡ SolarShare: Peer-to-Peer Energy Trading Simulator');
  console.log(`📡 Backend Server running at: http://localhost:${PORT}`);
  console.log(`📡 Local IPv4 Access:        http://127.0.0.1:${PORT}`);
  console.log('🌱 Hackathon Track: Clean Energy & Green Technology (SDG 7)');
  console.log('🔒 Cryptographic SHA-256 Hash Chain: Active');
  console.log('================================================================');
};

if (HOST) {
  server.listen(PORT, HOST, onListening);
} else {
  // Listen dual-stack on all interfaces (IPv4 0.0.0.0 and IPv6 ::)
  server.listen(PORT, onListening);
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nShutting down SolarShare server gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
