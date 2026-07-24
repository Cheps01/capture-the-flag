# Capture the Flag

This is a desktop capture-the-flag online game. The system has capabitlities to operate as a server and client using a custom application-level protocol to handle all comunication. 

## Arhitecture
```
ctf-game/
├── src/
│   ├── main/                  # Main Process (Node.js)
│   │   ├── main.ts            # Electron entry point
│   │   ├── window.ts          # Window management
│   │   └── network/           # Network sockets
│   │       ├── udp.ts
│   │       └── tcp.ts
│   ├── renderer/              # Renderer Process (Chromium)
│   │   ├── index.html
│   │   ├── renderer.ts
│   │   └── scenes/
│   │       ├── MenuScene.ts
│   │       ├── LobbyScene.ts
│   │       └── GameScene.ts
│   └── shared/                # Shared code for both processes
│       └── protocol.ts
├── package.json
└── tsconfig.json
```