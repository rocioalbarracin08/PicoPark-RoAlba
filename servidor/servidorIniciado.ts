import os     from 'os';
import { iniciarServidorWS } from './red';

const PUERTO = 3000;

// ── Obtener la IP local de la red ────────────────────────
function obtenerIPLocal(): string {
  const interfaces = os.networkInterfaces();

  for (const nombre of Object.keys(interfaces)) {
    for (const iface of interfaces[nombre] ?? []) {
      const esIPv4    = iface.family === 'IPv4';
      const esExterna = !iface.internal;

      if (esIPv4 && esExterna) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

const ipLocal  = obtenerIPLocal();
const urlJuego = `http://${ipLocal}:${PUERTO}`;

// ── Mostrar datos de arranque en consola ─────────────────
console.log('');
console.log('🎮  PicoPark — Servidor');
console.log(`🌐  Abrí esta URL en el navegador:  ${urlJuego}`);
console.log(`⏳  Esperando jugadores…`);
console.log('');

// Se pasa la URL para que la pantalla del juego la muestre con el QR
iniciarServidorWS(PUERTO, `${import.meta.dir}/../pagDeJuego`, urlJuego);