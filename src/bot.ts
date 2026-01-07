import 'dotenv/config';
import Mineflayer from 'mineflayer';
import { sleep, getRandom } from "./utils.ts";
import CONFIG from "../config.json" with {type: 'json'};

let loop: NodeJS.Timer;
let bot: Mineflayer.Bot;
let isReconnecting = false; // Prevent multiple reconnect attempts

// Runtime config that can be changed via HTTP API
let runtimeConfig = {
        host: process.env.MC_HOST || CONFIG.client.host,
        port: process.env.MC_PORT || CONFIG.client.port,
        username: process.env.BOT_USERNAME || CONFIG.client.username,
};

const retryDelay = process.env.RETRY_DELAY ? +process.env.RETRY_DELAY : CONFIG.action.retryDelay;
const initialRetryDelay = process.env.INITIAL_RETRY_DELAY ? +process.env.INITIAL_RETRY_DELAY : 60000;

// Export function to update config at runtime (called from web.ts)
export const updateConfig = (newConfig: { host?: string; port?: string; username?: string }) => {
        if (newConfig.host) runtimeConfig.host = newConfig.host;
        if (newConfig.port) runtimeConfig.port = newConfig.port;
        if (newConfig.username) runtimeConfig.username = newConfig.username;
        console.log(`[CONFIG] Updated: ${JSON.stringify(runtimeConfig)}`);
};

// Export function to restart the bot (called from web.ts)
export const restartBot = () => {
        console.log('[BOT] Restarting with new config...');
        isReconnecting = false; // Reset flag for manual restart
        disconnect();
        createBot();
};

export const getStatus = () => ({
        connected: bot?.entity ? true : false,
        username: bot?.username || null,
        config: runtimeConfig,
});

const disconnect = (): void => {
        clearInterval(loop);
        if (bot) {
                bot.removeAllListeners();
                bot?.quit?.();
                bot?.end?.();
        }
};

const scheduleReconnect = async (delay: number, reason: string): Promise<void> => {
        if (isReconnecting) {
                console.log('[BOT] Reconnect already scheduled, skipping...');
                return;
        }
        
        isReconnecting = true;
        console.log(`[BOT] ${reason}. Reconnecting in ${delay / 1000}s...`);
        
        disconnect();
        await sleep(delay);
        
        isReconnecting = false;
        createBot();
};

const createBot = (): void => {
        console.log(`[BOT] Connecting to ${runtimeConfig.host}:${runtimeConfig.port} as ${runtimeConfig.username}...`);
        
        bot = Mineflayer.createBot({
                host: runtimeConfig.host,
                port: +runtimeConfig.port,
                username: runtimeConfig.username
        } as const);

        let hasConnected = false;

        bot.once('error', (error) => {
                console.error(`[ERROR] ${error}`);
                
                if (!hasConnected) {
                        // Initial connection failed - use longer delay
                        scheduleReconnect(initialRetryDelay, 'Initial connection failed');
                }
                // If already connected, the 'end' event will handle reconnection
        });
        
        bot.once('kicked', rawResponse => {
                console.log(`[KICKED] ${rawResponse}`);
        });
        
        bot.once('end', (reason) => {
                console.log(`[DISCONNECTED] ${reason || 'Connection ended'}`);
                
                if (hasConnected) {
                        // Was connected before, use shorter delay
                        scheduleReconnect(retryDelay, 'Disconnected from server');
                }
                // If never connected, 'error' handler already scheduled reconnect
        });

        bot.once('spawn', () => {
                hasConnected = true;
                
                const changePos = async (): Promise<void> => {
                        const lastAction = getRandom(CONFIG.action.commands) as Mineflayer.ControlState;
                        const halfChance: boolean = Math.random() < 0.5;

                        console.debug(`[ACTION] ${lastAction}${halfChance ? " with sprinting" : ''}`);

                        bot.setControlState('sprint', halfChance);
                        bot.setControlState(lastAction, true);

                        await sleep(CONFIG.action.holdDuration);
                        bot.clearControlStates();
                };
                
                const changeView = async (): Promise<void> => {
                        const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI),
                                pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
                        
                        await bot.look(yaw, pitch, false);
                };
                
                loop = setInterval(() => {
                        changeView();
                        changePos();
                }, CONFIG.action.holdDuration);
        });
        
        bot.once('login', () => {
                hasConnected = true;
                console.log(`[LOGIN] ${bot.username} connected successfully`);
        });
};



export default (): void => {
        createBot();
};