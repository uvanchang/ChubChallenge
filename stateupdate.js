const Discord = require("discord.js");
const db = require('better-sqlite3')('./data/myData.db');
const {User} = require("./user.js");

class StateUpdate {
    // StateUpdate Types
    static UNTRACKED = -1;
    static JOINING_CALL = 0;
    static LEAVING_CALL = 1;
    static TRANSFERING_CALL = 2;
    static DEAFENING = 3;
    static UNDEAFENING = 4;
    static GOING_AFK = 5;
    static GOING_UNAFK = 6;
    static START_STREAM = 7;
    static END_STREAM = 8;

    /**
     * @param {Discord.VoiceState} oldState 
     * @param {Discord.VoiceState} newState 
     */
    constructor(oldState, newState) {
        if (
            oldState.channelId == newState.channelId &&
            oldState.selfDeaf == newState.selfDeaf &&
            oldState.serverDeaf == newState.serverDeaf &&
            oldState.streaming == newState.streaming
        ) {
            // Only track following updates:
            // channel, deafen, streaming
            this.type = StateUpdate.UNTRACKED;
            return;
        }

        this.oldState = oldState;
        this.newState = newState;
        this.guild = oldState.guild;
    }

    async init() {
        let discordMember = await this.guild.members.fetch(this.oldState.id);
        this.user = new User(db, discordMember);

        if (this.oldState.channelId) {
            this.oldChannel = await this.guild.channels.fetch(this.oldState.channelId);
        }
    
        if (this.newState.channelId) {
            this.newChannel = await this.guild.channels.fetch(this.newState.channelId);
        }

        // Set type
        if (!this.oldState.streaming && this.newState.streaming) {
            this.type = StateUpdate.START_STREAM;
        } else if (this.oldState.streaming && !this.newState.streaming) {
            this.type = StateUpdate.END_STREAM;
        } else if (!this.oldState.deaf && this.newState.deaf) {
            this.type = StateUpdate.DEAFENING;
        } else if (this.oldState.deaf && !this.newState.deaf) {
            this.type = StateUpdate.UNDEAFENING;
        } else if (!this.oldChannel) {
            this.type = StateUpdate.JOINING_CALL;
        } else if (!this.newChannel) {
            this.type = StateUpdate.LEAVING_CALL;
        } else if (this.newChannel.id === this.guild.afkChannelId) {
            this.type = StateUpdate.GOING_AFK;
        } else if (this.oldChannel.id === this.guild.afkChannelId) {
            this.type = StateUpdate.GOING_UNAFK;
        } else {
            this.type = StateUpdate.TRANSFERING_CALL;
        }
    }

    handle() {
        switch (this.type) {
            case StateUpdate.JOINING_CALL:
            case StateUpdate.UNDEAFENING:
                this.user.stopDeaf();
                
            case StateUpdate.GOING_UNAFK:
                if (this.user.deaf) {
                    this.user.startDeaf();
                    return;
                }

                console.log(this.user.getUsername() + " joined a call");
                this.user.joinVoice();

                this.handleJoinAlone();

                break;

            case StateUpdate.LEAVING_CALL:
            case StateUpdate.GOING_AFK:
                console.log(this.user.getUsername() + " leaving a call");
                this.user.leaveVoice();
                this.user.leaveVoiceAlone();

                this.user.stopDeaf();

                this.handleLeaveAlone();

            case StateUpdate.END_STREAM:
                console.log(this.user.getUsername() + " ended stream");
                this.user.endStream();
                break;

            case StateUpdate.TRANSFERING_CALL:
                console.log(this.user.getUsername() + " joining another call");

                this.handleJoinAlone();
                this.handleLeaveAlone();
                
                break;

            case StateUpdate.DEAFENING:
                console.log(this.user.getUsername() + " deafening");
                this.user.leaveVoice();
                this.user.leaveVoiceAlone();

                this.user.startDeaf();

                break;
            
            case StateUpdate.START_STREAM:
                console.log(this.user.getUsername() + " started stream");
                this.user.startStream();
                break;

            default:
                console.log(this.user.getUsername() + " doing unknown action " + this.type);
                break;
        }
    }
    
    handleJoinAlone() {
        // Stop tracking alone time for user
        this.user.leaveVoiceAlone();

        let newMembers = this.getValidMembers(this.newChannel.members);
        if (newMembers.length == 1) {
            // Start tracking alone time if going between channels and new channel is 1
            this.user.joinVoiceAlone();
        } else if (newMembers.length == 2) {
            // Stop tracking alone time for other user
            let otherMember = newMembers.find(member => {
                return member.user.id !== this.user.getUserID();
            });

            let otherUser = new User(db, otherMember);
            otherUser.leaveVoiceAlone();
        }
    }

    handleLeaveAlone() {
        let oldMembers = this.getValidMembers(this.oldChannel.members);
        if (oldMembers.length == 1) {
            // Start tracking alone time for other user
            let otherMember = oldMembers[0];
            let otherUser = new User(db, otherMember);
            otherUser.joinVoiceAlone();
        }
    }

    /**
     * @param {Discord.Collection<string, Discord.GuildMember} members 
     * @returns {Discord.GuildMember[]}
     */
    getValidMembers(members) {
        let newMembers = members.reduce((newMembers, member) => {
            if (!member.voice.deaf) {
                newMembers.push(member);
            }
            return newMembers;
        }, []);
        return newMembers;
    }
}

module.exports = {StateUpdate};