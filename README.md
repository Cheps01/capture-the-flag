# Capture the Flag

Juego de escritorio multijugador en red del tipo *Capture the Flag* (Captura la Bandera). Cada instancia de la aplicación puede funcionar como **servidor** (host) o como **cliente** que se conecta a un host existente. La comunicación se realiza mediante un protocolo de aplicación personalizado sobre TCP y UDP.

## Tecnologías

| Tecnología | Versión | Uso |
|---|---|---|
| **Electron** | ^43.2.0 | Shell de escritorio; gestiona ventana, IPC y red en el proceso principal |
| **Phaser** | ^4.2.1 | Motor de juegos 2D; escenas, renderizado y input en el proceso renderer |
| **TypeScript** | ^7.0.2 | Lenguaje tipado para todo el código fuente |
| **Vite** | ^8.1.5 | Bundler y servidor de desarrollo con HMR |
| **vite-plugin-electron** | ^1.1.0 | Integración entre Vite y Electron |
| **Node.js net** | (built-in) | Sockets TCP para conexión cliente-servidor |
| **Node.js dgram** | (built-in) | Sockets UDP para descubrimiento de servidores en LAN |

## Arquitectura

```
src/
├── main/                          # Proceso Principal (Node.js / Electron)
│   ├── main.ts                    # Punto de entrada de Electron
│   ├── window.ts                  # Creación de la ventana BrowserWindow
│   ├── preload.ts                 # contextBridge: expone APIs de red al renderer
│   ├── ipc.ts                     # Handlers IPC: puente entre renderer y red
│   └── network/
│       ├── tcpServer.ts           # Servidor TCP: acepta conexiones de clientes
│       ├── tcpClient.ts           # Cliente TCP: se conecta a un servidor
│       ├── udpBroadcaster.ts      # Envía broadcasts UDP para descubrir servidores
│       └── udpListener.ts         # Escucha broadcasts UDP (lado servidor)
│
├── renderer/                      # Proceso Renderer (Chromium / Phaser)
│   ├── renderer.ts                # Bootstrap de Phaser y registro de escenas
│   ├── client/
│   │   └── ClientState.ts         # Estado local del jugador (nombre, ID, config)
│   ├── server/
│   │   └── GameServer.ts          # Lógica del juego (solo cuando actúa como host)
│   └── scenes/
│       ├── MenuScene.ts           # Menú principal: nombre y elección de modo
│       ├── DiscoveryScene.ts      # Descubrimiento de servidores en LAN + conexión manual
│       ├── LobbyScene.ts          # Sala de espera: lista de jugadores y countdown
│       ├── GameScene.ts           # Partida: renderizado del mapa, jugadores y bandera
│       └── GameOverScene.ts       # Pantalla de fin de partida con ganador
│
└── shared/                        # Código compartido entre procesos
    ├── types.ts                   # Tipos del protocolo, constantes del juego y mensajes
    └── protocol.ts                # (reservado para futuras funciones del protocolo)
```

### Proceso Principal (Main)

El proceso principal gestiona toda la capa de red y la ventana de Electron. Se comunica con el renderer mediante **IPC** (`ipcMain.handle` / `ipcRenderer.invoke`).

- **Red TCP**: `tcpServer.ts` y `tcpClient.ts` manejan conexiones persistentes con framing JSON-delimitado por saltos de línea. Cada mensaje se serializa como `JSON.stringify(msg) + '\n'`.
- **Red UDP**: `udpBroadcaster.ts` envía paquetes de descubrimiento (`discover`) a la dirección de broadcast de la subred. `udpListener.ts` escucha en el puerto 8888 y responde con `server_info`.
- **Preload**: `preload.ts` usa `contextBridge.exposeInMainWorld` para exponer dos objetos globales en el renderer: `window.client` (API de cliente) y `window.server` (API de servidor).

### Proceso Renderer (Game)

El renderer ejecuta Phaser con 5 escenas que forman el flujo del juego:

1. **MenuScene** → El jugador ingresa su nombre y elige ser Servidor o Cliente.
2. **DiscoveryScene** (cliente) → Busca servidores en la LAN vía UDP o permite conexión manual por IP.
3. **LobbyScene** → Lista de jugadores conectados. El host puede iniciar la partida cuando hay ≥2 jugadores.
4. **GameScene** → Partida en tiempo real. Renderiza mapa, jugadores (círculos con nombre) y bandera. El servidor ejecuta la lógica a 20 ticks/segundo; el cliente recibe y renderiza snapshots de estado.
5. **GameOverScene** → Muestra el ganador y regresa al lobby tras 5 segundos.

### Protocolo de Red

El protocolo es **v1**, basado en mensajes JSON delimitados por `\n`:

**Descubrimiento (UDP, puerto 8888):**
| Mensaje | Dirección | Campos |
|---|---|---|
| `discover` | Cliente → LAN (broadcast) | `type`, `v` |
| `server_info` | Servidor → Cliente (unicast) | `type`, `v`, `name`, `tcp_port`, `state`, `players` |

**Partida (TCP):**
| Mensaje | Dirección | Campos clave |
|---|---|---|
| `join` | Cliente → Servidor | `name`, `v` |
| `welcome` | Servidor → Cliente | `player_id`, `config` (map_size, speed, tick_rate, etc.) |
| `lobby` | Servidor → Todos | `players[]` |
| `countdown` | Servidor → Todos | `seconds` |
| `start` | Servidor → Todos | — |
| `input` | Cliente → Servidor | `dir: {x, y}` (valores -1, 0, 1) |
| `interact` | Cliente → Servidor | — (capturar/robar bandera) |
| `state` | Servidor → Todos | `flag`, `players[]` (posiciones) |
| `game_over` | Servidor → Todos | `winner` |
| `error` | Servidor → Cliente | `reason` |

### Constantes del Juego

| Parámetro | Valor |
|---|---|
| Tamaño del mapa | 1000 × 1000 px |
| Radio del círculo central | 300 px |
| Radio del jugador | 15 px |
| Radio de interacción | 40 px |
| Velocidad de movimiento | 200 px/s |
| Tick rate del servidor | 20 ticks/s |
| Jugadores mínimos | 2 |
| Jugadores máximos | 100 |

### Condiciones de Victoria

Un jugador gana si携带 la bandera y se mueve desde **dentro** del círculo central hacia **fuera** de él (transición内外 → 外外).

## Inicio Rápido

```bash
npm install
npm run dev      # Inicia Vite + Electron con hot reload
npm run build    # Build de producción en dist/
```

## Requisitos

- Node.js ≥ 18
- npm
