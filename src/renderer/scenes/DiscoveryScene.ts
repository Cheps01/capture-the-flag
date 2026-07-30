import Phaser from 'phaser';
import { setPlayerId, setConfig, getPlayerName } from '../client/ClientState';

interface ServerEntry {
    name: string;
    address: string;
    port: number;
    state: string;
    players: number;
    textObjects: Phaser.GameObjects.Text[];
    bg: Phaser.GameObjects.Rectangle;
}

export class DiscoveryScene extends Phaser.Scene {

    private servers: ServerEntry[] = [];
    private listContainer: Phaser.GameObjects.Container | null = null;
    private statusText: Phaser.GameObjects.Text | null = null;
    private ipValue = '';
    private ipText: Phaser.GameObjects.Text | null = null;
    private searching = true;

    constructor() {
        super({ key: 'DiscoveryScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        this.add.text(width / 2, 50, 'Buscar Servidores', {
            fontSize: '32px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Status ───────────────────────────────────────────────
        this.statusText = this.add.text(width / 2, 90, 'Buscando servidores...', {
            fontSize: '14px',
            color: '#a0a0a0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Server List ──────────────────────────────────────────
        this.listContainer = this.add.container(width / 2, 120);
        this.servers = [];

        // ── Manual IP Input ──────────────────────────────────────
        this.add.text(width / 2, height - 140, 'Conexión manual:', {
            fontSize: '14px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.rectangle(width / 2, height - 110, 300, 32, 0x0a0a1a)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0x16213e);

        this.ipText = this.add.text(width / 2, height - 110, 'IP:puerto o IP', {
            fontSize: '14px',
            color: '#666666',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.createButton(width / 2, height - 70, 'Conectar', () => {
            this.connectManual();
        });

        // ── Buttons ──────────────────────────────────────────────
        this.createButton(width / 2, height - 30, 'Refrescar', () => {
            this.discover();
        });

        this.createButton(80, height - 30, 'Volver', () => {
            this.cleanup();
            this.scene.start('MenuScene');
        });

        // ── Keyboard for IP input ────────────────────────────────
        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            const focused = document.activeElement;
            if (focused && focused.tagName === 'INPUT') return;

            if (this.ipText && this.ipText.style.color === '#666666') {
                this.ipValue = '';
            }

            if (event.key === 'Backspace') {
                this.ipValue = this.ipValue.slice(0, -1);
            } else if (event.key.length === 1) {
                this.ipValue += event.key;
            }

            if (this.ipText) {
                this.ipText.setText(this.ipValue || 'IP:puerto o IP');
                this.ipText.setColor(this.ipValue ? '#ffffff' : '#666666');
            }
        });

        // ── Start discovery ──────────────────────────────────────
        this.registerListeners();
        this.discover();
    }

    private registerListeners(): void {
        const wc = (window as any).client;
        if (!wc) return;

        wc.onServerInfo((data: any, address: string) => {
            this.addServer(data, address);
        });

        wc.onConnected(() => {
            const name = getPlayerName() || 'Player';
            wc.join(name);
        });

        wc.onWelcome((data: any) => {
            setPlayerId(data.player_id);
            setConfig(data.config);
            this.cleanup();
            this.scene.start('LobbyScene', { isServer: false });
        });

        wc.onLobby((data: any) => {
            // First lobby received after welcome — scene is already transitioning
        });

        wc.onDisconnected(() => {
            this.statusText?.setText('Desconectado del servidor');
        });
    }

    private discover(): void {
        this.searching = true;
        this.statusText?.setText('Buscando servidores...');
        (window as any)?.client?.discover?.(8888);
    }

    private addServer(data: any, address: string): void {
        if (!this.listContainer) return;

        const existing = this.servers.find(
            s => s.address === address && s.port === data.tcp_port
        );
        if (existing) {
            existing.players = data.players;
            existing.state = data.state;
            if (existing.textObjects[1]) {
                existing.textObjects[1].setText(`${data.players} jugadores · ${data.state}`);
            }
            return;
        }

        const y = this.servers.length * 60;
        const bg = this.add.rectangle(0, y, 500, 50, 0x16213e)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const t1 = this.add.text(-230, y - 12, `${data.name}`, {
            fontSize: '16px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
        }).setOrigin(0, 0.5);

        const t2 = this.add.text(-230, y + 10, `${address} · ${data.players} jugadores · ${data.state}`, {
            fontSize: '12px',
            color: '#a0a0a0',
            fontFamily: 'monospace',
        }).setOrigin(0, 0.5);

        const t3 = this.add.text(230, y, 'Unirse →', {
            fontSize: '14px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
        }).setOrigin(1, 0.5);

        this.listContainer.add([bg, t1, t2, t3]);

        const entry: ServerEntry = {
            name: data.name,
            address: address,
            port: data.tcp_port,
            state: data.state,
            players: data.players,
            textObjects: [t1, t2, t3],
            bg,
        };

        bg.on('pointerover', () => bg.setFillStyle(0x0f3460));
        bg.on('pointerout', () => bg.setFillStyle(0x16213e));
        bg.on('pointerdown', () => this.connectToServer(entry));

        this.servers.push(entry);
        this.searching = false;
        this.statusText?.setText(`${this.servers.length} servidor(es) encontrado(s)`);
    }

    private connectToServer(entry: ServerEntry): void {
        this.statusText?.setText(`Conectando a ${entry.name}...`);
        const wc = (window as any).client;
        if (!wc) return;
        wc.connect(entry.address, entry.port);
    }

    private connectManual(): void {
        const input = this.ipValue.trim();
        if (!input) {
            this.statusText?.setText('Ingresa una IP');
            return;
        }

        let host: string;
        let port: number;

        if (input.includes(':')) {
            const parts = input.split(':');
            host = parts[0];
            port = parseInt(parts[1], 10);
            if (isNaN(port)) {
                this.statusText?.setText('Puerto inválido');
                return;
            }
        } else {
            host = input;
            port = 8889;
        }

        this.statusText?.setText(`Conectando a ${host}:${port}...`);

        const wc = (window as any).client;
        if (!wc) return;

        wc.connect(host, port);
    }

    private cleanup(): void {
        this.searching = false;
        // IPC listeners persist (they're on the window), which is fine
        // since we want to keep receiving messages.
    }

    private createButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 200, 40, 0x16213e)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '16px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        bg.on('pointerover', () => {
            bg.setFillStyle(0x0f3460);
            text.setColor('#ffffff');
        });
        bg.on('pointerout', () => {
            bg.setFillStyle(0x16213e);
            text.setColor('#a0c4ff');
        });
        bg.on('pointerdown', onClick);
    }
}
