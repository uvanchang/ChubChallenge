const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const nodeCleanup = require("node-cleanup");
const {User, UserList} = require("./user.js");
const utils = require("./utils.js");
require("dotenv").config();

const DiscordEvents = Discord.Constants.Events;
const DiscordIntents = Discord.Intents.FLAGS;

const client = new Discord.Client({
    intents: [DiscordIntents.GUILDS, DiscordIntents.GUILD_VOICE_STATES, DiscordIntents.GUILD_MESSAGES],
});

client.login(process.env.BOT_TOKEN);

client.once(DiscordEvents.CLIENT_READY, async () => {
    // Reset all JoinedTime to 0
    let users = new UserList(db);
    users.loadByNonZeroJoinedTime();

    users.list.forEach(user => {
        user.resetJoinedTime();
    });

    // Set all users currently in voice as joined
    let guilds = await client.guilds.fetch();

    guilds.forEach(async skimpGuild => {
        let guild = await client.guilds.fetch(skimpGuild.id);
        let channels = await guild.channels.fetch();

        channels.forEach(async channel => {
            // Only want voice channels that have users
            if (channel.type !== "GUILD_VOICE" || channel.members.size == 0) {
                return;
            }

            channel.members.forEach(member => {
                console.log(member.user.username + " in a call")

                let user = new User(db, member.user);
                user.joinVoice();
            });
        });
    });

    // Create the commands
    let commands
    
    let testGuild = client.guilds.cache.get("846186286918270996");
    if (testGuild) {
        commands = testGuild.commands;
    } else {
        commands = client.application.commands;
    }

    commands.create({
        name: "ccme",
        description: "See your CC stats.",
    });

    commands.create({
        name: "cctop",
        description: "See top 5 CC stats."
    });

    console.log("bot is ready!");
});

client.on(DiscordEvents.INTERACTION_CREATE, async (interaction) => {
    if (!interaction.isCommand()) {
        return;
    }

    const { commandName, options } = interaction;
    switch (commandName) {
        case "ccme":
            utils.refreshCCStats();

            let user = new User(db, interaction.user);

            interaction.reply({
                content: user.getVoiceTimeStr(),
            });

            break;
        case "cctop":
            utils.refreshCCStats();

            let users = new UserList(db);
            users.loadByTop5();

            let replyStr = "Top Voice Channel Losers\n";
            users.list.forEach((user, i) => {
                replyStr += `${i + 1}. ${user.getVoiceTimeStr()}\n`
            });

            interaction.reply({
                content: replyStr,
            });
            break;
        default:
            break;
    }
});

client.on(DiscordEvents.VOICE_STATE_UPDATE, async (oldVoiceState, newVoiceState) => {
    let discordUser = (await oldVoiceState.guild.members.fetch(oldVoiceState.id)).user;
    let user = new User(db, discordUser);

    if (!oldVoiceState.channelId) {
        // Joined the call
        console.log(discordUser.username + " joined a call");
        user.joinVoice();
    } else if (!newVoiceState.channelId) {
        // Left the call
        console.log(discordUser.username + " left a call");
        user.leaveVoice();
    }
});

nodeCleanup((exitCode, signal) => {
    console.log("Refreshing stats before stopping");
    utils.refreshCCStats();
});