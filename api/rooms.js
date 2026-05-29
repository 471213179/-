// api/rooms.js

let rooms = new Map();

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 获取房间
    if (req.method === 'GET') {
        const { roomId } = req.query;

        if (roomId && rooms.has(roomId)) {
            return res.status(200).json({
                success: true,
                room: rooms.get(roomId)
            });
        }

        return res.status(200).json({
            success: false
        });
    }

    // POST
    if (req.method === 'POST') {
        const {
            roomId,
            roomName,
            currentTime,
            isPlaying,
            videoUrl,
            action,
            clientId
        } = req.body;

        // cleanup
        if (action === 'cleanup') {
            const now = Date.now();

            for (const [rid, room] of rooms.entries()) {
                if (room.clients) {
                    for (const [cid, lastSeen] of room.clients.entries()) {
                        if (now - lastSeen > 10000) {
                            room.clients.delete(cid);
                        }
                    }

                    room.viewers = room.clients.size;

                    if (room.viewers <= 0) {
                        rooms.delete(rid);
                    } else {
                        rooms.set(rid, room);
                    }
                }
            }

            return res.status(200).json({
                success: true
            });
        }

        if (!roomId) {
            return res.status(400).json({
                error: 'roomId required'
            });
        }

        // 创建房间
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                roomId,
                roomName: roomName || `房间 ${roomId}`,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl:
                    videoUrl ||
                    'https://media.w3.org/2010/05/sintel/trailer.mp4',
                viewers: 1,
                currentMaster: clientId,
                clients: new Map([[clientId, Date.now()]]),
                createdAt: Date.now(),
                lastUpdate: Date.now()
            });
        }

        const room = rooms.get(roomId);

        // 更新客户端
        if (!room.clients) {
            room.clients = new Map();
        }

        room.clients.set(clientId, Date.now());

        room.viewers = room.clients.size;

        // 实时同步
        room.currentMaster = clientId;
        room.currentTime = currentTime;
        room.isPlaying = isPlaying;
        room.videoUrl = videoUrl;
        room.lastUpdate = Date.now();

        rooms.set(roomId, room);

        return res.status(200).json({
            success: true,
            room
        });
    }

    // DELETE
    if (req.method === 'DELETE') {
        const { roomId, clientId } = req.body;

        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);

            if (room.clients) {
                room.clients.delete(clientId);

                room.viewers = room.clients.size;

                if (room.viewers <= 0) {
                    rooms.delete(roomId);
                } else {
                    rooms.set(roomId, room);
                }
            }
        }

        return res.status(200).json({
            success: true
        });
    }

    return res.status(405).json({
        error: 'Method not allowed'
    });
}
