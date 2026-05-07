import { useState, useEffect, useRef } from 'react';

export interface JugadorEstado {
  id:            string;
  nombre:        string;
  color:         string;
  x:             number;
  y:             number;
  cargandoLlave: boolean;
  conectado:     boolean;
}

export interface EstadoJuegoCliente {
  fase:          'lobby' | 'jugando' | 'nivel-completado';
  jugadores:     JugadorEstado[];
  llaveEnJuego:  boolean;
  llaveRecogida: boolean;
}

export function useWebSocket(url: string) {
  const [estado, setEstado]         = useState<EstadoJuegoCliente | null>(null);
  const [conectado, setConectado]   = useState(false);
  const socketRef                   = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setConectado(true);
      console.log('Cliente web conectado al servidor');
    };

    ws.onmessage = (evento) => {
      const mensaje = JSON.parse(evento.data);
      if (mensaje.tipo === 'estado') {
        setEstado(mensaje);
      }
    };

    ws.onclose  = () => setConectado(false);
    ws.onerror  = (e) => console.error('Error WS cliente web:', e);

    return () => ws.close();
  }, [url]);

  return { estado, conectado };
}