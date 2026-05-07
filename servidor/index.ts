import { iniciarServidorWS } from './servidor-ws.ts';
import os from 'os';
import qrcode from 'qrcode-terminal';

const PUERTO = 3000;

// Obtener la IP local de la máquina (para el QR)
function obtenerIPLocal(): string {
  const interfaces = os.networkInterfaces();
  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const ip      = obtenerIPLocal();
const urlJuego = `ws://${ip}:${PUERTO}`;

console.log('');
console.log('╔════════════════════════════════════╗');
console.log('║          PikoPark Server           ║');
console.log('╠════════════════════════════════════╣');
console.log(`║  URL: ${urlJuego.padEnd(29)}║`);
console.log('╚════════════════════════════════════╝');
console.log('');
console.log('Escanea este QR con la app del celular:');
console.log('');

qrcode.generate(urlJuego, { small: true });

iniciarServidorWS(PUERTO);