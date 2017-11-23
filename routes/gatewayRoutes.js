let router = require('express').Router();
router.post('/status-update', async (req, res) => {
    if (!req.body.status) {
        return res.status(400).json({message: 'missing status'});
    }
    try {
        if (req.body.shard_id || req.body.shard_id === 0) {
            await req.bot.shardStatusUpdate(req.body.shard_id, {
                status: req.body.status,
                game: req.body.game
            });
        } else {
            await req.bot.statusUpdate({
                status: req.body.status,
                game: req.body.game
            });
        }
    } catch (e) {
        return res.status(500).json({message: 'internal server error', error: e.toString()});
    }
    return res.status(200).json({message: 'Updated status'});
});
router.post('/voice-state-update', async (req, res) => {
    if (!req.body.shard_id && req.body.shard_id !== 0) {
        return res.status(400).json({message: 'missing shard_id'});
    }
    if (!req.body.guild_id) {
        return res.status(400).json({message: 'missing guild_id'});
    }
    try {
        await req.bot.voiceStateUpdate(req.body.shard_id, {
            guild_id: req.body.guild_id,
            channel_id: req.body.channel_id,
            self_deaf: req.body.self_deaf,
            self_mute: req.body.self_mute
        });
    } catch (e) {
        return res.status(500).json({message: 'internal error', error: e.toString()});
    }
    return res.status(200).json({message: 'successfully sent payload'});
});
router.post('/request-guild-members', async (req, res) => {
    if (!req.body.shard_id && req.body.shard_id !== 0) {
        return res.status(400).json({message: 'missing shard_id'});
    }
    if (!req.body.guild_id) {
        return res.status(400).json({message: 'missing guild_id'});
    }
    try {
        await req.bot.requestGuildMembers(req.body.shard_id, {
            guild_id: req.body.guild_id,
            limit: req.body.limit,
            query: req.body.query
        });
    } catch (e) {
        return res.status(500).json({message: 'internal error', error: e.toString()});
    }
    return res.status(200).json({message: 'successfully sent payload'});
});
module.exports = router;