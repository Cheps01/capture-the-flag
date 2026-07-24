# Capture the Flag

This is a desktop capture-the-flag online game. The system has capabitlities to operate as a server and client using a custom application-level protocol to handle all comunication. 

## Arhitecture
```
ctf-game/
├── src/
│   ├── network/               # Network logic
│   │   ├── udp.ts             # Socket UDP (dgram)
│   │   └── tcp.ts             # Socket TCP (net)
│   ├── renderer/              # Renderer process
│   │   ├── index.html         # Renderer entry point
│   │   ├── renderer.ts        # Phaser entry point
│   │   └── scenes/            # Phaser scenes
│   │       ├── MenuScene.ts
│   │       ├── LobbyScene.ts
│   │       └── GameScene.ts
│   ├── shared/                # Shared code from processes
│   │   └── protocol.ts        # Protocol messages defitinition
│   ├── main.ts                # Electron entry point
│   └── window.ts              # Window managment  
├── package.json
└── tsconfig.json
```