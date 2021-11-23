const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const nodeCleanup = require("node-cleanup");
const {User, UserList, refreshCCStats} = require("./user.js");
const {DeafenStatus} = require("./constants.js")
const interactions = require("./interactions.js");
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
    users.loadByNonZeroJoinedTimes();

    users.list.forEach(user => {
        user.resetJoinedTimes();
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

                if (channel.members.size == 1) {
                    // Start tracking alone time
                    user.joinVoiceAlone();
                }
            });
        });
    });

    // Create the commands
    let commands;
    
    let testGuild // = client.guilds.cache.get("846186286918270996");
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

    let content;

    const { commandName, options } = interaction;
    switch (commandName) {
        case "ccme":
            await interaction.deferReply();

            content = interactions.ccme(interaction);
            await interaction.editReply({
                content: content,
            });

            break;
        case "cctop":
            await interaction.deferReply();

            content = interactions.cctop();
            await interaction.editReply({
                content: content,
            });
            break;
        default:
            break;
    }
});

client.on(DiscordEvents.VOICE_STATE_UPDATE, async (oldVoiceState, newVoiceState) => {
    if (
        oldVoiceState.channelId == newVoiceState.channelId &&
        oldVoiceState.selfDeaf == newVoiceState.selfDeaf &&
        oldVoiceState.serverDeaf == newVoiceState.serverDeaf
        ) {
        // Only track following updates:
        // channel, deafen
        return;
    }

    let guild = oldVoiceState.guild,
        discordUser = (await guild.members.fetch(oldVoiceState.id)).user,
        user = new User(db, discordUser),
        deafenStatus = handleDeafenStatus(oldVoiceState, newVoiceState),
        oldChannel, newChannel;
    
    if (oldVoiceState.channelId) {
        oldChannel = await guild.channels.fetch(oldVoiceState.channelId)
    }

    if (newVoiceState.channelId) {
        newChannel = await guild.channels.fetch(newVoiceState.channelId);
    }

    if (!oldChannel || deafenStatus == DeafenStatus.UNDEAFENING) {
        // Joined the call
        console.log(discordUser.username + " joined a call");
        user.joinVoice();

        handleJoinAlone(newChannel, user, guild.afkChannelId);
    } else if (!newChannel || deafenStatus == DeafenStatus.DEAFENING) {
        // Left the call
        console.log(discordUser.username + " left a call");
        user.leaveVoice();
        user.leaveVoiceAlone();

        handleLeaveAlone(oldChannel, user, deafenStatus);
    } else if (!newVoiceState.selfDeaf && !newVoiceState.serverDeaf) {
        // Went from one call to another while undeafened
        console.log(discordUser.username + " joined another call");
        
        handleJoinAlone(newChannel, user, guild.afkChannelId);
        handleLeaveAlone(oldChannel, user, deafenStatus);
    }
});

nodeCleanup((exitCode, signal) => {
    console.log("Refreshing stats before stopping");
    refreshCCStats();
});

function handleJoinAlone(newChannel, user, afkChannelId, deafenStatus) {
    // Stop tracking alone time for user
    user.leaveVoiceAlone();
    
    if (newChannel.id == afkChannelId) {
        // Went AFK
        console.log(user.getUsername() + " went AFK");
        user.leaveVoice();
        return;
    }

    if (newChannel.members.size == 1) {
        // Start tracking alone time if going between channels and new channel is 1
        user.joinVoiceAlone();
    } else if (newChannel.members.size == 2) {
        // Stop tracking alone time for other user
        let otherMember = newChannel.members.find(member => {
            return member.user.id !== user.getUserID();
        });
        if (!otherMember) {
            return;
        }

        let otherDiscordUser = otherMember.user;

        let otherUser = new User(db, otherDiscordUser);
        otherUser.leaveVoiceAlone();
    }
}

function handleLeaveAlone(oldChannel, user, deafenStatus) {
    if (deafenStatus == DeafenStatus.DEAFENING) {
        console.log(user.getUsername() + " is deafening");
        return;
    }

    if (oldChannel.members.size == 1) {
        // Start tracking alone time for other user
        let otherMember = oldChannel.members.first();

        let otherDiscordUser = otherMember.user;

        let otherUser = new User(db, otherDiscordUser);
        otherUser.joinVoiceAlone();
    }
}

function handleDeafenStatus(oldVoiceState, newVoiceState) {
    if (
        !oldVoiceState.selfDeaf && newVoiceState.selfDeaf ||
        !oldVoiceState.serverDeaf && newVoiceState.serverDeaf
        ) {
        // Going to deafen
        return DeafenStatus.DEAFENING;
    } else if (
        oldVoiceState.selfDeaf && !newVoiceState.selfDeaf ||
        oldVoiceState.serverDeaf && !newVoiceState.serverDeaf
        ) {
        // Going to undeafen
        return DeafenStatus.UNDEAFENING;
    } else {
        return DeafenStatus.NO_DEAFEN;
    }
}