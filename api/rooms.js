// api/rooms.js - 房间管理 API
let rooms = new Map(); // 内存存储
let clients = new Map(); // 记录每个房间的客户端数量 { roomId: Set of clientIds }

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GET - 获取单个房间信息
    if (req.method === 'GET') {
        const { roomId } = req.query;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            return res.status(200).json({
                success: true,
                room: {
                    roomId: room.roomId,
                    roomName: room.roomName,
                    currentTime: room.currentTime,
                    isPlaying: room.isPlaying,
                    videoUrl: room.videoUrl,
                    viewers: room.viewers,
                    createdAt: room.createdAt,
                    lastUpdate: room.lastUpdate
                }
            });
        }
        // 返回所有房间
        const roomList = Array.from(rooms.values()).map(room => ({
            roomId: room.roomId,
            roomName: room.roomName,
            currentTime: room.currentTime,
            isPlaying: room.isPlaying,
            videoUrl: room.videoUrl,
            viewers: room.viewers
        }));
        return res.status(200).json(roomList);
    }
    
    // POST - 加入房间或心跳
    if (req.method === 'POST') {
        const { roomId, roomName, currentTime, isPlaying, videoUrl, action, clientId } = req.body;
        
        if (!roomId) {
            return res.status(400).json({ error: 'roomId required' });
        }
        
        // 心跳更新
        if (action === 'heartbeat') {
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                // 只有第一个心跳更新视频状态，避免频繁覆盖
                if (room.currentMaster === clientId) {
                    room.currentTime = currentTime;
                    room.isPlaying = isPlaying;
                    room.videoUrl = videoUrl;
                }
                room.lastUpdate = Date.now();
                // 更新客户端心跳时间
                if (!room.clients) room.clients = new Map();
                room.clients.set(clientId, Date.now());
                room.viewers = room.clients.size;
                rooms.set(roomId, room);
            }
            return res.status(200).json({ success: true });
        }
        
        // 加入房间
        if (!rooms.has(roomId)) {
            // 创建新房间，第一个加入的是房主
            rooms.set(roomId, {
                roomId,
                roomName: roomName || `房间 ${roomId.slice(-4)}`,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl: videoUrl || 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                viewers: 1,
                currentMaster: clientId,
                clients: new Map([[clientId, Date.now()]]),
                createdAt: Date.now(),
                lastUpdate: Date.now()
            });
        } else {
            const room = rooms.get(roomId);
            if (!room.clients) room.clients = new Map();
            room.clients.set(clientId, Date.now());
            room.viewers = room.clients.size;
            room.lastUpdate = Date.now();
            rooms.set(roomId, room);
        }
        
        return res.status(200).json({ success: true, room: rooms.get(roomId) });
    }
    
    // DELETE - 离开房间
    if (req.method === 'DELETE') {
        const { roomId, clientId } = req.body;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (room.clients) {
                room.clients.delete(clientId);
                room.viewers = room.clients.size;
                if (room.viewers === 0) {
                    // 没有客户端了，删除房间
                    rooms.delete(roomId);
                } else {
                    // 如果房主离开，选一个新房主
                    if (room.currentMaster === clientId && room.clients.size > 0) {
                        room.currentMaster = room.clients.keys().next().value;
                    }
                    rooms.set(roomId, room);
                }
            }
        }
        return res.status(200).json({ success: true });
    }
    
    // 清理过期客户端（每隔一段时间调用）
    if (req.method === 'POST' && req.body.action === 'cleanup') {
        const now = Date.now();
        for (const [roomId, room] of rooms.entries()) {
            if (room.clients) {
                for (const [cid, lastSeen] of room.clients.entries()) {
                    if (now - lastSeen > 10000) { // 10秒无心跳则移除
                        room.clients.delete(cid);
                    }
                }
                room.viewers = room.clients.size;
                if (room.viewers === 0) {
                    rooms.delete(roomId);
                } else if (room.currentMaster && !room.clients.has(room.currentMaster)) {
                    room.currentMaster = room.clients.keys().next().value;
                }
            }
        }
        return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}
