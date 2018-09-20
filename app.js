const VERSION = '1.5.0';

var Discord = require('discord.js');
var env = require('node-env-file');
var isset = require('isset');
var empty = require('empty');
var md5 = require('md5');
var rs = require('random-string');
var uptimer = require('uptimer');
var checksum = require('checksum');
var path = require('path');
var request = require('request');

var App = {

    // Discord
    Discord: {
        presence: 'with Toy Sword | @nephilimboy',                        // Presence to display on the bot
        client: {},
    },

    // Dynamic Channel Name
    DynamicChannelName: {
        enabled: true,                         // Enable Dynamic Channel Name (dry-run or not)
        channelPrefix: '~ ',                    // Only process channels with this prefix
        defaultChannelName: 'Room',             // Default channel name
        defaultChannelNameEmpty: 'Room',        // Default empty channel name
        minPresenceDominanceProcentage: 50,     // Minimum procentage condition before changing channel name
        minParticipant: 0,                      // Minimum of participant in a channel before changing channel name
        maxChannelSpawn: 10,                    // @todo
        maxChannelNameLength: 14,               // Maximum generated channel name length (excluding prefix and room number)
    },

    // Logger
    logger: {
        enabled: true,
        service: {
            discord: {
                enabled: true,                  // Log to Discord
                channel: 'bot-log'              // Log to text channel name
            }
        }
    },

    // Instance
    instance: {
        keepalive: {
            enabled: true,
            interval: 60
        }
    },

    version: VERSION,

    // Run
    run: function (options, callback) {

        // Setup Application
        App.setup();

        // Construct Discord.client()
        App.Discord.client = new Discord.Client();

        // Discord token
        App.Discord.token = (process.env.DISCORD_TOKEN) ? process.env.DISCORD_TOKEN : false;

        if (!App.Discord.token) {
            App.log('!! Discord token is not defined (DISCORD_TOKEN).');

            process.exit();
        }

        // Login using token
        App.Discord.client.login(App.Discord.token);

        // Client ready
        App.Discord.client.on('ready', function () {
            App.log('** Discord is ready (' + App.Discord.client.user.tag + ')');

            // Set App.Discord.client information
            App.Discord.client.user.setGame(App.Discord.presence);

            // Run callback
            if (typeof callback == "function") {
                callback(options);
            }
        });

        /*
         * Run Event
         */
        App.Discord.client.on('ready', function (statusBefore, statusAfter) {

            App.DynamicChannelName.loop(App.Discord.client, statusAfter);
        });

        /*
         * Message Event
         */
        App.Discord.client.on('message', function (message) {

            App.handleMessage(App.Discord.client, message);
        });

    },

    setup: function () {

        // Only run once
        if (isset(App.Discord.setupCompleted)) return;

        // Process environment variables
        env(__dirname + '/.env');

        // Application logger
        App.log = function (data = null, options = null) {
            options = Object.assign({}, {
                discord: false
            }, options);

            // Log
            console.log(data);

            // Discord logging
            if (isset(App.channelProcessingisReady) && App.logger.service.discord.enabled && options.discord)
                App.logger.service.discord.channelObject.sendMessage(data, {});
        };

        App.log('** Starting instance');

        // Application file name
        App.instance.file = path.basename(__filename);

        // Application instance id
        App.instance.id = '#' + md5(rs()).substring(0, 5);

        // Application checksum
        App.instance.checksum = checksum.file(path.basename(__filename), function (err, checksum) {
            if (err) App.log(err);
            App.instance.checksum = checksum;

            App.log('** Instance id ' + App.instance.id + ' (Checksum: ' + App.instance.checksum + ')');
        });

        // Application uptime
        App.instance.uptime = 0;
        setInterval(function () {
            App.instance.uptime = Math.round(uptimer.getAppUptime(), 0) + ' seconds';
        }, 1000);

        // Keep-alive
        App.instance.keepalive.count = 0;
        setInterval(function () {
            if (App.instance.keepalive.enabled) {
                App.instance.keepalive.count++;
                App.log('** Keep-Alive ' + App.instance.keepalive.count + ' count/' + App.instance.keepalive.interval + ' sec.');
            }
        }, (App.instance.keepalive.interval * 1000));

        App.instance.setupCompleted = true;
    },

    // Handle Messages
    handleMessage: function (client, message) {

        // Block messages from log channel
        if (message.channel.name == App.logger.service.discord.channel) return;

        // Log inlogging message
        // App.log('[MESSAGE] ' + message.author.username + ' in ' + message.channel.name + ': ' + message.content);

        // Help
        if (message.content === '[*]help') {
            message.reply('[' + App.instance.id + '] Available commands: [*]ping, [*]uptime, [*]restart, [*]debug');

            return;
        }

        // Ping
        if (message.content === '[*]ping') {
            message.reply('[' + App.instance.id + '] Pong!');

            return;
        }

        // Uptime
        if (message.content === '[*]uptime') {
            message.reply('[' + App.instance.id + '] ' + App.instance.uptime);

            return;
        }

        // Debug
        if (message.content === '[*]debug') {
            message.reply('[' + App.instance.id + '] ' + ' Debug Information\n========================================\n\n:: App\nVersion: ' + App.version + '\n\n:: Instance\nId: ' + App.instance.id + '\nFile: ' + App.instance.file + '\nChecksum: ' + App.instance.checksum + '\nUptime = ' + App.instance.uptime + '\nKeep-Alive Count: ' + App.instance.keepalive.count + '\nKeep-Alive Interval: ' + App.instance.keepalive.interval + '\n\n:: Environment\nComputer Name: ' + process.env.COMPUTERNAME + '\n\n========================================');

            return;
        }

        // Restart
        if (message.content === '[*]restart') {
            message.reply('[' + App.instance.id + '] ' + ' Restarting...\n===============================\nYou may want to repool by requesting http://jeliasson-discord-bot.azurewebsites.net/');

            // Destory (logout App.Discord.client)
            App.Discord.client.destroy();

            // Delay reboot
            setTimeout(function () {
                App.run();
            }, 3000);

            return;
        }

        if (message.content === '[*]start') {
            App.DynamicChannelName.process(App.Discord.client, message);
            return;
        }

    }
};
App.DynamicChannelName.process = function (client, message) {
    var server = message.guild;

    // Create a new category channel with permission overwrites
    var isAlreadyCreated = false;
    server.channels.forEach(function (channel) {
        if (channel.name == "HI3 Server Current Time") {
            isAlreadyCreated = true;
            message.reply('[' + App.instance.id + '] Channels are Already created before');
        }
    });
    if (!isAlreadyCreated) {
        server.createChannel('HI3 Server Current Time', 'category')
            .then(function () {
                console.log;
                message.reply('[' + App.instance.id + '] Category HI3 Server Current Time created');
            })
            .catch(console.error);

        server.createChannel("🇺🇸->", 'voice').then(function () {
                message.reply('[' + App.instance.id + '] Channel 🇺🇸 created');
            }
        ).catch(console.error);

        server.createChannel("🇪🇺->", 'voice').then(function () {
                message.reply('[' + App.instance.id + '] Channel 🇪🇺 created');
            }
        ).catch(console.error);
    }
};


App.DynamicChannelName.loop = function (client, message) {
    var us_channel, eu_channel;
    setInterval(function () {
        App.Discord.client.channels.forEach(function (channel) {
            if (channel.name.split("->")[0] == "🇺🇸") {
                us_channel = channel;
            }
            else if (channel.name.split("->")[0] == "🇪🇺") {
                eu_channel = channel;
            }
        });

        if (us_channel != null && eu_channel != null) {
            var options = {
                url: 'http://api.timezonedb.com/v2.1/get-time-zone?key=xxxxx&format=json&by=zone&zone=America/Atikokan&fields=formatted'
            };

            function callback(error, response, body) {
                if (!error && response.statusCode == 200) {
                    var obj = JSON.parse(body);
                    us_channel.setName("🇺🇸-> ⏰ " + ((obj.formatted.split(" "))[1].split(":"))[0] + ":" + ((obj.formatted.split(" "))[1].split(":"))[1] + " " + obj.formatted.split(" ")[0])
                        .then(function () {
                            var options = {
                                url: 'http://api.timezonedb.com/v2.1/get-time-zone?key=xxxx&format=json&by=zone&zone=Europe/Guernsey&fields=formatted'
                            };

                            function callback(error, response, body) {
                                if (!error && response.statusCode == 200) {
                                    var obj = JSON.parse(body);
                                    eu_channel.setName("🇪🇺-> ⏰ " + ((obj.formatted.split(" "))[1].split(":"))[0] + ":" + ((obj.formatted.split(" "))[1].split(":"))[1] + " " + obj.formatted.split(" ")[0])
                                        .then()
                                        .catch(console.error);
                                }
                            }

                            request(options, callback);
                        })
                        .catch(console.error);
                }
            }

            request(options, callback);
        }


    }, 60000)
};

App.run();

var express = require('express');
var app = express();
var port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", function() {
    console.log("Listening on Port 3000");
});