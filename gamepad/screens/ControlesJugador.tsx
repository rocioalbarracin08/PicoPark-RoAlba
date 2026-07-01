import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
}                             from 'react-native';
import { useKeepAwake }       from 'expo-keep-awake';
import * as Orientacion       from 'expo-screen-orientation';
import { SafeAreaView }       from 'react-native-safe-area-context';

import type { InfoJugador } from '../App';

const TAMANIO_BTN      = 72;
const TAMANIO_BTN_SALTO = 110;

type Direccion = 'izquierda' | 'derecha' | 'salto' | 'arriba';

interface Props {
  ws:            WebSocket;
  infoJugador:   InfoJugador;
  onDesconectar: () => void;
}

export function PantallaGamepad({ ws, infoJugador, onDesconectar }: Props) {

  useKeepAwake(); //Evita que la pantalla se apague

  const [conectado, setConectado] = useState(ws.readyState === WebSocket.OPEN);
  const [fase, setFase]           = useState('jugando');

  const botonesPresionados = useRef<Set<Direccion>>(new Set());

  //orientación horizontal 
  useEffect(() => {
    Orientacion.lockAsync(Orientacion.OrientationLock.LANDSCAPE);
    return () => {
      Orientacion.lockAsync(Orientacion.OrientationLock.PORTRAIT_UP);
    };
  }, []);

  useEffect(() => {
    const alAbrir = () => setConectado(true);
    const alCerrar = () => {
      setConectado(false);
      onDesconectar();
    };

    const alMensaje = (evento: MessageEvent) => {
      let mensaje: any;
      try {
        mensaje = JSON.parse(evento.data);
      } catch {
        return;
      }

      if (mensaje.tipo === 'estado') {
        setFase(mensaje.fase);
      }
    };

    ws.addEventListener('open',    alAbrir);
    ws.addEventListener('close',   alCerrar);
    ws.addEventListener('message', alMensaje);

    return () => {
      ws.removeEventListener('open',    alAbrir);
      ws.removeEventListener('close',   alCerrar);
      ws.removeEventListener('message', alMensaje);
    };
  }, [ws, onDesconectar]);

  const alPresionar = useCallback((direccion: Direccion) => {
    if (botonesPresionados.current.has(direccion)) return; // ya estaba presionado
    botonesPresionados.current.add(direccion);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        tipo:      'input',
        direccion,
        estado:    'presionado',
      }));
    }
  }, [ws]);

  const alSoltar = useCallback((direccion: Direccion) => {
    if (!botonesPresionados.current.has(direccion)) return; // ya estaba suelto
    botonesPresionados.current.delete(direccion);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        tipo:      'input',
        direccion,
        estado:    'soltado',
      }));
    }
  }, [ws]);

  const colorLed = conectado ? '#00ff88' : '#ff4444';

  return (
    <SafeAreaView style={estilos.contenedor}>
      <View style={estilos.barra}>

        <View style={estilos.filaLed}>
          <View style={[estilos.led, { backgroundColor: colorLed }]} />
          <Text style={estilos.ledTexto}>
            {conectado ? 'Conectado' : 'Sin conexión'}
          </Text>
        </View>

        <View style={[
          estilos.etiquetaNombre,
          { backgroundColor: infoJugador.color + '33', borderColor: infoJugador.color }
        ]}>
          <Text style={[estilos.textoNombre, { color: infoJugador.color }]}>
            {infoJugador.nombre}
          </Text>
        </View>

        {fase === 'esperando' && (
          <Text style={estilos.textoFase}>⏳ Esperando…</Text>
        )}
        {fase === 'nivel-completado' && (
          <Text style={[estilos.textoFase, { color: '#00ff88' }]}>🎉 ¡Completado!</Text>
        )}

        <TouchableOpacity style={estilos.botonSalir} onPress={onDesconectar}>
          <Text style={estilos.botonSalirTexto}>Salir</Text>
        </TouchableOpacity>

      </View>

      <View style={estilos.zonaControles} pointerEvents="box-none">

        <View style={estilos.dpad}>

          <View style={estilos.filaDpad}>
            <View style={{ width: TAMANIO_BTN }} />
            <TouchableOpacity
              style={[estilos.botonDireccion, estilos.botonSecundario]}
              onPressIn={() => alPresionar('arriba')}
              onPressOut={() => alSoltar('arriba')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={estilos.textoDireccion}>▲</Text>
            </TouchableOpacity>
            <View style={{ width: TAMANIO_BTN }} />
          </View>

          <View style={estilos.filaDpad}>
            <TouchableOpacity
              style={estilos.botonDireccion}
              onPressIn={() => alPresionar('izquierda')}
              onPressOut={() => alSoltar('izquierda')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={estilos.textoDireccion}>◀</Text>
            </TouchableOpacity>

            <View style={estilos.centroVacio} />

            <TouchableOpacity
              style={estilos.botonDireccion}
              onPressIn={() => alPresionar('derecha')}
              onPressOut={() => alSoltar('derecha')}
              activeOpacity={0.7}
              delayLongPress={999999}
            >
              <Text style={estilos.textoDireccion}>▶</Text>
            </TouchableOpacity>
          </View>

        </View>

        <TouchableOpacity
          style={estilos.botonSalto}
          onPressIn={() => alPresionar('salto')}
          onPressOut={() => alSoltar('salto')}
          activeOpacity={0.8}
          delayLongPress={999999}
        >
          <Text style={estilos.botonSaltoLetra}>A</Text>
          <Text style={estilos.botonSaltoSub}>SALTO</Text>
        </TouchableOpacity>

      </View>

    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({

  contenedor: {
    flex:            1,
    backgroundColor: '#0f0f1e',
  },
  barra: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: 16,
    paddingVertical:  6,
    backgroundColor:  '#1a1a2e',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4e',
  },
  filaLed: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
  },
  led: {
    width:        9,
    height:       9,
    borderRadius: 999,
  },
  ledTexto: {
    color:    '#888',
    fontSize: 11,
  },
  etiquetaNombre: {
    paddingVertical:   3,
    paddingHorizontal: 10,
    borderRadius:      20,
    borderWidth:       1,
  },
  textoNombre: {
    fontSize:   12,
    fontWeight: 'bold',
  },
  textoFase: {
    color:    'white',
    fontSize: 12,
  },
  botonSalir: {
    paddingVertical:   4,
    paddingHorizontal: 10,
    backgroundColor:   '#2a2a4e',
    borderRadius:      6,
  },
  botonSalirTexto: {
    color:    '#777',
    fontSize: 11,
  },

  zonaControles: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 40,
    paddingVertical:   12,
  },

  dpad: {
    alignItems: 'center',
  },
  filaDpad: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  botonDireccion: {
    width:           TAMANIO_BTN,
    height:          TAMANIO_BTN,
    borderRadius:    16,
    backgroundColor: '#1e1e3a',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     2,
    borderColor:     '#3a3a6e',
  },
  botonSecundario: {
    opacity: 0.6,  
  },
  centroVacio: {
    width:  TAMANIO_BTN,
    height: TAMANIO_BTN,
  },
  textoDireccion: {
    color:    'white',
    fontSize: 28,
  },

  botonSalto: {
    width:           TAMANIO_BTN_SALTO,
    height:          TAMANIO_BTN_SALTO,
    borderRadius:    999,
    backgroundColor: '#85bdd8',
    justifyContent:  'center',
    alignItems:      'center',
    borderWidth:     3,
    borderColor:     '#b0d8ea',
  },
  botonSaltoLetra: {
    fontSize:   42,
    fontWeight: 'bold',
    color:      '#0f0f1e',
  },
  botonSaltoSub: {
    fontSize:      10,
    fontWeight:    '700',
    letterSpacing: 1,
    color:         '#0f0f1e',
  },

});