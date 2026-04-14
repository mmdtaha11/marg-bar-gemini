const { WebSocketServer } = require('ws');
const net = require('net');

const wss = new WebSocketServer({ noServer: true });

export default function handler(req, res) {
    if (!req.socket.server.wss) {
        req.socket.server.wss = wss;
        req.socket.server.on('upgrade', (request, socket, head) => {
            wss.handleUpgrade(request, socket, head, ws => {
                wss.emit('connection', ws, request);
            });
        });
    }

    wss.on('connection', (ws) => {
        ws.once('message', (msg) => {
            try {
                const buffer = Buffer.from(msg);
                const version = buffer[0];
                const id = buffer.slice(1, 17);
                
                // چک کردن پسورد (UUID)
                const envUUID = (process.env.UUID || '').replace(/-/g, '').toLowerCase();
                const clientUUID = id.toString('hex').toLowerCase();
                if (envUUID && envUUID !== clientUUID) {
                    ws.close();
                    return;
                }
                
                let i = 17;
                const optLen = buffer[i++];
                i += optLen; 
                
                const cmd = buffer[i++];
                if (cmd !== 1) { ws.close(); return; } 
                
                const port = buffer.readUInt16BE(i);
                i += 2;
                
                const addrType = buffer[i++];
                let addr = '';
                if (addrType === 1) { 
                    addr = buffer.slice(i, i + 4).join('.');
                    i += 4;
                } else if (addrType === 2) { 
                    const len = buffer[i++];
                    addr = buffer.slice(i, i + len).toString('utf8');
                    i += len;
                } else {
                    ws.close(); return; 
                }

                const remote = net.connect(port, addr, () => {
                    ws.send(Buffer.from([version, 0])); 
                });

                remote.on('data', data => ws.send(data));
                ws.on('message', data => remote.write(data));
                remote.on('error', () => ws.close());
                ws.on('close', () => remote.destroy());

            } catch (err) {
                ws.close();
            }
        });
    });

    if (req.headers.upgrade !== 'websocket') {
        res.status(200).send('Marg-bar-gemini Server is UP and Running! 😂');
    }
}
