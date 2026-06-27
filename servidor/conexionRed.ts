import { Elysia }    from 'elysia';
import { readFileSync } from 'fs';
import { join }         from 'path';
import os               from 'os';

import {
  iniciarSimulacion,
  registrarJugador,
  desregistrarJugador,
  registrarInput,
  hayLugar,
} from './simulacionFisica';

// ── Helpers ──────────────────────────────────────────────────────────────────
const PUERTO = 3000;

function obtenerIPLocal(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const DIR_PAG_DE_JUEGO = `${import.meta.dir}/../pagDeJuego`;
const ARCHIVOS: Record<string, { archivo: string; mime: string }> = {
  '/':            { archivo: 'index.html',  mime: 'text/html; charset=utf-8' },
  '/index.html':  { archivo: 'index.html',  mime: 'text/html; charset=utf-8' },
  '/juego.js':    { archivo: 'juego.js',    mime: 'application/javascript'   },
  '/estilos.css': { archivo: 'estilos.css', mime: 'text/css'                 },
};

// ── Clientes conectados ───────────────────────────────────────────────────────
// Usamos un Map para poder enviar mensajes a todos desde simulacionFisica
const clientes = new Map<string, { send: (msg: string) => void }>();

function enviarATodos(mensaje: object) {
  const texto = JSON.stringify(mensaje);
  for (const cliente of clientes.values()) cliente.send(texto);
}

// ── App ───────────────────────────────────────────────────────────────────────
const ipLocal  = obtenerIPLocal();
const urlJuego = `http://${ipLocal}:${PUERTO}`;

const app = new Elysia()

  // Servir archivos estáticos de pagDeJuego
  .get('*', ({ request }) => {
    const url    = new URL(request.url).pathname;
    const entry  = ARCHIVOS[url];
    if (!entry) return new Response('Página no encontrada', { status: 404 });
    try {
      const contenido = readFileSync(join(DIR_PAG_DE_JUEGO, entry.archivo));
      return new Response(contenido, { headers: { 'Content-Type': entry.mime } });
    } catch {
      return new Response('Error interno', { status: 500 });
    }
  })

  // WebSocket
  .ws('/ws', {
    open(ws) {
      clientes.set(ws.id, { send: (msg) => ws.send(msg) });
    },

    message(ws, raw) {
      let mensaje: any;
      try {
        mensaje = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return;
      }

      // ── Pantalla del juego ──
      if (mensaje.tipo === 'pantalla') {
        console.log('🖥️  Pantalla conectada');
        ws.send(JSON.stringify({ tipo: 'info-servidor', urlJuego }));
        return;
      }

      // ── Gamepad: primera conexión ──
      if (mensaje.tipo === 'gamepad') {
        if (!hayLugar()) {
          ws.send(JSON.stringify({ tipo: 'partida-llena' }));
          ws.close();
          console.log('🚫 Partida llena — conexión rechazada');
          return;
        }
        const resultado = registrarJugador(ws.id);
        if (!resultado) return;
        ws.send(JSON.stringify({
          tipo:   'bienvenido',
          id:     ws.id,
          nombre: resultado.nombre,
          color:  resultado.color,
        }));
        console.log(`✅ ${resultado.nombre} conectado`);
        return;
      }

      // ── Input de botones ──
      if (mensaje.tipo === 'input') {
        registrarInput(ws.id, mensaje.direccion, mensaje.estado);
      }
    },

    close(ws) {
      clientes.delete(ws.id);
      desregistrarJugador(ws.id, enviarATodos);
    },
  })

  .listen(PUERTO);

// ── Arrancar simulación ───────────────────────────────────────────────────────
iniciarSimulacion(enviarATodos);

console.log('');
console.log('🎮  PicoPark — Servidor');
console.log(`🌐  Abrí esta URL en el navegador:  ${urlJuego}`);
console.log(`⏳  Esperando jugadores…`);
console.log('');