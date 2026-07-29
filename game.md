# CTF Game — Documentación de Implementación

## Resumen

Juego Capture The Flag implementado con Electron + Phaser + TypeScript + Vite, siguiendo el protocolo CTF v1.2.0 definido en `CTF-protocol.md`.

---

## Arquitectura

```
src/
  main/                          # Proceso principal de Electron
    main.ts                      # Entry point, lifecycle de la app
    window.ts                    # Creación de BrowserWindow
    preload.ts                   # Bridge IPC: expone APIs al renderer
    ipc.ts                       # Handlers IPC: main ↔ renderer
    network/
      tcpClient.ts               # Cliente TCP (framing newline-delimited JSON)
      tcpServer.ts               # Servidor TCP multi-client
      udpBroadcaster.ts          # UDP broadcast + subnet broadcast
      udpListener.ts             # Escucha UDP en puerto 8888

  renderer/                      # Proceso renderer (Phaser + lógica del juego)
    renderer.ts                  # Bootstrap de Phaser, registro de escenas
    client/
      ClientState.ts             # Estado compartido del cliente
    server/
      GameServer.ts              # State machine del servidor + tick loop
    scenes/
      MenuScene.ts               # Menú principal (nombre + modo)
      DiscoveryScene.ts          # Búsqueda de servidores (UDP)
      LobbyScene.ts              # Sala de espera
      GameScene.ts               # Juego (renderizado + input)
      GameOverScene.ts           # Pantalla de victoria

  shared/
    types.ts                     # Tipos del protocolo, constantes, interfaces
    protocol.ts                  # (reservado)
```

### Flujo de datos

```
┌─────────────────────────────────────────────────────────┐
│  Renderer Process                                       │
│                                                         │
│  MenuScene ──→ GameServer (host) ──→ window.server.*    │
│       │              │                    │              │
│       │              ▼                    ▼              │
│       │         GameScene          ┌──────────────┐     │
│       │              │             │  IPC Bridge  │     │
│       │              │             │  (preload)   │     │
│       ▼              │             └──────┬───────┘     │
│  DiscoveryScene ────→│── window.client.*  │             │
│       │              │                    │              │
│       ▼              ▼                    ▼              │
│  LobbyScene ←──── callbacks ←──── Main Process          │
│       │                             │                   │
│       ▼                             ▼                   │
│  GameScene ──────────────→  TCP/UDP Sockets              │
│       │                                                   │
│       ▼                                                   │
│  GameOverScene ──→ LobbyScene (ciclo)                     │
└─────────────────────────────────────────────────────────┘
```

---

## Fase 1: Pantallas UI + Servidor Mínimo

### Archivos creados/modificados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `src/renderer/client/ClientState.ts` | NUEVO | Estado del cliente: playerId, playerName, config, isServer |
| `src/renderer/server/GameServer.ts` | NUEVO | State machine: lobby → countdown → playing → game_over |
| `src/renderer/scenes/MenuScene.ts` | REESCRITO | Campo de nombre + botones servidor/cliente |
| `src/renderer/scenes/DiscoveryScene.ts` | NUEVO | UDP discover, lista de servidores, IP manual |
| `src/renderer/scenes/LobbyScene.ts` | NUEVO | Sala de espera con lista de jugadores |
| `src/renderer/scenes/GameOverScene.ts` | NUEVO | Ganador + 5s regreso al lobby |
| `src/renderer/scenes/GameScene.ts` | NUEVO | Stub placeholder |
| `src/renderer/renderer.ts` | MODIFICADO | Registro de 5 escenas |
| `src/main/preload.ts` | MODIFICADO | onServerInfo pasa address |
| `src/main/ipc.ts` | MODIFICADO | Reenvía rinfo.address en discover |
| `src/main/network/udpBroadcaster.ts` | MODIFICADO | Envía a broadcast de subred |

### GameServer — Lobby

```typescript
class GameServer {
    // Estado
    phase: 'lobby' | 'countdown' | 'playing' | 'game_over'
    players: Map<playerId, Player>
    flag: FlagState

    // Acciones
    start(port)              // Inicia TCP server + UDP listener
    handleJoin(clientId, msg) // Valida nombre, envía welcome + lobby
    startCountdown()          // Inicia timer de 5s
}
```

**Validaciones de join (protocolo §2.3.2):**
- Phase debe ser `lobby`
- `v` debe ser exactamente 1
- Nombre: 1-20 chars UTF-8, sin control chars
- Máximo 100 jugadores
- Segundo `join` en la misma conexión → `INVALID_PHASE`

### DiscoveryScene — Búsqueda

1. Envía `{"type":"discover","v":1}` por UDP broadcast (255.255.255.255 + subnet)
2. Recibe `server_info` con nombre, tcp_port, state, players
3. Muestra lista de servidores con IP + puerto
4. Conexión manual: campo `IP:puerto` o `IP` (default 8889)
5. Conecta por TCP → recibe `welcome` → LobbyScene

### LobbyScene — Sala de espera

**Servidor:**
- Muestra lista de jugadores
- Botón "Iniciar Partida" habilitado con ≥ 2 jugadores
- Click → `startCountdown()`

**Cliente:**
- Muestra lista de jugadores (recibida vía IPC)
- Texto "Esperando..."
- Recibe `countdown` → muestra números
- Recibe `start` → GameScene

---

## Fase 2: Juego Completo

### GameServer — Tick Loop

```
┌─────────────────────────────────────────────┐
│  Tick (50ms = 20 Hz)                        │
│                                             │
│  1. Calcular dt desde último tick           │
│  2. Para cada jugador:                      │
│     - Integrar dir × speed × dt             │
│     - Normalizar diagonal (÷ √2)            │
│     - Clamp a [15, 985]                     │
│  3. Verificar victoria:                     │
│     - Portador existente                    │
│     - wasInsideCircle=true AND ahora fuera  │
│     → endGame(winnerId)                     │
│  4. Broadcast state                         │
└─────────────────────────────────────────────┘
```

### Constantes del juego (protocolo §2.3.3)

| Constante | Valor | Significado |
|-----------|-------|-------------|
| `map_size` | 1000 | Mapa 1000×1000 unidades |
| `circle_radius` | 300 | Radio del círculo central |
| `player_radius` | 15 | Radio del cuerpo del jugador |
| `interact_radius` | 40 | Distancia para capturar/robar bandera |
| `speed` | 200 | Velocidad de movimiento (u/s) |
| `tick_rate` | 20 | Envíos de estado por segundo |
| `victory_distance` | 315 | circle_radius + player_radius |
| `spawn_radius_min/max` | 350/450 | Anillo de aparición |

### Movimiento (protocolo §3.3)

```typescript
// Velocidad base
speed = 200

// Normalización diagonal
if (dx !== 0 && dy !== 0) speed /= √2

// Integración
player.x += dx × speed × dt
player.y += dy × speed × dt

// Clamp
player.x = clamp(player.x, 15, 985)
player.y = clamp(player.y, 15, 985)
```

### Captura y robo (protocolo §3.3)

```
Bandera libre:
  interact + distancia(flag, jugador) ≤ 40 → captura
  flag.owner = jugador
  jugador.wasInsideCircle = isInsideCircle(jugador)

Bandera portada:
  interact + distancia(portador, jugador) ≤ 40 → robo
  flag.owner = nuevo_jugador
  nuevo_jugador.wasInsideCircle = isInsideCircle(nuevo_jugador)
```

### Victoria (protocolo §3.3)

```
Condición: portador pasa de dentro a fuera del círculo
  wasInsideCircle = true  (al momento de capturar/robar)
  isInsideCircle() = true → false  (al moverse)

  Se registra en cada tick:
    carrier.wasInsideCircle = isInsideCircle(carrier.x, carrier.y)

  Si wasInsideCircle era true Y ahora es false → victoria
```

**Importante:** El protocolo exige la transición. Un jugador que roba estando fuera NO gana al instante.

### GameScene — Renderizado

**Mapa:**
- Fondo oscuro (#1a1a2e)
- Borde del mapa (1000×1000)
- Grid sutil cada 100 unidades
- Círculo central rojo (radio 300, borde + fill sutil)
- Punto central rojo

**Jugadores:**
- Círculo de color (8 colores asignados por índice)
- Etiqueta de nombre arriba
- Indicador dorado cuando porta la bandera
- Colores: `#4fc3f7`, `#f06292`, `#ffd54f`, `#81c784`, `#ba68c8`, `#ff8a65`, `#aed581`, `#7986cb`

**Bandera:**
- Asta + triángulo rojo cuando libre
- Diamante dorado cuando portada

**Cámara:**
- Sigue al jugador local (suavizado 0.1)
- Zoom 0.8 (visible casi todo el ancho del mapa)
- Bounds: 0,0 → 1000,1000

### Input

| Tecla | Acción |
|-------|--------|
| WASD / Flechas | Mover (dirección 8-way) |
| Espacio | Interactuar (capturar/robar bandera) |

**Envío de input:**
- Solo se envía cuando la dirección cambia (no cada frame)
- Host: `gameServer.processLocalInput(dir)` (directo, sin TCP)
- Cliente: `window.client.input(dir)` (vía IPC → TCP)

---

## Ciclo de vida de la partida

```
Lobby → Countdown (5s) → Playing → Game Over → Pausa (5s) → Lobby
  │                                         │
  │ min_players < 2 durante countdown       │ game_over winner
  │ → abort → Lobby                         │ → 5s → Lobby
  └─────────────────────────────────────────┘
```

### Conexión completa (cliente)

```
1. MenuScene: ingresa nombre
2. DiscoveryScene: UDP discover → lista → selecciona servidor
3. TCP connect → receive welcome(player_id, config)
4. LobbyScene: espera jugadores
5. receive countdown(5,4,3,2,1) → receive start
6. GameScene: juego activo
7. receive game_over(winner) → GameOverScene
8. 5 segundos → LobbyScene
```

### Conexión completa (servidor/host)

```
1. MenuScene: ingresa nombre → "Iniciar como Servidor"
2. GameServer.start(8889) → TCP + UDP listening
3. LobbyScene: ve jugadores conectarse
4. ≥2 jugadores → "Iniciar Partida"
5. Countdown 5s → start → tick loop
6. Juego activo (host juega con WASD/Espacio)
7. Victoria → GameOverScene → 5s → LobbyScene
```

---

## Manejo de desconexiones (protocolo §5.2)

| Fase | Acción | Bandera |
|------|--------|---------|
| Lobby | Eliminar jugador, actualizar lobby | Sin cambios |
| Countdown | Eliminar; si <2 → abortar countdown | Sin cambios |
| Playing | Eliminar jugador, continuar | Sin cambios |
| Playing (portador) | Eliminar, bandera al centro (500,500) | `owner=null` |
| Todos se van | Volver al lobby | Al centro |

---

## Errores del protocolo (§5.1.1)

Los mensajes de error se envían con `reason` en MAYÚSCULAS_CON_GUIONES_BAJOS:

| Código | Cuando | Cierra conexión |
|--------|--------|-----------------|
| `VERSION_MISMATCH` | Versión incompatible | Sí |
| `LOBBY_FULL` | >100 jugadores | Sí |
| `NAME_INVALID` | Nombre vacío/largo/inválido | No |
| `GAME_STARTED` | Join durante countdown/playing | Sí |
| `INVALID_PHASE` | Acción en fase incorrecta | No |
| `INVALID_FIELD` | dir fuera de {-1,0,1} | No |
| `NOT_JOINED` | Acción antes de join | No |
| `MESSAGE_TOO_LARGE` | >64 KB | Sí |

---

## Para ejecutar

```bash
npm run dev        # Vite dev server + Electron (hot reload)
npm run build      # Build producción → dist/
npx tsc --noEmit   # Type check
```

### Prueba local

1. `npm run dev` en dos terminales (o dos instancias)
2. Instancia 1: nombre → "Iniciar como Servidor" → LobbyScene
3. Instancia 2: nombre → "Unirse como Cliente" → DiscoveryScene → `127.0.0.1:8889`
4. Ambas en LobbyScene → Servidor inicia partida
5. Countdown → GameScene → jugar con WASD + Espacio

---

## Pendiente / Mejoras futuras

- [ ] Sonidos de captura, robo, victoria
- [ ] Animaciones de movimiento
- [ ] Scoreboard persistente entre rondas
- [ ] Chat en lobby
- [ ] Reconexión de clientes
- [ ] Timeout de inactividad (protocolo v2)
- [ ] Efectos visuales de la bandera
- [ ] Minimapas
- [ ] Soporte para más de 2 jugadores de forma robusta
