let express = require('express');
let bodyParser = require('body-parser');
let amqp = require('amqp');
let config = require('./config/config.json');
let CloudStorm = require('cloudstorm').Client;
let app = express();
let bot = new CloudStorm(config.token, config.botConfig);
let shardRouter = require('./routes/shardStatusRoutes');
let gatewayRouter = require('./routes/gatewayRoutes');
const version = require('./package.json').version;
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use((req, res, next) => {
    req.bot = bot;
    next();
});
app.use('/shards', shardRouter);
app.use('/gateway', gatewayRouter);
app.all('/', (req, res) => {
    res.json({version: version, gatewayVersion: bot.version});
});
app.listen(config.port, config.host);
let connection = amqp.createConnection({host: 'localhost'});
connection.on('error', (e) => {
    console.error(e);
});
connection.on('ready', async () => {
    console.log('AMQP Connection ready');
    await bot.connect();
    bot.on('event', (event) => {
        connection.publish('test-pre-cache', event);
        // Event was sent to amqp queue, now you can use it somewhere else
    });
});
bot.on('ready', () => {
    console.log(`Bot is ready with ${Object.keys(bot.shardManager.shards).length} shards`);
});
// bot.on('debug', (debug) => {
//     console.log(debug);
// });
// bot.on('rawReceive', (event) => {
//     console.log(event);
// });
// bot.on('rawSend', (send) => {
//     console.log(send);
// });
// bot.on('event', (event) => {
//     console.log(event);
// });


console.log(`Server listening on ${config.host}:${config.port}`);