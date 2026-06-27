import React, { useState, useRef }        from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
}                                          from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import type { InfoJugador } from '../App';

interface Props {
  onConectado: (info: InfoJugador, ws: WebSocket) => void;
}

export function PantallaConexion({ onConectado }: Props) {
  const [ip, setIp]                     = useState('');
  const [conectando, setConectando]     = useState(false);
  const [modoQR, setModoQR]             = useState(false);
  const [permisoCam, pedirPermisoCam]   = useCameraPermissions();

  // Evita manejar la conexión dos veces si hay eventos simultáneos
  const conexionManejada = useRef(false);

  //Limpiar la IP ingresada 
  function limpiarIP(texto: string): string {
    return texto
      .trim()
      .replace(/^https?:\/\//, '')  
      .split('/')[0];              
  }

  //Conectar al servidor 
  function conectar(ipTexto: string) {
    const host = limpiarIP(ipTexto);

    if (!host) {
      Alert.alert('Error', 'Ingresá una IP válida, ej: 192.168.1.5:3000');
      return;
    }

    const urlWS = `ws://${host}/ws`;
    setConectando(true);
    conexionManejada.current = false;

    let ws: WebSocket;
    try {
      ws = new WebSocket(urlWS);
    } catch {
      setConectando(false);
      Alert.alert('Error', 'URL inválida. Verificá la IP.');
      return;
    }

    const timerTimeout = setTimeout(() => {
      if (!conexionManejada.current) {
        conexionManejada.current = true;
        ws.close();
        setConectando(false);
        Alert.alert('Sin respuesta', 'El servidor no respondió. ¿Está corriendo el juego?');
      }
    }, 6000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ tipo: 'gamepad' }));
    };

    ws.onmessage = (evento) => {
      if (conexionManejada.current) return;

      let mensaje: any;
      try {
        mensaje = JSON.parse(evento.data);
      } catch {
        return;
      }

      if (mensaje.tipo === 'bienvenido') {
        conexionManejada.current = true;
        clearTimeout(timerTimeout);
        setConectando(false);

        const info: InfoJugador = {
          id:     mensaje.id,
          nombre: mensaje.nombre,
          color:  mensaje.color,
        };
        onConectado(info, ws);
      }

      if (mensaje.tipo === 'partida-llena') {
        conexionManejada.current = true;
        clearTimeout(timerTimeout);
        ws.close();
        setConectando(false);
        Alert.alert('Partida llena', 'Ya hay 4 jugadores. Esperá a que haya lugar.');
      }
    };

    ws.onerror = () => {
      if (conexionManejada.current) return;
      conexionManejada.current = true;
      clearTimeout(timerTimeout);
      setConectando(false);
      Alert.alert('Sin conexión', `No se pudo conectar a ${host}.\nVerificá la IP e intentá de nuevo.`);
    };

    ws.onclose = () => {
      clearTimeout(timerTimeout);
    };
  }

  //Abrir cámara para QR
  async function abrirCamaraQR() {
    if (!permisoCam?.granted) {
      const resultado = await pedirPermisoCam();
      if (!resultado.granted) {
        Alert.alert('Permiso denegado', 'Necesitamos la cámara para escanear el QR.');
        return;
      }
    }
    setModoQR(true);
  }

  function alEscanearQR({ data }: { data: string }) {
    if (conectando) return;
    setModoQR(false);
    setIp(data);
    conectar(data);
  }

  if (modoQR) {
    return (
      <View style={estilos.contenedor}>
        <CameraView
          style={StyleSheet.absoluteFill}
          onBarcodeScanned={alEscanearQR}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        <View style={estilos.qrSuperpuesto}>
          <View style={estilos.qrMarco} />
          <Text style={estilos.qrTexto}>Apuntá al QR del juego</Text>
          <TouchableOpacity
            style={estilos.botonCancelar}
            onPress={() => setModoQR(false)}
          >
            <Text style={estilos.botonCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={estilos.contenedor}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={estilos.formulario}>

        <Text style={estilos.subtitulo}>Gamepad — PicoPark</Text>

        <TouchableOpacity
          style={estilos.botonQR}
          onPress={abrirCamaraQR}
          disabled={conectando}
        >
          <Text style={estilos.botonQRTexto}>📷  Escanear QR del juego</Text>
        </TouchableOpacity>

        <Text style={estilos.separador}>— o ingresá la IP manualmente —</Text>

        <TextInput
          style={estilos.input}
          value={ip}
          onChangeText={setIp}
          placeholder="ej: 192.168.1.5:3000"
          placeholderTextColor="#555"
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!conectando}
          onSubmitEditing={() => ip.trim() && conectar(ip)}
        />

        <TouchableOpacity
          style={[
            estilos.botonConectar,
            (conectando || !ip.trim()) && estilos.botonDeshabilitado,
          ]}
          onPress={() => conectar(ip)}
          disabled={conectando || !ip.trim()}
        >
          {conectando
            ? <ActivityIndicator color="#1a1a2e" />
            : <Text style={estilos.botonConectarTexto}>Conectar</Text>
          }
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  contenedor: {
    flex:            1,
    backgroundColor: '#0f0f1e',
  },
  formulario: {
    flex:              1,
    justifyContent:    'center',
    alignItems:        'center',
    paddingHorizontal: 28,
    gap:               14,
  },
  subtitulo: {
    fontSize:      13,
    color:         '#556',
    marginBottom:  8,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  botonQR: {
    width:             '100%',
    backgroundColor:   '#151528',
    borderRadius:      14,
    paddingVertical:   16,
    paddingHorizontal: 24,
    alignItems:        'center',
    borderWidth:       1.5,
    borderColor:       '#85bdd8',
  },
  botonQRTexto: {
    color:      '#85bdd8',
    fontSize:   15,
    fontWeight: '700',
  },
  separador: {
    color:         '#333',
    fontSize:      12,
    letterSpacing: 1,
  },
  input: {
    width:             '100%',
    backgroundColor:   '#151528',
    borderRadius:      12,
    paddingVertical:   16,
    paddingHorizontal: 16,
    color:             '#e0e0ff',
    fontSize:          16,
    textAlign:         'center',
    letterSpacing:     2,
    borderWidth:       1.5,
    borderColor:       '#2a2a5e',
  },
  botonConectar: {
    width:           '100%',
    backgroundColor: '#85bdd8',
    borderRadius:    12,
    paddingVertical: 16,
    alignItems:      'center',
  },
  botonDeshabilitado: { opacity: 0.5 },
  botonConectarTexto: {
    color:         '#0f0f1e',
    fontSize:      17,
    fontWeight:    'bold',
    letterSpacing: 1,
  },
  qrSuperpuesto: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  qrMarco: {
    width:           250,
    height:          250,
    borderWidth:     3,
    borderColor:     '#85bdd8',
    borderRadius:    16,
    backgroundColor: 'transparent',
  },
  qrTexto: {
    color:             '#e0e0ff',
    fontSize:          15,
    marginTop:         24,
    backgroundColor:   'rgba(0,0,0,0.75)',
    paddingVertical:   8,
    paddingHorizontal: 16,
    borderRadius:      10,
  },
  botonCancelar: {
    marginTop:         20,
    backgroundColor:   'rgba(0,0,0,0.8)',
    paddingVertical:   12,
    paddingHorizontal: 32,
    borderRadius:      10,
    borderWidth:       1,
    borderColor:       '#444',
  },
  botonCancelarTexto: { color: '#aaa', fontSize: 15 },
});