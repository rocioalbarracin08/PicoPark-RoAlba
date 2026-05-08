
import os from 'os';
import qrcode from 'qrcode-terminal';
import { iniciarServidorWS } from './servidor-ws';

const PUERTO = 3000;

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

const ip       = obtenerIPLocal();
const urlJuego = `ws://${ip}:${PUERTO}`;

console.log(' PikoPark - Servidor');
console.log(`URL para unirse: ${urlJuego.padEnd(29)}`);
console.log('Escaneá este QR con la app del celular:');


qrcode.generate(urlJuego, { small: true });

console.log('Esperando jugadores (0/4)...');
iniciarServidorWS(PUERTO);