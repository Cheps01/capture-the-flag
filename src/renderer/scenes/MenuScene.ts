import Phaser from 'phaser';
import { setPlayerName, setPlayerId, setConfig, setIsServer } from '../client/ClientState';
import { GameServer } from '../server/GameServer';

export class MenuScene extends Phaser.Scene {

    private nameInput: Phaser.GameObjects.Text | null = null;
    private nameValue = '';
    private errorText: Phaser.GameObjects.Text | null = null;
    private gameServer: GameServer | null = null;

    constructor() {
        super({ key: 'MenuScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        this.add.text(width / 2, 100, 'CTF Game', {
            fontSize: '48px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Name Input ───────────────────────────────────────────
        this.add.text(width / 2, 190, 'Tu nombre:', {
            fontSize: '16px',
            color: '#a0c4ff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        const inputBg = this.add.rectangle(width / 2, 225, 300, 36, 0x0a0a1a)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x16213e);

        this.nameInput = this.add.text(width / 2, 225, '', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer) => {
            // Simple click-to-type simulation: we use keyboard events
        });

        this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
            if (event.key === 'Backspace') {
                this.nameValue = this.nameValue.slice(0, -1);
            } else if (event.key.length === 1 && this.nameValue.length < 20) {
                this.nameValue += event.key;
            }
            if (this.nameInput) {
                this.nameInput.setText(this.nameValue || 'Escribe tu nombre...');
                this.nameInput.setColor(this.nameValue ? '#ffffff' : '#666666');
            }
        });

        // ── Buttons ──────────────────────────────────────────────
        this.createButton(width / 2, 320, 'Iniciar como Servidor', () => {
            this.startAsServer();
        });

        this.createButton(width / 2, 400, 'Unirse como Cliente', () => {
            this.joinAsClient();
        });

        // ── Error text ───────────────────────────────────────────
        this.errorText = this.add.text(width / 2, 480, '', {
            fontSize: '14px',
            color: '#ff6b6b',
            fontFamily: 'monospace',
            wordWrap: { width: 400 },
        }).setOrigin(0.5);

        // Placeholder
        if (!this.nameValue) {
            this.nameInput?.setText('Escribe tu nombre...');
            this.nameInput?.setColor('#666666');
        }
    }

    private startAsServer(): void {
        const name = this.nameValue.trim();
        if (name.length === 0 || name.length > 20) {
            this.showError('Nombre inválido (1-20 caracteres)');
            return;
        }

        setPlayerName(name);
        setIsServer(true);

        this.gameServer = new GameServer(name, {
            onPhaseChange: () => {},
            onPlayersUpdate: () => {},
            onCountdown: () => {},
            onStart: () => {},
            onGameOver: () => {},
        });

        this.gameServer.start(8889);

        this.scene.start('LobbyScene', {
            gameServer: this.gameServer,
            isServer: true,
        });
    }

    private joinAsClient(): void {
        const name = this.nameValue.trim();
        if (name.length === 0 || name.length > 20) {
            this.showError('Nombre inválido (1-20 caracteres)');
            return;
        }

        setPlayerName(name);
        setIsServer(false);

        this.scene.start('DiscoveryScene');
    }

    private showError(msg: string): void {
        if (this.errorText) {
            this.errorText.setText(msg);
            this.time.delayedCall(3000, () => {
                this.errorText?.setText('');
            });
        }
    }

    private createButton(x: number, y: number, label: string, onClick: () => void): void {
        const bg = this.add.rectangle(x, y, 280, 55, 0x16213e)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, label, {
            fontSize: '20px',
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
