import { Elysia } from 'elysia';
import { node }   from '@elysiajs/node';
import { readFileSync } from 'fs';
import { join }         from 'path';
import os               from 'os';

import {
  iniciarSimulacion,
  registrarJugador,
  desregistrarJugador,
  registrarInput,
  hayLugar,
} from './simulacionFisica.ts';

// ── ID propio por conexión (no confiamos en ws.id del adapter) ──
const idsPorConexion = new WeakMap<object, string>();
let contadorConexiones = 0;

function idDe(ws: object): string {
  let id = idsPorConexion.get(ws);
  if (!id) {
    id = `conn-${++contadorConexiones}-${Date.now()}`;
    idsPorConexion.set(ws, id);
  }
  return id;
}

function obtenerIPLocal(): string {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const DIR_PAG_DE_JUEGO = `${import.meta.dirname}/../pagDeJuego`;
const ARCHIVOS: Record<string, { archivo: string; mime: string }> = {
  '/':            { archivo: 'index.html',  mime: 'text/html; charset=utf-8' },
  '/index.html':  { archivo: 'index.html',  mime: 'text/html; charset=utf-8' },
  '/juego.js':    { archivo: 'juego.js',    mime: 'application/javascript'   },
  '/estilos.css': { archivo: 'estilos.css', mime: 'text/css'                 },
};

// Usamos un Map para poder enviar mensajes a todos desde simulacionFisica
const clientes = new Map<string, { send: (msg: string) => void }>();

function enviarATodos(mensaje: object) {
  const texto = JSON.stringify(mensaje);
  for (const cliente of clientes.values()) cliente.send(texto);
}

const PUERTO = Number(process.env.PUERTO) || 3000; // puerto interno, fijo en 3000 para todos

// Puerto e IP que se muestran en el QR — pueden diferir del puerto interno
const puertoPublico = process.env.PUERTO_PUBLICO || String(PUERTO);
const hostPublico    = process.env.HOST_PUBLICO   || obtenerIPLocal();

const urlJuego = `http://${hostPublico}:${puertoPublico}`;

const app = new Elysia({ adapter: node() })

// Pag del juego
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
      clientes.set(idDe(ws), { send: (msg) => ws.send(msg) });
    },

    message(ws, raw) {
      let mensaje: any;
      try {
        mensaje = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        return;
      }

      if (mensaje.tipo === 'pantalla') {
        console.log('🖥️  Pantalla conectada');
        ws.send(JSON.stringify({ tipo: 'info-servidor', urlJuego }));
        return;
      }

      if (mensaje.tipo === 'gamepad') {
        if (!hayLugar()) {
          ws.send(JSON.stringify({ tipo: 'partida-llena' }));
          ws.close();
          console.log('🚫 Partida llena — conexión rechazada');
          return;
        }
        const resultado = registrarJugador(idDe(ws));
        if (!resultado) return;
        ws.send(JSON.stringify({
          tipo:   'bienvenido',
          id:     idDe(ws),
          nombre: resultado.nombre,
          color:  resultado.color,
        }));
        console.log(`✅ ${resultado.nombre} conectado`);
        return;
      }

      if (mensaje.tipo === 'input') {
        registrarInput(idDe(ws), mensaje.direccion, mensaje.estado);
      }
    },

    close(ws) {
      clientes.delete(idDe(ws));
      desregistrarJugador(idDe(ws), enviarATodos);
    },
  })

  .listen(PUERTO);

iniciarSimulacion(enviarATodos);

console.log('');
console.log('🎮  PicoPark — Servidor');
console.log(`🌐  Abrí esta URL en el navegador:  ${urlJuego}`);
console.log(`⏳  Esperando jugadores…`);
console.log('');