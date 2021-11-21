const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const {User, UserList} = require("./user.js");
require("dotenv").config();

const DiscordEvents = Discord.Constants.Events;

const client = new Discord.Client({
    partials: ['USER', 'MESSAGE', 'REACTION'],
    intents: ['GUILDS', 'GUILD_VOICE_STATES', 'GUILD_MESSAGES'],
});

client.login(process.env.BOT_TOKEN);

client.once(DiscordEvents.CLIENT_READY, async () => {
    // Reset all JoinedTime to 0
    let users = new UserList(db);
    users.loadByNonZeroJoinedTime();

    users.list.forEach(user => {
        console.log("reseting joined time")
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

                let user = new User(db, member.user.id);
                user.joinVoice(member.user);
            });
        });
    });

    console.log("bot is ready!");
});

// Message callback
client.on(DiscordEvents.MESSAGE_CREATE, async (message) => {
    const channel = message.channel;
    switch (message.content) {
        case "$ccme":
            let user = new User(db, message.author.id);

            channel.send(`${user.user.Username}: ${user.getVoiceTimeStr()}\n`)

            break;
        case "$cctop":
            let users = new UserList(db);
            users.loadByTop5();

            let replyStr = "Top Voice Channel Losers\n";
            users.list.forEach((user, i) => {
                replyStr += `${i + 1}. ${user.user.Username}: ${user.getVoiceTimeStr()}\n`
            });

            channel.send(replyStr);

            break;
        default:
            break;
    }
});

client.on(DiscordEvents.VOICE_STATE_UPDATE, async (oldVoiceState, newVoiceState) => {
    let discordUser = (await oldVoiceState.guild.members.fetch(oldVoiceState.id)).user;
    let user = new User(db, discordUser.id);

    if (!oldVoiceState.channelId) {
        // Joined the call
        console.log(discordUser.username + " joined a call");
        user.joinVoice(discordUser);
    } else if (!newVoiceState.channelId) {
        // Left the call
        console.log(discordUser.username + " left a call");
        user.leaveVoice(discordUser);
    }
});
