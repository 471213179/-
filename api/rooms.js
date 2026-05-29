// api/rooms.js - 房间管理 API
let rooms = new Map(); // 内存存储，Vercel 无服务器环境需要注意

export default function handler(req, res) {
    // 允许跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GET - 获取所有房间
    if (req.method === 'GET') {
        const roomList = Array.from(rooms.values()).map(room => ({
            roomId: room.roomId,
            roomName: room.roomName,
            currentTime: room.currentTime,
            isPlaying: room.isPlaying,
            videoUrl: room.videoUrl,
            viewers: room.viewers,
            createdAt: room.createdAt,
            lastUpdate: room.lastUpdate
        }));
        return res.status(200).json(roomList);
    }
    
    // POST - 创建或更新房间
    if (req.method === 'POST') {
        const { roomId, roomName, currentTime, isPlaying, videoUrl, action } = req.body;
        
        if (action === 'heartbeat') {
            // 心跳更新
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                room.currentTime = currentTime;
                room.isPlaying = isPlaying;
                room.videoUrl = videoUrl;
                room.lastUpdate = Date.now();
                rooms.set(roomId, room);
            }
            return res.status(200).json({ success: true });
        }
        
        if (!rooms.has(roomId)) {
            rooms.set(roomId, {
                roomId,
                roomName: roomName || `房间 ${roomId.slice(-4)}`,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl: videoUrl || 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                viewers: 1,
                createdAt: Date.now(),
                lastUpdate: Date.now()
            });
        } else {
            const room = rooms.get(roomId);
            room.currentTime = currentTime;
            room.isPlaying = isPlaying;
            room.videoUrl = videoUrl;
            room.lastUpdate = Date.now();
            rooms.set(roomId, room);
        }
        
        return res.status(200).json({ success: true, room: rooms.get(roomId) });
    }
    
    // DELETE - 删除房间
    if (req.method === 'DELETE') {
        const { roomId } = req.body;
        if (rooms.has(roomId)) {
            rooms.delete(roomId);
        }
        return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}