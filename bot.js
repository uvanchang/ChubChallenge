const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const nodeCleanup = require("node-cleanup");
const {StateUpdate} = require("./stateupdate.js");
const {User, UserList, refreshCCStats} = require("./user.js");
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
            if (channel.type !== "GUILD_VOICE" || channel.members.size == 0 || channel.id == guild.afkChannelId) {
                return;
            }

            channel.members.forEach(member => {
                let user = new User(db, member);

                if (member.voice.streaming) {
                    console.log(user.getUsername() + " is streaming");
                    user.startStream();
                }

                if (member.voice.deaf) {
                    console.log(user.getUsername() + " is deaf");
                    user.startDeaf();
                    return;
                }

                console.log(user.getUsername() + " in a call");

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
    let stateUpdate = new StateUpdate(oldVoiceState, newVoiceState);
    if (stateUpdate.type != StateUpdate.UNTRACKED) {
        await stateUpdate.init();
        stateUpdate.handle();
    }
});

nodeCleanup((exitCode, signal) => {
    console.log("Refreshing stats before stopping");
    refreshCCStats();
});
