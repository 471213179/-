// api/rooms.js - Vercel 优化版
let rooms = new Map();

// 清理过期房间（每分钟）
setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
        if (now - room.lastHeartbeat > 15000) {
            rooms.delete(roomId);
        }
    }
}, 60000);

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GET - 获取房间状态（长轮询）
    if (req.method === 'GET') {
        const { roomId, lastUpdate } = req.query;
        
        if (!roomId || !rooms.has(roomId)) {
            return res.status(200).json({ success: false, room: null });
        }
        
        const room = rooms.get(roomId);
        const lastSync = parseInt(lastUpdate) || 0;
        
        // 如果没有更新，等待最多 2 秒（长轮询）
        if (room.lastUpdate <= lastSync && room.viewers > 1) {
            // 长轮询：等待更新
            const timeout = setTimeout(() => {
                res.status(200).json({
                    success: true,
                    room: {
                        currentTime: room.currentTime,
                        isPlaying: room.isPlaying,
                        videoUrl: room.videoUrl,
                        viewers: room.viewers,
                        masterId: room.masterId,
                        lastUpdate: room.lastUpdate
                    }
                });
            }, 2000);
            
            // 如果期间有更新，提前返回
            const checkInterval = setInterval(() => {
                if (room.lastUpdate > lastSync) {
                    clearTimeout(timeout);
                    clearInterval(checkInterval);
                    res.status(200).json({
                        success: true,
                        room: {
                            currentTime: room.currentTime,
                            isPlaying: room.isPlaying,
                            videoUrl: room.videoUrl,
                            viewers: room.viewers,
                            masterId: room.masterId,
                            lastUpdate: room.lastUpdate
                        }
                    });
                }
            }, 50);
            return;
        }
        
        return res.status(200).json({
            success: true,
            room: {
                currentTime: room.currentTime,
                isPlaying: room.isPlaying,
                videoUrl: room.videoUrl,
                viewers: room.viewers,
                masterId: room.masterId,
                lastUpdate: room.lastUpdate
            }
        });
    }
    
    // POST - 更新房间状态
    if (req.method === 'POST') {
        const { roomId, clientId, currentTime, isPlaying, videoUrl, action, roomName } = req.body;
        
        if (!roomId || !clientId) {
            return res.status(400).json({ error: 'roomId and clientId required' });
        }
        
        // 心跳
        if (action === 'heartbeat') {
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                if (room.masterId === clientId) {
                    room.currentTime = currentTime;
                    room.isPlaying = isPlaying;
                    if (videoUrl) room.videoUrl = videoUrl;
                    room.lastUpdate = Date.now();
                }
                room.lastHeartbeat = Date.now();
                rooms.set(roomId, room);
            }
            return res.status(200).json({ success: true });
        }
        
        // 加入房间
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                roomId,
                roomName: roomName || `房间 ${roomId.slice(-4)}`,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl: videoUrl || 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                viewers: 1,
                masterId: clientId,
                clients: new Set([clientId]),
                createdAt: Date.now(),
                lastUpdate: Date.now(),
                lastHeartbeat: Date.now()
            });
        } else {
            const room = rooms.get(roomId);
            if (!room.clients.has(clientId)) {
                room.clients.add(clientId);
                room.viewers = room.clients.size;
            }
            room.lastHeartbeat = Date.now();
            rooms.set(roomId, room);
        }
        
        return res.status(200).json({ 
            success: true, 
            isMaster: rooms.get(roomId).masterId === clientId,
            room: rooms.get(roomId)
        });
    }
    
    // DELETE - 离开房间
    if (req.method === 'DELETE') {
        const { roomId, clientId } = req.body;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.clients.delete(clientId);
            room.viewers = room.clients.size;
            
            if (room.masterId === clientId && room.viewers > 0) {
                room.masterId = Array.from(room.clients)[0];
            }
            
            if (room.viewers === 0) {
                rooms.delete(roomId);
            } else {
                rooms.set(roomId, room);
            }
        }
        return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}
