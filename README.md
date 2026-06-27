Estoy en mi cas, y el profe me dijo que cumpla SOLO CON ESTE MODELO DE EVALUACION, una vez que lo logre simplemente se lo muestra el juego FUNCIONANDO, pero pricipalmente debe cumplir con este modelo

## Estrategia de Evaluación: "The Pico Stress Test"

La evaluación se dividirá en tres estaciones de control. Los docentes actuarán como "Product Owners" y los estudiantes como el equipo de ingeniería presentando su MVP.

### 1. Estación de Conectividad y Handshake (Protocolo)

Antes de jugar, el equipo debe demostrar que la arquitectura de red es sólida.

- **La prueba del QR/IP:** El docente debe poder conectar su propio smartphone al juego usando el código QR o la IP generada en pantalla.

- **Latencia (Lag):** Se evaluará visualmente si hay un retraso perceptible entre el toque en el móvil y la reacción en la pantalla principal.

- **Hot-Join:** ¿Qué pasa si un quinto jugador intenta entrar? ¿O si un jugador apaga su pantalla y se desconecta? El sistema debe manejar estos errores sin "crashear" el servidor.

---

### 2. Estación de Mecánicas y Niveles (Gameplay)

Aquí es donde se prueba el diseño de los niveles y la física.

| **Funcionalidad** | **Criterio de Aceptación (Checklist)** |

| --- | --- |

| **Sincronización de Cajas** | Si dos personas empujan una caja desde el mismo lado, ¿se mueve más rápido o igual? (Suma de fuerzas). |

| **Colisión de Jugadores** | Los personajes no deben atravesarse; deben poder saltar uno sobre otro para formar torres. |

| **Lógica de la Llave** | Solo un jugador puede cargar la llave. Si ese jugador cae al vacío, la llave debe reaparecer (respawn). |

| **Condición de Victoria** | La puerta no se abre sin la llave y el nivel no termina hasta que los **4 jugadores** estén en la zona de salida. |

---

### 3. El "Chaos Test" (Defensa Técnica)

En esta etapa, los docentes intentarán "romper" el juego de manera controlada para evaluar la robustez del código:

1. **Input Spam:** Todos los jugadores presionan "Salto" y "Derecha" repetidamente al mismo tiempo. El servidor de WebSockets no debe saturarse.

2. **The Wall Hug:** Un jugador intenta caminar infinitamente contra una pared. La física no debe permitir que el personaje se "trague" la pared o atraviese el mapa.

3. **Pregunta Técnica:** *"¿Cómo manejaron la autoridad de la física? ¿La calcula el celular o el servidor?"* (La respuesta correcta para evitar trampas siempre es el servidor).

---





Pregunta Técnica: "¿Cómo manejaron la autoridad de la física? ¿La calcula el celular o el servidor?" (La respuesta correcta para evitar trampas siempre es el servidor).



Actualmente mi codigo funciona asi



