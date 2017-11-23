let router = require('express').Router();
router.get('/status', (req, res) => {
    let shards = Object.keys(req.bot.shardManager.shards);
    for (let i = 0; i < shards.length; i++) {
        shards[i] = {
            id: req.bot.shardManager.shards[shards[i]].id,
            status: req.bot.shardManager.shards[shards[i]].connector.status,
            ready: req.bot.shardManager.shards[shards[i]].ready,
            trace: req.bot.shardManager.shards[shards[i]].connector._trace,
            seq: req.bot.shardManager.shards[shards[i]].connector.seq
        };
    }
    return res.status(200).json({shards, endpoint: req.bot.options.endpoint});
});
router.get('/queue', (req, res) => {
    let queue = req.bot.shardManager.connectQueue;
    queue = queue.map(shard => ({id: shard.id}));
    return res.status(200).json({queue, lastConnect: req.bot.shardManager.lastConnectionAttempt});
});
router.get('/:id', (req, res) => {
    let shard = req.bot.shardManager.shards[req.params.id];
    if (!shard) {
        return res.status(404).json({status: 404, message: `Shard ${req.params.id} does not exist`});
    }
    let shardData = {
        id: shard.id,
        status: shard.connector.status,
        ready: shard.ready,
        trace: shard.connector._trace,
        seq: shard.connector.seq
    };
    return res.status(200).json(shardData);
});

module.exports = router;