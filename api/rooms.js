// api/rooms.js - 房间管理 API
let rooms = new Map();

export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // GET - 获取房间信息
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
                    masterId: room.masterId
                }
            });
        }
        return res.status(200).json([]);
    }
    
    // POST - 加入/心跳/更新
    if (req.method === 'POST') {
        const { roomId, roomName, currentTime, isPlaying, videoUrl, action, clientId } = req.body;
        
        if (!roomId || !clientId) {
            return res.status(400).json({ error: 'roomId and clientId required' });
        }
        
        // 心跳
        if (action === 'heartbeat') {
            if (rooms.has(roomId)) {
                const room = rooms.get(roomId);
                // 只有房主才能更新房间状态
                if (room.masterId === clientId) {
                    room.currentTime = currentTime;
                    room.isPlaying = isPlaying;
                    if (videoUrl) room.videoUrl = videoUrl;
                }
                // 更新心跳时间
                if (!room.heartbeats) room.heartbeats = {};
                room.heartbeats[clientId] = Date.now();
                room.viewers = Object.keys(room.heartbeats).length;
                rooms.set(roomId, room);
            }
            return res.status(200).json({ success: true });
        }
        
        // 加入房间
        if (!rooms.has(roomId)) {
            // 创建房间，第一个加入的是房主
            rooms.set(roomId, {
                roomId,
                roomName: roomName || `房间 ${roomId.slice(-4)}`,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl: videoUrl || 'https://media.w3.org/2010/05/sintel/trailer.mp4',
                viewers: 1,
                masterId: clientId,
                heartbeats: { [clientId]: Date.now() },
                createdAt: Date.now()
            });
        } else {
            const room = rooms.get(roomId);
            if (!room.heartbeats) room.heartbeats = {};
            room.heartbeats[clientId] = Date.now();
            room.viewers = Object.keys(room.heartbeats).length;
            rooms.set(roomId, room);
        }
        
        return res.status(200).json({ success: true, room: rooms.get(roomId) });
    }
    
    // DELETE - 离开房间
    if (req.method === 'DELETE') {
        const { roomId, clientId } = req.body;
        if (roomId && rooms.has(roomId)) {
            const room = rooms.get(roomId);
            if (room.heartbeats) {
                delete room.heartbeats[clientId];
                room.viewers = Object.keys(room.heartbeats).length;
                
                // 如果房主离开，转让给其他人
                if (room.masterId === clientId && room.viewers > 0) {
                    const newMaster = Object.keys(room.heartbeats)[0];
                    room.masterId = newMaster;
                }
                
                if (room.viewers === 0) {
                    rooms.delete(roomId);
                } else {
                    rooms.set(roomId, room);
                }
            }
        }
        return res.status(200).json({ success: true });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
}
