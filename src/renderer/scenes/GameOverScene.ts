import Phaser from 'phaser';

export class GameOverScene extends Phaser.Scene {

    private timer = 5;
    private timerText: Phaser.GameObjects.Text | null = null;
    private isServer = false;

    constructor() {
        super({ key: 'GameOverScene' });
    }

    init(data: { winnerName: string; isServer: boolean }): void {
        this.isServer = data.isServer;
        this.registry.set('winnerName', data.winnerName);
    }

    create(): void {
        const { width, height } = this.scale;
        const winnerName = this.registry.get('winnerName') || '???';

        this.timer = 5;

        this.add.text(width / 2, height / 2 - 80, 'Game Over', {
            fontSize: '48px',
            color: '#ffcc00',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 - 20, `Ganador: ${winnerName}`, {
            fontSize: '24px',
            color: '#e0e0e0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.timerText = this.add.text(width / 2, height / 2 + 40, `Regresando al lobby en ${this.timer}...`, {
            fontSize: '16px',
            color: '#a0a0a0',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // ── Countdown timer ──────────────────────────────────────
        this.time.addEvent({
            delay: 1000,
            repeat: 4,
            callback: () => {
                this.timer--;
                if (this.timerText) {
                    this.timerText.setText(`Regresando al lobby en ${this.timer}...`);
                }
                if (this.timer <= 0) {
                    this.returnToLobby();
                }
            },
        });

        // ── Listen for lobby message (server broadcasts it) ──────
        if (this.isServer) {
            // Server will get its own lobby broadcast via GameServer
            // For now, just use the timer
        } else {
            const wc = (window as any).client;
            if (wc) {
                wc.onLobby(() => {
                    this.returnToLobby();
                });
            }
        }
    }

    private returnToLobby(): void {
        this.scene.start('LobbyScene', { isServer: this.isServer });
    }
}
