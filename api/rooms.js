import { Redis } from '@upstash/redis'

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default async function handler(req, res) {

    // 获取房间
    if (req.method === 'GET') {

        const { roomId } = req.query

        if (!roomId) {
            return res.status(400).json({
                success: false
            })
        }

        const room =
            await redis.get(`room:${roomId}`)

        return res.status(200).json({
            success: true,
            room: room || null
        })
    }

    // 创建 / 更新房间
    if (req.method === 'POST') {

        const {
            roomId,
            clientId,
            currentTime,
            isPlaying,
            videoUrl,
            isHost
        } = req.body

        if (!roomId) {
            return res.status(400).json({
                success: false
            })
        }

        let room =
            await redis.get(`room:${roomId}`)

        // 新房间
        if (!room) {

            room = {
                roomId,
                host: clientId,
                currentTime: currentTime || 0,
                isPlaying: isPlaying || false,
                videoUrl: videoUrl || '',
                viewers: 1,
                updatedAt: Date.now()
            }

        } else {

            // 只有房主可以更新状态
            if (room.host === clientId) {

                room.currentTime =
                    currentTime ?? room.currentTime

                room.isPlaying =
                    isPlaying ?? room.isPlaying

                room.videoUrl =
                    videoUrl ?? room.videoUrl

                room.updatedAt =
                    Date.now()
            }

            room.viewers = 2
        }

        // 保存 10 分钟
        await redis.set(
            `room:${roomId}`,
            room,
            {
                ex: 60 * 10
            }
        )

        return res.status(200).json({
            success: true,
            room
        })
    }

    // 删除房间
    if (req.method === 'DELETE') {

        const { roomId } = req.body

        if (!roomId) {
            return res.status(400).json({
                success: false
            })
        }

        await redis.del(`room:${roomId}`)

        return res.status(200).json({
            success: true
        })
    }

    return res.status(405).json({
        success: false
    })
}
